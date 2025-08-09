use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenInterface},
};
use crate::state::*;
use crate::error::*;

#[derive(Accounts)]
pub struct InitializeBridgePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    // AMM config that will be bridge-enabled
    #[account(
        mut,
        seeds = [b"config", amm_config.seed.to_le_bytes().as_ref()],
        bump = amm_config.config_bump,
        constraint = amm_config.authority == Some(authority.key()) @ AmmError::Unauthorized,
        constraint = !amm_config.is_bridge_pool @ AmmError::AlreadyBridgePool
    )]
    pub amm_config: Account<'info, config>,
    
    // Bridge pool configuration
    #[account(
        init,
        payer = authority,
        space = 8 + BridgePoolConfig::INIT_SPACE,
        seeds = [b"bridge_pool_config", amm_config.key().as_ref()],
        bump
    )]
    pub bridge_pool_config: Account<'info, BridgePoolConfig>,
    
    // Token-2022 mint that will be bridged
    pub restricted_token_mint: InterfaceAccount<'info, Mint>,
    
    // Bridge token mint (standard SPL) for pool trading
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = bridge_pool_config,
        mint::token_program = token_program
    )]
    pub bridge_token_mint: InterfaceAccount<'info, Mint>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_bridge_pool(ctx: Context<InitializeBridgePool>) -> Result<()> {
    let amm_config = &mut ctx.accounts.amm_config;
    let bridge_pool_config = &mut ctx.accounts.bridge_pool_config;
    
    // Update AMM config to mark as bridge pool
    amm_config.is_bridge_pool = true;
    amm_config.bridge_config = Some(bridge_pool_config.key());
    
    // Initialize bridge pool config
    bridge_pool_config.amm_config = amm_config.key();
    bridge_pool_config.bridge_config = Pubkey::default(); // Will be set if using external bridge
    bridge_pool_config.restricted_token_mint = ctx.accounts.restricted_token_mint.key();
    bridge_pool_config.bridge_token_mint = ctx.accounts.bridge_token_mint.key();
    bridge_pool_config.token_vault = Pubkey::default(); // Will be set when first tokens are wrapped
    bridge_pool_config.bump = ctx.bumps.bridge_pool_config;
    
    msg!("Bridge pool initialized for AMM: {}", amm_config.key());
    msg!("Token-2022 mint: {}", bridge_pool_config.restricted_token_mint);
    msg!("Bridge token mint: {}", bridge_pool_config.bridge_token_mint);
    msg!("Bridge tokens can now be traded on this AMM pool");
    
    Ok(())
}