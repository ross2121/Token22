use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount,Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken, 
    token_2022::Token2022,
    token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked,transfer_checked}
};

use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};
impl <'info> InitializeExtraAccountMetaList<'info> {
    pub fn initialize(
        &mut self,bump:InitializeExtraAccountMetaListBumps,programid:Pubkey
    ) -> Result<()> {
        let account_meta=vec![
            ExtraAccountMeta::new_with_pubkey(&self.wsol_mint.key(), false,false)?,
            ExtraAccountMeta::new_with_pubkey(&self.token_program.key(),false,false)?,
            ExtraAccountMeta::new_with_pubkey(
                &self.associated_token_program.key(),
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
        let mint=self.mint.key();   
        let signer_seeds:&[&[&[u8]]]=&[&[b"extra-account-metas",&mint.as_ref(),&[bump.extra_account_meta_list]]];
        create_account(CpiContext::new(self.system_program.to_account_info(),CreateAccount { from: self.payer.to_account_info(), to: self.extra_account_meta_list.to_account_info() },).with_signer(signer_seeds),lampott,acount_size,&programid)?;
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut self.extra_account_meta_list.try_borrow_mut_data()?,&account_meta)?;
      Ok(())
    }
}



#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer:Signer<'info>,
    /// CHECK: ExtraAccountMetaList Account for storing transfer hook metadata
    #[account(mut,seeds=[b"extra-account-metas",mint.key().as_ref()],bump)]
    pub extra_account_meta_list:AccountInfo<'info>,
    pub mint:InterfaceAccount<'info,Mint>,
    pub wsol_mint:InterfaceAccount<'info,Mint>,
    pub token_program:Interface<'info,TokenInterface>,
    pub associated_token_program:Program<'info,AssociatedToken>,
    pub system_program:Program<'info,System>
}