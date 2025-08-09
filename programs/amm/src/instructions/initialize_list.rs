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
use crate::{config, AmmError};
impl <'info> InitializeExtraAccountMetaList<'info> {
    pub fn initialize(
        &mut self,bump:InitializeExtraAccountMetaListBumps,programid:Pubkey
    ) -> Result<()> {
        // Base accounts: 0=source, 1=mint, 2=destination, 3=owner
        // Extra accounts for config-based fee collection:
        // 5: wsol_mint (Token-2022 WSOL)
        // 6: token_program (Token-2022)
        // 7: associated_token_program
        // 8: config PDA
        // 9: wsol_vault = ATA(config, wsol_mint, token_program)
        // 10: sender_wsol_token_account = ATA(owner, wsol_mint, token_program)
        // 11: system_program
        let mut account_meta = Vec::<ExtraAccountMeta>::with_capacity(7);
        account_meta.push(ExtraAccountMeta::new_with_pubkey(&self.wsol_mint.key(), false, false)?); // 5
        account_meta.push(ExtraAccountMeta::new_with_pubkey(&self.token_program.key(), false, false)?); // 6
        account_meta.push(ExtraAccountMeta::new_with_pubkey(&self.associated_token_program.key(), false, false)?); // 7
        // 8: config PDA (place BEFORE its ATA so seeds can reference it)
        account_meta.push(ExtraAccountMeta::new_with_pubkey(&self.config.key(), false, false)?);
        // 9: wsol_vault = ATA(config, wsol_mint, token_program)
        account_meta.push(ExtraAccountMeta::new_external_pda_with_seeds(
            7,
            &[
                Seed::AccountKey { index: 8 }, // config authority
                Seed::AccountKey { index: 6 }, // token_program (Token-2022)
                Seed::AccountKey { index: 5 }, // wsol_mint (NATIVE_MINT_2022)
            ],
            false,
            true,
        )?);
        // 10: sender_wsol_token_account = ATA(owner, wsol_mint, token_program)
        account_meta.push(ExtraAccountMeta::new_external_pda_with_seeds(
            7,
            &[
                Seed::AccountKey { index: 3 }, // owner authority
                Seed::AccountKey { index: 6 }, // token_program (Token-2022)
                Seed::AccountKey { index: 5 }, // wsol_mint (NATIVE_MINT_2022)
            ],
            false,
            true,
        )?);
        // 11: system_program
        account_meta.push(ExtraAccountMeta::new_with_pubkey(&self.system_program.key(), false, false)?);
        let acount_size=ExtraAccountMetaList::size_of(account_meta.len())? as u64;
        let lampott=Rent::get()?.minimum_balance(acount_size as usize);
        // Canonical PDA includes transfer hook program id as seed
        let mint_key = self.mint.key();
        let program_id_key = programid;
        let (expected_pda, pda_bump) = Pubkey::find_program_address(
            &[b"extra-account-metas", mint_key.as_ref()],
            &program_id_key,
        );
        require_keys_eq!(expected_pda, self.extra_account_meta_list.key(), AmmError::InvalidAmount);
        let seed_extra: &[u8] = b"extra-account-metas";
        let seed_mint: &[u8] = mint_key.as_ref();
        let seed_bump: &[u8] = &[pda_bump];
        let signer_seeds: &[&[&[u8]]] = &[&[seed_extra, seed_mint, seed_bump]];
        create_account(
            CpiContext::new(
                self.system_program.to_account_info(),
                CreateAccount { from: self.payer.to_account_info(), to: self.extra_account_meta_list.to_account_info() },
            )
            .with_signer(signer_seeds),
            lampott,
            acount_size,
            &program_id_key,
        )?;
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut self.extra_account_meta_list.try_borrow_mut_data()?,&account_meta)?;
      Ok(())
    }
}



#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer:Signer<'info>,
    /// CHECK: ExtraAccountMetaList Account for storing transfer hook metadata
    #[account(mut)]
    pub extra_account_meta_list:AccountInfo<'info>,
    pub mint:InterfaceAccount<'info,Mint>,
    /// CHECK: WSOL mint for Token-2022 (NATIVE_MINT_2022)
    /// CHECK: WSOL mint for Token-2022 (NATIVE_MINT_2022)
    pub wsol_mint: AccountInfo<'info>,
    pub token_program:Interface<'info,TokenInterface>,
    pub associated_token_program:Program<'info,AssociatedToken>,
    #[account(
        mut,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump
    )]
    pub config: Account<'info, config>,
    pub system_program:Program<'info,System>
}