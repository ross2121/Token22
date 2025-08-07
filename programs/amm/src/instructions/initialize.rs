use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};
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
 pub mint:Account<'info,Mint>,
 pub wsol_mint:Account<'info,Mint>,
 #[account(init,seeds=[b"lp",config.key().as_ref()],bump,mint::decimals=6,mint::authority=config,payer=signer)]
pub lp_token:Account<'info,Mint>,
 #[account(mut)]
 pub user_wsol: Account<'info, TokenAccount>,
 #[account(init_if_needed, associated_token::mint=lp_token, associated_token::authority=signer, payer=signer)]
 pub user_lp: Account<'info, TokenAccount>,

#[account(init,associated_token::mint=mint,associated_token::authority=config,payer=signer)]
pub vault:Account<'info,TokenAccount>,
#[account(init, seeds=[b"sol_vault", config.key().as_ref()], bump, payer=signer, space=0)]
pub sol_vault: AccountInfo<'info>,
#[account(init, associated_token::mint=wsol_mint, associated_token::authority=config, payer=signer)]
pub wsol_vault: Account<'info, TokenAccount>,
#[account(init,seeds=[b"config",seeds.to_le_bytes().as_ref()],bump,payer=signer,space=8+config::INIT_SPACE)]
pub config:Account<'info,config>,
pub system_program:Program<'info,System>,
pub token_program:Program<'info,Token>,
pub associated_token_program:Program<'info,AssociatedToken>
}
impl<'info>  Initialize <'info>{
    pub fn initialize(&mut self,seed:u64,fee:u16,authority:Option<Pubkey>,bump:&InitializeBumps)->Result<()>{
        self.config.set_inner(config { seed, authority, mint:self.mint.key(), fee, locked:false, config_bump:bump.config, lp_bump:bump.lp_token,wsol_mint:self.wsol_mint.key(),sol_vault_bump:bump.sol_vault});
        Ok(())
    }
    pub fn initialize_extra_account_meta_list(
        ctx: Context<Initialize>,
    ) -> Result<()> {
        let account_meta=vec![
            ExtraAccountMeta::new_with_pubkey(&ctx.accounts.wsol_mint.key(), false,false)?,
            ExtraAccountMeta::new_with_pubkey(&ctx.accounts.token_program.key(),false,false)?,
            ExtraAccountMeta::new_with_pubkey(
                &ctx.accounts.associated_token_program.key(),
                false,
                false,
            )?,
           // index 8, delegate PDA
ExtraAccountMeta::new_with_seeds(
    &[Seed::Literal {
        bytes: "delegate".as_bytes().to_vec(),
    }],
    false, // is_signer
    false,  // is_writable
)?,

      ExtraAccountMeta::new_external_pda_with_seeds(7,&[Seed::AccountKey { index: 8},Seed::AccountKey { index: 6 },Seed::AccountKey { index: 5 }],false, true)?,     
        ExtraAccountMeta::new_external_pda_with_seeds(7, &[Seed::AccountKey { index: 3 },Seed::AccountKey { index: 6 },Seed::AccountKey { index: 5 }], false,true)?,
        ];
        let acount_size=ExtraAccountMetaList::size_of(account_meta.len())? as u64;
        let lampott=Rent::get()?.minimum_balance(acount_size as usize);
        let mint=ctx.accounts.mint.key();   
        let signer_seeds:&[&[&[u8]]]=&[&[b"extra-account-metas",&mint.as_ref(),&[ctx.bumps.extra_account_meta_list]]];
        create_account(CpiContext::new(ctx.accounts.system_program.to_account_info(),CreateAccount { from: ctx.accounts.signer.to_account_info(), to: ctx.accounts.extra_account_meta_list.to_account_info() },).with_signer(signer_seeds),lampott,acount_size,ctx.program_id)?;
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,&account_meta)?;
      Ok(())
    }
}