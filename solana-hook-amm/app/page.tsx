"use client"

import { useEffect, useMemo, useState } from "react"
import { Toaster } from "@/components/ui/toaster"
import { ToastProviderUI } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeProvider } from "@/components/theme-provider"
import { WalletProviderUI } from "@/components/solana/wallet-provider"
import { PoolProvider } from "@/lib/pool-context"
import CreateHookedToken from "@/components/create-hooked-token"
import CreatePool from "@/components/create-pool"
import Swap from "@/components/swap"
import PoolList from "@/components/pool-list"
import OrcaPools from "@/components/orca-pools"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldCheck, TriangleAlert } from 'lucide-react'

export default function Page() {
    const [defaultTab, setDefaultTab] = useState("create-pool")

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : ""
    if (hash && ["create-token", "create-pool", "swap", "pools"].includes(hash)) {
      setDefaultTab(hash)
    }
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ToastProviderUI>
      <WalletProviderUI>
        <PoolProvider>
        <main className="min-h-screen mx-auto max-w-5xl px-4 py-8">
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Hook-Safe AMM Router (Devnet Demo)</CardTitle>
                <CardDescription>
                  Create Token-2022 mints with Transfer Hooks, make a pool, and trade with pre-transfer simulation and hook whitelisting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>How it works</AlertTitle>
                  <AlertDescription>
                    - This demo uses a constant-product pool with vaults owned by your wallet (custodial, for demonstration only).
                    - Swap transactions include extra accounts for Transfer Hooks and simulate before sending.
                    - Add your Transfer Hook program ID to the whitelist, then create a hooked mint and trade it here.
                  </AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Limitations</AlertTitle>
                  <AlertDescription>
                    Permissionless multi-user trading requires an on-chain AMM that passes hook remaining accounts. This demo showcases the full flow and can be used to prototype a whitelist-based hook approval system and middleware relayer.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue={defaultTab} className="w-full" onValueChange={(v) => { if (typeof window !== "undefined") window.location.hash = v }}>
                            <TabsList className="flex flex-wrap">
                  <TabsTrigger value="create-token">Create Hooked Token</TabsTrigger>
                  <TabsTrigger value="create-pool">Create Pool</TabsTrigger>
                  <TabsTrigger value="swap">Swap</TabsTrigger>
                  <TabsTrigger value="pools">My Pools</TabsTrigger>
                  <TabsTrigger value="orca">Orca Pools</TabsTrigger>
                </TabsList>
            <TabsContent value="create-token" className="mt-4">
              <CreateHookedToken />
            </TabsContent>
            <TabsContent value="create-pool" className="mt-4">
              <CreatePool />
            </TabsContent>
            <TabsContent value="swap" className="mt-4">
              <Swap />
            </TabsContent>
            <TabsContent value="pools" className="mt-4">
              <PoolList />
            </TabsContent>
            <TabsContent value="orca" className="mt-4">
              <OrcaPools />
            </TabsContent>
          </Tabs>
        </main>
        <Toaster />
        </PoolProvider>
      </WalletProviderUI>
      </ToastProviderUI>
    </ThemeProvider>
  )
}
