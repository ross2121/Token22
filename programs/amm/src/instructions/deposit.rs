use anchor_lang::{prelude::*};
use anchor_spl::{associated_token::AssociatedToken, token_interface::{mint_to, transfer_checked, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked}};
use constant_product_curve::ConstantProduct;

use crate::{config, error::AmmError};


#[derive(Accounts)]

pub struct Deposit<'info>{
#[account(mut)]
    pub signer:Signer<'info>,
    
 pub mintx:InterfaceAccount<'info,Mint>,
/// CHECK: NATIVE_MINT_2022 - special system-owned mint
pub minty: AccountInfo<'info>,
#[account(mut)]
pub user_x:InterfaceAccount<'info,TokenAccount>,
#[account(mut)]
pub user_y:InterfaceAccount<'info,TokenAccount>,
#[account(init_if_needed,associated_token::mint=lp_token,associated_token::authority=signer,payer=signer)]
pub user_lp:InterfaceAccount<'info,TokenAccount>,
#[account(mut,seeds=[b"lp",config.key().as_ref()],bump=config.lp_bump)]
pub lp_token:InterfaceAccount<'info,Mint>,
#[account(init_if_needed,payer=signer,associated_token::mint=mintx,associated_token::authority=config)]
pub vault_x:InterfaceAccount<'info,TokenAccount>,
#[account(init_if_needed,payer=signer,associated_token::mint=minty,associated_token::authority=config)]
pub vault_y:InterfaceAccount<'info,TokenAccount>,
#[account(mut,seeds=[b"config",config.seed.to_le_bytes().as_ref()],bump=config.config_bump)]
pub config:Account<'info,config>,
pub system_program:Program<'info,System>,
pub token_program:Interface<'info,TokenInterface>,
pub associated_token_program:Program<'info,AssociatedToken>
}
impl<'info>  Deposit <'info>{
    pub fn deposit(&mut self,amount:u64,max_x:u64,max_y:u64)->Result<()>{
        require!(self.config.locked == false, AmmError::PoolLocked);
       require!(amount!=0,AmmError::InvalidAmount);

    println!("Vault X amount: {}", self.vault_x.amount);
println!("Vault Y amount: {}", self.vault_y.amount);
    println!("LP supply: {}", self.lp_token.supply);
       let (x,y)=match self.lp_token.supply==0 && self.vault_x.amount==0 && self.vault_y.amount==0  {
            true =>(max_x,max_y),
            false=>{let amount=ConstantProduct::xy_deposit_amounts_from_l(self.vault_x.amount, self.vault_y.amount, self.lp_token.supply, amount, 6).unwrap();
                (amount.x,amount.y)}
       };
       require!(x<=max_x||y<=max_y,AmmError::SlippageExceded);
       self.deposittoken(true, x)?;
       self.deposittoken(false, y)?;
       self.mint(amount)
    
    }
    pub fn deposittoken(&self,is_x:bool,amount:u64)->Result<()>{
      if is_x {
          // Transfer Token-2022 with transfer hook
          let account=TransferChecked{
            from:self.user_x.to_account_info(),
            mint: self.mintx.to_account_info(),
            to:self.vault_x.to_account_info(),
            authority:self.signer.to_account_info()
          };
         let cpi_context=CpiContext::new(self.token_program.to_account_info(), account);
          transfer_checked(cpi_context, amount, self.mintx.decimals)
      } else {
          // Transfer WSOL (NATIVE_MINT_2022)
          let account=TransferChecked{
            from:self.user_y.to_account_info(),
            mint: self.minty.to_account_info(),
            to:self.vault_y.to_account_info(),
            authority:self.signer.to_account_info()
          };
         let cpi_context=CpiContext::new(self.token_program.to_account_info(), account);
          transfer_checked(cpi_context, amount, 9) // WSOL has 9 decimals
      }
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