"use client"

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js"
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  type Account as TokenAccount,
} from "@solana/spl-token"

// -------- Types and local storage helpers --------

type SignAndSend = (tx: Transaction) => Promise<string>
type SignTx = (tx: Transaction) => Promise<Transaction>
type SendRaw = (tx: Transaction) => Promise<string>

type MintMeta = {
  mint: string
  hookProgramId: string
  name?: string
  symbol?: string
  decimals?: number
}

type Pool = {
  id: string
  mintA: string
  mintB: string
  vaultA: string
  vaultB: string
  // reserves (refreshed on demand)
  reserveA?: string
  reserveB?: string
  // cached humanized
  reserveAHuman?: number
  reserveBHuman?: number
}

const LS_KEYS = {
  MINTS: "hook_demo_mints",
  POOLS: "hook_demo_pools",
}

function loadJSON<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveJSON<T>(k: string, v: T) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(k, JSON.stringify(v))
}

export function persistMintHookMeta(mint: string, hookProgramId: string, meta?: { name?: string; symbol?: string; decimals?: number }) {
  const mints = loadJSON<MintMeta[]>(LS_KEYS.MINTS, [])
  const idx = mints.findIndex((m) => m.mint === mint)
  const rec: MintMeta = { mint, hookProgramId, ...meta }
  if (idx >= 0) mints[idx] = rec
  else mints.push(rec)
  saveJSON(LS_KEYS.MINTS, mints)
}

export function getKnownMints(): MintMeta[] {
  return loadJSON<MintMeta[]>(LS_KEYS.MINTS, [])
}

export function addPool(p: Pool) {
  const pools = loadJSON<Pool[]>(LS_KEYS.POOLS, [])
  const idx = pools.findIndex((x) => x.id === p.id)
  if (idx >= 0) pools[idx] = p
  else pools.push(p)
  saveJSON(LS_KEYS.POOLS, pools)
}

export function getPools(): Pool[] {
  return loadJSON<Pool[]>(LS_KEYS.POOLS, [])
}

function bnToHuman(bn: bigint, decimals: number): number {
  const base = BigInt(10) ** BigInt(decimals)
  const int = Number(bn / base)
  const frac = Number(bn % base) / Number(base)
  return int + frac
}

function humanToBn(amount: number, decimals: number): bigint {
  const base = BigInt(10) ** BigInt(decimals)
  return BigInt(Math.floor(amount * Number(base)))
}

async function airdropIfNeeded(connection: Connection, pubkey: PublicKey) {
  const bal = await connection.getBalance(pubkey, { commitment: "confirmed" })
  if (bal < 0.1 * LAMPORTS_PER_SOL) {
    try {
      const sig = await connection.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL)
      await connection.confirmTransaction(sig, "confirmed")
    } catch {
      // ignore
    }
  }
}

// -------- Core: Create hooked mint --------

export async function createHookedMintAndMintTo(args: {
  connection: Connection
  walletPublicKey: PublicKey
  signAndSend: SignAndSend
  params: {
    decimals: number
    mintAmount: bigint
    hookProgramId: PublicKey
    name?: string
    symbol?: string
  }
}) {
  const { connection, walletPublicKey, signAndSend, params } = args
  await airdropIfNeeded(connection, walletPublicKey)

  // Allocate mint with TransferHook extension
  const mintKP = Keypair.generate()
  const mintLen = getMintLen([ExtensionType.TransferHook])
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen)

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: walletPublicKey,
      newAccountPubkey: mintKP.publicKey,
      lamports,
      space: mintLen,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    // IMPORTANT: initialize extension BEFORE InitializeMint2
    createInitializeTransferHookInstruction(
      mintKP.publicKey,
      walletPublicKey, // transfer hook authority (update authority)
      params.hookProgramId,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMint2Instruction(
      mintKP.publicKey,
      params.decimals,
      walletPublicKey, // mint authority
      walletPublicKey, // freeze authority
      TOKEN_2022_PROGRAM_ID
    ),
  )

  // Create ATA for wallet and mint initial supply
  const ata = getAssociatedTokenAddressSync(mintKP.publicKey, walletPublicKey, false, TOKEN_2022_PROGRAM_ID)
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      walletPublicKey,
      ata,
      walletPublicKey,
      mintKP.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createMintToInstruction(
      mintKP.publicKey,
      ata,
      walletPublicKey,
      params.mintAmount,
      [],
      TOKEN_2022_PROGRAM_ID
    ),
  )

  tx.feePayer = walletPublicKey
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash
  tx.partialSign(mintKP)

  const sig = await signAndSend(tx)

  return { signature: sig, mint: mintKP.publicKey, ata }
}

