import { envioClient } from './envio-client';
import { storage } from './storage';
import { analyzeRisk } from './ai-risk-analyzer';

const intervals = new Map<string, NodeJS.Timeout>();

export async function startMonitoringAddress(address: string) {
  const addr = address.toLowerCase();
  if (intervals.has(addr)) return; // already monitoring

  const tick = async () => {
    try {
      // Get latest approvals and transfers
      const [approvals, transfers] = await Promise.all([
        envioClient.getRecentApprovals(addr, 10),
        envioClient.getRecentTransfers(addr, 10),
      ]);

      const processApproval = async (ev: any) => {
        const exists = await storage.eventExists(addr, ev.transactionHash || null);
        if (exists) return;
        const risk = await analyzeRisk({
          eventType: 'approval',
          tokenSymbol: undefined,
          spenderAddress: ev.spender,
          amount: ev.value?.toString?.() ?? '0',
          accountAddress: addr,
          whitelistedAddresses: ((await storage.getUserSettings(addr))?.whitelistedAddresses as string[]) || [],
        });
        await storage.createRiskEvent({
          accountAddress: addr,
          eventType: 'approval',
          tokenAddress: ev.tokenAddress || '',
          tokenSymbol: undefined,
          spenderAddress: ev.spender,
          amount: ev.value?.toString?.() ?? '0',
          riskScore: risk.score,
          riskLevel: risk.level,
          aiReasoning: risk.reasoning,
          txHash: ev.transactionHash || undefined,
          blockNumber: String(ev.blockNumber ?? 0),
          status: 'detected',
        });
      };

      const processTransfer = async (ev: any) => {
        const exists = await storage.eventExists(addr, ev.transactionHash || null);
        if (exists) return;
        const risk = await analyzeRisk({
          eventType: 'transfer',
          tokenSymbol: undefined,
          spenderAddress: undefined,
          amount: ev.value?.toString?.() ?? '0',
          accountAddress: addr,
          whitelistedAddresses: ((await storage.getUserSettings(addr))?.whitelistedAddresses as string[]) || [],
        });
        await storage.createRiskEvent({
          accountAddress: addr,
          eventType: 'transfer',
          tokenAddress: ev.tokenAddress || '',
          tokenSymbol: undefined,
          spenderAddress: undefined,
          amount: ev.value?.toString?.() ?? '0',
          riskScore: risk.score,
          riskLevel: risk.level,
          aiReasoning: risk.reasoning,
          txHash: ev.transactionHash || undefined,
          blockNumber: String(ev.blockNumber ?? 0),
          status: 'detected',
        });
      };

      await Promise.all([
        ...approvals.map(processApproval),
        ...transfers.map(processTransfer),
      ]);
    } catch (e) {
      console.error('[monitor] tick error for', addr, e);
    }
  };

  // initial run then interval
  await tick();
  const handle = setInterval(tick, 10000);
  intervals.set(addr, handle);
}

export function stopMonitoringAddress(address: string) {
  const addr = address.toLowerCase();
  const h = intervals.get(addr);
  if (h) {
    clearInterval(h);
    intervals.delete(addr);
  }
}

export function stopAllMonitoring() {
  intervals.forEach((h) => clearInterval(h));
  intervals.clear();
}
