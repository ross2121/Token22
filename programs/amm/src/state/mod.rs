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
    pub lp_bump:u8
}