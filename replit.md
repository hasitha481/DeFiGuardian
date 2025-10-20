# DeFi Guardian Agent

## Overview
AI-Powered DeFi security dApp built for the MetaMask Smart Accounts x Monad Hackathon. The application provides real-time monitoring and automated risk management for DeFi assets using MetaMask Smart Accounts on Monad testnet.

## Project Status
**Status**: MVP Development Complete
**Last Updated**: January 2025

## Tech Stack
- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI, Wouter routing
- **Backend**: Express.js, WebSocket for real-time updates
- **AI**: OpenAI GPT-5 for risk analysis
- **Blockchain**: Monad Testnet (Chain ID: 10143)
- **Storage**: In-memory storage (MemStorage) for MVP
- **Key Integrations**:
  - MetaMask Delegation Toolkit (planned for smart account operations)
  - Envio HyperIndex/HyperSync (simulated for MVP)
  - OpenAI API for AI-powered risk detection

## Architecture

### Data Models
- **Smart Accounts**: User wallet addresses with balance tracking
- **Risk Events**: Approval/Transfer events with AI risk scores
- **User Settings**: Risk thresholds, auto-revoke settings, whitelisted addresses
- **Audit Logs**: Complete history of security actions

### Key Features
1. **Smart Account Management**
   - Connect/create smart accounts on Monad testnet
   - View balance and account details
   - Network status monitoring

2. **AI Risk Analysis**
   - Real-time risk scoring (0-100) using GPT-5
   - Multi-factor analysis: amount, spender, event type
   - Explainable AI reasoning for every decision
   - Whitelist support for trusted contracts

3. **Automated Protection**
   - Configurable risk thresholds
   - Automatic approval revocation via gasless transactions
   - Manual override controls
   - Real-time WebSocket notifications

4. **Activity Monitoring**
   - Live activity feed with filtering
   - Risk-scored event cards
   - Transaction explorer links
   - Event timeline visualization

5. **Security Settings**
   - Risk threshold slider (0-100)
   - Auto-revoke toggle
   - Whitelist management
   - Notification preferences

6. **Audit Trail**
   - Complete action history
   - Transaction hash tracking
   - Export functionality (JSON)
   - Compliance-ready logging

## API Endpoints

### Smart Accounts
- `POST /api/smart-account/connect` - Create/connect smart account
- `GET /api/dashboard/stats/:accountAddress` - Get dashboard statistics

### Risk Events
- `GET /api/events/:accountAddress` - Get all events
- `GET /api/events/recent/:accountAddress` - Get recent events (5)
- `POST /api/events/simulate` - Create demo event (testing)
- `POST /api/events/revoke` - Revoke approval
- `POST /api/events/ignore` - Ignore event

### Settings
- `GET /api/settings/:accountAddress` - Get user settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/whitelist` - Add to whitelist

### Audit
- `GET /api/audit/:accountAddress` - Get audit logs

### WebSocket
- Endpoint: `ws://localhost:5000/ws`
- Messages: `new_event`, `event_updated`, `connection_status`

## Development Setup

### Prerequisites
- Node.js 20+
- OpenAI API Key

### Environment Variables
- `OPENAI_API_KEY` - Required for AI risk analysis

### Running Locally
```bash
npm run dev
```
Server runs on port 5000 with Vite frontend.

## Design System

### Colors
- **Primary**: Blue (217 91% 60%) - Trust, MetaMask-inspired
- **Success**: Green (142 71% 45%) - Low risk, safe actions
- **Warning**: Yellow (38 92% 50%) - Medium risk alerts
- **Destructive**: Red (0 84% 60%) - High risk, critical alerts
- **Background**: Dark mode (220 13% 9%) - Reduced eye strain

### Typography
- **Sans**: Inter (UI, body text)
- **Mono**: JetBrains Mono (addresses, hashes, numbers)

### Components
All components follow Shadcn UI patterns with custom risk-themed variants.

## User Journeys

