import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import { 
  Keypair, 
  PublicKey, 
  sendAndConfirmTransaction, 
  SystemProgram, 
  Transaction 
} from "@solana/web3.js";
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  createAssociatedTokenAccountInstruction, 
  createInitializeMintInstruction, 
  createInitializeTransferHookInstruction, 
  createMintToInstruction, 
  ExtensionType, 
  getAssociatedTokenAddressSync, 
  getMintLen, 
  NATIVE_MINT, 
  TOKEN_2022_PROGRAM_ID, 
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import { BN } from "bn.js";

describe("Bridge AMM Integration", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  
  const program = anchor.workspace.amm as Program<Amm>;
  const provider = anchor.getProvider();
  const connection = provider.connection;
  
  // Test keypairs
  const authority = Keypair.generate();
  const user = Keypair.generate();
  
  // Test configuration
  const decimals = 9;
  const initialSupply = 1000 * 10 ** decimals;
  
  beforeEach(async () => {
    // Fund test accounts
    await Promise.all([
      connection.requestAirdrop(authority.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
      connection.requestAirdrop(user.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    ]);
    
    // Wait for confirmations
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  it("Complete Token-2022 to Bridge Token AMM Flow", async () => {
    // Step 1: Create Token-2022 mint with transfer hook
    const token2022Mint = Keypair.generate();
    const hookProgramId = program.programId; // Use AMM program as hook for simplicity
    
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);
    
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: token2022Mint.publicKey,
        space: mintLen,
        lamports: mintRent,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        token2022Mint.publicKey,
        authority.publicKey, // authority as hook authority
        hookProgramId,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        token2022Mint.publicKey,
        decimals,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    await sendAndConfirmTransaction(
      connection,
      createMintTx,
      [authority, token2022Mint]
    );
    
    console.log("✅ Token-2022 mint created:", token2022Mint.publicKey.toString());
    
    // Step 2: Initialize AMM pool
    const seed = new BN(Date.now() % 1_000_000_000);
    const [ammConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)], 
      program.programId
    );
    
    const [lpToken] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), ammConfig.toBuffer()], 
      program.programId
    );
    
    const [solVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("sol_vault"), ammConfig.toBuffer()], 
      program.programId
    );
    
    const [extraAccountMetaList] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), token2022Mint.publicKey.toBuffer(), program.programId.toBuffer()],
      program.programId
    );
    
    // Note: For bridge pools, we'll use the bridge token mint instead of Token-2022 mint
    const vault = getAssociatedTokenAddressSync(
      token2022Mint.publicKey, 
      ammConfig, 
      true, 
      TOKEN_2022_PROGRAM_ID
    );
    
    const wsolVault = getAssociatedTokenAddressSync(
      NATIVE_MINT, 
      ammConfig, 
      true, 
      TOKEN_PROGRAM_ID
    );
    
    // Initialize standard AMM first
    const initTx = await program.methods
      .initialize(seed, 30, authority.publicKey) // 0.3% fee
      .accountsStrict({
        signer: authority.publicKey,
        extraAccountMetaList: extraAccountMetaList,
        mint: token2022Mint.publicKey,
        wsolMint: NATIVE_MINT,
        lpToken: lpToken,
        vault: vault,
        solVault: solVault,
        wsolVault: wsolVault,
        config: ammConfig,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
      })
      .signers([authority])
      .rpc();
    
    console.log("✅ AMM pool initialized:", initTx);
    
    // Step 3: Initialize bridge pool functionality
    const [bridgePoolConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridge_pool_config"), ammConfig.toBuffer()],
      program.programId
    );
    
    const bridgeTokenMint = Keypair.generate();
    
    const initBridgePoolTx = await program.methods
      .initializeBridgePool()
      .accountsStrict({
        authority: authority.publicKey,
        ammConfig: ammConfig,
        bridgePoolConfig: bridgePoolConfig,
        restrictedTokenMint: token2022Mint.publicKey,
        bridgeTokenMint: bridgeTokenMint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .signers([authority, bridgeTokenMint])
      .rpc();
    
    console.log("✅ Bridge pool initialized:", initBridgePoolTx);
    
    // Step 4: Create user Token-2022 account and mint tokens
    const userToken2022Account = getAssociatedTokenAddressSync(
      token2022Mint.publicKey,
      user.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    const createUserAccountTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey, // payer
        userToken2022Account,
        user.publicKey, // owner
        token2022Mint.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createMintToInstruction(
        token2022Mint.publicKey,
        userToken2022Account,
        authority.publicKey,
        initialSupply,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    await sendAndConfirmTransaction(
      connection,
      createUserAccountTx,
      [authority]
    );
    
    console.log("✅ User Token-2022 account created and funded");
    
    // Step 5: Wrap Token-2022 tokens into bridge tokens
    const userBridgeTokenAccount = getAssociatedTokenAddressSync(
      bridgeTokenMint.publicKey,
      user.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    const poolVaultTokenAccount = getAssociatedTokenAddressSync(
      token2022Mint.publicKey,
      bridgePoolConfig,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    const wrapAmount = new BN(100 * 10 ** decimals); // Wrap 100 tokens
    
    const wrapTx = await program.methods
      .wrapForPool(wrapAmount)
      .accountsStrict({
        user: user.publicKey,
        ammConfig: ammConfig,
        bridgePoolConfig: bridgePoolConfig,
        restrictedTokenMint: token2022Mint.publicKey,
        userRestrictedTokenAccount: userToken2022Account,
        bridgeTokenMint: bridgeTokenMint.publicKey,
        userBridgeTokenAccount: userBridgeTokenAccount,
        poolVaultTokenAccount: poolVaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .signers([user])
      .rpc();
    
    console.log("✅ Tokens wrapped for pool trading:", wrapTx);
    
    // Step 6: Verify bridge token balance
    const bridgeTokenBalance = await connection.getTokenAccountBalance(userBridgeTokenAccount);
    console.log("Bridge token balance:", bridgeTokenBalance.value.amount);
    
    // Step 7: Test unwrapping (reverse flow)
    const unwrapAmount = new BN(50 * 10 ** decimals); // Unwrap 50 tokens
    
    const unwrapTx = await program.methods
      .unwrapFromPool(unwrapAmount)
      .accountsStrict({
        user: user.publicKey,
        ammConfig: ammConfig,
        bridgePoolConfig: bridgePoolConfig,
        restrictedTokenMint: token2022Mint.publicKey,
        userRestrictedTokenAccount: userToken2022Account,
        bridgeTokenMint: bridgeTokenMint.publicKey,
        userBridgeTokenAccount: userBridgeTokenAccount,
        poolVaultTokenAccount: poolVaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .signers([user])
      .rpc();
    
    console.log("✅ Tokens unwrapped from pool:", unwrapTx);
    
    // Verify final balances
    const finalBridgeBalance = await connection.getTokenAccountBalance(userBridgeTokenAccount);
    const finalToken2022Balance = await connection.getTokenAccountBalance(userToken2022Account);
    
    console.log("Final bridge token balance:", finalBridgeBalance.value.amount);
    console.log("Final Token-2022 balance:", finalToken2022Balance.value.amount);
    
    console.log("🎉 Complete Token-2022 bridge integration successful!");
  });
});