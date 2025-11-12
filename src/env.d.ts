/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_SAFE_RPC_URL?: string
  readonly VITE_SAFE_PRIVATE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

