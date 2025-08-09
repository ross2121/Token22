"use client"
import * as anchor from "@coral-xyz/anchor";
import  { Idl, Program, AnchorProvider, web3 } from "@coral-xyz/anchor"
import { PublicKey, SystemProgram } from "@solana/web3.js"
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, NATIVE_MINT, getAccount, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token"
import { Transaction, SystemProgram as Web3SystemProgram } from "@solana/web3.js"
import { Amm } from "./idl/amm"
import idl from "./idl/amm.json";
// Lazy import anchor to avoid SSR build issues
async function loadAnchor() {
  const anchor = await import("@coral-xyz/anchor")
  return anchor
}

export type AmmClient = {
  program: Program<Amm>
  provider: AnchorProvider
}

export async function getAmmClient(connection: web3.Connection, wallet: any, programId?: string): Promise<AmmClient> {
  const anchor = await loadAnchor()
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" })
  anchor.setProvider(provider)
  const programs = new Program<Amm>(
    idl as Amm, 
    provider
  );

  return { program: programs, provider }
}

// ---------- PDA + ATA helpers ----------
const te = new TextEncoder()

function u64ToLeBytes(value: bigint): Uint8Array {
  const arr = new ArrayBuffer(8)
  const view = new DataView(arr)
  view.setBigUint64(0, BigInt(value), true)
  return new Uint8Array(arr)
}

export function deriveConfigPda(programId: PublicKey, seed: bigint): PublicKey {
  const [config] = PublicKey.findProgramAddressSync([te.encode("config"), u64ToLeBytes(seed)], programId)
  return config
}

export function deriveLpMintPda(programId: PublicKey, configPda: PublicKey): PublicKey {
  const [lpMint] = PublicKey.findProgramAddressSync([te.encode("lp"), new Uint8Array(configPda.toBuffer())], programId)
  return lpMint
}

export function getVaultAta(mint: PublicKey, configPda: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, configPda, true, TOKEN_PROGRAM_ID)
}

export function getUserAta(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID)
}

// Token-2022 WSOL mint address
const NATIVE_MINT_2022 = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM")
export const WSOL_MINT = NATIVE_MINT_2022

async function ensureWrappedSol(connection: web3.Connection, wallet: any, lamportsNeeded: bigint): Promise<PublicKey> {
  const owner: PublicKey = wallet.publicKey
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT_2022, owner, false, TOKEN_2022_PROGRAM_ID)
  const ixs: any[] = []
  ixs.push(createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, NATIVE_MINT_2022, TOKEN_2022_PROGRAM_ID))
  let current: bigint = BigInt(0)
  try {
    const acc = await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID)
    current = BigInt(acc.amount.toString())
  } catch {}
  if (current < lamportsNeeded) {
    const delta = Number(lamportsNeeded - current)
    if (delta > 0) {
      ixs.push(Web3SystemProgram.transfer({ fromPubkey: owner, toPubkey: ata, lamports: delta }))
      ixs.push(createSyncNativeInstruction(ata))
    }
  }
  if (ixs.length > 0) {
    const tx = new Transaction().add(...ixs)
    tx.feePayer = owner
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash
    const signed = await wallet.signTransaction(tx)
    const sig = await connection.sendRawTransaction(signed.serialize())
    await connection.confirmTransaction(sig, "confirmed")
  }
  return ata
}

// ---------- Instruction wrappers ----------

