import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("Registering dummy routes");
  const httpServer = createServer(app);
  return httpServer;
}
