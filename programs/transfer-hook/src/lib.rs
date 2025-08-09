use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

// Transfer-hook program that charges a WSOL fee on token transfer
// Uses a delegate PDA and WSOL so the hook can sign independently of the original transfer's signer

declare_id!("88CNX3Y7TyzjPtD76YhpmnPAsrmhSsYRVS5ad2wKMjuk");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // Index 0-3 are reserved by Token-2022 (source, mint, destination, owner)
        // Index 4 is the ExtraAccountMetaList itself (passed automatically)
        // The rest are our custom accounts required by the hook
        let account_metas = vec![
            // index 5: WSOL mint
            ExtraAccountMeta::new_with_pubkey(&ctx.accounts.wsol_mint.key(), false, false)?,
            // index 6: Token-2022 program
            ExtraAccountMeta::new_with_pubkey(&ctx.accounts.token_program.key(), false, false)?,
            // index 7: Associated Token program
            ExtraAccountMeta::new_with_pubkey(&ctx.accounts.associated_token_program.key(), false, false)?,
            // index 8: Delegate PDA (signer for fee transfer)
            ExtraAccountMeta::new_with_seeds(
                &[Seed::Literal {
                    bytes: b"delegate".to_vec(),
                }],
                false, // is_signer (signature provided via with_signer)
                true,  // is_writable
            )?,
            // index 9: Delegate's WSOL ATA
            ExtraAccountMeta::new_external_pda_with_seeds(
                7, // associated token program index
                &[
                    Seed::AccountKey { index: 8 }, // owner (delegate PDA)
                    Seed::AccountKey { index: 6 }, // token program (Token-2022)
                    Seed::AccountKey { index: 5 }, // WSOL mint
                ],
                false, // is_signer
                true,  // is_writable
            )?,
            // index 10: Sender's WSOL ATA
            ExtraAccountMeta::new_external_pda_with_seeds(
                7, // associated token program index
                &[
                    Seed::AccountKey { index: 3 }, // owner (source owner)
                    Seed::AccountKey { index: 6 }, // token program (Token-2022)
                    Seed::AccountKey { index: 5 }, // WSOL mint
                ],
                false, // is_signer
                true,  // is_writable
            )?,
        ];

        // Compute space and rent
        let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
        let lamports = Rent::get()?.minimum_balance(account_size as usize);

        // PDA signer for the ExtraAccountMetaList account
        let mint_key = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"extra-account-metas",
            mint_key.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];

        // Create the ExtraAccountMetaList account
        create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lamports,
            account_size,
            ctx.program_id,
        )?;

        // Initialize metadata
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx
                .accounts
                .extra_account_meta_list
                .try_borrow_mut_data()?,
            &account_metas,
        )?;

        Ok(())
    }

    // This is the hook called by Token-2022 via the interface fallback
    // It transfers a WSOL fee from the sender to a delegate-owned fee ATA
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        // Example fee: 0.1% of amount (basis points = 10)
        let fee_amount = amount / 1000;
        if fee_amount == 0 {
            return Ok(());
        }

        let signer_seeds: &[&[&[u8]]] = &[&[b"delegate", &[ctx.bumps.delegate]]];

        // Transfer WSOL from sender's WSOL ATA to delegate's WSOL ATA
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx
                        .accounts
                        .sender_wsol_token_account
                        .to_account_info(),
                    mint: ctx.accounts.wsol_mint.to_account_info(),
                    to: ctx
                        .accounts
                        .delegate_wsol_token_account
                        .to_account_info(),
                    authority: ctx.accounts.delegate.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            fee_amount,
            ctx.accounts.wsol_mint.decimals,
        )?;

        Ok(())
    }

    // Fallback handler so Token-2022 can route its Execute instruction
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;
        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => Err(anchor_lang::solana_program::program_error::ProgramError::InvalidInstructionData.into()),
        }
    }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList account; derived and owned by this program
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub wsol_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// Order-sensitive; first 4 are the canonical Token-2022 accounts
#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(token::mint = mint, token::authority = owner)]
    pub source_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(token::mint = mint)]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Source owner; could be system account or PDA
    pub owner: UncheckedAccount<'info>,

    /// CHECK: ExtraAccountMetaList for this mint (derived by this program)
    #[account(seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    pub wsol_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    // Delegate PDA used as the fee authority
    #[account(mut, seeds = [b"delegate"], bump)]
    pub delegate: SystemAccount<'info>,

    #[account(mut, token::mint = wsol_mint, token::authority = delegate)]
    pub delegate_wsol_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = wsol_mint, token::authority = owner)]
    pub sender_wsol_token_account: InterfaceAccount<'info, TokenAccount>,
}