"use client"

import { type ReactNode, useMemo } from "react"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets"
import { clusterApiUrl } from "@solana/web3.js"
import "@solana/wallet-adapter-react-ui/styles.css"

export function WalletProviderUI({ children }: { children?: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), [])
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {/* The modal provider gives you the default UI for selecting wallets */}
        <WalletModalProvider>
          <header className="flex items-center justify-between gap-4 mb-6">
            <div className="text-xl font-semibold">{"Hook-Safe AMM Router"}</div>
            <WalletMultiButton />
          </header>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
