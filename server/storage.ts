import {
  type SmartAccount,
  type InsertSmartAccount,
  type RiskEvent,
  type InsertRiskEvent,
  type UserSettings,
  type InsertUserSettings,
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Smart Accounts
  getSmartAccount(address: string): Promise<SmartAccount | undefined>;
  createSmartAccount(account: InsertSmartAccount): Promise<SmartAccount>;
  updateSmartAccountBalance(address: string, balance: string): Promise<void>;

  // Risk Events
  getRiskEvents(accountAddress: string): Promise<RiskEvent[]>;
  getRiskEventsFor(addresses: string[]): Promise<RiskEvent[]>;
  getRiskEvent(id: string): Promise<RiskEvent | undefined>;
  createRiskEvent(event: InsertRiskEvent): Promise<RiskEvent>;
  updateRiskEventStatus(id: string, status: string): Promise<void>;
  eventExists(accountAddress: string, txHash: string | null, logIndex: number | null): Promise<boolean>;

  // User Settings
  getUserSettings(accountAddress: string): Promise<UserSettings | undefined>;
  upsertUserSettings(settings: InsertUserSettings): Promise<UserSettings>;

  // Audit Logs
  getAuditLogs(accountAddress: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
}

export class MemStorage implements IStorage {
  private smartAccounts: Map<string, SmartAccount>;
  private riskEvents: Map<string, RiskEvent>;
  private userSettings: Map<string, UserSettings>;
  private auditLogs: Map<string, AuditLog>;

  constructor() {
    this.smartAccounts = new Map();
    this.riskEvents = new Map();
    this.userSettings = new Map();
    this.auditLogs = new Map();
  }

  // Smart Accounts
  async getSmartAccount(address: string): Promise<SmartAccount | undefined> {
    return this.smartAccounts.get(address);
  }

  async createSmartAccount(
    insertAccount: InsertSmartAccount
  ): Promise<SmartAccount> {
    const id = randomUUID();
    const account: SmartAccount = {
      id,
      address: insertAccount.address,
      ownerAddress: insertAccount.ownerAddress,
      balance: insertAccount.balance || "0",
      network: insertAccount.network || "monad-testnet",
      createdAt: new Date(),
    };
    this.smartAccounts.set(account.address, account);
    return account;
  }

  async updateSmartAccountBalance(
    address: string,
    balance: string
  ): Promise<void> {
    const account = this.smartAccounts.get(address);
    if (account) {
      account.balance = balance;
      this.smartAccounts.set(address, account);
    }
  }

  // Risk Events
  async getRiskEvents(accountAddress: string): Promise<RiskEvent[]> {
    return Array.from(this.riskEvents.values())
      .filter((event) => event.accountAddress === accountAddress)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getRiskEventsFor(addresses: string[]): Promise<RiskEvent[]> {
    const set = new Set(addresses.map((a) => a.toLowerCase()));
    return Array.from(this.riskEvents.values())
      .filter((event) => set.has(event.accountAddress.toLowerCase()))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getRiskEvent(id: string): Promise<RiskEvent | undefined> {
    return this.riskEvents.get(id);
  }

  async createRiskEvent(insertEvent: InsertRiskEvent): Promise<RiskEvent> {
    const id = randomUUID();
    const event: RiskEvent = {
      id,
      accountAddress: insertEvent.accountAddress,
      eventType: insertEvent.eventType,
      tokenAddress: insertEvent.tokenAddress,
      tokenSymbol: insertEvent.tokenSymbol ?? null,
      spenderAddress: insertEvent.spenderAddress ?? null,
      amount: insertEvent.amount,
      riskScore: insertEvent.riskScore,
      riskLevel: insertEvent.riskLevel,
      aiReasoning: insertEvent.aiReasoning ?? null,
      txHash: insertEvent.txHash ?? null,
      blockNumber: insertEvent.blockNumber ?? null,
      status: insertEvent.status || "detected",
      timestamp: new Date(),
    };
    this.riskEvents.set(id, event);
    return event;
  }

  async updateRiskEventStatus(id: string, status: string): Promise<void> {
    const event = this.riskEvents.get(id);
    if (event) {
      event.status = status;
      this.riskEvents.set(id, event);
    }
  }

  async eventExists(accountAddress: string, txHash: string | null, logIndex: number | null): Promise<boolean> {
    if (!txHash || logIndex == null) return false;
    return Array.from(this.riskEvents.values()).some(
      (e) => e.accountAddress.toLowerCase() === accountAddress.toLowerCase() && e.txHash === txHash && e.logIndex === logIndex,
    );
  }

  // User Settings
  async getUserSettings(
    accountAddress: string
  ): Promise<UserSettings | undefined> {
    return this.userSettings.get(accountAddress);
  }

  async upsertUserSettings(
    insertSettings: InsertUserSettings
  ): Promise<UserSettings> {
    const existing = this.userSettings.get(insertSettings.accountAddress);
    const id = existing?.id || randomUUID();
    const settings: UserSettings = {
      id,
      accountAddress: insertSettings.accountAddress,
      riskThreshold: insertSettings.riskThreshold ?? 70,
      autoRevokeEnabled: insertSettings.autoRevokeEnabled ?? false,
      whitelistedAddresses: insertSettings.whitelistedAddresses ?? [],
      notificationsEnabled: insertSettings.notificationsEnabled ?? true,
      updatedAt: new Date(),
    };
    this.userSettings.set(settings.accountAddress, settings);
    return settings;
  }

  // Audit Logs
  async getAuditLogs(accountAddress: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter((log) => log.accountAddress === accountAddress)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const log: AuditLog = {
      id,
      accountAddress: insertLog.accountAddress,
      action: insertLog.action,
      status: insertLog.status,
      eventId: insertLog.eventId ?? null,
      txHash: insertLog.txHash ?? null,
      details: insertLog.details ?? {},
      timestamp: new Date(),
    };
    this.auditLogs.set(id, log);
    return log;
  }
}

export const storage = new MemStorage();
