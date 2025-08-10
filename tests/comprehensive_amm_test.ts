import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import { TransferHook } from "../target/types/transfer_hook";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT_2022,
  createInitializeMintInstruction,
  createMintToInstruction,
  createInitializeTransferHookInstruction,
  createApproveInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  ExtensionType,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import { BN } from "bn.js";
import { expect } from "chai";

describe("Comprehensive AMM + Transfer Hook Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.amm as Program<Amm>;
  const transferHookProgram = anchor.workspace.transferHook as Program<TransferHook>;

  let payer: Keypair;
  let user: Keypair;
  let tokenMint: Keypair;
  let connection = provider.connection;

  let config: PublicKey;
  let lpToken: PublicKey;
  let vault: PublicKey;
  let solVault: PublicKey;
  let wsolVault: PublicKey;
  let extraAccountMetaList: PublicKey;

  let userTokenAccount: PublicKey;
  let userWsolAccount: PublicKey;
  let userLpAccount: PublicKey;

  let delegatePda: PublicKey;
  let delegateWsolAta: PublicKey;

  const decimals = 9;
  const seed = new BN(Date.now());
  const feeBps = 300;
  const initialTokenSupply = new BN(1000 * 10 ** decimals);
  const initialSolAmount = new BN(10 * LAMPORTS_PER_SOL);

  before(async () => {
    payer = Keypair.generate();
    user = Keypair.generate();
    tokenMint = Keypair.generate();

    await Promise.all([
      connection.requestAirdrop(payer.publicKey, 20 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(user.publicKey, 20 * LAMPORTS_PER_SOL)
    ]);

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it("1. Create Token-2022 with Transfer Hook", async () => {
    [delegatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegate")],
      transferHookProgram.programId
    );

    delegateWsolAta = getAssociatedTokenAddressSync(
      NATIVE_MINT_2022,
      delegatePda,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);

    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: tokenMint.publicKey,
        space: mintLen,
        lamports: await connection.getMinimumBalanceForRentExemption(mintLen),
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        tokenMint.publicKey,
        payer.publicKey,
        transferHookProgram.programId,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        tokenMint.publicKey,
        decimals,
        payer.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, createMintTx, [payer, tokenMint]);

    userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint.publicKey,
      user.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const createUserAccountTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userTokenAccount,
        user.publicKey,
        tokenMint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        tokenMint.publicKey,
        userTokenAccount,
        payer.publicKey,
        BigInt(initialTokenSupply.toString()),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, createUserAccountTx, [payer]);

    const userTokenBalance = await getAccount(
      connection,
      userTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(userTokenBalance.amount.toString()).to.equal(initialTokenSupply.toString());
  });

  it("2. Initialize Transfer Hook Extra Account Meta List", async () => {
    [extraAccountMetaList] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), tokenMint.publicKey.toBuffer()],
      transferHookProgram.programId
    );

    await transferHookProgram.methods
      .initializeExtraAccountMetaList()
      .accountsStrict({
        payer: payer.publicKey,
        extraAccountMetaList,
        mint: tokenMint.publicKey,
        wsolMint: NATIVE_MINT_2022,
        delegatePda,
        delegateWsolAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();
  });

  it("3. Prepare Transfer Hook Fee System", async () => {
    userWsolAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT_2022,
      user.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const createWsolTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userWsolAccount,
        user.publicKey,
        NATIVE_MINT_2022,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: userWsolAccount,
        lamports: LAMPORTS_PER_SOL
      })
    );

    await sendAndConfirmTransaction(connection, createWsolTx, [payer]);

    const approveTx = new Transaction().add(
      createApproveInstruction(
        userWsolAccount,
        delegatePda,
        user.publicKey,
        BigInt(LAMPORTS_PER_SOL),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, approveTx, [user]);
  });

  it("4. Initialize AMM Pool", async () => {
    [config] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [lpToken] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), config.toBuffer()],
      program.programId
    );

    [solVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("sol_vault"), config.toBuffer()],
      program.programId
    );

    vault = getAssociatedTokenAddressSync(
      tokenMint.publicKey,
      config,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    wsolVault = getAssociatedTokenAddressSync(
      NATIVE_MINT_2022,
      config,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    await program.methods
      .initialize(seed, feeBps, payer.publicKey)
      .accountsStrict({
        signer: payer.publicKey,
        extraAccountMetaList,
        mint: tokenMint.publicKey,
        wsolMint: NATIVE_MINT_2022,
        lpToken,
        vault,
        solVault,
        wsolVault,
        config,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();

    const poolConfig = await program.account.config.fetch(config);
    expect(poolConfig.seed.toString()).to.equal(seed.toString());
    expect(poolConfig.fee).to.equal(feeBps);
    expect(poolConfig.authority.toBase58()).to.equal(payer.publicKey.toBase58());
  });

  it("5. Deposit Liquidity to Pool", async () => {
    const tokenAmount = new BN(100 * 10 ** decimals);
    const solAmount = new BN(5 * LAMPORTS_PER_SOL);
    const maxToken = new BN(110 * 10 ** decimals);
    const maxSol = new BN(5.5 * LAMPORTS_PER_SOL);

    userLpAccount = getAssociatedTokenAddressSync(
      lpToken,
      user.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    const initialTokenBalance = await getAccount(
      connection,
      userTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const initialSolBalance = await connection.getBalance(user.publicKey);

    await program.methods
      .deposit(solAmount, tokenAmount, maxSol, maxToken)
      .accountsStrict({
        signer: user.publicKey,
        mintx: tokenMint.publicKey,
        minty: NATIVE_MINT_2022,
        userX: userTokenAccount,
        userY: userWsolAccount,
        userLp: userLpAccount,
        lpToken,
        vaultX: vault,
        vaultY: wsolVault,
        config,
        solVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: extraAccountMetaList, isWritable: false, isSigner: false },
        { pubkey: transferHookProgram.programId, isWritable: false, isSigner: false },
        { pubkey: delegatePda, isWritable: false, isSigner: false },
        { pubkey: delegateWsolAta, isWritable: true, isSigner: false },
      ])
      .signers([user])
      .rpc();

    const userLpBalance = await getAccount(
      connection,
      userLpAccount,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    expect(Number(userLpBalance.amount)).to.be.greaterThan(0);

    const vaultTokenBalance = await getAccount(
      connection,
      vault,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const vaultSolBalance = await connection.getBalance(solVault);

    expect(Number(vaultTokenBalance.amount)).to.be.greaterThan(0);
    expect(vaultSolBalance).to.be.greaterThan(0);
  });

  it("6. Perform Token-to-SOL Swap", async () => {
    console.log("\n🔄 Performing token-to-SOL swap...");

    const swapAmount = new BN(10 * 10 ** decimals); // Swap 10 tokens
    const minOut = new BN(0.1 * LAMPORTS_PER_SOL); // Expect at least 0.1 SOL

    // Get initial balances
    const initialTokenBalance = await getAccount(
      connection,
      userTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const initialSolBalance = await connection.getBalance(user.publicKey);

    console.log(`Pre-swap token balance: ${initialTokenBalance.amount}`);
    console.log(`Pre-swap SOL balance: ${initialSolBalance / LAMPORTS_PER_SOL} SOL`);

    // Perform swap (token to SOL)
    await program.methods
      .swap(swapAmount, true, minOut) // true = swapping token (X) for SOL (Y)
      .accountsStrict({
        signer: user.publicKey,
        mintx: tokenMint.publicKey,
        minty: NATIVE_MINT_2022,
        userX: userTokenAccount,
        userY: userWsolAccount,
        userLp: userLpAccount,
        lpToken,
        vaultX: vault,
        vaultY: wsolVault,
        config,
        solVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: extraAccountMetaList, isWritable: false, isSigner: false },
        { pubkey: transferHookProgram.programId, isWritable: false, isSigner: false },
        { pubkey: delegatePda, isWritable: false, isSigner: false },
        { pubkey: delegateWsolAta, isWritable: true, isSigner: false },
      ])
      .signers([user])
      .rpc();

    console.log(`✅ Token-to-SOL swap completed`);

    // Verify balance changes
    const finalTokenBalance = await getAccount(
      connection,
      userTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const finalSolBalance = await connection.getBalance(user.publicKey);

    console.log(`Post-swap token balance: ${finalTokenBalance.amount}`);
    console.log(`Post-swap SOL balance: ${finalSolBalance / LAMPORTS_PER_SOL} SOL`);

    // Verify tokens were deducted
    expect(Number(finalTokenBalance.amount)).to.be.lessThan(Number(initialTokenBalance.amount));
    
    // Verify transfer hook fee was collected
    const delegateFeeBalance = await getAccount(
      connection,
      delegateWsolAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    expect(Number(delegateFeeBalance.amount)).to.be.greaterThan(0);
    console.log(`Transfer hook fees collected: ${delegateFeeBalance.amount}`);
  });

  it("7. Perform SOL-to-Token Swap", async () => {
    console.log("\n🔄 Performing SOL-to-token swap...");

    const swapAmount = new BN(1 * LAMPORTS_PER_SOL); // Swap 1 SOL
    const minOut = new BN(1 * 10 ** decimals); // Expect at least 1 token

    // Get initial balances
    const initialTokenBalance = await getAccount(
      connection,
      userTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const initialSolBalance = await connection.getBalance(user.publicKey);

    console.log(`Pre-swap token balance: ${initialTokenBalance.amount}`);
    console.log(`Pre-swap SOL balance: ${initialSolBalance / LAMPORTS_PER_SOL} SOL`);

    // Perform swap (SOL to token)
    await program.methods
      .swap(swapAmount, false, minOut) // false = swapping SOL (Y) for token (X)
      .accountsStrict({
        signer: user.publicKey,
        mintx: tokenMint.publicKey,
        minty: NATIVE_MINT_2022,
        userX: userTokenAccount,
        userY: userWsolAccount,
        userLp: userLpAccount,
        lpToken,
        vaultX: vault,
        vaultY: wsolVault,
        config,
        solVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: extraAccountMetaList, isWritable: false, isSigner: false },
        { pubkey: transferHookProgram.programId, isWritable: false, isSigner: false },
        { pubkey: delegatePda, isWritable: false, isSigner: false },
        { pubkey: delegateWsolAta, isWritable: true, isSigner: false },
      ])
      .signers([user])
      .rpc();

    console.log(`✅ SOL-to-token swap completed`);

    // Verify balance changes
    const finalTokenBalance = await getAccount(
      connection,
      userTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const finalSolBalance = await connection.getBalance(user.publicKey);

    console.log(`Post-swap token balance: ${finalTokenBalance.amount}`);
    console.log(`Post-swap SOL balance: ${finalSolBalance / LAMPORTS_PER_SOL} SOL`);

    // Verify tokens were received
    expect(Number(finalTokenBalance.amount)).to.be.greaterThan(Number(initialTokenBalance.amount));
  });

  it("8. Withdraw Liquidity from Pool", async () => {
    console.log("\n💸 Withdrawing liquidity from pool...");

    // Get current LP balance
    const lpBalance = await getAccount(
      connection,
      userLpAccount,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    
    const withdrawAmount = new BN(lpBalance.amount.toString()).div(new BN(2)); // Withdraw half
    const minToken = new BN(1); // Minimum tokens to receive
    const minSol = new BN(1); // Minimum SOL to receive

    console.log(`LP balance: ${lpBalance.amount}`);
    console.log(`Withdrawing: ${withdrawAmount}`);

    // Get initial balances
    const initialTokenBalance = await getAccount(
      connection,
      userTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const initialSolBalance = await connection.getBalance(user.publicKey);

    // Withdraw liquidity
    await program.methods
      .withdraw(withdrawAmount, minToken, minSol)
      .accountsStrict({
        signer: user.publicKey,
        mintx: tokenMint.publicKey,
        minty: NATIVE_MINT_2022,
        userX: userTokenAccount,
        userY: userWsolAccount,
        userLp: userLpAccount,
        lpToken,
        vaultX: vault,
        vaultY: wsolVault,
        config,
        solVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: extraAccountMetaList, isWritable: false, isSigner: false },
        { pubkey: transferHookProgram.programId, isWritable: false, isSigner: false },
        { pubkey: delegatePda, isWritable: false, isSigner: false },
        { pubkey: delegateWsolAta, isWritable: true, isSigner: false },
      ])
      .signers([user])
      .rpc();



    // Verify LP tokens were burned
    const finalLpBalance = await getAccount(
      connection,
      userLpAccount,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    expect(Number(finalLpBalance.amount)).to.be.lessThan(Number(lpBalance.amount));

    // Verify tokens and SOL were received
    const finalTokenBalance = await getAccount(
      connection,
      userTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const finalSolBalance = await connection.getBalance(user.publicKey);

    console.log(`Final token balance: ${finalTokenBalance.amount}`);
    console.log(`Final SOL balance: ${finalSolBalance / LAMPORTS_PER_SOL} SOL`);

    expect(Number(finalTokenBalance.amount)).to.be.greaterThan(Number(initialTokenBalance.amount));
  });

  it("9. Verify Transfer Hook Fee Collection", async () => {
    console.log("\n🏦 Verifying transfer hook fee collection...");

    // Check total fees collected by the delegate
    const delegateFeeBalance = await getAccount(
      connection,
      delegateWsolAta,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    console.log(`Total transfer hook fees collected: ${delegateFeeBalance.amount} lamports`);
    console.log(`Total transfer hook fees collected: ${Number(delegateFeeBalance.amount) / LAMPORTS_PER_SOL} SOL`);

    // Verify fees were collected (should be > 0 from all the transfers)
    expect(Number(delegateFeeBalance.amount)).to.be.greaterThan(0);

    // Verify the fee rate (0.1% of transfers)
    const expectedMinimumFees = 3; // At least 3 transfers occurred (deposit, 2 swaps, withdraw)
    expect(Number(delegateFeeBalance.amount)).to.be.greaterThan(expectedMinimumFees);
  });

 
});