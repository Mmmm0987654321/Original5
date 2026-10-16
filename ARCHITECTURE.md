# Aether Exchange: Architectural & System Design Specification
**Version:** 1.0.0  
**Author:** Lead Blockchain & Full-Stack Architect  
**Classification:** Confidential / Proprietary  

---

## 1. Executive Summary & Brand Identity

**Aether Exchange** is a next-generation, institutional-grade decentralized trading platform. It functions as a premium proprietary frontend wrapper utilizing **Hyperliquid L1** as its underlying execution and liquidity infrastructure. 

### Visual Brand Pillars
- **Dark Elegance (Cosmic Slate Theme):** Absolute deep charcoal (`#030712`) and absolute obsidian black base layers, paired with cool titanium and silver accents.
- **Glassmorphism:** Generous usage of backdrop-blur layers, thin neon-tinted borders, and micro-shadows to establish premium multi-dimensional depth.
- **Micro-Animations:** Fluid, high-refresh-rate Framer Motion animations for order submissions, trade executions, order book updates, and tab transitions.
- **Minimalist Layout:** Clean, distraction-free trading interfaces optimized for high-density information display without cognitive overload.

---

## 2. Technology & Integration Stack

### Core Frontend & Framework
- **Framework:** React 19 + Vite 6 (Single Page Application architecture with SPA routing).
- **Styling Engine:** Tailwind CSS v4 featuring native CSS variables and modular modern configurations.
- **Animation Framework:** `motion` (Framer Motion v12) for GPU-accelerated page transitions, live order book tickers, and system notifications.
- **Icons:** `lucide-react` (strictly imported via named exports).

### Web3 & Trading Infrastructure
- **Web3 Connections:** Unified modal integrating **MetaMask**, **Phantom (EVM & Solana)**, and **WalletConnect v2** (via Wagmi or standalone provider scripts).
- **Execution Network:** Hyperliquid L1 (Arbitrum-based bridge & native Hyperliquid L1 EVM signature schemes).
- **Data Engine (Charting):** High-performance TradingView Lightweight Charts (or standard TradingView Embed SDK) configured with custom dark-slate styling.
- **Network Middleware:** Node.js + Express (to proxy WebSocket feeds, aggregate server-side statistics, bypass CORS restrictions, and track referrals safely without exposing server configurations).

---

## 3. Directory & Folder Structure

To ensure maximum modularity, clean separation of concerns, and type-safety, the following directory structure is designed:

```
/
├── .env.example                 # Publicly documented environment variables
├── .gitignore                   # Ignore node_modules, build outputs, and logs
├── index.html                   # HTML entrypoint
├── metadata.json                # Project name and permissions manifest
├── package.json                 # Dependency definitions and scripts
├── tsconfig.json                # Strict TypeScript compilation rules
├── vite.config.ts               # Vite bundler, alias, and dev-server parameters
├── ARCHITECTURE.md              # [This Document] System Design Specification
│
├── server.ts                    # Full-Stack Express proxy server (CORS bypass + WebSockets)
│
└── src/
    ├── main.tsx                 # Client entry point
    ├── App.tsx                  # Root client routing and layout shell
    ├── index.css                # Global styles, Tailwind imports, and design system variables
    ├── types.ts                 # Centralized strict TypeScript interfaces & enums
    │
    ├── components/              # Reusable premium visual components
    │   ├── ui/                  # Atom-level layout primitives (Buttons, Modals, Inputs)
    │   ├── layout/              # Structural wrappers (Navbar, Sidebar, Page Shell)
    │   ├── charts/              # Styled TradingView Chart wrappers
    │   ├── trading/             # Core trading widgets (OrderBook, OrderForm, RecentTrades)
    │   ├── dashboard/           # Portfolio and history tables
    │   └── common/              # Glassmorphic boxes, status indicators, dynamic tickers
    │
    ├── hooks/                   # Custom business logic & Web3 hooks
    │   ├── useHyperliquid.ts    # Main trade execution and query client
    │   ├── useWallet.ts         # MetaMask/WalletConnect hook
    │   ├── useWebSocket.ts      # Real-time data subscriber (order book, tickers)
    │   └── useBuilderFee.ts     # Builder fee approval tracker
    │
    ├── lib/                     # Custom utilities and helpers
    │   ├── hyperliquid-api.ts   # Hyperliquid RPC and signature client
    │   ├── formatters.ts        # Currency, numbers, and date standardizers
    │   └── theme.ts             # Tailwind class consolidators (cn utility)
    │
    └── pages/                   # Main view controllers (lazy-loaded inside App.tsx)
        ├── Landing.tsx          # Institutional homepage
        ├── Markets.tsx          # Real-time token market screener
        ├── TradeSpot.tsx        # Spot trading terminal
        ├── TradePerp.tsx        # Perpetual leverage terminal
        ├── Portfolio.tsx        # Balance, positions, and history dashboard
        ├── Leaderboard.tsx      # Top traders & volume metrics
        ├── Referral.tsx         # Affiliate links & builder fee distribution
        ├── Blog.tsx             # Updates & analysis
        ├── API.tsx              # Institutional API documentation
        ├── Support.tsx          # FAQ and user ticket interface
        └── legal/               # Compliance and legal sub-pages
            ├── Terms.tsx        # User service agreements
            ├── Privacy.tsx      # Privacy protocols
            ├── Disclaimer.tsx   # Financial risk disclosures
            └── Cookies.tsx      # Cookie policy
```

