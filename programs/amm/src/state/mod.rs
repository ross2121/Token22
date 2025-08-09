use anchor_lang::prelude::*;
#[account]
#[derive(InitSpace)]
pub struct config{
    pub seed:u64,
    pub authority:Option<Pubkey>,
    pub mint:Pubkey,
    pub fee:u16,
    pub  locked:bool,
    pub config_bump:u8,
    pub wsol_mint: Pubkey,
    pub sol_vault_bump: u8, 
    pub lp_bump:u8,
    pub bridge_config: Option<Pubkey>, // Reference to bridge config if this pool uses bridge tokens
    pub is_bridge_pool: bool, // Whether this pool trades bridge tokens
}

// Bridge-related state structures for AMM integration
#[account]
#[derive(InitSpace)]
pub struct BridgePoolConfig {
    pub amm_config: Pubkey,              // Reference to AMM config
    pub bridge_config: Pubkey,           // Reference to bridge system config
    pub restricted_token_mint: Pubkey,   // Original Token-2022 mint
    pub bridge_token_mint: Pubkey,       // Bridge token mint used in pool
    pub token_vault: Pubkey,             // Bridge token vault address
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolBridgeMetadata {
    pub pool_config: Pubkey,             // Reference to pool config
    pub total_wrapped: u64,              // Total bridge tokens in circulation for this pool
    pub last_updated: i64,               // Last update timestamp
    pub bump: u8,
}