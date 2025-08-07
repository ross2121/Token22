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
declare_id!("6EfhjRgXRRnvzLaxcDbyCd5zQaKNrDLrhHcsbQgwkJjt");

#[program]
pub mod transfer_hook {
    use super::*;
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
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
        create_account(CpiContext::new(ctx.accounts.system_program.to_account_info(),CreateAccount { from: ctx.accounts.payer.to_account_info(), to: ctx.accounts.extra_account_meta_list.to_account_info() },).with_signer(signer_seeds),lampott,acount_size,ctx.program_id)?;
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,&account_meta)?;
      Ok(())
    }   
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {   
        let signer_Seed:& [ & [ & [ u8 ]]] =&[&[b"delegate",&[ctx.bumps.delegate]]];
        
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_wsol_token_account.to_account_info(),
            mint: ctx.accounts.wsol_mint.to_account_info(),
            to: ctx.accounts.delegate_wsol_token_account.to_account_info(),
            authority: ctx.accounts.delegate.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts).with_signer(signer_Seed);
        
        transfer_checked(cpi_ctx, amount, ctx.accounts.wsol_mint.decimals)?;
        
        Ok(())
    }

// fallback instruction handler as workaround to anchor instruction discriminator check
pub fn fallback<'info>(
    program_id: &Pubkey,
    accounts: &'info [AccountInfo<'info>],
    data: &[u8],
) -> Result<()> {
    let instruction = TransferHookInstruction::unpack(data)?;

    // match instruction discriminator to transfer hook interface execute instruction
    // token2022 program CPIs this instruction on token transfer
    match instruction {
        TransferHookInstruction::Execute { amount } => {
            let amount_bytes = amount.to_le_bytes();

            // invoke custom transfer hook instruction on our program
            __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
        }
        _ => return Err(ProgramError::InvalidInstructionData.into()),
    }
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

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        token::mint = mint,
        token::authority = owner,
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = mint,
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList Account,
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub wsol_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info,TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    #[account(
        seeds = [b"delegate"],
        bump
    )]
    pub delegate: SystemAccount<'info>,
    #[account(
        mut,
        token::mint = wsol_mint,
        token::authority = delegate,
    )]
    pub delegate_wsol_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = wsol_mint,
        token::authority = owner,
    )]
    pub sender_wsol_token_account: InterfaceAccount<'info, TokenAccount>,
}