---

## 4. Database Schema Design (Optional / Server-Side Serverless-ready)

While all core financial transactions occur natively on the decentralized blockchain/Hyperliquid L1, we outline a lightweight local schema to manage auxiliary features (Referrals, Leaderboards, and User-custom settings).

### Table: `users`
| Column Name | Type | Key | Description |
|---|---|---|---|
| `wallet_address` | VARCHAR(42) | Primary Key | Lowercase EVM wallet address |
| `referrer_address`| VARCHAR(42)| Foreign Key | Wallet address of the affiliate who referred them |
| `builder_approved`| BOOLEAN | Default: FALSE| Cached status of builder fee signature |
| `joined_at` | TIMESTAMP | | Registration date |

### Table: `referral_rewards`
| Column Name | Type | Key | Description |
|---|---|---|---|
| `tx_hash` | VARCHAR(66) | Primary Key | Transaction hash of the volume milestone |
| `referee` | VARCHAR(42) | Foreign Key | Referred trader address |
| `referrer` | VARCHAR(42) | Foreign Key | Affiliate address receiving payout |
| `volume_usd` | NUMERIC(20, 6)| | Dynamic volume executed |
| `earned_usd` | NUMERIC(10, 6)| | Referral fee generated (capped at builder limit) |
| `settled_at` | TIMESTAMP | | Date reward was credited |

---

## 5. Complete Page & View Specifications

Each page will maintain a responsive, desktop-first high-density design, folding into a thumb-optimized layout on mobile interfaces.

1. **Landing Page:** Minimal, high-conversion display presenting institutional liquidity, live TVL/volume tickers, a dynamic trading terminal mockup, and an instant wallet launch button.
2. **Markets Page:** Advanced screener categorizing Perpetuals and Spot tokens. Includes customizable columns (24h Change, Volume, Open Interest, Funding Rate, Funding Countdown) with sorting engines.
3. **Trading Terminals (Spot & Perpetual):**
   - **Main Layout:** Dynamic 4-column desktop layout (Left: Order Entry; Center-Top: Chart + Stats Bar; Center-Bottom: Positions/History; Right: Order Book + Recent Trades).
   - **Perpetual Controls:** Interactive leverage sliders (1x - 50x), Margin Modes (Cross/Isolated), liquidation estimations, and dynamic PnL charts.
4. **Portfolio Dashboard:** Clean overview displaying Total Net Asset Value, Margin Usage, Individual Collateral Assets, Active Positions, Open Orders, and an unified Deposit/Withdraw portal.
5. **Leaderboard:** Dynamic community scoreboard tracking traders by ROI %, realized PnL, and total trading volume over various intervals (Daily, Weekly, Monthly, All-time).
6. **Referral Hub:** Personal stats panel showing total referred users, cumulative trading volume generated, total commissions earned, and a referral link generator.
7. **Legal Compliance Pages:** Clean, readable, typographically structured documents detailing Terms of Service, Privacy Protocols, Risk Disclaimers, and Cookie configurations.

---

## 6. Complete Component Inventory

### Atomic UI Components (`src/components/ui/`)
- `Button`: Multiple luxury states (Obsidian Glass, Brushed Titanium, Neon Border, Text Link).
- `Modal`: Backdrop-blur overlays with smooth sliding entrances.
- `Tooltip`: High-contrast informational tooltips with smart directional placement.
- `Input`: Glassmorphic input fields with custom focus transitions and embedded units.
- `Slider`: Fully interactive, drag-optimized leverage selector.

