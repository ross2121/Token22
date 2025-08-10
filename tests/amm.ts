import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import { TransferHook } from "../target/types/transfer_hook";
import { Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createApproveInstruction, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createInitializeTransferHookInstruction, createMintToInstruction, ExtensionType, getAssociatedTokenAddressSync, getMintLen, getOrCreateAssociatedTokenAccount, NATIVE_MINT, NATIVE_MINT_2022, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { BN, min } from "bn.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

describe("amm", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.amm as Program<Amm>;
  const transferHookProgram = anchor.workspace.transferHook as Program<TransferHook>;

    const decimals = 9;
  beforeEach(async () => {
  });

  it("Initialize pool", async () => {
    const   provider = anchor.getProvider();
    // Use a fresh local keypair and airdrop on localnet
    const wallet = Keypair.generate();
   const connection = provider.connection;  
    const airdropSig = await connection.requestAirdrop(wallet.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({ signature: airdropSig, ...latest }, 'confirmed');
    const seed = new anchor.BN(Date.now() % 1_000_000_000)
     const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)], program.programId);
      const [lptoken] = PublicKey.findProgramAddressSync([Buffer.from("lp"),config.toBuffer()], program.programId)
    
     const mint=Keypair.generate();
     const mintB=Keypair.generate(); // Second Token-2022 mint instead of WSOL
     const vault = getAssociatedTokenAddressSync(mint.publicKey, config,true, TOKEN_2022_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID);
    
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
      transferHookProgram.programId
    );
    const fee = 2;
    const userlp = getAssociatedTokenAddressSync(lptoken, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const amount = 100 * 10 ** decimals;
    const extensions = [ExtensionType.TransferHook]; // Re-enable transfer hook
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);
           const wsolVault=getAssociatedTokenAddressSync(mintB.publicKey,config,true,TOKEN_2022_PROGRAM_ID);
     const senderwsol=getAssociatedTokenAddressSync(mintB.publicKey,wallet.publicKey,false,TOKEN_2022_PROGRAM_ID)
     const [delegatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate")],
      transferHookProgram.programId
     );
     const delegateWsolAta = getAssociatedTokenAddressSync(
       mintB.publicKey,
       delegatePda,
       true,
       TOKEN_2022_PROGRAM_ID,
       ASSOCIATED_TOKEN_PROGRAM_ID
     );
    
    const expectedVault = getAssociatedTokenAddressSync(mint.publicKey, config, true, TOKEN_2022_PROGRAM_ID);

    const temp=Keypair.generate();
    const destinationTokenAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      temp.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
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
        wallet.publicKey,
        transferHookProgram.programId, // Use separate transfer hook program
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      ),
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintB.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mintB.publicKey,
        wallet.publicKey,
        transferHookProgram.programId, // Use separate transfer hook program
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mintB.publicKey,
        decimals,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    )
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const txSig1 = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet, mint, mintB]
    );
    console.log("mint keypair",mint.publicKey.toString())
    console.log(`Transaction Signature: ${txSig1}`);
    // Generate a dummy ExtraAccountMetaList PDA for the AMM program (not used)
    const [ammExtraList] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
      program.programId
    );
    
    const tx = await program.methods.initialize(seed, fee, wallet.publicKey).accountsStrict({
      signer: wallet.publicKey,
      extraAccountMetaList: ammExtraList,
      mint: mint.publicKey,
      wsolMint: mintB.publicKey,
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
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        senderwsol,
        wallet.publicKey,
        mintB.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        delegateWsolAta,
        delegatePda,
        mintB.publicKey,
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
      createMintToInstruction(
        mintB.publicKey,
        senderwsol,
        wallet.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      ),
      createApproveInstruction(
        senderwsol,
        delegatePda,
        wallet.publicKey,
        amount / 1000, // Approve enough for the 0.1% fee
        [],
        TOKEN_2022_PROGRAM_ID
      ),
  
    )
      transaction2.feePayer = wallet.publicKey;
      transaction2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
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
    const extraAccountMetaL = await transferHookProgram.methods.initializeExtraAccountMetaList().accounts({
      payer: wallet.publicKey,
      extraAccountMetaList: extramint,
      mint: mint.publicKey,
      wsolMint: mintB.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SYSTEM_PROGRAM_ID,
    }).signers([wallet]).rpc();
    console.log("ExtraAccountMetaList initialized:", extraAccountMetaL);
    console.log("tx4",extraAccountMetaL);  
    
    // Debug: Print all key accounts
    console.log("DEBUG: Key accounts:");
    console.log("- mint:", mint.publicKey.toString());
    console.log("- mintB (WSOL):", mintB.publicKey.toString());
    console.log("- delegatePda:", delegatePda.toString());
    console.log("- delegateWsolAta:", delegateWsolAta.toString());
    console.log("- senderwsol:", senderwsol.toString());
    console.log("- extramint (ExtraAccountMetaList):", extramint.toString());

    const solAmount = new anchor.BN(2 * 10**9); // 2 SOL
    const tokenAmount = new anchor.BN(10); // skip token transfer to avoid transfer-hook extra accounts
    const solnmax=new anchor.BN(1000);
    const tokenmax=new anchor.BN(1000);
    console.log("vaulet",vault.toString());
    const tx3 = await program.methods.deposit(solAmount, tokenAmount, solnmax, tokenmax).accountsStrict({
      signer: wallet.publicKey,
      mintx: mint.publicKey,
      minty: mintB.publicKey,
      userX: sourceTokenAccount,
      userY: senderwsol,
      userLp: userlp,
      lpToken: lptoken,
      vaultX: vault,
      vaultY: wsolVault,
      config: config,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    }).signers([wallet]).rpc();
    
    console.log("Deposit tx:", tx3);
  });

  it("Deposit liquidity", async () => {
    const amount = new anchor.BN(2);
    const max_x = new anchor.BN(6);
    const max_y = new anchor.BN(6);
    
    const tx = await program.methods.deposit(amount, max_x, max_y).accountsStrict({
      signer: wallet.payer.publicKey,
      mintx: minta,
      minty: mintb,
      lpToken: lptoken,
      vaultX: vaulta,
      vaultY: vaultb,
      userX: userx,
      userY: usery,
      userLp: userlp,
      config: config,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    }).rpc();
    
    console.log("Deposit tx:", tx);
  });

  it("Swap tokens", async () => {
    const amount = new anchor.BN(2);
    const min_receive = new anchor.BN(1);
    
    const tx = await program.methods.swap(amount, true, min_receive).accountsStrict({
      signer: wallet.payer.publicKey,
      mintx: minta,
      minty: mintb,
      lpToken: lptoken,
      vaultX: vaulta,
      vaultY: vaultb,
      userX: userx,
      userY: usery,
      userLp: userlp,
      config: config,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    }).rpc();
    
    console.log("Swap tx:", tx);
  });

  it("Withdraw liquidity", async () => {
    const amount = new anchor.BN(2);
    const min_x = new anchor.BN(1);
    const min_y = new anchor.BN(1);
    
    const tx = await program.methods.withdraw(amount, min_x, min_y).accountsStrict({
      signer: wallet.payer.publicKey,
      mintx: minta,
      minty: mintb,
      lpToken: lptoken,
      vaultX: vaulta,
      vaultY: vaultb,
      userX: userx,
      userY: usery,
      userLp: userlp,
      config: config,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    }).rpc();
    
    console.log("Withdraw tx:", tx);
  });
  it("Create Mint Account with Transfer Hook Extension", async () => {
    
  });
});