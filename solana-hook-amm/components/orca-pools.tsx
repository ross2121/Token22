"use client"

import { useCallback, useState, useEffect } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { WSOL_MINT } from "@/lib/amm-client"
import { Loader2 } from "lucide-react"

export default function OrcaPools() {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const { toast } = useToast()
  const [isMounted, setIsMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Pool Creation State
  const [tokenAMint, setTokenAMint] = useState("")
  const [tokenBMint, setTokenBMint] = useState("")
  const [initialPrice, setInitialPrice] = useState(1.0)
  const [useWSolA, setUseWSolA] = useState(false)
  const [useWSolB, setUseWSolB] = useState(false)
  const [createdPools, setCreatedPools] = useState<Array<{
    address: string;
    tokenA: string;
    tokenB: string;
    price: number;
  }>>([])

  // Liquidity Management State
  const [selectedPoolAddress, setSelectedPoolAddress] = useState("")
  const [liquidityTokenAAmount, setLiquidityTokenAAmount] = useState(100)
  const [liquidityTokenBAmount, setLiquidityTokenBAmount] = useState(100)
  const [removeLiquidityAmount, setRemoveLiquidityAmount] = useState("")
  const [tickLower, setTickLower] = useState(-1000)
  const [tickUpper, setTickUpper] = useState(1000)

  // Swap State
  const [swapPoolAddress, setSwapPoolAddress] = useState("")
  const [inputTokenMint, setInputTokenMint] = useState("")
  const [outputTokenMint, setOutputTokenMint] = useState("")
  const [swapInputAmount, setSwapInputAmount] = useState(10)
  const [minOutputAmount, setMinOutputAmount] = useState(9)
  const [slippageTolerance, setSlippageTolerance] = useState(1)

  // Pool Info State
  const [poolInfoAddress, setPoolInfoAddress] = useState("")
  const [poolInfo, setPoolInfo] = useState<any>(null)

  const effectiveTokenAMint = useWSolA ? WSOL_MINT.toBase58() : tokenAMint
  const effectiveTokenBMint = useWSolB ? WSOL_MINT.toBase58() : tokenBMint

  // Don't render until mounted to avoid SSR issues
  if (!isMounted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading Orca Whirlpools...</CardTitle>
            <CardDescription>
              <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
              Initializing Orca integration
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const onCreatePool = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    
    setIsLoading(true)
    try {
      if (!effectiveTokenAMint || !effectiveTokenBMint) {
        return toast({ title: "Please provide both token mints", variant: "destructive" })
      }

      // Placeholder implementation - Orca SDK integration coming soon
      toast({
        title: "Orca Integration",
        description: `Ready to create pool for ${effectiveTokenAMint.slice(0, 8)}... and ${effectiveTokenBMint.slice(0, 8)}... at price ${initialPrice}. Full integration coming soon!`,
      })

      const newPool = {
        address: PublicKey.default.toBase58(),
        tokenA: effectiveTokenAMint,
        tokenB: effectiveTokenBMint,
        price: initialPrice
      }

      setCreatedPools(prev => [...prev, newPool])

    } catch (e: any) {
      console.error("Pool creation error:", e)
      toast({ title: "Pool creation failed", description: e?.message ?? "Unknown", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [connected, effectiveTokenAMint, effectiveTokenBMint, initialPrice, toast])

  const onAddLiquidity = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    
    setIsLoading(true)
    try {
      if (!selectedPoolAddress) {
        return toast({ title: "Please select a pool", variant: "destructive" })
      }

      toast({
        title: "Add Liquidity Ready",
        description: `Ready to add ${liquidityTokenAAmount} + ${liquidityTokenBAmount} liquidity to pool ${selectedPoolAddress.slice(0, 8)}... Full integration coming soon!`,
      })

    } catch (e: any) {
      console.error("Add liquidity error:", e)
      toast({ title: "Add liquidity failed", description: e?.message ?? "Unknown", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [connected, selectedPoolAddress, liquidityTokenAAmount, liquidityTokenBAmount, slippageTolerance, toast])

  const onRemoveLiquidity = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    
    setIsLoading(true)
    try {
      if (!selectedPoolAddress || !removeLiquidityAmount) {
        return toast({ title: "Please provide pool address and liquidity amount", variant: "destructive" })
      }

      toast({
        title: "Remove Liquidity Ready",
        description: `Ready to remove ${removeLiquidityAmount} liquidity from pool. Full integration coming soon!`,
      })

    } catch (e: any) {
      console.error("Remove liquidity error:", e)
      toast({ title: "Remove liquidity failed", description: e?.message ?? "Unknown", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [connected, selectedPoolAddress, removeLiquidityAmount, tickLower, tickUpper, slippageTolerance, toast])

  const onSwap = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    
    setIsLoading(true)
    try {
      if (!swapPoolAddress || !inputTokenMint || !outputTokenMint) {
        return toast({ title: "Please provide all swap details", variant: "destructive" })
      }

      toast({
        title: "Swap Ready",
        description: `Ready to swap ${swapInputAmount} of ${inputTokenMint.slice(0, 8)}... for ${outputTokenMint.slice(0, 8)}... Full integration coming soon!`,
      })

    } catch (e: any) {
      console.error("Swap error:", e)
      toast({ title: "Swap failed", description: e?.message ?? "Unknown", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [connected, swapPoolAddress, inputTokenMint, outputTokenMint, swapInputAmount, minOutputAmount, slippageTolerance, toast])

  const onGetPoolInfo = useCallback(async () => {
    setIsLoading(true)
    try {
      if (!poolInfoAddress) {
        return toast({ title: "Please provide pool address", variant: "destructive" })
      }

      // Placeholder pool info
      const info = {
        tokenMintA: PublicKey.default,
        tokenMintB: PublicKey.default,
        tickCurrentIndex: 0,
        sqrtPrice: "0",
        liquidity: "0",
        feeRate: 300, // 0.3%
        tickSpacing: 64,
      }
      
      setPoolInfo(info)
      
      toast({
        title: "Pool Info Ready",
        description: `Ready to fetch info for pool ${poolInfoAddress.slice(0, 8)}... Full integration coming soon!`
      })

    } catch (e: any) {
      console.error("Get pool info error:", e)
      toast({ title: "Failed to get pool info", description: e?.message ?? "Unknown", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [poolInfoAddress, toast])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Orca Whirlpools</CardTitle>
          <CardDescription>
            Create and manage concentrated liquidity pools using Orca's Whirlpools protocol
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="create">Create Pool</TabsTrigger>
          <TabsTrigger value="liquidity">Manage Liquidity</TabsTrigger>
          <TabsTrigger value="swap">Swap</TabsTrigger>
          <TabsTrigger value="info">Pool Info</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Splash Pool</CardTitle>
              <CardDescription>
                Create a new concentrated liquidity pool with Orca Whirlpools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Token A Mint</Label>
                <Input 
                  value={useWSolA ? WSOL_MINT.toBase58() : tokenAMint}
                  onChange={(e) => setTokenAMint(e.target.value)}
                  disabled={useWSolA}
                  placeholder="Token A mint address" 
                />
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="useWSolA"
                    checked={useWSolA}
                    onCheckedChange={(checked) => setUseWSolA(checked === true)}
                  />
                  <Label htmlFor="useWSolA">Use WSOL for Token A</Label>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Token B Mint</Label>
                <Input 
                  value={useWSolB ? WSOL_MINT.toBase58() : tokenBMint}
                  onChange={(e) => setTokenBMint(e.target.value)}
                  disabled={useWSolB}
                  placeholder="Token B mint address" 
                />
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="useWSolB"
                    checked={useWSolB}
                    onCheckedChange={(checked) => setUseWSolB(checked === true)}
                  />
                  <Label htmlFor="useWSolB">Use WSOL for Token B</Label>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Initial Price (Token B per Token A)</Label>
                <Input 
                  type="number" 
                  value={initialPrice} 
                  onChange={(e) => setInitialPrice(Number(e.target.value))}
                  step="0.000001"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={onCreatePool} 
                disabled={!connected || isLoading || !effectiveTokenAMint || !effectiveTokenBMint}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Pool...
                  </>
                ) : (
                  "Create Splash Pool"
                )}
              </Button>
            </CardFooter>
          </Card>

          {createdPools.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Created Pools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {createdPools.map((pool, index) => (
                    <div key={index} className="p-3 border rounded-md">
                      <p><strong>Pool:</strong> {pool.address.slice(0, 8)}...{pool.address.slice(-8)}</p>
                      <p><strong>Token A:</strong> {pool.tokenA.slice(0, 8)}...</p>
                      <p><strong>Token B:</strong> {pool.tokenB.slice(0, 8)}...</p>
                      <p><strong>Initial Price:</strong> {pool.price}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="liquidity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manage Liquidity</CardTitle>
              <CardDescription>
                Add or remove liquidity from Orca Whirlpools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Pool Address</Label>
                <Input 
                  value={selectedPoolAddress} 
                  onChange={(e) => setSelectedPoolAddress(e.target.value)}
                  placeholder="Whirlpool address" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Token A Amount</Label>
                  <Input 
                    type="number" 
                    value={liquidityTokenAAmount} 
                    onChange={(e) => setLiquidityTokenAAmount(Number(e.target.value))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Token B Amount</Label>
                  <Input 
                    type="number" 
                    value={liquidityTokenBAmount} 
                    onChange={(e) => setLiquidityTokenBAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tick Lower</Label>
                  <Input 
                    type="number" 
                    value={tickLower} 
                    onChange={(e) => setTickLower(Number(e.target.value))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tick Upper</Label>
                  <Input 
                    type="number" 
                    value={tickUpper} 
                    onChange={(e) => setTickUpper(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Slippage Tolerance (%)</Label>
                <Input 
                  type="number" 
                  value={slippageTolerance} 
                  onChange={(e) => setSlippageTolerance(Number(e.target.value))}
                  step="0.1"
                  max="10"
                  min="0.1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={onAddLiquidity} 
                  disabled={!connected || isLoading || !selectedPoolAddress}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add Liquidity
                </Button>
                
                <Button 
                  onClick={onRemoveLiquidity} 
                  disabled={!connected || isLoading || !selectedPoolAddress}
                  variant="outline"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Remove Liquidity
                </Button>
              </div>

              <div className="grid gap-2">
                <Label>Liquidity Amount to Remove</Label>
                <Input 
                  value={removeLiquidityAmount} 
                  onChange={(e) => setRemoveLiquidityAmount(e.target.value)}
                  placeholder="Liquidity amount (BN string)" 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="swap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Swap Tokens</CardTitle>
              <CardDescription>
                Swap tokens using Orca Whirlpools
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Pool Address</Label>
                <Input 
                  value={swapPoolAddress} 
                  onChange={(e) => setSwapPoolAddress(e.target.value)}
                  placeholder="Whirlpool address" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Input Token Mint</Label>
                  <Input 
                    value={inputTokenMint} 
                    onChange={(e) => setInputTokenMint(e.target.value)}
                    placeholder="Input token mint" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Output Token Mint</Label>
                  <Input 
                    value={outputTokenMint} 
                    onChange={(e) => setOutputTokenMint(e.target.value)}
                    placeholder="Output token mint" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Input Amount</Label>
                  <Input 
                    type="number" 
                    value={swapInputAmount} 
                    onChange={(e) => setSwapInputAmount(Number(e.target.value))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Minimum Output</Label>
                  <Input 
                    type="number" 
                    value={minOutputAmount} 
                    onChange={(e) => setMinOutputAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Slippage Tolerance (%)</Label>
                <Input 
                  type="number" 
                  value={slippageTolerance} 
                  onChange={(e) => setSlippageTolerance(Number(e.target.value))}
                  step="0.1"
                  max="10"
                  min="0.1"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={onSwap} 
                disabled={!connected || isLoading || !swapPoolAddress || !inputTokenMint || !outputTokenMint}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Swapping...
                  </>
                ) : (
                  "Swap Tokens"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pool Information</CardTitle>
              <CardDescription>
                Fetch detailed information about a Whirlpool
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Pool Address</Label>
                <Input 
                  value={poolInfoAddress} 
                  onChange={(e) => setPoolInfoAddress(e.target.value)}
                  placeholder="Whirlpool address" 
                />
              </div>
              
              <Button 
                onClick={onGetPoolInfo} 
                disabled={isLoading || !poolInfoAddress}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Info...
                  </>
                ) : (
                  "Get Pool Info"
                )}
              </Button>

              {poolInfo && (
                <div className="p-4 border rounded-md space-y-2">
                  <h4 className="font-semibold">Pool Information</h4>
                  <p><strong>Token A:</strong> {poolInfo.tokenMintA.toBase58()}</p>
                  <p><strong>Token B:</strong> {poolInfo.tokenMintB.toBase58()}</p>
                  <p><strong>Current Tick:</strong> {poolInfo.tickCurrentIndex}</p>
                  <p><strong>Sqrt Price:</strong> {poolInfo.sqrtPrice}</p>
                  <p><strong>Liquidity:</strong> {poolInfo.liquidity}</p>
                  <p><strong>Fee Rate:</strong> {poolInfo.feeRate} bps</p>
                  <p><strong>Tick Spacing:</strong> {poolInfo.tickSpacing}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">Wallet: {publicKey?.toBase58().slice(0, 8)}...</Badge>
            <Badge variant="outline">Orca Whirlpools</Badge>
            <Badge variant="outline">Concentrated Liquidity</Badge>
            <Badge variant="outline">Splash Pools</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}