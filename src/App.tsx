import { useCallback, useMemo, useState } from 'react'
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import type { DeploymentResult } from '@p2p-org/safe-onboarding-sdk'
import { OnboardingClient, constants } from '@p2p-org/safe-onboarding-sdk'
import { getAddress } from 'viem'
import { base } from 'viem/chains'
import './App.css'

type OnboardingPhase = 'idle' | 'running' | 'success' | 'error'

function App() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient, refetch: refetchWalletClient } = useWalletClient()
  const rawPublicClient = usePublicClient()
  const chainId = useChainId()
  const isOnBase = chainId === base.id

  const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>('idle')
  const [onboardingError, setOnboardingError] = useState<string | null>(null)
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null)

  const normalizedAddresses = useMemo(
    () => ({
      p2pAddress: getAddress(constants.P2P_ADDRESS),
      p2pSuperformProxyFactoryAddress: getAddress(constants.P2P_SUPERFORM_PROXY_FACTORY_ADDRESS),
      rolesMasterCopyAddress: getAddress(constants.ROLES_MASTER_COPY_ADDRESS),
      rolesIntegrityLibraryAddress: getAddress(constants.ROLES_INTEGRITY_LIBRARY_ADDRESS),
      rolesPackerLibraryAddress: getAddress(constants.ROLES_PACKER_LIBRARY_ADDRESS),
      safeSingletonAddress: getAddress(constants.SAFE_SINGLETON_ADDRESS),
      safeProxyFactoryAddress: getAddress(constants.SAFE_PROXY_FACTORY_ADDRESS),
      safeMultiSendCallOnlyAddress: getAddress(constants.SAFE_MULTI_SEND_CALL_ONLY_ADDRESS),
    }),
    [],
  )

  const publicClient = useMemo(() => {
    if (!rawPublicClient) {
      return rawPublicClient
    }
    return new Proxy(rawPublicClient, {
      get(target, prop, receiver) {
        if (prop === 'readContract') {
          return async (...args: Parameters<typeof target.readContract>) => {
            try {
              return await target.readContract(...args)
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              if (message.includes('returned no data')) {
                const patchedError = new Error(`ContractFunctionZeroDataError: ${message}`)
                patchedError.name = 'ContractFunctionZeroDataError'
                throw patchedError
              }
              throw error
            }
          }
        }
        const value = Reflect.get(target, prop, receiver)
        if (typeof value === 'function') {
          return value.bind(target)
        }
        return value
      },
    }) as typeof rawPublicClient
  }, [rawPublicClient])

  const handleConnect = useCallback(
    (connectorId: string) => {
      const connector = connectors.find((item) => item.id === connectorId)
      if (!connector) {
        return
      }
      connect({ connector, chainId: base.id })
    },
    [connectors, connect],
  )

  const handleOnboard = useCallback(async () => {
    if (!walletClient || !publicClient) {
      setOnboardingError('Wallet or public client not available.')
      setOnboardingPhase('error')
      return
    }

    setOnboardingPhase('running')
    setOnboardingError(null)
    setDeploymentResult(null)

    try {
      let activeWalletClient = walletClient
      const resolveChainId = async () =>
        activeWalletClient.chain?.id ??
        (typeof activeWalletClient.getChainId === 'function'
          ? await activeWalletClient.getChainId()
          : undefined)

      let currentChainId = await resolveChainId()

      if (currentChainId !== base.id) {
        let switched = false

        if (typeof activeWalletClient.switchChain === 'function') {
          try {
            await activeWalletClient.switchChain({ id: base.id })
            switched = true
          } catch (error) {
            console.warn('Wallet client switchChain failed, falling back to connector switch.', error)
          }
        }

        if (!switched && typeof switchChainAsync === 'function') {
          await switchChainAsync({ chainId: base.id })
          switched = true
        }

        if (switched && typeof refetchWalletClient === 'function') {
          const refreshed = await refetchWalletClient()
          if (refreshed.data) {
            activeWalletClient = refreshed.data
          }
        }

        currentChainId = await resolveChainId()

        if (currentChainId !== base.id) {
          throw new Error('Please switch your wallet to the Base network and try again.')
        }
      }

      const account = activeWalletClient.account
      if (!account) {
        throw new Error('Wallet client must have an active account.')
      }

      const baseBoundWalletClient = {
        ...activeWalletClient,
        chain: base,
        getChainId: async () => base.id,
        account,
      } as typeof activeWalletClient

      const onboarding = new OnboardingClient({
        walletClient: baseBoundWalletClient,
        publicClient,
        ...normalizedAddresses,
        feeConfigFetcher: async () => ({
          clientBasisPointsOfDeposit: 0,
          clientBasisPointsOfProfit: 9700,
        }),
      })

      const result = await onboarding.onboardClient({
        clientAddress: address,
      })

      setDeploymentResult(result)
      setOnboardingPhase('success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Onboarding failed. Please try again.'
      setOnboardingError(message)
      setOnboardingPhase('error')
    }
  }, [address, normalizedAddresses, publicClient, refetchWalletClient, switchChainAsync, walletClient])

  return (
    <div className="app">
      <header className="app__header">
        <h1>Safe Onboarding Demo</h1>
        <p>Connect a wallet via MetaMask or WalletConnect and run the onboarding flow.</p>
      </header>

      <section className="app__section">
        <h2>Connection</h2>

        {!isConnected ? (
          <>
            <p>Select a wallet to connect.</p>
            <div className="button-group">
              {connectors.map((connector) => {
                const isWalletConnect = connector.id === 'walletConnect'
                const isMetaMask =
                  connector.id === 'metaMask' ||
                  connector.id === 'metaMaskSDK' ||
                  connector.id === 'injected' ||
                  connector.name.toLowerCase().includes('metamask')
                const allowUnready = isWalletConnect || isMetaMask
                return (
                  <button
                    key={connector.id}
                    type="button"
                    className="button"
                    onClick={() => handleConnect(connector.id)}
                    disabled={connectStatus === 'pending' || (!connector.ready && !allowUnready)}
                  >
                    {connector.name}
                  </button>
                )
              })}
            </div>
            {connectors.length === 0 && (
              <p className="app__hint">
                No connectors available. Ensure MetaMask is installed or configure a WalletConnect
                project id.
              </p>
            )}
            {!connectors.some((connector) => connector.id === 'walletConnect') &&
              import.meta.env.VITE_WALLETCONNECT_PROJECT_ID === undefined && (
                <p className="app__hint">
                  WalletConnect is disabled because <code>VITE_WALLETCONNECT_PROJECT_ID</code> is
                  not set.
                </p>
              )}
            {connectors.some((connector) => {
              const isWalletConnect = connector.id === 'walletConnect'
              const isMetaMask =
                connector.id === 'metaMask' ||
                connector.id === 'metaMaskSDK' ||
                connector.id === 'injected' ||
                connector.name.toLowerCase().includes('metamask')
              return (isWalletConnect || isMetaMask) && !connector.ready
            }) && (
              <p className="app__hint">
                WalletConnect and MetaMask buttons stay enabled even while the extension or QR modal is
                loading.
              </p>
            )}
            {connectError && <p className="app__error">{connectError.message}</p>}
          </>
        ) : (
          <div className="connected">
            <p className="connected__status">Connected</p>
            <p className="connected__info">
              <span>Address:</span> {address}
            </p>
            <p className="connected__info">
              <span>Network:</span> {isOnBase ? base.name : `Chain ID ${chainId ?? 'unknown'}`}
            </p>
            <div className="button-group">
              <button type="button" className="button" onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="app__section">
        <h2>Onboarding</h2>
        <p>
          The onboarding flow will use the connected wallet on the Base network (
          <code>{base.name}</code>) to deploy the required Safe and Roles contracts.
        </p>

        <button
          type="button"
          className="button button--primary"
          onClick={handleOnboard}
          disabled={!isConnected || onboardingPhase === 'running' || !isOnBase}
        >
          {onboardingPhase === 'running' ? 'Onboarding...' : 'Onboard'}
        </button>

        {isConnected && !isOnBase && (
          <p className="app__error">Please switch your wallet to the Base network before onboarding.</p>
        )}

        {onboardingPhase === 'success' && deploymentResult && (
          <div className="result">
            <p className="result__status">Success</p>
            <div className="result__grid">
              <div>
                <span className="result__label">Safe address</span>
                <code className="result__value">{deploymentResult.safeAddress}</code>
              </div>
              <div>
                <span className="result__label">Roles address</span>
                <code className="result__value">{deploymentResult.rolesAddress}</code>
              </div>
              <div>
                <span className="result__label">Predicted P2pSuperformProxy address</span>
                <code className="result__value">{deploymentResult.predictedProxyAddress}</code>
              </div>
            </div>
          </div>
        )}

        {onboardingPhase === 'error' && onboardingError && (
          <p className="app__error">Onboarding failed: {onboardingError}</p>
        )}

        {onboardingPhase === 'running' && (
          <p className="app__hint">Please confirm the transactions in your wallet.</p>
        )}
      </section>
    </div>
  )
}

export default App
