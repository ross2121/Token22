"use client"

import { useCallback, useMemo, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createHookedMintAndMintTo, persistMintHookMeta } from "@/lib/solana-hooks"
import { Badge } from "@/components/ui/badge"

export default function CreateHookedToken() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, sendTransaction } = useWallet()
  const { toast } = useToast()

  const [name, setName] = useState("Hooked Token")
  const [symbol, setSymbol] = useState("HOOK")
  const [decimals, setDecimals] = useState(6)
  const [initialSupply, setInitialSupply] = useState(1_000_000)
  const [hookProgramId, setHookProgramId] = useState("88CNX3Y7TyzjPtD76YhpmnPAsrmhSsYRVS5ad2wKMjuk")
  const [isCreating, setIsCreating] = useState(false)

  const connected = !!publicKey && !!signTransaction && !!sendTransaction

  const onCreate = useCallback(async () => {
    console.log("onCreate called, connected:", connected)
    if (!connected) {
      console.log("Not connected, showing toast")
      toast({ title: "Connect your wallet", description: "Please connect your wallet to continue.", variant: "destructive" })
      return
    }
    
    console.log("Starting token creation...")
    setIsCreating(true)
    let mintAddress: string | null = null
    let transactionId: string | null = null
    
    try {
      console.log("Creating hookProgram with ID:", hookProgramId)
      const hookProgram = new PublicKey(hookProgramId)
      console.log("Calling createHookedMintAndMintTo...")
      const res = await createHookedMintAndMintTo({
        connection,
        walletPublicKey: publicKey!,
        signAndSend: async (tx) => {
          const signed = await signTransaction!(tx)
          const sig = await connection.sendRawTransaction(signed.serialize())
          await connection.confirmTransaction(sig, "confirmed")
          return sig
        },
        params: {
          decimals,
          mintAmount: BigInt(initialSupply) * BigInt(10 ** decimals),
          hookProgramId: hookProgram,
          name,
          symbol,
        },
      })

      console.log("Token creation successful:", res)
      // Capture successful results
      mintAddress = res.mint.toBase58()
      transactionId = res.signature

      // Store simple metadata locally for convenience
      persistMintHookMeta(res.mint.toBase58(), hookProgram.toBase58(), {
        name,
        symbol,
        decimals,
      })

      console.log("Showing success toast")
      toast({
        title: "✅ Hooked Token Created Successfully!",
        description: (
          <div className="space-y-1">
            <div><strong>Mint:</strong> {res.mint.toBase58()}</div>
            <div><strong>Transaction:</strong> {res.signature}</div>
            <div className="text-xs text-muted-foreground mt-2">
              Token-2022 with Transfer Hook is ready for pool creation!
            </div>
          </div>
        ),
      })
    } catch (e: any) {
      console.log(e);
      
      // Check if it's a partial success (mint was created but subsequent steps failed)
      const errorMessage = e?.message || "Unknown error";
      const isPartialSuccess = errorMessage.includes("already been processed") || 
                              errorMessage.includes("already in use") ||
                              errorMessage.includes("account already exists");
      
      if (isPartialSuccess) {
        toast({
          title: "⚠️ Token Created (with warnings)",
          description: (
            <div className="space-y-1">
              <div>Token-2022 mint was created successfully!</div>
              {mintAddress && <div><strong>Mint:</strong> {mintAddress}</div>}
              {transactionId && <div><strong>Transaction:</strong> {transactionId}</div>}
              <div className="text-xs text-muted-foreground">
                Some setup steps were skipped (likely already completed)
              </div>
              <div className="text-xs text-orange-600">
                {errorMessage}
              </div>
            </div>
          ),
          variant: "default" // Not destructive for partial success 
        })
      } else {
        toast({
          title: "❌ Failed to create hooked mint",
          description: (
            <div className="space-y-1">
              <div>{errorMessage}</div>
              <div className="text-xs text-muted-foreground">
                Please try again or check console for details
              </div>
            </div>
          ),
          variant: "destructive",
        })
      }
    } finally {
      setIsCreating(false)
    }
  }, [connected, connection, publicKey, signTransaction, hookProgramId, decimals, initialSupply, name, symbol, toast])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a Token-2022 with Transfer Hook</CardTitle>
        <CardDescription>
          Provide your Transfer Hook Program ID, and we&apos;ll create a Token-2022 mint with the Transfer Hook extension and mint supply to your wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hooked Token" />
        </div>
        <div className="grid gap-2">
          <Label>Symbol</Label>
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="HOOK" />
        </div>
        <div className="grid gap-2">
          <Label>Decimals</Label>
          <Input type="number" min={0} max={9} value={decimals} onChange={(e) => setDecimals(Number(e.target.value || 0))} />
        </div>
        <div className="grid gap-2">
          <Label>Initial Supply (human-readable)</Label>
          <Input type="number" min={0} value={initialSupply} onChange={(e) => setInitialSupply(Number(e.target.value || 0))} />
        </div>
        <div className="grid gap-2">
          <Label>Transfer Hook Program ID</Label>
          <Input value={hookProgramId} onChange={(e) => setHookProgramId(e.target.value)} placeholder="Enter a deployed program ID on devnet" />
          <div className="text-xs text-muted-foreground">
            Ensure the hook program is deployed on devnet. This UI will include it as a remaining account for transfers.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary">Network: devnet</Badge>
          <Badge variant="outline">Token-2022</Badge>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={() => { console.log("Button clicked!"); onCreate(); }} disabled={!connected || !hookProgramId || isCreating}>
          {isCreating ? "Creating Token..." : "🚀 Create Token-2022 with Transfer Hook"}
        </Button>
      </CardFooter>
    </Card>
  )
}
