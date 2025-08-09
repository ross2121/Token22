"use client"

import { useCallback, useEffect, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getAmmClient } from "@/lib/amm-client"
import { Badge } from "@/components/ui/badge"
import { usePool } from "@/lib/pool-context"
import * as anchor from "@coral-xyz/anchor"

export default function PoolList() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  const { toast } = useToast()
  const { pools, addPool, selectedPoolSeed, setSelectedPoolSeed } = usePool()
  
  const [programId, setProgramId] = useState("AwovFVc8D64taLRrHjmg4ZeNSh6xnZGTbd2Arv6kbcwd")
  const [seedToFetch, setSeedToFetch] = useState("")
  const [loading, setLoading] = useState(false)

  const connected = !!publicKey && !!signTransaction && !!signAllTransactions

  const fetchPoolBySeed = useCallback(async (seed: number) => {
    if (!connected) return
    
    try {
      setLoading(true)
      const { program } = await getAmmClient(connection, { publicKey, signTransaction, signAllTransactions }, programId);
      
      // Derive the config PDA for this seed
      const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), new anchor.BN(seed).toArrayLike(Buffer, "le", 8)], program.programId);
      
      // Try to fetch the pool state
      const poolState = await program.account.config.fetch(config);
      console.log("Fetched pool state:", poolState);
      
      // Derive other addresses
      const [lpToken] = PublicKey.findProgramAddressSync([Buffer.from("lp"), config.toBuffer()], program.programId);
      const vaultX = PublicKey.findProgramAddressSync([config.toBuffer(), Buffer.from([6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169]), poolState.mintx.toBuffer()], new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"))[0];
      const vaultY = PublicKey.findProgramAddressSync([config.toBuffer(), Buffer.from([6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169]), poolState.minty.toBuffer()], new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"))[0];
      
      const poolData = {
        seed: poolState.seed.toNumber(),
        authority: poolState.authority?.toBase58() || "",
        mintX: poolState.mintx.toBase58(),
        mintY: poolState.minty.toBase58(),
        fee: poolState.fee,
        bump: poolState.configBump || 0,
        config: config.toBase58(),
        lpToken: lpToken.toBase58(),
        vaultX: vaultX.toBase58(),
        vaultY: vaultY.toBase58(),
      }
      
      // Add to shared pool context
      addPool(poolData)
      
      toast({ title: "Pool Found", description: `Seed ${seed} pool loaded successfully` })
    } catch (e: any) {
      console.log("Error fetching pool:", e);
      toast({ title: "Pool Not Found", description: `No pool found for seed ${seed}`, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [connected, connection, programId, publicKey, signTransaction, signAllTransactions, toast])

  const onFetchPool = useCallback(async () => {
    const seed = parseInt(seedToFetch)
    if (!seed || isNaN(seed)) {
      toast({ title: "Invalid Seed", description: "Please enter a valid seed number", variant: "destructive" })
      return
    }
    await fetchPoolBySeed(seed)
  }, [seedToFetch, fetchPoolBySeed, toast])

  const onRefreshAll = useCallback(async () => {
    if (pools.length === 0) return
    
    setLoading(true)
    for (const pool of pools) {
      await fetchPoolBySeed(pool.seed)
    }
    setLoading(false)
  }, [pools, fetchPoolBySeed])

  const handlePoolSelect = useCallback((seed: number) => {
    setSelectedPoolSeed(seed)
    toast({ title: "Pool Selected", description: `Pool with seed ${seed} is now selected for operations` })
  }, [setSelectedPoolSeed, toast])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My AMM Pools</CardTitle>
          <CardDescription>Fetch and view your AMM pools by seed number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Program ID</Label>
            <Input value={programId} onChange={(e) => setProgramId(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Pool Seed</Label>
              <Input 
                type="number" 
                value={seedToFetch} 
                onChange={(e) => setSeedToFetch(e.target.value)} 
                placeholder="Enter seed number (e.g. 13412)"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={onFetchPool} disabled={!connected || loading}>
                {loading ? "Fetching..." : "Fetch Pool"}
              </Button>
            </div>
          </div>
          {pools.length > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={onRefreshAll} disabled={loading}>
                Refresh All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {pools.length === 0 ? (
    <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              No pools fetched yet. Enter a seed number above to fetch your pool.
            </div>
          </CardContent>
        </Card>
      ) : (
                <div className="space-y-4">
          {pools.map((pool) => (
            <Card key={pool.seed} className={selectedPoolSeed === pool.seed ? "ring-2 ring-blue-500" : ""}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Pool Seed: {pool.seed}</CardTitle>
                    <CardDescription>Fee: {pool.fee} bps | Bump: {pool.bump}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedPoolSeed === pool.seed ? (
                      <Badge variant="default">Selected</Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handlePoolSelect(pool.seed)}
                      >
                        Select for Operations
                      </Button>
                    )}
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </div>
              </CardHeader>
      <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>
                      <div className="font-medium text-sm">Mint X</div>
                      <div className="text-sm text-muted-foreground break-all">{pool.mintX}</div>
                    </div>
                    <div>
                      <div className="font-medium text-sm">Vault X</div>
                      <div className="text-sm text-muted-foreground break-all">{pool.vaultX}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="font-medium text-sm">Mint Y</div>
                      <div className="text-sm text-muted-foreground break-all">{pool.mintY}</div>
                    </div>
                <div>
                      <div className="font-medium text-sm">Vault Y</div>
                      <div className="text-sm text-muted-foreground break-all">{pool.vaultY}</div>
                    </div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <div className="font-medium text-sm">Authority</div>
                    <div className="text-sm text-muted-foreground break-all">{pool.authority}</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">LP Token</div>
                    <div className="text-sm text-muted-foreground break-all">{pool.lpToken}</div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="font-medium text-sm">Config Address</div>
                  <div className="text-sm text-muted-foreground break-all">{pool.config}</div>
            </div>
      </CardContent>
    </Card>
          ))}
        </div>
      )}
    </div>
  )
}
