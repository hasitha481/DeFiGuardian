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
- **MetaMask SDK Integration** (@metamask/sdk-react v0.33.1)
  - Real wallet connection with MetaMaskProvider + WalletContext
  - Shared state across entire application
  - Network switching to Monad testnet
  - Account change listeners
- **Delegation Toolkit Setup** (@metamask/delegation-toolkit)
  - Smart account service with toMetaMaskSmartAccount()
  - Deterministic CREATE2 salt based on owner address
  - Correct Monad testnet RPC configuration
  - Hybrid implementation (EOA + passkey support)
- **Viem Integration** (v2.x)
  - Public client for reading blockchain state
  - Wallet client for transaction signing (prepared)
  - Type-safe contract interactions
- **Monad Testnet Configuration** (Chain ID: 10143)
  - RPC: https://testnet.monad.xyz
  - Explorer: https://explorer.testnet.monad.xyz
  - Native currency: MON
- **Real Wallet Connection Flow**
  - Landing page → MetaMask connection → Smart account creation
  - WalletContext propagates state to all components
  - Dashboard shows real account data

### 🚧 In Progress
- **Smart Account On-Chain Deployment**
  - Deterministic address generation complete
  - Deployment requires bundler/paymaster integration (Pimlico/Stackup)
  - UserOperation submission for gasless transactions
- **Transaction Signing for Revocations**
  - Viem integration prepared
  - ERC-20 approve(spender, 0) calls
  - Transaction status tracking
- **Envio HyperIndex Integration**
  - GraphQL client for event monitoring
  - ERC-20 Approval/Transfer indexing
  - Real-time event subscription
  - Fallback to RPC event logs

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

## Recent Changes
- ✅ Complete schema design for all data models
- ✅ Comprehensive React components with dark mode
- ✅ Backend API with AI risk analysis
- ✅ WebSocket real-time updates
- ✅ Demo event simulation
- ✅ Audit logging system
- ✅ Settings management with whitelist support
