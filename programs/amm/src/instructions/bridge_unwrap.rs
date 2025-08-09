use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        Mint, TokenAccount, TokenInterface, 
        transfer_checked, burn, TransferChecked, Burn
    },
};
use crate::state::*;
use crate::error::*;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct UnwrapFromPool<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    // AMM-specific accounts
    #[account(
        seeds = [b"config", amm_config.seed.to_le_bytes().as_ref()],
        bump = amm_config.config_bump,
        constraint = amm_config.is_bridge_pool @ AmmError::NotBridgePool
    )]
    pub amm_config: Account<'info, config>,
    
    #[account(
        mut,
        seeds = [b"bridge_pool_config", amm_config.key().as_ref()],
        bump = bridge_pool_config.bump
    )]
    pub bridge_pool_config: Account<'info, BridgePoolConfig>,
    
    // Token-2022 accounts
    pub restricted_token_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = restricted_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_2022_program
    )]
    pub user_restricted_token_account: InterfaceAccount<'info, TokenAccount>,
    
    // Bridge token accounts
    #[account(
        mut,
        address = bridge_pool_config.bridge_token_mint @ AmmError::InvalidBridgeTokenMint
    )]
    pub bridge_token_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = bridge_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        constraint = user_bridge_token_account.amount >= amount @ AmmError::InsufficientBridgeTokens
    )]
    pub user_bridge_token_account: InterfaceAccount<'info, TokenAccount>,
    
    // Vault accounts
    #[account(
        mut,
        associated_token::mint = restricted_token_mint,
        associated_token::authority = bridge_pool_config,
        associated_token::token_program = token_2022_program
    )]
    pub pool_vault_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn unwrap_from_pool(ctx: Context<UnwrapFromPool>, amount: u64) -> Result<()> {
    require!(amount > 0, AmmError::InvalidAmount);
    
    let bridge_pool_config = &ctx.accounts.bridge_pool_config;
    let amm_config = &ctx.accounts.amm_config;
    let mint_decimals = ctx.accounts.restricted_token_mint.decimals;
    
    // Burn bridge tokens from user
    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.bridge_token_mint.to_account_info(),
                from: ctx.accounts.user_bridge_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;
    
    msg!("Burned {} bridge tokens from user", amount);
    
    // Transfer Token-2022 tokens from pool vault to user (unlocks them with hook validation)
    let amm_config_key = amm_config.key();
    let bridge_pool_signer_seeds: &[&[u8]] = &[
        b"bridge_pool_config",
        amm_config_key.as_ref(),
        &[bridge_pool_config.bump],
    ];
    
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_2022_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.pool_vault_token_account.to_account_info(),
                mint: ctx.accounts.restricted_token_mint.to_account_info(),
                to: ctx.accounts.user_restricted_token_account.to_account_info(),
                authority: ctx.accounts.bridge_pool_config.to_account_info(),
            },
            &[bridge_pool_signer_seeds],
        ),
        amount,
        mint_decimals,
    ).map_err(|_| AmmError::HookValidationFailed)?;
    
    msg!("Unlocked {} Token-2022 tokens to user", amount);
    msg!("Transfer hook validation (if any) passed successfully");
    
    Ok(())
}