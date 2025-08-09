"use client"

import { useCallback, useMemo, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey, SystemProgram } from "@solana/web3.js"
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getMint } from "@solana/spl-token"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { depositLiquidity, swapTokens, withdrawLiquidity, WSOL_MINT, getAmmClient, enableHooks } from "@/lib/amm-client"
import { getKnownMints } from "@/lib/solana-hooks"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { usePool } from "@/lib/pool-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import * as anchor from "@coral-xyz/anchor"

// Helper function to detect which token program a mint uses
async function detectTokenProgram(connection: any, mintPubkey: PublicKey): Promise<PublicKey> {
  try {
    await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
    return TOKEN_2022_PROGRAM_ID;
  } catch {
    return TOKEN_PROGRAM_ID;
  }
}

export default function CreatePool() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  const { toast } = useToast()
  const { pools, addPool, selectedPoolSeed, setSelectedPoolSeed, getPoolBySeed } = usePool()

  const [programId, setProgramId] = useState("3D6uyMfYh3s315PgTRJQNsTNYfThWKoCfUaG1we6ZC8c")
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000000))
  const [feeBps, setFeeBps] = useState(2)
  const [mintX, setMintX] = useState("")
  const [mintY, setMintY] = useState("")
  const [useSolX, setUseSolX] = useState(false)
  const [useSolY, setUseSolY] = useState(false)

  const [lAmount, setLAmount] = useState(2)
  const [maxX, setMaxX] = useState(6)
  const [maxY, setMaxY] = useState(6)

  const [swapAmount, setSwapAmount] = useState(2)
  const [isX, setIsX] = useState(true)
  const [minReceive, setMinReceive] = useState(1)
  const [enableHookFees, setEnableHookFees] = useState(false)

  // Get selected pool data
  const selectedPool = selectedPoolSeed ? getPoolBySeed(selectedPoolSeed) : null
  const knownMints = getKnownMints()

  const connected = !!publicKey && !!signTransaction && !!signAllTransactions
  const effMintX = useMemo(() => (useSolX ? WSOL_MINT.toBase58() : mintX), [useSolX, mintX])
  const effMintY = useMemo(() => (useSolY ? WSOL_MINT.toBase58() : mintY), [useSolY, mintY])

  const onInit = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" });
    
    // Validate mint inputs
    if (!mintX.trim()) {
      return toast({ 
        title: "Missing Token-2022 Mint", 
        description: "Please enter a Token-2022 mint address or create one first and use 'Use Latest Created Token'",
        variant: "destructive" 
      });
    }
    
    // Validate that mintX is a valid public key
    try {
      new PublicKey(mintX);
    } catch (e) {
      return toast({ 
        title: "Invalid Token-2022 Mint", 
        description: "The Token-2022 mint address is not a valid Solana public key",
        variant: "destructive" 
      });
    }
    
    try {
      // Generate a new random seed for each pool creation attempt to avoid conflicts
      const newSeed = Math.floor(Math.random() * 1000000) + Date.now() % 1000000;
      setSeed(newSeed);
      console.log("Using seed:", newSeed);
      
      const { program } = await getAmmClient(connection, { publicKey, signTransaction, signAllTransactions }, programId);
      const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), new anchor.BN(newSeed).toArrayLike(Buffer, "le", 8)], program.programId);

             // For SOL + Token-2022 pool: mintX is the Token-2022, mintY should be WSOL
       console.log("effMintX:", effMintX);
       console.log("Using WSOL for mintY automatically");
       
       const mintXPubkey = new PublicKey(effMintX); // Token-2022 mint
       const mintYPubkey = WSOL_MINT; // Always use WSOL for SOL trading
       
       const tokenProgramX = await detectTokenProgram(connection, mintXPubkey);
       const tokenProgramY = TOKEN_2022_PROGRAM_ID; // WSOL uses Token-2022
       
       console.log("Mint X uses:", tokenProgramX === TOKEN_2022_PROGRAM_ID ? "Token-2022" : "Token Program");
       console.log("Mint Y uses: Token-2022 (WSOL)");
       
       // For the deployed program: mint (Token-2022) + wsol_mint (WSOL)
       const tokenMint = mintXPubkey; // Token-2022 mint
       const wsolMint = mintYPubkey; // WSOL mint for SOL trading
       
       // The ExtraAccountMetaList should be derived from the transfer hook program, not AMM program
       const transferHookProgramId = new PublicKey("88CNX3Y7TyzjPtD76YhpmnPAsrmhSsYRVS5ad2wKMjuk");
       const [extraAccountMetaList] = PublicKey.findProgramAddressSync(
         [Buffer.from("extra-account-metas"), tokenMint.toBuffer()],
         transferHookProgramId
       );
       
       // Derive common accounts
       const [lpToken] = PublicKey.findProgramAddressSync([Buffer.from("lp"), config.toBuffer()], program.programId);
       const vault = getAssociatedTokenAddressSync(tokenMint, config, true, tokenProgramX);
       const [solVault] = PublicKey.findProgramAddressSync([Buffer.from("sol_vault"), config.toBuffer()], program.programId);
       const wsolVault = getAssociatedTokenAddressSync(wsolMint, config, true, TOKEN_2022_PROGRAM_ID);
       
       // Check if ExtraAccountMetaList exists, if not, use AMM's dummy one
       let finalExtraAccountMetaList = extraAccountMetaList;
       try {
         const extraAccountInfo = await connection.getAccountInfo(extraAccountMetaList);
         if (!extraAccountInfo) {
           console.log("ExtraAccountMetaList not found, using AMM's dummy list...");
           const [ammExtraList] = PublicKey.findProgramAddressSync(
             [Buffer.from("extra-account-metas"), tokenMint.toBuffer()],
             program.programId
           );
           finalExtraAccountMetaList = ammExtraList;
         } else {
           console.log("ExtraAccountMetaList found, using it...");
         }
       } catch (error) {
         console.log("Error checking ExtraAccountMetaList:", error, "- using AMM's dummy list");
         const [ammExtraList] = PublicKey.findProgramAddressSync(
           [Buffer.from("extra-account-metas"), tokenMint.toBuffer()],
           program.programId
         );
         finalExtraAccountMetaList = ammExtraList;
       }
       
       const tx = await program.methods.initialize(new anchor.BN(newSeed), feeBps, publicKey).accountsStrict({
         signer: publicKey,
         extraAccountMetaList: finalExtraAccountMetaList,
         mint: tokenMint,
         wsolMint: wsolMint,
         lpToken: lpToken,
         vault: vault,
         solVault: solVault,
         wsolVault: wsolVault,
         config: config,
         systemProgram: SystemProgram.programId,
         tokenProgram: tokenProgramX,
         associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
       }).rpc();
      
      console.log("Initialize tx:", tx);

      // Fetch the pool state to verify and get details
      try {
        const poolState = await program.account.config.fetch(config);
        console.log("Pool state:", poolState);

        // Add the created pool to shared context with fetched data
        const newPool = {
          seed: poolState.seed.toNumber(),
          authority: poolState.authority?.toBase58() || "",
          mintX: poolState.mint.toBase58(), // Token-2022 mint
          mintY: poolState.wsolMint.toBase58(), // WSOL mint
          fee: poolState.fee,
          bump: poolState.configBump || 0,
          config: config.toBase58(),
          lpToken: lpToken.toBase58(),
          vaultX: vault.toBase58(), // Token vault
          vaultY: wsolVault.toBase58(), // WSOL vault
        }
        addPool(newPool)
        setSelectedPoolSeed(poolState.seed.toNumber())

        toast({
          title: "Pool Initialized Successfully",
          description: `Seed: ${poolState.seed.toNumber()} | Fee: ${poolState.fee} bps | Authority: ${poolState.authority?.toBase58().slice(0,8) || "None"}...`
        })
      } catch (fetchError) {
        console.log("Could not fetch pool state:", fetchError);
        // Fallback to original behavior if fetch fails
        const newPool = {
          seed,
          authority: publicKey!.toBase58(),
          mintX: tokenMint.toBase58(), // Token-2022 mint
          mintY: wsolMint.toBase58(), // WSOL mint
          fee: feeBps,
          bump: 0,
          config: config.toBase58(),
          lpToken: lpToken.toBase58(),
          vaultX: vault.toBase58(), // Token vault
          vaultY: wsolVault.toBase58(), // WSOL vault
        }
        addPool(newPool)
        setSelectedPoolSeed(seed)

        toast({ title: "Pool Initialized", description: `Tx: ${tx}` })
      }
    } catch (e: any) {
      console.log("Error:", e);
      toast({ title: "Initialize failed", description: e?.message ?? "Unknown", variant: "destructive" })
    }
  }, [connected, connection, programId, seed, feeBps, effMintX, effMintY, publicKey, toast, signTransaction, signAllTransactions, addPool, setSelectedPoolSeed])

  const onDeposit = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    try {
      if (!selectedPool) return toast({ title: "Select a pool first", variant: "destructive" })
      
      const { program } = await getAmmClient(connection, { publicKey, signTransaction, signAllTransactions }, programId);
      const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), new anchor.BN(selectedPool.seed).toArrayLike(Buffer, "le", 8)], program.programId);

      // Detect token programs for pool mints
      const mintXPubkey = new PublicKey(selectedPool.mintX);
      const mintYPubkey = new PublicKey(selectedPool.mintY);
      const tokenProgramX = await detectTokenProgram(connection, mintXPubkey);
      const tokenProgramY = await detectTokenProgram(connection, mintYPubkey);
      
      console.log("Deposit - Mint X uses:", tokenProgramX === TOKEN_2022_PROGRAM_ID ? "Token-2022" : "Token Program");
      console.log("Deposit - Mint Y uses:", tokenProgramY === TOKEN_2022_PROGRAM_ID ? "Token-2022" : "Token Program");
      
      const vaulta = getAssociatedTokenAddressSync(mintXPubkey, config, true, tokenProgramX);
      const vaultb = getAssociatedTokenAddressSync(mintYPubkey, config, true, tokenProgramY);
      const [lptoken] = PublicKey.findProgramAddressSync([Buffer.from("lp"), config.toBuffer()], program.programId);
      
      const userx = getAssociatedTokenAddressSync(mintXPubkey, publicKey!, false, tokenProgramX);
      const usery = getAssociatedTokenAddressSync(mintYPubkey, publicKey!, false, tokenProgramY);
      const userlp = getAssociatedTokenAddressSync(lptoken, publicKey!, false, TOKEN_PROGRAM_ID);

      // Use the appropriate token program (prefer Token-2022 if either mint uses it)
      const tokenProgram = tokenProgramX === TOKEN_2022_PROGRAM_ID || tokenProgramY === TOKEN_2022_PROGRAM_ID ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

      const amount = new anchor.BN(lAmount);
      const max_x = new anchor.BN(maxX);
      const max_y = new anchor.BN(maxY);
      
      const tx = await program.methods.deposit(amount, max_x, max_y).accountsStrict({
        signer: publicKey,
        mintx: mintXPubkey,
        minty: mintYPubkey,
        lpToken: lptoken,
        vaultX: vaulta,
        vaultY: vaultb,
        userX: userx,
        userY: usery,
        userLp: userlp,
        config: config,
        systemProgram: SystemProgram.programId,
        tokenProgram: tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
      }).rpc();
      
      console.log("Deposit tx:", tx);
      // const res = await depositLiquidity({
      //   connection,
      //   wallet: { publicKey: publicKey!, signTransaction: async (tx: any) => await signTransaction!(tx), signAllTransactions: async (txs: any[]) => await signAllTransactions!(txs) },
      //   programId,
      //   seed: BigInt(selectedPoolSeed || seed),
      //   mintX: effMintX,
      //   mintY: effMintY,
      //   amountL: BigInt(lAmount),
      //   maxX: BigInt(maxX),
      //   maxY: BigInt(maxY),
      // })
      toast({ title: "Deposited", description: `Tx: ${tx}` })
    } catch (e: any) {
      console.log(e);
      toast({ title: "Deposit failed", description: e?.message ?? "Unknown", variant: "destructive" })
    }
  }, [connected, connection, programId, selectedPool, lAmount, maxX, maxY, toast, signTransaction, signAllTransactions, publicKey])

  const onSwap = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    try {
      if (!selectedPool) return toast({ title: "Select a pool first", variant: "destructive" })
      
      const { program } = await getAmmClient(connection, { publicKey, signTransaction, signAllTransactions }, programId);
      const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), new anchor.BN(selectedPool.seed).toArrayLike(Buffer, "le", 8)], program.programId);

      const vaulta = getAssociatedTokenAddressSync(new PublicKey(selectedPool.mintX), config, true, TOKEN_PROGRAM_ID);
      const vaultb = getAssociatedTokenAddressSync(new PublicKey(selectedPool.mintY), config, true, TOKEN_PROGRAM_ID);
      const [lptoken] = PublicKey.findProgramAddressSync([Buffer.from("lp"), config.toBuffer()], program.programId);
      
      const userx = getAssociatedTokenAddressSync(new PublicKey(selectedPool.mintX), publicKey!, false, TOKEN_PROGRAM_ID);
      const usery = getAssociatedTokenAddressSync(new PublicKey(selectedPool.mintY), publicKey!, false, TOKEN_PROGRAM_ID);
      const userlp = getAssociatedTokenAddressSync(lptoken, publicKey!, false, TOKEN_PROGRAM_ID);

      const amount = new anchor.BN(swapAmount);
      const min_out = new anchor.BN(minReceive);
      
              // Use the helper function which supports hook fees
        const result = await swapTokens({
          connection,
          wallet: { publicKey, signTransaction, signAllTransactions },
          programId,
          seed: BigInt(selectedPool.seed),
          mintX: selectedPool.mintX,
          mintY: selectedPool.mintY,
          amountIn: BigInt(swapAmount),
          isX,
          minOut: BigInt(minReceive),
          enableHookFees: enableHookFees,
        })
        
        const tx = result.signature;
      
      console.log("Swap tx:", tx);
      toast({ title: "Swapped", description: `Tx: ${tx}` })
    } catch (e: any) {
      console.log("Error:", e);
      toast({ title: "Swap failed", description: e?.message ?? "Unknown", variant: "destructive" })
    }
  }, [connected, connection, programId, selectedPool, swapAmount, isX, minReceive, toast, signTransaction, signAllTransactions, publicKey])

  const onEnableHooks = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    try {
      if (!selectedPool) return toast({ title: "Select a pool first", variant: "destructive" })
      
      const result = await enableHooks({
        connection,
        wallet: { publicKey, signTransaction, signAllTransactions },
        programId,
        seed: BigInt(selectedPool.seed),
      })
      
      console.log("Enable hooks tx:", result.signature)
      toast({
        title: "Hook Fees Enabled", 
        description: `Pool can now collect WSOL fees from hooked token transfers. Tx: ${result.signature}` 
      })
    } catch (e: any) {
      console.log("Error:", e)
      toast({ title: "Enable hooks failed", description: e?.message ?? "Unknown", variant: "destructive" })
    }
  }, [connected, connection, programId, selectedPool, toast, signTransaction, signAllTransactions, publicKey])

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
          <CardTitle>AMM Pool Management</CardTitle>
        <CardDescription>
            Create pools, add liquidity, and swap tokens using the Anchor AMM program.
        </CardDescription>
      </CardHeader>
      </Card>

      <Tabs defaultValue="initialize" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="initialize">Initialize Pool</TabsTrigger>
          <TabsTrigger value="liquidity">Manage Liquidity</TabsTrigger>
          <TabsTrigger value="swap">Swap</TabsTrigger>
          <TabsTrigger value="hooks">Hook Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="initialize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Initialize Pool</CardTitle>
              <CardDescription>Create a new AMM pool with your specified tokens</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Program ID</Label>
                <Input value={programId} onChange={(e) => setProgramId(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Seed</Label>
                <Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value || 0))} />
              </div>
              <div className="grid gap-2">
                <Label>Fee (bps)</Label>
                <Input type="number" value={feeBps} onChange={(e) => setFeeBps(Number(e.target.value || 0))} />
              </div>
                <div className="grid gap-4">
          <div className="grid gap-2">
                  <Label>Token-2022 Mint (with Transfer Hook)</Label>
                  <Input 
                    value={mintX} 
                    onChange={(e) => setMintX(e.target.value)} 
                    placeholder="Token-2022 mint address with transfer hook" 
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Token-2022 mint with transfer hook
                    </div>
                    {knownMints.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setMintX(knownMints[knownMints.length - 1].mint)}
                      >
                        Use Latest Created Token
                      </Button>
                    )}
                  </div>
         </div>
       </div>
       <div className="p-3 bg-muted rounded-lg text-sm">
         <div className="font-medium mb-1">Pool Structure (SOL + Token-2022):</div>
         <div>• Token-2022 with Transfer Hook paired with SOL</div>
         <div>• Transfer hook fees automatically collected during token transfers</div>
         <div>• Native SOL trading through sol_vault + wsol_vault</div>
         <div>• WSOL mint: {WSOL_MINT.toBase58().slice(0,8)}...</div>
       </div>
            </CardContent>
            <CardFooter>
              <Button onClick={onInit} disabled={!connected || !mintX} className="w-full">
                Initialize SOL + Token-2022 Pool
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="liquidity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Liquidity</CardTitle>
              <CardDescription>Add liquidity to your pool</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pools.length > 0 ? (
                <div className="grid gap-2">
                  <Label>Select Pool</Label>
                  <Select value={selectedPoolSeed?.toString() || ""} onValueChange={(value) => setSelectedPoolSeed(value ? Number(value) : null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a pool..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pools.map((pool) => (
                        <SelectItem key={pool.seed} value={pool.seed.toString()}>
                          Seed {pool.seed} | {pool.mintX.slice(0,8)}.../{pool.mintY.slice(0,8)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPool && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <div className="font-medium">Selected Pool Details:</div>
                      <div>Seed: {selectedPool.seed} | Fee: {selectedPool.fee} bps</div>
                      <div>Mint X: {selectedPool.mintX.slice(0,8)}...</div>
                      <div>Mint Y: {selectedPool.mintY.slice(0,8)}...</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground border rounded-lg">
                  No pools available. Create one in the "Initialize Pool" tab or fetch pools in the "My Pools" tab.
                </div>
              )}
              <div className="grid gap-2">
                <Label>LP Amount</Label>
                <Input type="number" value={lAmount} onChange={(e) => setLAmount(Number(e.target.value || 0))} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
                  <Label>Max X</Label>
                  <Input type="number" value={maxX} onChange={(e) => setMaxX(Number(e.target.value || 0))} />
          </div>
          <div className="grid gap-2">
                  <Label>Max Y</Label>
                  <Input type="number" value={maxY} onChange={(e) => setMaxY(Number(e.target.value || 0))} />
          </div>
        </div>
            </CardContent>
            <CardFooter>
              <Button onClick={onDeposit} disabled={!connected || !selectedPool} className="w-full">
                {!selectedPool ? "Select a pool first" : "Add Liquidity"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="swap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Swap Tokens</CardTitle>
              <CardDescription>Swap between your pool tokens</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pools.length > 0 ? (
                <div className="grid gap-2">
                  <Label>Select Pool</Label>
                  <Select value={selectedPoolSeed?.toString() || ""} onValueChange={(value) => setSelectedPoolSeed(value ? Number(value) : null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a pool..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pools.map((pool) => (
                        <SelectItem key={pool.seed} value={pool.seed.toString()}>
                          Seed {pool.seed} | {pool.mintX.slice(0,8)}.../{pool.mintY.slice(0,8)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPool && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <div className="font-medium">Selected Pool Details:</div>
                      <div>Seed: {selectedPool.seed} | Fee: {selectedPool.fee} bps</div>
                      <div>Mint X: {selectedPool.mintX.slice(0,8)}...</div>
                      <div>Mint Y: {selectedPool.mintY.slice(0,8)}...</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground border rounded-lg">
                  No pools available. Create one in the "Initialize Pool" tab or fetch pools in the "My Pools" tab.
                </div>
              )}
              <div className="grid gap-2">
                <Label>Amount In</Label>
                <Input type="number" value={swapAmount} onChange={(e) => setSwapAmount(Number(e.target.value || 0))} />
              </div>
              <div className="grid gap-2">
                <Label>Direction</Label>
                <select 
                  className="w-full p-2 border rounded" 
                  value={isX ? "x" : "y"} 
                  onChange={(e) => setIsX(e.target.value === "x")}
                >
                  <option value="x">X → Y</option>
                  <option value="y">Y → X</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Min Receive</Label>
                <Input type="number" value={minReceive} onChange={(e) => setMinReceive(Number(e.target.value || 0))} />
        </div>
      </CardContent>
            <CardFooter>
              <Button onClick={onSwap} disabled={!connected || !selectedPool} className="w-full">
                {!selectedPool ? "Select a pool first" : "Swap"}
        </Button>
      </CardFooter>
    </Card>
        </TabsContent>

        <TabsContent value="hooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Hook Fees</CardTitle>
              <CardDescription>
                Enable WSOL fee collection for Token-2022 transfers with hooks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPool && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <h3 className="font-semibold mb-2">Selected Pool</h3>
                    <p><strong>Seed:</strong> {selectedPool.seed}</p>
                    <p><strong>Token X:</strong> {selectedPool.mintX.slice(0, 8)}...</p>
                    <p><strong>Token Y:</strong> {selectedPool.mintY.slice(0, 8)}...</p>
                    <p><strong>Fee:</strong> {selectedPool.fee} bps</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">What are Transfer Hook Fees?</h4>
                    <p className="text-sm text-muted-foreground">
                      When Token-2022 tokens with transfer hooks are traded in this pool, 
                      the hook automatically charges a small WSOL fee (0.1% of trade value) 
                      that gets deposited into this pool's WSOL vault.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Benefits:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Automatic fee collection from hooked token transfers</li>
                      <li>• Additional revenue stream for the pool</li>
                      <li>• WSOL fees can be withdrawn by pool authority</li>
                      <li>• Transparent on-chain fee tracking</li>
                    </ul>
                  </div>
                  
                  <Button 
                    onClick={onEnableHooks} 
                    disabled={!connected || !selectedPool}
                    className="w-full"
                  >
                    Enable Hook Fees for This Pool
                  </Button>
                </div>
              )}
              
              {!selectedPool && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Please select a pool from the "Manage Liquidity" or "Swap" tabs first.</p>
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
            <Badge variant="outline">Constant product AMM</Badge>
                         <Badge variant="outline">SOL + Token-2022 with Transfer Hooks</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
