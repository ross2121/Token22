"use client"

import { useCallback, useMemo, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getKnownMints, getPools, simulateAndSwap } from "@/lib/solana-hooks"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function Swap() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, sendTransaction } = useWallet()
  const { toast } = useToast()

  const mints = useMemo(() => getKnownMints(), [])
  const pools = useMemo(() => getPools(), [])
  const [mintIn, setMintIn] = useState(mints[0]?.mint || "")
  const [mintOut, setMintOut] = useState(mints[1]?.mint || "")
  const [amountIn, setAmountIn] = useState(100)
  const [slippageBps, setSlippageBps] = useState(50) // 0.5%

  const onSwap = useCallback(async () => {
    if (!publicKey || !signTransaction || !sendTransaction) {
      toast({ title: "Connect your wallet", description: "Please connect your wallet to continue.", variant: "destructive" })
      return
    }
    try {
      const sig = await simulateAndSwap({
        connection,
        walletPublicKey: publicKey,
        signTransaction: async (tx) => await signTransaction(tx),
        sendRaw: async (tx) => {
          const sig = await connection.sendRawTransaction(tx.serialize())
          await connection.confirmTransaction(sig, "confirmed")
          return sig
        },
        mintIn: new PublicKey(mintIn),
        mintOut: new PublicKey(mintOut),
        humanAmountIn: amountIn,
        slippageBps,
      })
      toast({ title: "Swap success", description: `Signature: ${sig}` })
    } catch (e: any) {
      toast({ title: "Swap failed", description: e?.message ?? "Unknown error", variant: "destructive" })
    }
  }, [publicKey, signTransaction, sendTransaction, connection, toast, mintIn, mintOut, amountIn, slippageBps])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swap</CardTitle>
        <CardDescription>Get a quote from the local pool and perform a swap with transfer-hook support and pre-transfer simulation.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Token In</Label>
            <Select value={mintIn} onValueChange={setMintIn}>
              <SelectTrigger><SelectValue placeholder="Select token" /></SelectTrigger>
              <SelectContent>
                {mints.map((m) => (
                  <SelectItem key={m.mint} value={m.mint}>
                    {m.symbol} ({m.mint.slice(0, 4)}...{m.mint.slice(-4)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Token Out</Label>
            <Select value={mintOut} onValueChange={setMintOut}>
              <SelectTrigger><SelectValue placeholder="Select token" /></SelectTrigger>
              <SelectContent>
                {mints.map((m) => (
                  <SelectItem key={m.mint} value={m.mint}>
                    {m.symbol} ({m.mint.slice(0, 4)}...{m.mint.slice(-4)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Amount In (human)</Label>
            <Input type="number" min={0} value={amountIn} onChange={(e) => setAmountIn(Number(e.target.value || 0))} />
          </div>
          <div className="grid gap-2">
            <Label>Slippage (bps)</Label>
            <Input type="number" min={0} value={slippageBps} onChange={(e) => setSlippageBps(Number(e.target.value || 0))} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          This demo identifies your local pools and includes hook remaining accounts. If your hook program needs more accounts, please update the whitelist config.
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={onSwap} disabled={!mintIn || !mintOut || mintIn === mintOut}>Swap</Button>
      </CardFooter>
    </Card>
  )
}