// -------- Pool creation (custodial demo) --------

export async function createPoolWithInitialLiquidity(args: {
  connection: Connection
  walletPublicKey: PublicKey
  signTransaction: SignTx
  mintA: PublicKey
  mintB: PublicKey
  humanAmountA: number
  humanAmountB: number
}) {
  const { connection, walletPublicKey, signTransaction, mintA, mintB, humanAmountA, humanAmountB } = args

  const [mintAInfo, mintBInfo] = await Promise.all([
    getMint(connection, mintA, "confirmed", TOKEN_2022_PROGRAM_ID),
    getMint(connection, mintB, "confirmed", TOKEN_2022_PROGRAM_ID),
  ])

  const decimalsA = Number(mintAInfo.decimals)
  const decimalsB = Number(mintBInfo.decimals)

  const amountA = humanToBn(humanAmountA, decimalsA)
  const amountB = humanToBn(humanAmountB, decimalsB)

  const owner = walletPublicKey // vault authority = you (custodial demo)
  const vaultA = getAssociatedTokenAddressSync(mintA, owner, false, TOKEN_2022_PROGRAM_ID)
  const vaultB = getAssociatedTokenAddressSync(mintB, owner, false, TOKEN_2022_PROGRAM_ID)

  const userAtaA = getAssociatedTokenAddressSync(mintA, owner, false, TOKEN_2022_PROGRAM_ID)
  const userAtaB = getAssociatedTokenAddressSync(mintB, owner, false, TOKEN_2022_PROGRAM_ID)

  const tx = new Transaction()

  // Ensure ATAs
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(owner, userAtaA, owner, mintA, TOKEN_2022_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(owner, userAtaB, owner, mintB, TOKEN_2022_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(owner, vaultA, owner, mintA, TOKEN_2022_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(owner, vaultB, owner, mintB, TOKEN_2022_PROGRAM_ID),
  )

  // Transfer initial reserves from user to vaults (with hooks)
  addTransferCheckedWithHook(tx, {
    mint: mintA,
    source: userAtaA,
    destination: vaultA,
    owner,
    amount: amountA,
    decimals: decimalsA,
  })
  addTransferCheckedWithHook(tx, {
    mint: mintB,
    source: userAtaB,
    destination: vaultB,
    owner,
    amount: amountB,
    decimals: decimalsB,
  })

  tx.feePayer = owner
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash

  const signed = await signTransaction(tx)
  const sig = await connection.sendRawTransaction(signed.serialize())
  await connection.confirmTransaction(sig, "confirmed")

  const id = `${mintA.toBase58()}_${mintB.toBase58()}_${owner.toBase58()}`
  // Save pool
  const rec: Pool = {
    id,
    mintA: mintA.toBase58(),
    mintB: mintB.toBase58(),
    vaultA: vaultA.toBase58(),
    vaultB: vaultB.toBase58(),
  }
  addPool(rec)

  return rec
}

// -------- Swap with pre-transfer simulation --------

export async function simulateAndSwap(args: {
  connection: Connection
  walletPublicKey: PublicKey
  signTransaction: SignTx
  sendRaw: SendRaw
  mintIn: PublicKey
  mintOut: PublicKey
  humanAmountIn: number
  slippageBps: number
}) {
  const { connection, walletPublicKey, signTransaction, sendRaw, mintIn, mintOut, humanAmountIn, slippageBps } = args

  const pools = getPools()
  const pool = pools.find(
    (p) =>
      (p.mintA === mintIn.toBase58() && p.mintB === mintOut.toBase58()) ||
      (p.mintA === mintOut.toBase58() && p.mintB === mintIn.toBase58()),
  )
  if (!pool) throw new Error("No matching local pool found")

  const mintInInfo = await getMint(connection, mintIn, "confirmed", TOKEN_2022_PROGRAM_ID)
  const mintOutInfo = await getMint(connection, mintOut, "confirmed", TOKEN_2022_PROGRAM_ID)
  const decimalsIn = Number(mintInInfo.decimals)
  const decimalsOut = Number(mintOutInfo.decimals)

  const vaultIn = new PublicKey(pool.mintA === mintIn.toBase58() ? pool.vaultA : pool.vaultB)
  const vaultOut = new PublicKey(pool.mintA === mintIn.toBase58() ? pool.vaultB : pool.vaultA)

  const [accIn, accOut] = await Promise.all([
    getAccount(connection, vaultIn, "confirmed", TOKEN_2022_PROGRAM_ID),
    getAccount(connection, vaultOut, "confirmed", TOKEN_2022_PROGRAM_ID),
  ])

  const reserveIn = BigInt(accIn.amount.toString())
  const reserveOut = BigInt(accOut.amount.toString())
  const amountIn = humanToBn(humanAmountIn, decimalsIn)

  // Constant product with 0.3% fee
  const feeBps = 30n
  const amountInAfterFee = amountIn * (10000n - feeBps) / 10000n
  const k = reserveIn * reserveOut
  const newReserveIn = reserveIn + amountInAfterFee
  if (newReserveIn === 0n) throw new Error("Invalid state")
  const newReserveOut = k / newReserveIn
  const amountOut = reserveOut - newReserveOut

  // Slippage check
  const minOut = amountOut * BigInt(10000 - slippageBps) / 10000n
  if (minOut <= 0) throw new Error("Min out is zero")

  const userAtaIn = getAssociatedTokenAddressSync(mintIn, walletPublicKey, false, TOKEN_2022_PROGRAM_ID)
  const userAtaOut = getAssociatedTokenAddressSync(mintOut, walletPublicKey, false, TOKEN_2022_PROGRAM_ID)

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    createAssociatedTokenAccountIdempotentInstruction(walletPublicKey, userAtaIn, walletPublicKey, mintIn, TOKEN_2022_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(walletPublicKey, userAtaOut, walletPublicKey, mintOut, TOKEN_2022_PROGRAM_ID),
  )

  // 1) User sends amountIn to vaultIn (hook on mintIn)
  addTransferCheckedWithHook(tx, {
    mint: mintIn,
    source: userAtaIn,
    destination: vaultIn,
    owner: walletPublicKey,
    amount: amountIn,
    decimals: decimalsIn,
  })

  // 2) VaultOut sends amountOut to user (hook on mintOut) - vault owned by the same wallet (custodial demo)
  addTransferCheckedWithHook(tx, {
    mint: mintOut,
    source: vaultOut,
    destination: userAtaOut,
    owner: walletPublicKey,
    amount: amountOut,
    decimals: decimalsOut,
  })

  tx.feePayer = walletPublicKey
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash

  const signed = await signTransaction(tx)

  // Simulate to ensure hooks pass
  const sim = await connection.simulateTransaction(signed, { sigVerify: false, commitment: "confirmed" })
  if (sim.value.err) {
    const logs = sim.value.logs?.join("\n") ?? "No logs"
    throw new Error(`Pre-transfer simulation failed.\n${logs}`)
  }

  const sig = await sendRaw(signed)
  return sig
}

// -------- Transfer with hook helper --------

function addTransferCheckedWithHook(
  tx: Transaction,
  args: {
    mint: PublicKey
    source: PublicKey
    destination: PublicKey
    owner: PublicKey
    amount: bigint
    decimals: number
  },
) {
  const ix = createTransferCheckedInstruction(
    args.source,
    args.mint,
    args.destination,
    args.owner,
    args.amount,
    args.decimals,
    [],
    TOKEN_2022_PROGRAM_ID
  )

  // If we have a known hook program for this mint, include it as a remaining account.
  const known = getKnownMints().find((m) => m.mint === args.mint.toBase58())
  if (known?.hookProgramId) {
    ix.keys.push({
      pubkey: new PublicKey(known.hookProgramId),
      isSigner: false,
      isWritable: false,
    })
  }

  tx.add(ix)
}

// -------- Pool reserve refresh --------

export async function refreshPoolReserves(connection: Connection) {
  const pools = getPools()
  for (const p of pools) {
    try {
      const mintA = new PublicKey(p.mintA)
      const mintB = new PublicKey(p.mintB)
      const [infoA, infoB, accA, accB] = await Promise.all([
        getMint(connection, mintA, "confirmed", TOKEN_2022_PROGRAM_ID),
        getMint(connection, mintB, "confirmed", TOKEN_2022_PROGRAM_ID),
        getAccount(connection, new PublicKey(p.vaultA), "confirmed", TOKEN_2022_PROGRAM_ID),
        getAccount(connection, new PublicKey(p.vaultB), "confirmed", TOKEN_2022_PROGRAM_ID),
      ])
      const decimalsA = Number(infoA.decimals)
      const decimalsB = Number(infoB.decimals)
      const reserveA = BigInt(accA.amount.toString())
      const reserveB = BigInt(accB.amount.toString())
      p.reserveA = reserveA.toString()
      p.reserveB = reserveB.toString()
      p.reserveAHuman = bnToHuman(reserveA, decimalsA)
      p.reserveBHuman = bnToHuman(reserveB, decimalsB)
    } catch {
      // ignore pool if failing
    }
  }
  saveJSON(LS_KEYS.POOLS, pools)
}
