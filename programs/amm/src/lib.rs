use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken, 
    token_interface::{Mint as InterfaceMint, TokenAccount as InterfaceTokenAccount, TokenInterface, TransferChecked,transfer_checked}
};
use spl_transfer_hook_interface::instruction::{TransferHookInstruction};
declare_id!("3D6uyMfYh3s315PgTRJQNsTNYfThWKoCfUaG1we6ZC8c");
pub mod instructions;
pub use instructions::*;
pub mod state;
pub use state::*;
pub mod error;
pub use error::*;

#[program]
pub mod amm {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        seed: u64,
        fee: u16,
        authority: Option<Pubkey>
    ) -> Result<()> {
        ctx.accounts.initialize(seed, fee, authority, &ctx.bumps)
    }
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        ctx.accounts.initialize(ctx.bumps,*ctx.program_id)
    }
    pub fn deposit(
        ctx: Context<Deposit>,
        sol_amount: u64, token_amount: u64, max_sol: u64, max_token: u64
    ) -> Result<()> {
        ctx.accounts.deposit(sol_amount,token_amount,max_sol,max_token)
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount: u64,
        is_x: bool,
        min_receive: u64
    ) -> Result<()> {
        ctx.accounts.swap(amount, is_x, min_receive)
    }
 

    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64,
        min_x: u64,
        min_y: u64
    ) -> Result<()> {
        ctx.accounts.withdraw(amount, min_x, min_y)
    }

    // Bridge functionality for Token-2022 support
    pub fn initialize_bridge_pool(ctx: Context<InitializeBridgePool>) -> Result<()> {
        instructions::initialize_bridge_pool(ctx)
    }

    pub fn wrap_for_pool(ctx: Context<WrapForPool>, amount: u64) -> Result<()> {
        instructions::wrap_for_pool(ctx, amount)
    }

    pub fn unwrap_from_pool(ctx: Context<UnwrapFromPool>, amount: u64) -> Result<()> {
        instructions::unwrap_from_pool(ctx, amount)
    }
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {   
        msg!("Transfer hook called with amount: {}", amount);
        
        // For now, just log and return success - no fee collection
        // In a real implementation, you might want to:
        // 1. Validate the transfer
        // 2. Collect fees
        // 3. Update state
        
        msg!("Transfer hook completed successfully");
        Ok(())
    }
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;
    
        // match instruction discriminator to transfer hook interface execute instruction
        // token2022 program CPIs this instruction on token transfer
        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
    
                // invoke custom transfer hook instruction on our program
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => return Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}
#[derive(Accounts)]
pub struct TransferHook<'info> {
    /// CHECK: Source token account provided by Token-2022
    pub source_token: UncheckedAccount<'info>,
    /// CHECK: Mint provided by Token-2022
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Destination token account provided by Token-2022
    pub destination_token: UncheckedAccount<'info>,
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList Account
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub wsol_mint: InterfaceAccount<'info, InterfaceMint>,
    pub token_program: Interface<'info,TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    #[account(
        seeds=[b"config",config.seed.to_le_bytes().as_ref()],
        bump
    )]
    pub config:Account<'info,config>,
    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    pub wsol_vault: InterfaceAccount<'info, InterfaceTokenAccount>,
    #[account(
        mut,
        token::mint = wsol_mint,
        token::authority = owner,
    )]
    pub sender_wsol_token_account: InterfaceAccount<'info, InterfaceTokenAccount>,
    pub system_program:Program<'info,System>
}
