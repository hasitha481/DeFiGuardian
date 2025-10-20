import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Smart Account schema
export const smartAccounts = pgTable("smart_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull().unique(),
  ownerAddress: text("owner_address").notNull(),
  balance: text("balance").notNull().default("0"),
  network: text("network").notNull().default("monad-testnet"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSmartAccountSchema = createInsertSchema(smartAccounts).omit({
  id: true,
  createdAt: true,
});

export type InsertSmartAccount = z.infer<typeof insertSmartAccountSchema>;
export type SmartAccount = typeof smartAccounts.$inferSelect;

// Risk Events schema (Approvals, Transfers detected by Envio)
export const riskEvents = pgTable("risk_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountAddress: text("account_address").notNull(),
  eventType: text("event_type").notNull(), // "approval" | "transfer"
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol"),
  spenderAddress: text("spender_address"), // For approvals
  amount: text("amount").notNull(),
  riskScore: integer("risk_score").notNull(), // 0-100
  riskLevel: text("risk_level").notNull(), // "low" | "medium" | "high"
  aiReasoning: text("ai_reasoning"),
  txHash: text("tx_hash"),
  blockNumber: text("block_number"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: text("status").notNull().default("detected"), // "detected" | "processing" | "revoked" | "ignored"
});

export const insertRiskEventSchema = createInsertSchema(riskEvents).omit({
  id: true,
  timestamp: true,
});

export type InsertRiskEvent = z.infer<typeof insertRiskEventSchema>;
export type RiskEvent = typeof riskEvents.$inferSelect;

// User Settings schema
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountAddress: text("account_address").notNull().unique(),
  riskThreshold: integer("risk_threshold").notNull().default(70), // Auto-revoke if risk > this
  autoRevokeEnabled: boolean("auto_revoke_enabled").notNull().default(false),
  whitelistedAddresses: jsonb("whitelisted_addresses").notNull().default([]), // Array of trusted contract addresses
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// Audit Log schema
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountAddress: text("account_address").notNull(),
  action: text("action").notNull(), // "revoke_approval" | "ignore_event" | "whitelist_address" | "update_settings"
  eventId: text("event_id"), // Reference to risk event if applicable
  details: jsonb("details"), // Additional context
  txHash: text("tx_hash"), // For on-chain actions
  status: text("status").notNull(), // "success" | "failed" | "pending"
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// API Response types
export interface RiskAnalysis {
  score: number; // 0-100
  level: "low" | "medium" | "high";
  reasoning: string;
  recommendations: string[];
}

export interface DashboardStats {
  totalEvents: number;
  highRiskEvents: number;
  autoRevoked: number;
  whitelistedContracts: number;
}

export interface WebSocketMessage {
  type: "new_event" | "event_updated" | "settings_updated" | "connection_status";
  data: any;
}
