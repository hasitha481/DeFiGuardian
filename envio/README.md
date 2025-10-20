# DeFi Guardian Agent - Envio HyperIndex Integration

This directory contains the Envio HyperIndex configuration for indexing ERC-20 token events (Approval and Transfer) on Monad testnet.

## Overview

**Envio HyperIndex** provides blazing-fast blockchain event indexing (10-100x faster than RPC) through HyperSync technology. This indexer monitors all ERC-20 token activity on Monad testnet to power the DeFi Guardian Agent's real-time risk analysis.

## Configuration Files

### `config.yaml`
Defines the indexer settings:
- **Network**: Monad testnet (Chain ID: 10143)
- **Events**: Transfer and Approval events
- **Start Block**: 0 (HyperSync auto-detects deployment)

### `schema.graphql`
Defines the data entities:
- **Transfer**: Token transfer events
- **Approval**: Token approval events
- **TokenHolder**: Aggregated holder statistics

### `src/EventHandlers.ts`
TypeScript event handlers that:
- Index Transfer and Approval events
- Update holder balances
- Track approval counts
- Maintain activity timestamps

## Setup Instructions

### Prerequisites
```bash
npm install -g envio
```

### 1. Generate Code
```bash
cd envio
pnpm envio codegen
```

This generates TypeScript types and database models from the schema.

### 2. Local Development
```bash
pnpm envio dev
```

Starts the indexer with:
- PostgreSQL database (via Docker)
- Real-time event indexing
- GraphQL playground at `http://localhost:8080`

### 3. Deploy to Hosted Service
```bash
pnpm envio deploy
```

Deploys to Envio's hosted service, providing a production GraphQL endpoint.

## GraphQL Queries

### Get Recent Approvals
```graphql
query RecentApprovals($limit: Int = 10) {
  Approval(limit: $limit, order_by: {timestamp: desc}) {
    id
    owner
    spender
    value
    blockNumber
    timestamp
    transactionHash
  }
}
```

### Get Recent Transfers
```graphql
query RecentTransfers($limit: Int = 10) {
  Transfer(limit: $limit, order_by: {timestamp: desc}) {
    id
    from
    to
    value
    blockNumber
    timestamp
  }
}
```

### Get Account Activity
```graphql
query AccountActivity($address: String!) {
  # Transfers from address
  sentTransfers: Transfer(
    where: {from: {_eq: $address}}
    order_by: {timestamp: desc}
  ) {
    to
    value
    timestamp
  }
  
  # Transfers to address
  receivedTransfers: Transfer(
    where: {to: {_eq: $address}}
    order_by: {timestamp: desc}
  ) {
    from
    value
    timestamp
  }
  
  # Approvals by address
  approvals: Approval(
    where: {owner: {_eq: $address}}
    order_by: {timestamp: desc}
  ) {
    spender
    value
    timestamp
  }
}
```

### Get Top Token Holders
```graphql
query TopHolders($limit: Int = 100) {
  TokenHolder(
    limit: $limit
    order_by: {balance: desc}
    where: {balance: {_gt: "0"}}
  ) {
    address
    balance
    approvalCount
    transferCount
    lastActivityTimestamp
  }
}
```

## Integration with DeFi Guardian

The DeFi Guardian backend consumes the Envio GraphQL API to:
1. Monitor real-time approval events
2. Analyze transfer patterns
3. Identify high-risk transactions
4. Trigger AI risk analysis
5. Execute automated revocations

See `server/envio-client.ts` for the integration implementation.

## Performance

- **Indexing Speed**: 10-100x faster than RPC polling
- **Latency**: <1 second for real-time events  
- **Historical Backfill**: Complete ERC-20 history in minutes
- **Cost**: Free tier available (hosted service)

## Resources

- **Envio Docs**: https://docs.envio.dev
- **Monad Tutorial**: https://docs.monad.xyz/guides/indexers/tg-bot-using-envio
- **HyperSync Docs**: https://docs.envio.dev/docs/HyperSync-LLM/hypersync-complete
- **Discord Support**: https://discord.gg/envio

## Competition Requirements Status

**Current Implementation Status**:

✅ **Indexer Configuration**: Complete config.yaml, schema.graphql, and TypeScript event handlers  
⚠️ **Deployment**: Requires manual deployment to Envio hosted service or local Docker setup  
⚠️ **API Integration**: Client structure created but currently returns mock data pending deployment  
✅ **Documentation**: Complete setup guide and integration instructions

**To Complete for Production**:

1. **Add Contract Addresses**: Update config.yaml with specific ERC-20 token addresses to monitor
2. **Deploy Indexer**:
   ```bash
   cd envio
   pnpm envio deploy  # Get GraphQL endpoint URL
   ```
3. **Configure Endpoint**: Set `ENVIO_GRAPHQL_ENDPOINT` environment variable
4. **Implement Real Queries**: Replace mock responses in `server/envio-client.ts` with actual GraphQL calls
5. **Test Integration**: Verify events flow from Envio → AI risk analysis → Auto-revoke

**Why Not Fully Deployed**:
- Envio deployment requires external service registration
- GraphQL endpoint needs to be live before integration can be tested
- Replit environment constraints make local Docker setup complex
- Configuration is complete and deployment-ready

## Notes

- The indexer tracks ALL ERC-20 tokens on Monad testnet
- For production, filter specific token addresses in config.yaml
- HyperSync automatically handles chain reorganizations
- GraphQL API supports complex queries, filtering, and aggregations
