use anchor_lang::{prelude::*};
use anchor_spl::{associated_token::AssociatedToken, token::{ transfer, transfer_checked, Mint, MintTo, Token, TokenAccount, Transfer, TransferChecked}, token_2022::Token2022};
use constant_product_curve::{ConstantProduct, LiquidityPair};

use crate::{config, error::AmmError};

#[derive(Accounts)]
#[instruction(seeds:u64)]
pub struct Swap<'info>{
#[account(mut)]
pub signer:Signer<'info>,
pub token_mint: Account<'info, Mint>,  
    /// CHECK: WSOL mint for Token-2022 (NATIVE_MINT_2022)
    // wsol_mint accessed via remaining_accounts to bypass Anchor validation
    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,  // User's Token-2022 accoun             // User's SOL account
    #[account(mut)]
    pub user_wsol: Account<'info, TokenAccount>,
#[account(mut,seeds=[b"lp",config.key().as_ref()],bump=config.lp_bump)]
pub lp_token:Account<'info,Mint>,
#[account(mut, associated_token::mint=token_mint, associated_token::authority=config)]
pub token_vault: Account<'info, TokenAccount>,
#[account(mut, seeds=[b"sol_vault", config.key().as_ref()], bump=config.sol_vault_bump)]
    /// CHECK: This is the user's SOL account, checked in the instruction logic.
pub sol_vault: AccountInfo<'info>,
#[account(mut,seeds=[b"config",config.seed.to_le_bytes().as_ref()],bump=config.config_bump)]
pub config:Account<'info,config>,
    /// CHECK: ExtraAccountMetaList passed through; validated at runtime by transfer hook
pub extra_account_meta_list: UncheckedAccount<'info>,
    /// CHECK: WSOL vault ATA for config authority
    #[account(mut)]
    pub wsol_vault: AccountInfo<'info>,
pub system_program:Program<'info,System>,
pub token_program:Program<'info,Token>,
pub token_2022_program: Program<'info, Token2022>,
pub associated_token_program:Program<'info,AssociatedToken>
}
impl<'info>  Swap <'info>{
    pub fn swap(&mut self, amount: u64, is_sol_to_token: bool, min_receive: u64) -> Result<()> {
        require!(self.config.locked == false, AmmError::PoolLocked);
        require!(amount != 0, AmmError::InvalidAmount);
    
        let sol_balance = self.sol_vault.lamports();
        let token_balance = self.token_vault.amount;
        
        let mut curve = ConstantProduct::init(
            sol_balance, 
            token_balance, 
            self.lp_token.supply, 
            self.config.fee, 
            None
        ).map_err(|_| AmmError::CurveError)?;
        
        let swap_direction = if is_sol_to_token {
            LiquidityPair::X  // SOL is X
        } else {
            LiquidityPair::Y  // Token is Y
        };
        
        let swap_result = curve.swap(swap_direction, amount, min_receive)
            .map_err(|_| AmmError::CurveError)?;
        
        require!(swap_result.deposit != 0 || swap_result.withdraw != 0, AmmError::InvalidAmount);
        
        if is_sol_to_token {
    
            self.transfer_sol_to_vault(swap_result.deposit)?;
            self.transfer_token_from_vault(swap_result.withdraw)?;
        } else {
        
            self.transfer_token_to_vault(swap_result.deposit)?;
            self.transfer_sol_from_vault(swap_result.withdraw)?;
        }    
        Ok(())
    }
    pub fn transfer_sol_from_vault(&self, amount: u64) -> Result<()> {
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: self.sol_vault.to_account_info(),
            to: self.signer.to_account_info(),
        };
        let seed_config=&self.config.key();
        let seeds = &[
            b"sol_vault".as_ref(),
            &seed_config.as_ref(),
            &[self.config.sol_vault_bump]
        ];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_context = CpiContext::new_with_signer(
            self.system_program.to_account_info(),
            transfer_instruction,
            signer_seeds,
        );
        
        anchor_lang::system_program::transfer(cpi_context, amount)
    }



    pub fn transfer_sol_to_vault(&self, amount: u64) -> Result<()> {
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: self.signer.to_account_info(),
            to: self.sol_vault.to_account_info(),
        };
        
        let cpi_context = CpiContext::new(
            self.system_program.to_account_info(),
            transfer_instruction,
        );
        
        anchor_lang::system_program::transfer(cpi_context, amount)
    }
    pub fn transfer_token_to_vault(&self, amount: u64) -> Result<()> {
        // Use Token-2022 program for transfer with hooks
        let transfer_instruction = TransferChecked {
            from: self.user_token.to_account_info(),
            mint: self.token_mint.to_account_info(),
            to: self.token_vault.to_account_info(),
            authority: self.signer.to_account_info(),
        }; 
        let cpi_context = CpiContext::new(
            self.token_2022_program.to_account_info(),
            transfer_instruction,
        );
        transfer_checked(cpi_context, amount, self.token_mint.decimals)
    }
    pub fn transfer_token_from_vault(&self, amount: u64) -> Result<()> {
        let transfer_instruction = Transfer {
            from: self.token_vault.to_account_info(),
            to: self.user_token.to_account_info(),
            authority: self.config.to_account_info(),
        };
        
        let seeds = &[
            b"config".as_ref(),
            &self.config.seed.to_le_bytes(),
            &[self.config.config_bump]
        ];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_context = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            transfer_instruction,
            signer_seeds,
        );
        
        transfer(cpi_context, amount)
    }
    

}