### Composite Components (`src/components/trading/` & `src/components/layout/`)
- `Navbar`: Translucent floating header containing ticker streams, wallet controller, status markers, and main navigation.
- `OrderBook`: Double-sided vertical pricing ledger displaying depth gradients, custom tick size groupings, and instant click-to-price capabilities.
- `OrderForm`: Fully integrated terminal form handling Limit, Market, and Stop-Loss/Take-Profit orders, dynamically tracking collateral and transaction fees.
- `RecentTrades`: Fast-scrolling transaction ticker color-coded for buy/sell momentum.
- `PositionTable`: Rich dashboard monitoring Margin, Size, Entry Price, Mark Price, Liquidation Price, and Real-time Unrealized PnL.
- `BuilderFeePopup`: Lock-screen modal forcing wallet signature approval before trading commands can be initialized.

---

## 7. Hyperliquid Builder Fee Protocol

The Hyperliquid L1 network supports **Builder Fees** which allow platform integrations to receive a percentage of execution fees. This is the cornerstone of our platform monetization.

### Security and Implementation Logic:
1. **Approval Detection:**
   - On wallet connection, the platform queries the Hyperliquid L1 API (via the client) to determine if the user has signed the builder fee delegator agreement pointing to our designated protocol address.
   - Or, the custom trade execution library checks if our unique `builderAddress` and `feeRate` (e.g., 0.01%) are injected as params within the signed order JSON structure.
2. **Lockout Mechanism:**
   - If the builder fee delegation is unapproved, the core components (`OrderForm`, Spot/Perpetual execution buttons) are gracefully blurred or disabled.
   - A highly-polished, institutional-grade pop-up appears explaining that to access top-tier liquidity, zero-latency execution, and institutional depth, a one-time signature is required to register the partner fee protocol.
3. **Frictionless Experience:**
   - Clicking "Approve Protocol Fee" prompts a gasless MetaMask/Phantom Web3 signature.
   - Once successfully signed, the popup dissolves instantly via Framer Motion, and the entire trading engine transitions to unlocked.

---

## 8. Roadmaps (Project, Deployment, Security)

```
┌─────────────────────────────────────────────────────────────┐
│                       PROJECT ROADMAP                       │
├───────────────┬───────────────────────────────┬─────────────┤
│ Phase         │ Deliverables                  │ Status      │
├───────────────┼───────────────────────────────┼─────────────┤
│ Phase 1: Core │ Spec & Design System Setup    │ PLANNING    │
│ Phase 2: Web3 │ Connection Hooks & Fee popups │ UP NEXT     │
│ Phase 3: Live │ Charting & Socket Integrator  │ UP NEXT     │
│ Phase 4: Order│ Order Execution Engine        │ UP NEXT     │
│ Phase 5: Audit│ Mainnet Deployment            │ UP NEXT     │
└───────────────┴───────────────────────────────┴─────────────┘
```

### A. Project Timeline & Milestones
- **Milestone 1:** Architecture approval and Global Design System initialization (current).
- **Milestone 2:** Web3 Multi-Wallet connectivity (MetaMask, Phantom, WalletConnect) and Builder Fee signature lock screen implementation.
- **Milestone 3:** Live WebSocket integrations supplying real-time Order Book, Tickers, and TradingView charts.
- **Milestone 4:** Full trading panel integration (Spot/Perps, Order entry, collateral estimations, and real-time Position table tracking).
- **Milestone 5:** Leaderboard, Referral hub, and custom server-side analytics.
- **Milestone 6:** Compliance reviews, Stress-testing, and production mainnet launch.

### B. Deployment Strategy
- **Stage 1 (Local Dev):** Vite server proxying Hyperliquid WS/REST API.
- **Stage 2 (Staging/Preview):** Automated deployments to the AI Studio preview environment with continuous deployment verification.
- **Stage 3 (Production):** Distributed edge deployment via Cloudflare Pages + secure proxy API on Cloud Run for low latency and DDOS-resilience.

### C. Security Protocol Spec
- **Zero Custody:** Private keys are *never* stored, requested, or processed by our server. All cryptographic signing happens entirely client-side via hardware/software browser wallets.
- **Cross-Site Request Forgery (CSRF):** API routes guarded with strict CORS policies, restricting calls solely to our verified app domain.
- **RPC Resiliency:** Graceful fallbacks across multiple public/private Hyperliquid RPC endpoints to ensure uninterrupted service if a core node goes down.
- **Frontrunning Protection:** Built-in slippage tolerance sliders preventing trade executions at outdated rates.
