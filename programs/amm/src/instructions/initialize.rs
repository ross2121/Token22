use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::{associated_token::AssociatedToken, token_2022::Token2022, token_interface::{Mint as InterfaceMint, TokenAccount as InterfaceTokenAccount, TokenInterface}};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};
use crate::config;
#[derive(Accounts)]
#[instruction(seeds:u64)]
pub struct Initialize<'info>{
#[account(mut)]
    pub signer:Signer<'info>,
      /// CHECK: ExtraAccountMetaList Account for storing transfer hook metadata
      #[account(mut,seeds=[b"extra-account-metas",mint.key().as_ref()],bump)]
      pub extra_account_meta_list:AccountInfo<'info>,
 pub mint:InterfaceAccount<'info, InterfaceMint>,
 // wsol_mint accessed via remaining_accounts to bypass Anchor validation
#[account(init,seeds=[b"lp",config.key().as_ref()],bump,mint::decimals=6,mint::authority=config,payer=signer)]
pub lp_token:InterfaceAccount<'info, InterfaceMint>,
#[account(init,associated_token::mint=mint,associated_token::authority=config,payer=signer)]
pub vault:InterfaceAccount<'info, InterfaceTokenAccount>,
#[account(mut, seeds=[b"sol_vault", config.key().as_ref()], bump)]
pub sol_vault:SystemAccount<'info>,
/// CHECK: WSOL vault ATA for config authority
#[account(mut)]
pub wsol_vault: AccountInfo<'info>,
#[account(init,seeds=[b"config",seeds.to_le_bytes().as_ref()],bump,payer=signer,space=8+config::INIT_SPACE)]
pub config:Account<'info,config>,
pub system_program:Program<'info,System>,
pub token_program:Interface<'info,TokenInterface>,
pub associated_token_program:Program<'info,AssociatedToken>
}
impl<'info>  Initialize <'info>{
    pub fn initialize(&mut self,seed:u64,fee:u16,authority:Option<Pubkey>,bump:&InitializeBumps, wsol_mint_key: Pubkey)->Result<()>{
        self.config.set_inner(config { seed, authority, mint:self.mint.key(), fee, locked:false, config_bump:bump.config, lp_bump:bump.lp_token,wsol_mint:wsol_mint_key,sol_vault_bump:bump.sol_vault});
        Ok(())
    }
   
}