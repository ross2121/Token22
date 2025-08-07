use anchor_lang::{prelude::*,system_program::{Transfer,transfer}};
use anchor_spl::{associated_token::AssociatedToken, token::{mint_to, transfer_checked, Mint, MintTo, Token, TokenAccount,TransferChecked}, token_2022::Token2022};
use crate::{config, error::AmmError};
#[derive(Accounts)]
pub struct Deposit<'info>{
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(init_if_needed, associated_token::mint=lp_token, associated_token::authority=signer, payer=signer)]
    pub user_lp: Account<'info, TokenAccount>,
    #[account(mut, seeds=[b"lp", config.key().as_ref()], bump=config.lp_bump)]
    pub lp_token: Account<'info, Mint>,
    #[account(mut, associated_token::mint=token_mint, associated_token::authority=config)]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut, seeds=[b"sol_vault", config.key().as_ref()], bump=config.sol_vault_bump)]
        /// CHECK: This is the user's SOL account, checked in the instruction logic.
    pub sol_vault: AccountInfo<'info>,
    #[account(mut, seeds=[b"config", config.seed.to_le_bytes().as_ref()], bump=config.config_bump)]
    pub config: Account<'info, config>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>
}
impl<'info>  Deposit <'info>{
    pub fn deposit(&mut self,sol_amount: u64, token_amount: u64, max_sol: u64, max_token: u64)->Result<()>{
        require!(self.config.locked == false, AmmError::PoolLocked);
       require!(sol_amount!=0,AmmError::InvalidAmount);
       println!("LP supply: {}", self.lp_token.supply);  
    
       let sol_balance = self.sol_vault.lamports();
       let token_balance = self.token_vault.amount;
       let (deposit_sol, deposit_token) = match self.lp_token.supply == 0 && sol_balance == 0 && token_balance == 0 {
        true => (max_sol, max_token),
        false => {
            let total_liquidity = self.lp_token.supply;
            let sol_ratio = if sol_balance > 0 { sol_amount as f64 / sol_balance as f64 } else { 0.0 };
            let token_ratio = if token_balance > 0 { token_amount as f64 / token_balance as f64 } else { 0.0 };
          
            let ratio = if sol_ratio < token_ratio { sol_ratio } else { token_ratio };
            
            let deposit_sol = (sol_balance as f64 * ratio) as u64;
            let deposit_token = (token_balance as f64 * ratio) as u64;
            
            (deposit_sol, deposit_token)
        }
    };
    require!(deposit_sol <= max_sol && deposit_token <= max_token, AmmError::SlippageExceded);
      // Transfer SOL to vault
      if deposit_sol > 0 {
        let  account=Transfer{
            from:self.signer.to_account_info(),
            to:self.sol_vault.to_account_info()
        };
        let cpicontex=CpiContext::new(self.system_program.to_account_info(), account);
        transfer(cpicontex,deposit_sol)?;
    }
    
    // Transfer Token-2022 to vault
    if deposit_token > 0 {
        let  account=TransferChecked{
            from:self.signer.to_account_info(),
            to:self.sol_vault.to_account_info(),
            authority:self.config.to_account_info(),
            mint:self.token_mint.to_account_info()
        };
        let cpicontex=CpiContext::new(self.token_program.to_account_info(), account);
        transfer_checked(cpicontex,deposit_sol,self.token_mint.decimals)?;
    }
    let lp_amount = if self.lp_token.supply == 0 {
        (deposit_sol + deposit_token) / 2  // Simple initial LP calculation
    } else {
        // Calculate based on proportional contribution
        let sol_contribution = (deposit_sol as f64 / sol_balance as f64) * self.lp_token.supply as f64;
        let token_contribution = (deposit_token as f64 / token_balance as f64) * self.lp_token.supply as f64;
        (sol_contribution + token_contribution) as u64 / 2
    };
    self.mint(lp_amount)?;
    Ok(())

}
pub fn mint(&self,amount:u64)->Result<()>{
    let mint=MintTo{mint:self.lp_token.to_account_info(),to:self.user_lp.to_account_info(),authority:self.config.to_account_info()};
    let seeds = &[
        b"config".as_ref(),
        &self.config.seed.to_le_bytes(),
        &[self.config.config_bump]
    ];
    let signer_seeds = &[&seeds[..]];
    let cpi_context=CpiContext::new_with_signer(self.token_program.to_account_info(),mint, signer_seeds);
    mint_to(cpi_context, amount)
}
}