### 1. First-Time User
1. Land on homepage with feature overview
2. Click "Connect Smart Account"
3. Smart account created with default settings
4. Redirected to dashboard (empty state)
5. Use "Simulate Event" to create demo risk events
6. Configure settings and explore features

### 2. Active Monitoring
1. Dashboard shows real-time statistics
2. New events appear via WebSocket
3. High-risk events trigger notifications
4. User reviews AI reasoning
5. Manual revoke or ignore actions
6. Auto-revoke for scores > threshold

### 3. Settings Configuration
1. Navigate to Settings page
2. Adjust risk threshold slider
3. Enable/disable auto-revoke
4. Add trusted contracts to whitelist
5. Save settings
6. Settings applied to future events

## Testing Features

### Demo Event Simulation
Use the "Simulate Event" button to create test risk events:
- Customize event type (Approval/Transfer)
- Set token symbol and amount
- AI analyzes and scores the event
- Test auto-revoke functionality

### Test Scenarios
1. **Low Risk**: Small amount, whitelisted address
2. **Medium Risk**: Moderate amount, unknown spender
3. **High Risk**: Large amount (>1M), new contract
4. **Auto-Revoke**: Enable auto-revoke, set threshold to 60, simulate high-risk event

## Future Enhancements

### Immediate (Post-MVP)
- MetaMask Delegation Toolkit integration
- Real Monad testnet transactions
- Envio HyperIndex integration
- Safe swap to stablecoins

### Phase 2
- Multi-chain support
- Advanced AI models
- Batch revocations
- Portfolio analytics
- Mobile responsive improvements

### Phase 3
- Historical analysis
- Risk pattern detection
- Community whitelist sharing
- Governance features

## Real-World Integration Status

### ✅ Completed (January 2025)
**Real MetaMask Wallet Integration:**
- MetaMask SDK v0.33.1 fully integrated
- WalletContext provides shared state across app
- Real wallet connection with network switching to Monad testnet
- Account change listeners
- Landing → Dashboard transition working with real wallet data

