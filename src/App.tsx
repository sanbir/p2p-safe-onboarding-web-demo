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
import type {
  DeploySafeResult,
  SetPermissionsResult,
  TransferAssetResult,
} from '@p2p-org/safe-onboarding-sdk'
import { OnboardingClient } from '@p2p-org/safe-onboarding-sdk'
import type { Address, Hex } from 'viem'
import { base } from 'viem/chains'
import './App.css'

type StepPhase = 'idle' | 'running' | 'success' | 'error'

function App() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, status: connectStatus, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient, refetch: refetchWalletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const chainId = useChainId()
  const isOnBase = chainId === base.id

  const [deployPhase, setDeployPhase] = useState<StepPhase>('idle')
  const [permissionsPhase, setPermissionsPhase] = useState<StepPhase>('idle')
  const [transferPhase, setTransferPhase] = useState<StepPhase>('idle')
  const [transferBackPhase, setTransferBackPhase] = useState<StepPhase>('idle')
  const [deployError, setDeployError] = useState<string | null>(null)
  const [permissionsError, setPermissionsError] = useState<string | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferBackError, setTransferBackError] = useState<string | null>(null)
  const [safeResult, setSafeResult] = useState<DeploySafeResult | null>(null)
  const [permissionsResult, setPermissionsResult] = useState<SetPermissionsResult | null>(null)
  const [transferResult, setTransferResult] = useState<TransferAssetResult | null>(null)
  const [transferBackResult, setTransferBackResult] = useState<TransferAssetResult | null>(null)
  const [transferBackSafeAddress, setTransferBackSafeAddress] = useState<string>('')
  const [transferAddress, setTransferAddress] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('')
  const [transferBackAddress, setTransferBackAddress] = useState<string>('')
  const [transferBackAmount, setTransferBackAmount] = useState<string>('')
  const [activeStep, setActiveStep] = useState<'deploy' | 'permissions' | 'transfer' | 'transferBack' | null>(null)

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

  const ensureWalletOnBase = useCallback(async () => {
    if (!walletClient) {
      throw new Error('Wallet client not available. Connect a wallet first.')
    }

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

    return activeWalletClient
  }, [refetchWalletClient, switchChainAsync, walletClient])

  const feeConfigFetcher = useCallback(
    async () => ({
      clientBasisPointsOfDeposit: 0,
      clientBasisPointsOfProfit: 9700,
    }),
    [],
  )

  const canInteract = useMemo(
    () => isConnected && isOnBase && !!publicClient,
    [isConnected, isOnBase, publicClient],
  )

  const handleDeploySafe = useCallback(async () => {
    if (!publicClient) {
      setDeployError('Public client not available.')
      setDeployPhase('error')
      return
    }

    setActiveStep('deploy')
    setDeployPhase('running')
    setDeployError(null)
    setPermissionsPhase('idle')
    setPermissionsError(null)
    setPermissionsResult(null)
    setTransferPhase('idle')
    setTransferError(null)
    setTransferResult(null)
    setTransferBackPhase('idle')
    setTransferBackError(null)
    setTransferBackResult(null)
    setSafeResult(null)

    try {
      const activeWalletClient = await ensureWalletOnBase()
      const onboarding = new OnboardingClient({
        walletClient: activeWalletClient,
        publicClient,
        feeConfigFetcher,
      })

      const result = await onboarding.deploySafe()
      setSafeResult(result)
      setDeployPhase('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to deploy Safe.'
      setDeployError(message)
      setDeployPhase('error')
    } finally {
      setActiveStep(null)
    }
  }, [ensureWalletOnBase, feeConfigFetcher, publicClient])

  const handleSetPermissions = useCallback(async () => {
    if (!publicClient) {
      setPermissionsError('Public client not available.')
      setPermissionsPhase('error')
      return
    }
    if (!safeResult?.safeAddress) {
      setPermissionsError('Deploy a Safe first.')
      setPermissionsPhase('error')
      return
    }

    setActiveStep('permissions')
    setPermissionsPhase('running')
    setPermissionsError(null)
    setTransferPhase('idle')
    setTransferError(null)
    setTransferResult(null)
    setTransferBackPhase('idle')
    setTransferBackError(null)
    setTransferBackResult(null)

    try {
      const activeWalletClient = await ensureWalletOnBase()
      const onboarding = new OnboardingClient({
        walletClient: activeWalletClient,
        publicClient,
        feeConfigFetcher,
      })

      const result = await onboarding.setPermissions({
        safeAddress: safeResult.safeAddress,
        multiSendCallOnlyAddress: safeResult.multiSendCallOnly,
      })
      setPermissionsResult(result)
      setPermissionsPhase('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set permissions.'
      setPermissionsError(message)
      setPermissionsPhase('error')
    } finally {
      setActiveStep(null)
    }
  }, [ensureWalletOnBase, feeConfigFetcher, publicClient, safeResult])

  const handleTransfer = useCallback(async () => {
    if (!publicClient) {
      setTransferError('Public client not available.')
      setTransferPhase('error')
      return
    }
    if (!safeResult?.safeAddress) {
      setTransferError('Deploy a Safe first.')
      setTransferPhase('error')
      return
    }

    const tokenAddress = transferAddress.trim() as Address
    const amount = transferAmount.trim()

    if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
      setTransferError('Enter a valid token address.')
      setTransferPhase('error')
      return
    }

    if (!amount) {
      setTransferError('Enter an amount (integer or hex string).')
      setTransferPhase('error')
      return
    }

    setActiveStep('transfer')
    setTransferPhase('running')
    setTransferError(null)

    try {
      const activeWalletClient = await ensureWalletOnBase()
      const onboarding = new OnboardingClient({
        walletClient: activeWalletClient,
        publicClient,
        feeConfigFetcher,
      })

      const result = await onboarding.transferAssetFromCallerToSafe({
        safeAddress: safeResult.safeAddress,
        assetAddress: tokenAddress,
        amount,
      })
      setTransferResult(result)
      setTransferPhase('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token transfer failed.'
      setTransferError(message)
      setTransferPhase('error')
    } finally {
      setActiveStep(null)
    }
  }, [
    ensureWalletOnBase,
    feeConfigFetcher,
    publicClient,
    safeResult?.safeAddress,
    transferAddress,
    transferAmount,
  ])

  const handleTransferBack = useCallback(async () => {
    if (!publicClient) {
      setTransferBackError('Public client not available.')
      setTransferBackPhase('error')
      return
    }

    const safeAddressInput = transferBackSafeAddress.trim() as Address
    const tokenAddress = transferBackAddress.trim() as Address
    const amount = transferBackAmount.trim()

    if (
      !safeAddressInput ||
      !safeAddressInput.startsWith('0x') ||
      safeAddressInput.length !== 42
    ) {
      setTransferBackError('Enter a valid Safe address.')
      setTransferBackPhase('error')
      return
    }

    if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
      setTransferBackError('Enter a valid token address.')
      setTransferBackPhase('error')
      return
    }

    if (!amount) {
      setTransferBackError('Enter an amount (integer or hex string).')
      setTransferBackPhase('error')
      return
    }

    setActiveStep('transferBack')
    setTransferBackPhase('running')
    setTransferBackError(null)

    try {
      const activeWalletClient = await ensureWalletOnBase()
      const onboarding = new OnboardingClient({
        walletClient: activeWalletClient,
        publicClient,
        feeConfigFetcher,
      })

      const result = await onboarding.transferAssetFromSafeToSafeOwner({
        safeAddress: safeAddressInput,
        assetAddress: tokenAddress,
        amount,
      })
      setTransferBackResult(result)
      setTransferBackPhase('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token transfer failed.'
      setTransferBackError(message)
      setTransferBackPhase('error')
    } finally {
      setActiveStep(null)
    }
  }, [
    ensureWalletOnBase,
    feeConfigFetcher,
    publicClient,
    transferBackSafeAddress,
    transferBackAddress,
    transferBackAmount,
  ])

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
          Use the connected wallet on Base (<code>{base.name}</code>) to run each onboarding step
          independently.
        </p>

        <div className="step">
          <div className="step__header">
            <div>
              <p className="step__title">1. Deploy Safe</p>
              <p className="step__desc">Creates a single-owner Safe on Base.</p>
            </div>
            <button
              type="button"
              className="button button--primary"
              onClick={handleDeploySafe}
              disabled={!canInteract || activeStep === 'deploy'}
            >
              {deployPhase === 'running' ? 'Deploying...' : 'Deploy Safe'}
            </button>
          </div>
          {deployPhase === 'success' && safeResult && (
            <div className="status status--success">
              <span className="status__label">Safe deployed</span>
              <code className="status__value">{safeResult.safeAddress}</code>
              <p className="status__hint">
                Tx: <code>{safeResult.transactionHash}</code>
              </p>
            </div>
          )}
          {deployPhase === 'error' && deployError && <p className="app__error">{deployError}</p>}
          {deployPhase === 'running' && <p className="app__hint">Check your wallet to confirm.</p>}
        </div>

        <div className="step">
          <div className="step__header">
            <div>
              <p className="step__title">2. Set permissions</p>
              <p className="step__desc">Deploys the Roles module and enables it on the Safe.</p>
            </div>
            <button
              type="button"
              className="button"
              onClick={handleSetPermissions}
              disabled={!canInteract || !safeResult || activeStep === 'permissions'}
            >
              {permissionsPhase === 'running' ? 'Setting...' : 'Set permissions'}
            </button>
          </div>
          {permissionsPhase === 'success' && permissionsResult && (
            <div className="status status--success">
              <span className="status__label">Permissions set</span>
              <div className="status__grid">
                <div>
                  <span className="result__label">Roles address</span>
                  <code className="status__value">{permissionsResult.rolesAddress}</code>
                </div>
                <div>
                  <span className="result__label">Predicted proxy</span>
                  <code className="status__value">{permissionsResult.predictedProxyAddress}</code>
                </div>
              </div>
              <p className="status__hint">
                Tx: <code>{permissionsResult.transactionHash}</code>
              </p>
            </div>
          )}
          {permissionsPhase === 'error' && permissionsError && (
            <p className="app__error">{permissionsError}</p>
          )}
          {permissionsPhase === 'running' && (
            <p className="app__hint">This step is a Safe transaction. Confirm it in your wallet.</p>
          )}
          {!safeResult && <p className="app__hint">Deploy a Safe first to unlock this step.</p>}
        </div>

        <div className="step">
          <div className="step__header">
            <div>
              <p className="step__title">3. Transfer tokens</p>
              <p className="step__desc">Send ERC-20s directly from the owner wallet into the Safe.</p>
            </div>
          </div>
          <div className="form">
            <label className="form__label" htmlFor="tokenAddress">
              Token address
            </label>
            <input
              id="tokenAddress"
              className="form__input"
              placeholder="0x..."
              value={transferAddress}
              onChange={(event) => setTransferAddress(event.target.value)}
              autoComplete="off"
            />
            <label className="form__label" htmlFor="tokenAmount">
              Amount (integer or hex string)
            </label>
            <input
              id="tokenAmount"
              className="form__input"
              placeholder="e.g. 1000000 for 1 USDC (6 decimals)"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
              autoComplete="off"
            />
            <div className="button-group">
              <button
                type="button"
                className="button"
                onClick={handleTransfer}
                disabled={!canInteract || !safeResult || activeStep === 'transfer'}
              >
                {transferPhase === 'running' ? 'Transferring...' : 'Transfer tokens'}
              </button>
            </div>
          </div>
          {transferPhase === 'success' && transferResult && (
            <div className="status status--success">
              <span className="status__label">Tokens transferred</span>
              <p className="status__hint">
                Tx: <code>{transferResult.transactionHash as Hex}</code>
              </p>
            </div>
          )}
          {transferPhase === 'error' && transferError && <p className="app__error">{transferError}</p>}
          {!safeResult && <p className="app__hint">Deploy a Safe first to fund it.</p>}
        </div>

        <div className="step">
          <div className="step__header">
            <div>
              <p className="step__title">4. Transfer tokens to owner</p>
              <p className="step__desc">
                Send ERC-20s from any deployed Safe back to its single owner.
              </p>
            </div>
          </div>
          <div className="form">
            <label className="form__label" htmlFor="safeBackAddress">
              Safe address
            </label>
            <input
              id="safeBackAddress"
              className="form__input"
              placeholder="0x..."
              value={transferBackSafeAddress}
              onChange={(event) => setTransferBackSafeAddress(event.target.value)}
              autoComplete="off"
            />
            <label className="form__label" htmlFor="tokenBackAddress">
              Token address
            </label>
            <input
              id="tokenBackAddress"
              className="form__input"
              placeholder="0x..."
              value={transferBackAddress}
              onChange={(event) => setTransferBackAddress(event.target.value)}
              autoComplete="off"
            />
            <label className="form__label" htmlFor="tokenBackAmount">
              Amount (integer or hex string)
            </label>
            <input
              id="tokenBackAmount"
              className="form__input"
              placeholder="e.g. 1000000 for 1 USDC (6 decimals)"
              value={transferBackAmount}
              onChange={(event) => setTransferBackAmount(event.target.value)}
              autoComplete="off"
            />
            <div className="button-group">
              <button
                type="button"
                className="button"
                onClick={handleTransferBack}
                disabled={!canInteract || activeStep === 'transferBack'}
              >
                {transferBackPhase === 'running' ? 'Transferring...' : 'Transfer to owner'}
              </button>
            </div>
          </div>
          {transferBackPhase === 'success' && transferBackResult && (
            <div className="status status--success">
              <span className="status__label">Tokens sent to owner</span>
              <p className="status__hint">
                Tx: <code>{transferBackResult.transactionHash as Hex}</code>
              </p>
            </div>
          )}
          {transferBackPhase === 'error' && transferBackError && (
            <p className="app__error">{transferBackError}</p>
          )}
          {transferBackPhase === 'running' && (
            <p className="app__hint">This step submits a Safe transaction. Confirm it in your wallet.</p>
          )}
        </div>

        {isConnected && !isOnBase && (
          <p className="app__error">Please switch your wallet to the Base network before onboarding.</p>
        )}
      </section>
    </div>
  )
}

export default App
