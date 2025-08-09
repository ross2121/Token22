"use client"

import { useCallback, useMemo, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey, SystemProgram } from "@solana/web3.js"
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { useToast } from "@/hooks/use-toast"
import { depositLiquidity, initializePool, swapTokens, withdrawLiquidity, WSOL_MINT, getAmmClient } from "@/lib/amm-client"
import * as anchor from "@coral-xyz/anchor"

export default function AnchorAmm() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  const { toast } = useToast()

  const [programId, setProgramId] = useState("AwovFVc8D64taLRrHjmg4ZeNSh6xnZGTbd2Arv6kbcwd")
  const [seed, setSeed] = useState(11)
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

  const [wAmount, setWAmount] = useState(2)
  const [minX, setMinX] = useState(1)
  const [minY, setMinY] = useState(1)

  const connected = !!publicKey && !!signTransaction && !!signAllTransactions
  const effMintX = useMemo(() => (useSolX ? WSOL_MINT.toBase58() : mintX), [useSolX, mintX])
  const effMintY = useMemo(() => (useSolY ? WSOL_MINT.toBase58() : mintY), [useSolY, mintY])

  const onInit = useCallback(async () => {
    console.log("Initialize clicked");

    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" });
    try {
    const seed=331331
      const { program } = await getAmmClient(connection, { publicKey, signTransaction, signAllTransactions }, programId);
      const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), new anchor.BN(seed).toArrayLike(Buffer, "le", 8)], program.programId);

   const  vaulta = getAssociatedTokenAddressSync(new PublicKey(effMintX), config, true, TOKEN_PROGRAM_ID);
    const vaultb = getAssociatedTokenAddressSync(new PublicKey(effMintY), config, true, TOKEN_PROGRAM_ID);
      const [lptoken] = PublicKey.findProgramAddressSync([Buffer.from("lp"), config.toBuffer()], program.programId);
      const tx = await program.methods.initialize(new anchor.BN(seed), feeBps, publicKey).accountsStrict({
        signer: publicKey,
        mintx: new PublicKey(effMintX),
        minty: new PublicKey(effMintY),
        lpToken: lptoken,
        vaultX: vaulta,
        vaultY: vaultb,
        config: config,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
      }).rpc(); 
      
      console.log("Initialize tx:", tx);
      // const res = await initializePool({
      //   connection,
      //   wallet: {
      //     publicKey: publicKey!,
      //     signTransaction: async (tx: any) => await signTransaction!(tx),
      //     signAllTransactions: async (txs: any[]) => await signAllTransactions!(txs),
      //   },
      //   programId,
      //   seed: BigInt(seed),
      //   feeBps,
      //   mintX: effMintX,
      //   mintY: effMintY,
      //   authority: publicKey?.toBase58() ?? null,
      // })
      // console.log("check")
      toast({ title: "Initialized", description: `Tx: ${tx}` })
    } catch (e: any) {
      console.log("adsadsa",e);
      toast({ title: "Initialize failed", description: e?.message ?? "Unknown", variant: "destructive" })
    }
  }, [connected, connection, programId, seed, feeBps, mintX, mintY, publicKey, toast, signTransaction, signAllTransactions, useSolX, useSolY])

  const onDeposit = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    try {
      const res = await depositLiquidity({
        connection,
        wallet: {
          publicKey: publicKey!,
          signTransaction: async (tx: any) => await signTransaction!(tx),
          signAllTransactions: async (txs: any[]) => await signAllTransactions!(txs),
        },
        programId,
        seed: BigInt(seed),
        mintX: effMintX,
        mintY: effMintY,
        amountL: BigInt(lAmount),
        maxX: BigInt(maxX),
        maxY: BigInt(maxY),
      })
      toast({ title: "Deposited", description: `Sig: ${res.signature}` })
    } catch (e: any) {
      toast({ title: "Deposit failed", description: e?.message ?? "Unknown", variant: "destructive" })
    }
  }, [connected, connection, programId, seed, mintX, mintY, lAmount, maxX, maxY, toast, signTransaction, signAllTransactions, useSolX, useSolY])

  const onSwap = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    try {
      const res = await swapTokens({
        connection,
        wallet: {
          publicKey: publicKey!,
          signTransaction: async (tx: any) => await signTransaction!(tx),
          signAllTransactions: async (txs: any[]) => await signAllTransactions!(txs),
        },
        programId,
        seed: BigInt(seed),
        mintX: effMintX,
        mintY: effMintY,
        amountIn: BigInt(swapAmount),
        isX,
        minOut: BigInt(minReceive),
      })
      toast({ title: "Swapped", description: `Sig: ${res.signature}` })
    } catch (e: any) {
      toast({ title: "Swap failed", description: e?.message ?? "Unknown", variant: "destructive" })
    }
  }, [connected, connection, programId, seed, mintX, mintY, swapAmount, isX, minReceive, toast, signTransaction, signAllTransactions, useSolX, useSolY])

  const onWithdraw = useCallback(async () => {
    if (!connected) return toast({ title: "Connect your wallet", variant: "destructive" })
    try {
      const res = await withdrawLiquidity({
        connection,
        wallet: {
          publicKey: publicKey!,
          signTransaction: async (tx: any) => await signTransaction!(tx),
          signAllTransactions: async (txs: any[]) => await signAllTransactions!(txs),
        },
        programId,
        seed: BigInt(seed),
        mintX: effMintX,
        mintY: effMintY,
        amountL: BigInt(wAmount),
        minX: BigInt(minX),
        minY: BigInt(minY),
      })
      toast({ title: "Withdrew", description: `Sig: ${res.signature}` })
    } catch (e: any) {
      toast({ title: "Withdraw failed", description: e?.message ?? "Unknown", variant: "destructive" })
    }
  }, [connected, connection, programId, seed, mintX, mintY, wAmount, minX, minY, toast, signTransaction, signAllTransactions, useSolX, useSolY])

  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-6">
        {/* Initialize Pool */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Initialize Pool</h3>
          <div className="space-y-3">
            <div><label className="block text-sm mb-1">Program ID</label><input className="w-full p-2 border rounded" value={programId} onChange={(e) => setProgramId(e.target.value)} /></div>
            <div><label className="block text-sm mb-1">Seed (u64)</label><input type="number" className="w-full p-2 border rounded" value={seed} onChange={(e) => setSeed(Number(e.target.value || 0))} /></div>
            <div><label className="block text-sm mb-1">Mint X</label><input className="w-full p-2 border rounded" value={useSolX ? WSOL_MINT.toBase58() : mintX} disabled={useSolX} onChange={(e) => setMintX(e.target.value)} placeholder="Mint address" /></div>
            <div><label className="block text-sm mb-1">Mint Y</label><input className="w-full p-2 border rounded" value={useSolY ? WSOL_MINT.toBase58() : mintY} disabled={useSolY} onChange={(e) => setMintY(e.target.value)} placeholder="Mint address" /></div>
            <div><label className="block text-sm mb-1">Fee (bps)</label><input type="number" className="w-full p-2 border rounded" value={feeBps} onChange={(e) => setFeeBps(Number(e.target.value || 0))} /></div>
            <div className="flex items-center gap-2 text-xs">
              <input type="checkbox" id="useSolX" checked={useSolX} onChange={(e) => setUseSolX(e.target.checked)} />
              <label htmlFor="useSolX">Use SOL for X</label>
              <input type="checkbox" id="useSolY" checked={useSolY} onChange={(e) => setUseSolY(e.target.checked)} />
              <label htmlFor="useSolY">Use SOL for Y</label>
            </div>
          </div>
          <button className="w-full p-2 bg-blue-600 text-white rounded" onClick={onInit} disabled={!connected || !effMintX || !effMintY}>Initialize Pool</button>
        </div>

        {/* Deposit Liquidity */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Deposit Liquidity</h3>
          <div className="space-y-3">
            <div><label className="block text-sm mb-1">L amount</label><input type="number" className="w-full p-2 border rounded" value={lAmount} onChange={(e) => setLAmount(Number(e.target.value || 0))} /></div>
            <div><label className="block text-sm mb-1">Max X</label><input type="number" className="w-full p-2 border rounded" value={maxX} onChange={(e) => setMaxX(Number(e.target.value || 0))} /></div>
            <div><label className="block text-sm mb-1">Max Y</label><input type="number" className="w-full p-2 border rounded" value={maxY} onChange={(e) => setMaxY(Number(e.target.value || 0))} /></div>
          </div>
          <button className="w-full p-2 bg-blue-600 text-white rounded" onClick={onDeposit} disabled={!connected}>Deposit</button>
        </div>

        {/* Swap */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Swap</h3>
          <div className="space-y-3">
            <div><label className="block text-sm mb-1">Amount In</label><input type="number" className="w-full p-2 border rounded" value={swapAmount} onChange={(e) => setSwapAmount(Number(e.target.value || 0))} /></div>
            <div><label className="block text-sm mb-1">Direction</label><select className="w-full p-2 border rounded" value={isX ? "x" : "y"} onChange={(e) => setIsX(e.target.value === "x")}><option value="x">X → Y</option><option value="y">Y → X</option></select></div>
            <div><label className="block text-sm mb-1">Min Receive</label><input type="number" className="w-full p-2 border rounded" value={minReceive} onChange={(e) => setMinReceive(Number(e.target.value || 0))} /></div>
          </div>
          <button className="w-full p-2 bg-blue-600 text-white rounded" onClick={onSwap} disabled={!connected}>Swap</button>
        </div>

        {/* Withdraw */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Withdraw</h3>
          <div className="space-y-3">
            <div><label className="block text-sm mb-1">L amount</label><input type="number" className="w-full p-2 border rounded" value={wAmount} onChange={(e) => setWAmount(Number(e.target.value || 0))} /></div>
            <div><label className="block text-sm mb-1">Min X</label><input type="number" className="w-full p-2 border rounded" value={minX} onChange={(e) => setMinX(Number(e.target.value || 0))} /></div>
            <div><label className="block text-sm mb-1">Min Y</label><input type="number" className="w-full p-2 border rounded" value={minY} onChange={(e) => setMinY(Number(e.target.value || 0))} /></div>
          </div>
          <button className="w-full p-2 bg-blue-600 text-white rounded" onClick={onWithdraw} disabled={!connected}>Withdraw</button>
        </div>
      </div>
    </div>
  )
}

