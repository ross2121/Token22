import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import { Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createInitializeTransferHookInstruction, createMintToInstruction, ExtensionType, getAssociatedTokenAddressSync, getMintLen, getOrCreateAssociatedTokenAccount, NATIVE_MINT, NATIVE_MINT_2022, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { BN, min } from "bn.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

describe("amm", () => {
//8bqYTWshpCYLBNRojKQyCVa8hvtGmwMiA4LFtK4mye8c
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.amm as Program<Amm>;

    const decimals = 9;
  beforeEach(async () => {



    
     
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
    const encode=bs58.decode("33YLSRPPbPu3EuzPxHd6bpHT7xzho39mcsVo1ctw1Vdwj9MFnBBRSBveFAKeaxdcxCTeUcbVig2n5ShqxFzAhpGe");  
    const wallet = Keypair.fromSecretKey(encode);
   const connection = provider.connection;  
    const seed = new anchor.BN(Date.now() % 1_000_000_000)
     const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)], program.programId);
      const [lptoken] = PublicKey.findProgramAddressSync([Buffer.from("lp"),config.toBuffer()], program.programId)
    
     const mint=Keypair.generate();
     const vault = getAssociatedTokenAddressSync(mint.publicKey, config,true, TOKEN_2022_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID);
    //  const wsol=getAssociatedTokenAddressSync(NATIVE_MINT_2022,config,true,TOKEN_2022_PROGRAM_ID)
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
      [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer(), program.programId.toBuffer()],
      program.programId
    );
    const fee = 2;
    const userlp = getAssociatedTokenAddressSync(lptoken, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const amount = 100 * 10 ** decimals;
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);
    const wsolVault=getAssociatedTokenAddressSync(NATIVE_MINT_2022,config,true,TOKEN_2022_PROGRAM_ID);
    const senderwsol=getAssociatedTokenAddressSync(NATIVE_MINT_2022,wallet.publicKey,false,TOKEN_2022_PROGRAM_ID)
    
    // Calculate the expected vault address manually to verify
    const expectedVault = getAssociatedTokenAddressSync(mint.publicKey, config, true, TOKEN_2022_PROGRAM_ID);

    const temp=Keypair.generate();
    const destinationTokenAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      temp.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    // Calculate the expected user_token address manually to verify
    const expectedUserToken = getAssociatedTokenAddressSync(mint.publicKey, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);

    
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
        vault,
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
    const txSig1 = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet, mint]
    );
    console.log("mint keypair",mint.publicKey.toString())
    console.log(`Transaction Signature: ${txSig1}`);
    const tx = await program.methods.initialize(seed, fee, wallet.publicKey).accountsStrict({
      signer: wallet.publicKey,
      extraAccountMetaList: extramint,
      mint: mint.publicKey,
      wsolMint: NATIVE_MINT_2022,
      lpToken: lptoken,
      vault,
      solVault: solvault,
      wsolVault: wsolVault,
      config: config,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    })
    .signers([wallet]).rpc();
    console.log("fsadsd",tx);
    const transaction2 = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
  
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        temp.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    ), 

      createMintToInstruction(
        mint.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      ),
  
    )
      const txSig2 = await sendAndConfirmTransaction(
        connection,
        transaction2,
        [wallet]
      );
     console.log("asads",txSig2);
     console.log("temp",temp.publicKey.toString());
     console.log("tempata",destinationTokenAccount.toString());
     console.log("dadsa",vault.toString());
     console.log("dasd",config.toString());
 
    
    
    console.log("transaction3",tx);
    // Temporarily skip transfer hook initialization to focus on core AMM
    const extraAccountMetaL=await program.methods.initializeExtraAccountMetaList().accountsStrict({
      payer:wallet.publicKey,
      extraAccountMetaList:extramint,
       mint:mint.publicKey,
       wsolMint:NATIVE_MINT_2022,
       systemProgram:SYSTEM_PROGRAM_ID,
       tokenProgram:TOKEN_2022_PROGRAM_ID,
       config:config,
       associatedTokenProgram:ASSOCIATED_TOKEN_PROGRAM_ID
    }).signers([wallet]).rpc();
    console.log("tx4",extraAccountMetaL);  

    // Ensure sender's WSOL-2022 ATA exists
    try {
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        NATIVE_MINT_2022,
        wallet.publicKey,
        false,
        'confirmed',
        undefined,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    } catch (e) {
      console.log('sender WSOL-2022 ATA check/create error (ignored if exists):', e);
    }

    // Ensure config's WSOL-2022 ATA exists
    try {
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet,
        NATIVE_MINT_2022,
        config,
        true,
        'confirmed',
        undefined,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    } catch (e) {
      console.log('config WSOL-2022 ATA check/create error (ignored if exists):', e);
    }
    const solAmount = new anchor.BN(2 * 10**9); // 2 SOL
    const tokenAmount = new anchor.BN(10); // skip token transfer to avoid transfer-hook extra accounts
    const solnmax=new anchor.BN(1000);
    const tokenmax=new anchor.BN(1000);
    console.log("vaulet",vault.toString());
    const tx3 = await program.methods.deposit(solAmount, tokenAmount,solnmax,tokenmax).accountsStrict({
      signer: wallet.publicKey,
      mint: mint.publicKey,
      userToken: sourceTokenAccount,
      // user_token:expectedUserToken,
      userLp: userlp,
      lpToken: lptoken,
      tokenVault: vault,
      solVault: solvault,
      
      config: config,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      extraAccountMetaList:extramint,
      wsolMint:NATIVE_MINT_2022,
      wsolVault:wsolVault,
      senderWsolTokenAccount:senderwsol,
      transferHookProgram: program.programId
    }).signers([wallet]).rpc();
    
    console.log("Deposit tx:", tx3);
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