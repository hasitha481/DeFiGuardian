# Design Guidelines: AI-Powered DeFi Guardian Agent

## Design Approach

**Selected Framework**: Material Design + Web3 Best Practices
**Rationale**: As a security-focused DeFi monitoring tool, the interface prioritizes trust, data clarity, and real-time information density. Drawing from successful platforms like Etherscan (data presentation), Linear (clean utility), and MetaMask (Web3 familiarity).

**Core Principles**:
- **Trust through transparency**: Clear visual hierarchy for risk indicators
- **Information density**: Efficient use of space for monitoring data
- **Real-time clarity**: Obvious visual feedback for live updates
- **Security-first aesthetics**: Professional, non-distracting design

---

## Color Palette

### Dark Mode (Primary)
- **Background**: 220 13% 9% (deep blue-gray, reducing eye strain)
- **Surface**: 220 13% 13% (elevated cards/panels)
- **Surface Elevated**: 220 13% 16% (modals, dropdowns)
- **Border**: 220 13% 22% (subtle divisions)

### Semantic Colors
- **Primary (Brand)**: 217 91% 60% (trust blue, MetaMask-inspired)
- **Success/Safe**: 142 71% 45% (risk: low)
- **Warning/Medium**: 38 92% 50% (risk: medium)
- **Danger/High**: 0 84% 60% (risk: high, critical alerts)
- **Neutral/Info**: 220 13% 60% (secondary information)

### Text
- **Primary**: 210 20% 98% (high contrast)
- **Secondary**: 217 10% 70% (labels, metadata)
- **Tertiary**: 217 10% 50% (timestamps, auxiliary)

---

## Typography

**Font Stack**: 
- **Primary**: Inter (system UI clarity, excellent for data)
- **Monospace**: JetBrains Mono (addresses, hashes, numbers)

**Scale**:
- **Page Headers**: text-3xl font-bold (account overview)
- **Section Headers**: text-xl font-semibold (dashboard sections)
- **Card Titles**: text-base font-medium
- **Body/Data**: text-sm (event feeds, transaction details)
- **Metadata**: text-xs (timestamps, chain info)
- **Addresses/Hashes**: text-sm font-mono (wallet addresses, tx hashes)

---

## Layout System

**Spacing Primitives**: Tailwind units of 4, 6, 8, 12 (tight, efficient spacing for data-dense UI)

**Grid System**:
- **Dashboard**: 12-column grid with sidebar (sidebar: 16 units, main: flexible)
- **Responsive Breakpoints**: md: 2-column cards, lg: 3-column layouts for metrics

**Container Strategy**:
- **App Shell**: Full-width with max-w-screen-2xl
- **Content Panels**: p-6 to p-8 spacing
- **Card Grids**: gap-6 between cards

---

## Component Library

### Navigation
**Sidebar Navigation** (persistent, left-aligned):
- Dashboard, Monitoring, Settings, Audit Log, Dev Tools
- Active state: primary blue left border (4px) + background tint
- Icons: Heroicons (outline for inactive, solid for active)
- Height: full viewport with sticky positioning

**Top Bar** (horizontal):
- Wallet connection status (address, balance, network indicator)
- Real-time sync indicator (pulsing dot when indexing active)
- User settings dropdown (right-aligned)

### Cards & Panels
**Smart Account Card**:
- Elevated surface background
- Account address (truncated, click-to-copy)
- Balance display (large, prominent)
- Network badge (Monad Testnet)
- QR code button for easy sharing

**Risk Event Card**:
- Timeline layout (vertical flow)
- Risk score badge (color-coded: green/yellow/red)
- Event type icon + timestamp
- Expandable details (approval amount, contract address)
- Action buttons (revoke, ignore, whitelist)

**Activity Feed**:
- Reverse chronological stream
- Auto-scroll lock toggle
- Live update pulse animation (subtle)
- Filter controls (event type, risk level)

### Data Display
**Metrics Grid**:
- 4-column layout (desktop), 2-column (tablet), 1-column (mobile)
- Large number displays with labels
- Trend indicators (up/down arrows)
- Tooltips for context

**Transaction Table**:
- Monospace font for hashes
- Status indicators (pending/confirmed/failed)
- Explorer links (external icon)
- Sortable columns

**Risk Score Indicator**:
- Circular progress ring (0-100 scale)
- Color transition (green → yellow → red)
- Large centered number
- AI reasoning tooltip

### Forms & Inputs
**Risk Threshold Settings**:
- Slider with numeric input
- Preview of affected transactions
- Save/Reset buttons (primary/secondary)

**Whitelist Management**:
- Tag-based input for addresses
- Validation (checksum verification)
- Remove button per tag

### Modals & Overlays
**Confirmation Dialogs**:
- Blurred backdrop (backdrop-blur-sm)
- Centered modal (max-w-md)
- Clear action hierarchy (danger actions in red)
- Transaction preview before execution

**Toast Notifications**:
- Bottom-right positioned
- Auto-dismiss (5 seconds)
- Success/Warning/Error states
- Action links where applicable

---

## Animations & Interactions

**Real-Time Updates**:
- Fade-in for new events (duration-300)
- Pulse animation for active monitoring indicator
- Smooth height transitions for expandable cards

**Hover States**:
- Cards: subtle elevation increase (shadow-md → shadow-lg)
- Buttons: brightness increase, no background color change
- Links: underline on hover (text-decoration-offset-4)

**Loading States**:
- Skeleton screens for initial load (matching component shapes)
- Spinner for async actions (primary blue, centered)
- Progress bars for indexing backfill

---

## Special Components

### Wallet Connection Flow
- Large "Connect Wallet" button (hero CTA)
- MetaMask logo integration
- Network switcher (Monad testnet requirement)
- Account creation wizard (multi-step)

### AI Reasoning Display
- Expandable panel showing GPT analysis
- Structured reasoning (bullet points)
- Confidence score visualization
- Timestamp and model version

### Audit Trail
- Immutable log display
- Filter by action type/date range
- Export functionality (CSV/JSON)
- Transaction hash linking to explorer

---

## Accessibility & Responsiveness

- **Contrast**: WCAG AAA compliance for risk indicators
- **Focus States**: 2px primary blue outline, 4px offset
- **Dark Mode**: Consistent throughout (no light mode toggle needed)
- **Mobile**: Collapsible sidebar (hamburger menu), stacked cards, bottom navigation for key actions
- **Screen Readers**: Proper ARIA labels for status indicators and live regions

---

## Images

**No hero images required** - This is a utility dashboard focused on functionality over marketing appeal.

**Icon Usage**:
- Heroicons throughout (shield for security, clock for activity, settings for configuration)
- Network logos (Monad, MetaMask) in appropriate contexts
- Status icons (checkmark, warning triangle, error X)