export async function initializePool(args: {
  connection: web3.Connection
  wallet: any
  programId: string
  seed: bigint
  feeBps: number
  mintX: string
  mintY: string
  authority?: string | null
}) {
  const { connection, wallet, programId, seed, feeBps, mintX, mintY, authority } = args
  const { program } = await getAmmClient(connection, wallet, programId)

  const pid = new PublicKey(programId)

  const mintx = new PublicKey(mintX)
  const minty = new PublicKey(mintY)
  const config = deriveConfigPda(pid, BigInt(seed))
  const lpToken = deriveLpMintPda(pid, config)
  const vaultX = getVaultAta(mintx, config)
  const vaultY = getVaultAta(minty, config)

  const signer = wallet.publicKey
  const anchor = await loadAnchor()
  const txSig = await program.methods
    .initialize(new anchor.BN(seed.toString()), feeBps, authority ? new PublicKey(authority) : signer)
    .accountsStrict({
      signer,
      mintx,
      minty,
      lpToken,
      vaultX,
      vaultY,
      config,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc()

  return { signature: txSig, config: config.toBase58(), lpMint: lpToken.toBase58(), vaultX: vaultX.toBase58(), vaultY: vaultY.toBase58() }
}

export async function depositLiquidity(args: {
  connection: web3.Connection
  wallet: any
  programId: string
  seed: bigint
  mintX: string
  mintY: string
  amountL: bigint
  maxX: bigint
  maxY: bigint
}) {
  const { connection, wallet, programId, seed, mintX, mintY, amountL, maxX, maxY } = args
  const { program } = await getAmmClient(connection, wallet, programId)

  const pid = new PublicKey(programId)
  const mintx = new PublicKey(mintX)
  const minty = new PublicKey(mintY)
  const config = deriveConfigPda(pid, BigInt(seed))
  const lpToken = deriveLpMintPda(pid, config)
  const vaultX = getVaultAta(mintx, config)
  const vaultY = getVaultAta(minty, config)
  const userX = getUserAta(mintx, wallet.publicKey)
  const userY = getUserAta(minty, wallet.publicKey)
  const userLp = getAssociatedTokenAddressSync(lpToken, wallet.publicKey, false, TOKEN_PROGRAM_ID)

  // If WSOL is one side, ensure wrapped SOL balance up to max contribution for that side
  if (mintx.equals(NATIVE_MINT)) {
    await ensureWrappedSol(connection, wallet, BigInt(maxX))
  }
  if (minty.equals(NATIVE_MINT)) {
    await ensureWrappedSol(connection, wallet, BigInt(maxY))
  }

  const anchor = await loadAnchor()
  const txSig = await program.methods
    .deposit(new anchor.BN(amountL.toString()), new anchor.BN(maxX.toString()), new anchor.BN(maxY.toString()))
    .accountsStrict({
      signer: wallet.publicKey,
      mintx,
      minty,
      lpToken,
      vaultX,
      vaultY,
      userX,
      userY,
      userLp,
      config,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc()

  return { signature: txSig }
}

export async function swapTokens(args: {
  connection: web3.Connection
  wallet: any
  programId: string
  seed: bigint
  mintX: string
  mintY: string
  amountIn: bigint
  isX: boolean
  minOut: bigint
  enableHookFees?: boolean
}) {
  const { connection, wallet, programId, seed, mintX, mintY, amountIn, isX, minOut, enableHookFees } = args
  const { program } = await getAmmClient(connection, wallet, programId)

  const pid = new PublicKey(programId)
  const mintx = new PublicKey(mintX)
  const minty = new PublicKey(mintY)
  const config = deriveConfigPda(pid, BigInt(seed))
  const lpToken = deriveLpMintPda(pid, config)
  const vaultX = getVaultAta(mintx, config)
  const vaultY = getVaultAta(minty, config)
  const userX = getUserAta(mintx, wallet.publicKey)
  const userY = getUserAta(minty, wallet.publicKey)
  const userLp = getAssociatedTokenAddressSync(lpToken, wallet.publicKey, false, TOKEN_PROGRAM_ID)

  // If input side is WSOL, ensure wrap for amountIn
  if ((isX && mintx.equals(NATIVE_MINT)) || (!isX && minty.equals(NATIVE_MINT))) {
    await ensureWrappedSol(connection, wallet, BigInt(amountIn))
  }

  // Hook fee accounts (optional)
  let hookFeeVault = null
  let wsolMint = null
  let poolWsolVault = null
  let userWsolAccount = null

  if (enableHookFees) {
    // Derive hook fee vault PDA
    const [hookFeeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("hook_fees"), config.toBuffer()], 
      pid
    )
    hookFeeVault = hookFeeVaultPda
    wsolMint = NATIVE_MINT
    poolWsolVault = getAssociatedTokenAddressSync(NATIVE_MINT, config, true, TOKEN_PROGRAM_ID)
    userWsolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey, false, TOKEN_PROGRAM_ID)
    
    // Ensure user has WSOL for fees
    await ensureWrappedSol(connection, wallet, BigInt(1000)) // Small amount for fees
  }

  const accounts: any = {
    signer: wallet.publicKey,
    mintx,
    minty,
    userX,
    userY,
    userLp,
    lpToken,
    vaultX,
    vaultY,
    config,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  }

  // Add optional hook fee accounts
  if (enableHookFees) {
    accounts.hookFeeVault = hookFeeVault
    accounts.wsolMint = wsolMint
    accounts.poolWsolVault = poolWsolVault
    accounts.userWsolAccount = userWsolAccount
  }

  const anchor = await loadAnchor()
  const txSig = await program.methods
    .swap(new anchor.BN(amountIn.toString()), isX, new anchor.BN(minOut.toString()))
    .accountsStrict(accounts)
    .rpc()

  return { signature: txSig }
}

export async function withdrawLiquidity(args: {
  connection: web3.Connection
  wallet: any
  programId: string
  seed: bigint
  mintX: string
  mintY: string
  amountL: bigint
  minX: bigint
  minY: bigint
}) {
  const { connection, wallet, programId, seed, mintX, mintY, amountL, minX, minY } = args
  const { program } = await getAmmClient(connection, wallet, programId)

  const pid = new PublicKey(programId)
  const mintx = new PublicKey(mintX)
  const minty = new PublicKey(mintY)
  const config = deriveConfigPda(pid, BigInt(seed))
  const lpToken = deriveLpMintPda(pid, config)
  const vaultX = getVaultAta(mintx, config)
  const vaultY = getVaultAta(minty, config)
  const userX = getUserAta(mintx, wallet.publicKey)
  const userY = getUserAta(minty, wallet.publicKey)
  const userLp = getAssociatedTokenAddressSync(lpToken, wallet.publicKey, false, TOKEN_PROGRAM_ID)

  const anchor = await loadAnchor()
  const txSig = await program.methods
    .withdraw(new anchor.BN(amountL.toString()), new anchor.BN(minX.toString()), new anchor.BN(minY.toString()))
    .accountsStrict({
      signer: wallet.publicKey,
      mintx,
      minty,
      lpToken,
      vaultX,
      vaultY,
      userX,
      userY,
      userLp,
      config,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc()

  return { signature: txSig }
}

export async function enableHooks(args: {
  connection: web3.Connection
  wallet: any
  programId: string
  seed: bigint
}) {
  const { connection, wallet, programId, seed } = args
  const { program } = await getAmmClient(connection, wallet, programId)

  const pid = new PublicKey(programId)
  const config = deriveConfigPda(pid, BigInt(seed))
  
  // Derive hook fee vault PDA
  const [hookFeeVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("hook_fees"), config.toBuffer()], 
    pid
  )
  
  // WSOL mint
  const wsolMint = NATIVE_MINT
  
  // Pool's WSOL vault (ATA of config PDA)
  const poolWsolVault = getAssociatedTokenAddressSync(wsolMint, config, true, TOKEN_PROGRAM_ID)

  const txSig = await program.methods
    .enableHooks()
    .accountsStrict({
      authority: wallet.publicKey,
      config,
      hookFeeVault,
      wsolMint,
      poolWsolVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc()

  return { signature: txSig, hookFeeVault: hookFeeVault.toBase58(), poolWsolVault: poolWsolVault.toBase58() }
}

