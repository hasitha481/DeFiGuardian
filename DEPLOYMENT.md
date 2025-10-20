# DeFi Guardian Agent - Deployment Guide

## Prerequisites

### Required
1. **MetaMask Browser Extension**
   - Install from [metamask.io](https://metamask.io)
   - For advanced features, use [MetaMask Flask](https://metamask.io/flask/) (developer version)

2. **Environment Variables**
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   SESSION_SECRET=your_session_secret_here
   SERVICE_ACCOUNT_KEY=your_service_account_private_key_here  # Optional, auto-generated if not provided
   ```

3. **Monad Testnet Setup**
   - Network Name: Monad Testnet
   - Chain ID: 10143
   - RPC URL: https://testnet.monad.xyz
   - Currency Symbol: MON
   - Block Explorer: https://explorer.testnet.monad.xyz

### Optional (for Production)
- **Bundler Service**: For gasless transactions (ERC-4337)
- **Paymaster Service**: For sponsored transactions
- **Envio HyperIndex**: For blockchain event indexing

## Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   Create a `.env` file with required keys

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5000`

4. **Connect MetaMask**
   - Open the app in your browser
   - Click "Connect MetaMask Smart Account"
   - Approve the connection in MetaMask
   - Switch to Monad Testnet when prompted
   - Allow smart account creation

## Real-World Usage

### Smart Account Creation
The application uses MetaMask Delegation Toolkit to create ERC-4337 smart accounts:

```typescript
// Automatic flow:
1. User connects MetaMask
2. App requests network switch to Monad testnet
3. Smart account is created using Delegation Toolkit
4. Account address is deterministic based on owner
5. Settings and monitoring begin automatically
```

### Transaction Signing
All blockchain operations require MetaMask approval:
- **Approval Revocations**: Sign ERC-20 `approve(spender, 0)` transactions
- **Settings Changes**: Sign when updating on-chain preferences
- **Delegations**: Approve delegation caveats for automated actions

### Event Monitoring
Two modes available:

**Development Mode** (Current):
- Simulated events for testing
- Use "Simulate Event" button to create test data
- AI analysis runs on simulated events

**Production Mode** (Requires Envio):
- Real-time blockchain event indexing
- Automatic detection of Approval/Transfer events
- Continuous monitoring of user's smart account

## Monad Testnet Integration

### Getting Testnet Tokens
1. Visit [Monad Faucet](https://faucet.testnet.monad.xyz) (if available)
2. Enter your smart account address
3. Receive testnet MON tokens
4. Use for transaction fees

### Network Configuration
The app automatically configures Monad testnet in MetaMask:
- If network exists: Switches to it
- If network missing: Adds it with proper configuration
- Handles chain ID validation

## Production Deployment

### Required Services

1. **Backend API**
   - Deploy Express server
   - Configure CORS for your domain
   - Set production environment variables
   - Enable HTTPS

2. **Database** (Optional Upgrade)
   - Currently uses in-memory storage
   - For production, migrate to PostgreSQL
   - Use Drizzle ORM migrations

3. **Bundler Service**
   - Set up ERC-4337 bundler for Monad
   - Configure bundler URL in smart-account-service.ts
   - Enable gasless transactions

4. **Paymaster** (Optional)
   - Deploy paymaster contract on Monad
   - Fund paymaster for sponsored transactions
   - Configure paymaster URL

5. **Envio HyperIndex**
   - Create Envio project for Monad testnet
   - Configure indexers for ERC-20 events
   - Set GraphQL endpoint in backend

### Environment Variables (Production)
```bash
NODE_ENV=production
OPENAI_API_KEY=<your_key>
SESSION_SECRET=<strong_random_string>
SERVICE_ACCOUNT_KEY=<production_private_key>
DATABASE_URL=<postgresql_connection_string>  # If using database
BUNDLER_URL=<bundler_endpoint>
PAYMASTER_URL=<paymaster_endpoint>
ENVIO_API_URL=<envio_graphql_endpoint>
MONAD_RPC_URL=https://testnet.monad.xyz
```

### Deployment Checklist
- [ ] Environment variables configured
- [ ] HTTPS enabled
- [ ] CORS configured for production domain
- [ ] Database migrations run (if applicable)
- [ ] Bundler service operational
- [ ] Envio indexer deployed and synced
- [ ] MetaMask connection tested
- [ ] Smart account creation verified
- [ ] Transaction signing working
- [ ] Event monitoring active
- [ ] AI risk analysis operational

## Testing

### Manual Testing Flow
1. Connect MetaMask wallet
2. Switch to Monad testnet
3. Create smart account
4. Simulate high-risk event
5. Verify AI analysis
6. Test manual revoke
7. Test auto-revoke (with settings)
8. Check audit logs
9. Verify WebSocket updates

### Automated Tests
```bash
# Run end-to-end tests (when available)
npm run test:e2e

# Run unit tests
npm run test
```

## Troubleshooting

### MetaMask Connection Issues
- **Problem**: Connection rejected
- **Solution**: Ensure MetaMask is unlocked and on correct account

### Network Switch Fails
- **Problem**: Monad testnet not added
- **Solution**: Manually add network using configuration above

### Smart Account Creation Fails
- **Problem**: Delegation Toolkit error
- **Solution**: Check SERVICE_ACCOUNT_KEY is valid, verify RPC endpoint

### Transaction Fails
- **Problem**: Insufficient gas or wrong network
- **Solution**: Ensure MON tokens in account, verify on Monad testnet

### Events Not Detected
- **Problem**: Envio not configured
- **Solution**: Use simulation mode for testing, configure Envio for production

## Support

For issues or questions:
- Check [MetaMask Docs](https://docs.metamask.io/delegation-toolkit/)
- Review [Monad Documentation](https://docs.monad.xyz/)
- See [Envio Documentation](https://docs.envio.dev/)

## Security Notes

- **Never commit** private keys or secrets to version control
- **Rotate keys** regularly in production
- **Audit smart contracts** before mainnet deployment
- **Monitor** delegations and permissions closely
- **Backup** account recovery phrases securely
