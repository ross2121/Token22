import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import { Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createInitializeTransferHookInstruction, createMintToInstruction, ExtensionType, getAssociatedTokenAddressSync, getMintLen, getOrCreateAssociatedTokenAccount, NATIVE_MINT, NATIVE_MINT_2022, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { BN, min } from "bn.js";

describe("amm", () => {
//8bqYTWshpCYLBNRojKQyCVa8hvtGmwMiA4LFtK4mye8c
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.amm as Program<Amm>;

    const decimals = 9;
  beforeEach(async () => {
  const   provider = anchor.getProvider();
    const wallet = provider.wallet;
   const connection = provider.connection;  
    const seed = new anchor.BN(11);
     const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)], program.programId);
      const [lptoken] = PublicKey.findProgramAddressSync([Buffer.from("lp"),config.toBuffer()], program.programId)

     const mint=new PublicKey("8bqYTWshpCYLBNRojKQyCVa8hvtGmwMiA4LFtK4mye8c");

      const sourceTokenAccount =getAssociatedTokenAddressSync(
      mint,
      wallet.payer.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
     const [extramint] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.toBuffer()],
      program.programId
    );
    // // const [delegatePDA] = PublicKey.findProgramAddressSync(
    // //   [Buffer.from("delegate")],
    // //   program.programId
    // // );
    // console.log("dasdasdas")
    // [solvault] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("sol_vault"), config.toBuffer()], program.programId
    // )
    //   console.log("rterdas")    
    // // userx = getAssociatedTokenAddressSync(minta, wallet.payer.publicKey, false);
    // // usery = getAssociatedTokenAddressSync(mintb, wallet.payer.publicKey, false);
    // // userlp = getAssociatedTokenAddressSync(lptoken, wallet.payer.publicKey, false);
    
    // vault = getAssociatedTokenAddressSync(mint, config, true, TOKEN_PROGRAM_ID);
    // wsol=getAssociatedTokenAddressSync(NATIVE_MINT,config,true,TOKEN_2022_PROGRAM_ID)
    // vaultb = getAssociatedTokenAddressSync(mintb, config, true, TOKEN_PROGRAM_ID);
  });

  it("Initialize pool", async () => {
    const   provider = anchor.getProvider();
    const wallet = provider.wallet;
   const connection = provider.connection;  
    const seed = new anchor.BN(11);
     const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)], program.programId);
      const [lptoken] = PublicKey.findProgramAddressSync([Buffer.from("lp"),config.toBuffer()], program.programId)

      
     const mint=Keypair.generate();
     const vault = getAssociatedTokenAddressSync(mint.publicKey, config, true, TOKEN_2022_PROGRAM_ID);
     const wsol=getAssociatedTokenAddressSync(NATIVE_MINT_2022,config,true,TOKEN_2022_PROGRAM_ID)
      const sourceTokenAccount =getAssociatedTokenAddressSync(
      mint.publicKey,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
     const [solvault] = PublicKey.findProgramAddressSync(
        [Buffer.from("sol_vault"), config.toBuffer()], program.programId
      )
      
     const [extramint] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
      program.programId
    );
    const fee = 2;
    const amount = 100 * 10 ** decimals;
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);
    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mint.publicKey,
        wallet.publicKey,
        program.programId, // Transfer Hook Program ID
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    )
    const txSig2 = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet.payer, mint]
    );
  
    console.log("mint keypair",mint.publicKey.toString())
    console.log(`Transaction Signature: ${txSig2}`);
    const transaction2 = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ), createMintToInstruction(
        mint.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      ))
      const txSig = await sendAndConfirmTransaction(
        connection,
        transaction2,
        [wallet.payer],
      );
     console.log("asads",txSig);
    const tx = await program.methods.initialize(seed, fee, wallet.payer.publicKey).accountsStrict({
      signer: wallet.payer.publicKey,
      mint:mint.publicKey,
      wsolMint: NATIVE_MINT_2022,
      lpToken: lptoken,
      vault,
      solVault: solvault,
      wsolVault: wsol,
      config: config,
      systemProgram: SYSTEM_PROGRAM_ID,
      extraAccountMetaList: extramint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    }).rpc();
    
    console.log("Initialize tx:", tx);
  });

  // it("Deposit liquidity", async () => {
  //   const amount = new anchor.BN(2);
  //   const max_x = new anchor.BN(6);
  //   const max_y = new anchor.BN(6);
    
  //   const tx = await program.methods.deposit(amount, max_x, max_y).accountsStrict({
  //     signer: wallet.payer.publicKey,
  //     mintx: minta,
  //     minty: mintb,
  //     lpToken: lptoken,
  //     vaultX: vaulta,
  //     vaultY: vaultb,
  //     userX: userx,
  //     userY: usery,
  //     userLp: userlp,
  //     config: config,
  //     systemProgram: SYSTEM_PROGRAM_ID,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
  //   }).rpc();
    
  //   console.log("Deposit tx:", tx);
  // });

  // it("Swap tokens", async () => {
  //   const amount = new anchor.BN(2);
  //   const min_receive = new anchor.BN(1);
    
  //   const tx = await program.methods.swap(amount, true, min_receive).accountsStrict({
  //     signer: wallet.payer.publicKey,
  //     mintx: minta,
  //     minty: mintb,
  //     lpToken: lptoken,
  //     vaultX: vaulta,
  //     vaultY: vaultb,
  //     userX: userx,
  //     userY: usery,
  //     userLp: userlp,
  //     config: config,
  //     systemProgram: SYSTEM_PROGRAM_ID,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
  //   }).rpc();
    
  //   console.log("Swap tx:", tx);
  // });

  // it("Withdraw liquidity", async () => {
  //   const amount = new anchor.BN(2);
  //   const min_x = new anchor.BN(1);
  //   const min_y = new anchor.BN(1);
    
  //   const tx = await program.methods.withdraw(amount, min_x, min_y).accountsStrict({
  //     signer: wallet.payer.publicKey,
  //     mintx: minta,
  //     minty: mintb,
  //     lpToken: lptoken,
  //     vaultX: vaulta,
  //     vaultY: vaultb,
  //     userX: userx,
  //     userY: usery,
  //     userLp: userlp,
  //     config: config,
  //     systemProgram: SYSTEM_PROGRAM_ID,
  //     tokenProgram: TOKEN_PROGRAM_ID,
  //     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
  //   }).rpc();
    
  //   console.log("Withdraw tx:", tx);
  // });
  // it("Create Mint Account with Transfer Hook Extension", async () => {
    
  // });
});
