import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS: allow requests from Builder preview and trusted fly.dev previews
const allowedOrigins = new Set<string>([
  "https://builder.io",
  // The Fly preview domain seen in logs — add specific preview host if known
  "https://cec21f27b18948d4812509f431fa07f5-0f144fc4168542bf9e7de4e3c.fly.dev",
  // Allow additional origins via environment variable ALLOWED_ORIGINS (comma-separated)
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean) : []),
]);

// If ALLOW_ALL_CORS or ENABLE_FLY_WILDCARD is true, echo any Origin
const allowAllCors = (process.env.ALLOW_ALL_CORS === 'true') || (process.env.ENABLE_FLY_WILDCARD === 'true');

app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (origin) {
    const normalized = origin.toLowerCase();
    const isAllowedExplicit = allowedOrigins.has(normalized) || allowedOrigins.has(origin);
    const isFly = normalized.endsWith('.fly.dev');
    const isBuilder = normalized === 'https://builder.io' || normalized.endsWith('.builder.io');
    const isNetlify = normalized.endsWith('.netlify.app') || normalized.endsWith('.netlify.live');

    if (allowAllCors || isAllowedExplicit || isFly || isBuilder || isNetlify) {
      // Echo back the incoming origin (more secure than using '*')
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,x-envio-secret');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      // Ensure caches differentiate responses based on Origin
      res.setHeader('Vary', 'Origin');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
    }
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