**Smart Account Infrastructure:**
- Delegation Toolkit integration with toMetaMaskSmartAccount()
- Deterministic CREATE2 address generation based on owner
- Monad testnet RPC configuration (https://testnet.monad.xyz)
- Hybrid implementation supporting EOA + passkey
- Smart account creation API working

**Transaction Infrastructure (Completed):**
- transaction-service.ts with ERC-20 helpers (getAllowance, getTokenInfo)
- transaction-client.ts for client-side MetaMask signing
- Proper transaction structure documented
- **Real token approval revocations with on-chain verification**

**Real Approval Revocations (✅ Completed 2025-10-20):**
- User wallet signing via MetaMask integration
- `/api/events/revoke-confirm` endpoint with multi-layer verification
- On-chain transaction status verification
- Allowance verification (confirms allowance=0)
- Complete audit trail with block numbers
- Security-hardened: prevents fake transaction submissions
- Error handling: surfaces RPC failures instead of masking them

### ⚠️ Known Limitations
**Smart Account Deployment:**
- Accounts created but not deployed on-chain
- Requires bundler/paymaster integration (Pimlico/Stackup)
- UserOperation submission needed for deployment

**Event Monitoring:**
- Currently using simulated events
- Envio HyperIndex integration pending
- Real blockchain event monitoring not implemented

### Known Limitations
- In-memory storage (data resets on server restart)
- Requires MetaMask browser extension
- Monad testnet RPC and infrastructure required for full functionality
- Development mode includes graceful fallbacks for testing

## Resources
- [MetaMask Delegation Toolkit](https://docs.metamask.io/delegation-toolkit/)
- [Monad Testnet](https://docs.monad.xyz/)
- [Envio Documentation](https://docs.envio.dev/)
- [Hackathon Details](https://www.hackquest.io/hackathons/MetaMask-Smart-Accounts-x-Monad-Dev-Cook-Off)

## Competition Requirements Checklist

### Qualification Requirements (MUST HAVE)
1. ✅ **MetaMask Smart Accounts**: Using @metamask/sdk-react v0.33.1 and @metamask/delegation-toolkit
   - Real wallet integration with WalletContext
   - Smart account creation API working (fixed 2025-01-20)
   - Delegation Toolkit SDK properly configured
   
2. ✅ **Monad Testnet Deployment**: Chain ID 10143, RPC: https://testnet.monad.xyz
   - Custom chain configuration in client/src/lib/chains.ts
   - Network switching functionality
   - Monad explorer integration

3. ✅ **Delegation Toolkit SDK**: Using Implementation.Hybrid
   - toMetaMaskSmartAccount() integration
   - Deterministic CREATE2 address generation
   - Hybrid signer configuration (EOA + passkey support)

4. ⚠️ **Working Demo Video**: Preparation needed
   - Main flow demonstrated: wallet connect → smart account → monitoring → AI analysis
   - Need to show real blockchain interactions
   - Requires Envio integration for production-ready demo

5. ⚠️ **Quality Standards**: Project must meet judge standards
   - Current state: Infrastructure complete, some features using mock data
   - Need: Full end-to-end working implementation

### Envio Bonus Requirements (FOR BONUS PRIZE)
⚠️ **Partially Implemented**: Envio HyperIndex/HyperSync integration configured, pending deployment

Requirements:
- [x] Working indexer using Envio (for ERC-20 Approval/Transfer events) - Configuration complete in `/envio` directory
- [x] Query and usage of HyperSync's API - Client service structure created in `server/envio-client.ts`
- [⚠️] Queries or endpoints generated by Envio being consumed in the project - Integration ready, requires deployed indexer
- [x] Documentation, code, or demos showing Envio actively supporting functionality - Complete README with setup guide

**Current Status (2025-10-20)**:
- ✅ Complete Envio HyperIndex configuration (config.yaml, schema.graphql, event handlers, ABI)
- ✅ @envio-dev/hypersync-client package installed
- ✅ EnvioClient service class with GraphQL query structure
- ✅ Comprehensive documentation and deployment instructions
- ⚠️ Requires manual deployment to Envio hosted service (external to Replit)
- ⚠️ GraphQL endpoint needs to be live for integration testing

**To Complete**: Deploy indexer with `pnpm envio deploy` and set `ENVIO_GRAPHQL_ENDPOINT` environment variable. See `/envio/README.md` for details.

**Impact**: Configuration demonstrates Envio integration capability, but full deployment requires external service registration.

### Current Implementation Status
✅ **Fully Working**:
- MetaMask SDK integration
- Smart account creation (as of 2025-01-20)
- AI risk analysis (OpenAI GPT-5)
- WebSocket real-time updates
- UI/UX components
- **Token approval revocations with on-chain verification (as of 2025-10-20)**

⚠️ **Using Simulated Data**:
- Blockchain event monitoring (using simulated events via "Simulate Event" button)

⚠️ **Requires External Deployment**:
- Envio HyperIndex indexer (configured, needs deployment to hosted service)
- On-chain smart account deployment (requires bundler/paymaster)

## Recent Changes (2025-10-20)
- ✅ **Real token approval revocations** with user wallet signing via MetaMask
- ✅ **On-chain verification** before accepting revocations (transaction status + allowance checks)
- ✅ **Security hardening** to prevent fake transaction submissions
- ✅ Fixed smart account creation (toMetaMaskSmartAccount signer parameter - walletClient)
- ✅ Updated Monad testnet RPC URL (https://testnet-rpc.monad.xyz)
- ✅ Enhanced UI styling (gradient buttons, improved hero section, better visual hierarchy)
- ✅ Implemented Envio HyperIndex integration (configuration, event handlers, client service)
- ✅ Complete schema design for all data models
- ✅ Comprehensive React components with dark mode
- ✅ Backend API with AI risk analysis
- ✅ WebSocket real-time updates
- ✅ Demo event simulation
- ✅ Audit logging system
- ✅ Settings management with whitelist support
