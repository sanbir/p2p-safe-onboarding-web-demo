const globalWithProcess = globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> }
}

const existingProcess = globalWithProcess.process ?? { env: {} as Record<string, string | undefined> }

existingProcess.env = {
  ...existingProcess.env,
  RPC_URL: existingProcess.env.RPC_URL ?? (import.meta.env.VITE_SAFE_RPC_URL as string | undefined) ?? '',
  PRIVATE_KEY:
    existingProcess.env.PRIVATE_KEY ?? (import.meta.env.VITE_SAFE_PRIVATE_KEY as string | undefined) ?? '',
}

globalWithProcess.process = existingProcess

