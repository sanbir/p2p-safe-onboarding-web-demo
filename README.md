# Safe Onboarding Demo

This project is a minimal React + TypeScript single-page app that lets a user connect a wallet (MetaMask or WalletConnect) and trigger the [P2P.org Safe Onboarding SDK](https://www.npmjs.com/package/@p2p-org/safe-onboarding-sdk) flow on Base.

## Prerequisites

- Node.js 18+
- npm 10+
- A [WalletConnect Cloud](https://cloud.walletconnect.com/) project id if you want to offer the QR-based wallet connection.

## Getting Started

```bash
npm install
```

Create a `.env` file (or export the environment variable another way) when you want to enable the WalletConnect connector:

```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
# Optional, if you plan to call helpers that read Safe RPC credentials from env:
# VITE_SAFE_RPC_URL=https://...
# VITE_SAFE_PRIVATE_KEY=0x...
```

Run the development server:

```bash
npm run dev
```

Then open the app and follow the steps:

1. **Deploy Safe**
2. **Set permissions** (optionally enter tokens to approve for the proxy)
3. **Transfer tokens to Safe** (ERC-20 transfer from caller to Safe)
4. **Transfer tokens to owner** (ERC-20 transfer from Safe back to its owner; accepts an existing Safe address)

On success the UI shows Safe address, Roles address, and predicted P2pSuperformProxy address.

## Building

```bash
npm run build
```

The build output is written to `dist/`.
