import './polyfills/process-env.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { metaMask, walletConnect } from 'wagmi/connectors'
import { base } from 'viem/chains'
import './index.css'
import App from './App.tsx'

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const connectors = [
  metaMask(),
  ...(walletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: {
            name: 'Safe Onboarding Demo',
            description: 'Demo Safe onboarding flow powered by P2P.org SDK',
            url: 'https://p2p.org',
            icons: ['https://p2p.org/favicon.ico'],
          },
          showQrModal: true,
        }),
      ]
    : []),
]

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors,
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
