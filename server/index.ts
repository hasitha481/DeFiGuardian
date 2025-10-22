console.log("Executing server/index.ts");
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

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
