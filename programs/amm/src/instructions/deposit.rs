    use anchor_lang::prelude::*;
    use anchor_spl::{
        associated_token::AssociatedToken, token_2022::{mint_to, MintTo}, token_interface::{Mint, TokenAccount as InterfaceTokenAccount, TokenInterface}
    };
    use spl_token_2022::onchain::invoke_transfer_checked;
    // use constant_product_curve::constant_product_curve::ConstantProductCurve;
    use crate::{config, error::AmmError};

    #[derive(Accounts)]
    pub struct Deposit<'info> {
        #[account(mut)]
        pub signer: Signer<'info>,
        pub mint: Box<InterfaceAccount<'info, Mint>>,
        #[account(
            init_if_needed,
            payer=signer,
            associated_token::mint = mint,
            associated_token::authority = signer,
        )]
        pub user_token: Box<InterfaceAccount<'info, InterfaceTokenAccount>>,
        #[account(
            init_if_needed,
            payer = signer,
            associated_token::mint = lp_token,
            associated_token::authority = signer,
        )]
        pub user_lp: Box<InterfaceAccount<'info, InterfaceTokenAccount>>,
        /// CHECK: ExtraAccountMetaList passed through; validated by transfer hook execution
        pub extra_account_meta_list: AccountInfo<'info>,
        #[account(
            mut,
            seeds = [b"lp", config.key().as_ref()],
            bump = config.lp_bump
        )]
        pub lp_token: Box<InterfaceAccount<'info,Mint>>,
        #[account(
            init_if_needed,
            payer = signer,
            associated_token::mint = mint,
            associated_token::authority = config
        )]
        pub token_vault: Box<InterfaceAccount<'info, InterfaceTokenAccount>>,
        #[account(
            mut,
            seeds = [b"sol_vault", config.key().as_ref()],
            bump = config.sol_vault_bump
        )]
        /// CHECK: Native SOL vault PDA
        pub sol_vault: AccountInfo<'info>,
        #[account(
            mut,    
            seeds = [b"config", config.seed.to_le_bytes().as_ref()],
            bump = config.config_bump
        )]
        pub config: Account<'info, config>,
        pub system_program: Program<'info, System>,
        pub token_program: Interface<'info, TokenInterface>,
        pub associated_token_program: Program<'info, AssociatedToken>,
        /// CHECK: WSOL mint for Token-2022 (NATIVE_MINT_2022)
        pub wsol_mint: AccountInfo<'info>,
        #[account(
            mut,
            associated_token::mint = wsol_mint,
            associated_token::authority = config,
            associated_token::token_program = token_program
        )]
        pub wsol_vault: InterfaceAccount<'info, InterfaceTokenAccount>,
        #[account(
            mut,
            associated_token::mint = wsol_mint,
            associated_token::authority = signer,
            associated_token::token_program = token_program
        )]
        pub sender_wsol_token_account: InterfaceAccount<'info, InterfaceTokenAccount>,
        /// CHECK: Transfer hook program id account, appended at the end of remaining accounts
        pub transfer_hook_program: AccountInfo<'info>
    }

    impl<'info> Deposit<'info> {
        pub fn deposit(
            &mut self,
            sol_amount: u64,
            token_amount: u64,
            max_sol: u64,
            max_token: u64
        ) -> Result<()> {
            require!(!self.config.locked, AmmError::PoolLocked);
            require!(sol_amount > 0 || token_amount > 0, AmmError::InvalidAmount);

            let sol_balance = self.sol_vault.lamports();
            let token_balance = self.token_vault.amount;
            let lp_supply = self.lp_token.supply;

            let (deposit_sol, deposit_token, lp_amount) = if lp_supply == 0 || sol_balance == 0 || token_balance == 0 {
                (sol_amount, token_amount, 100_000_000_000)
            } else {
                let deposit_sol_based_on_token = (sol_balance as u128)
                    .checked_mul(token_amount as u128).ok_or(AmmError::InvalidAmount)?
                    .checked_div(token_balance as u128).ok_or(AmmError::InvalidAmount)? as u64;

                let deposit_token_based_on_sol = (token_balance as u128)
                    .checked_mul(sol_amount as u128).ok_or(AmmError::InvalidAmount)?
                    .checked_div(sol_balance as u128).ok_or(AmmError::InvalidAmount)? as u64;

                require!(
                    sol_amount >= deposit_sol_based_on_token || token_amount >= deposit_token_based_on_sol,
                    AmmError::InvalidAmount
                );

                let (final_deposit_sol, final_deposit_token) = if sol_amount < deposit_sol_based_on_token {
                    (sol_amount, deposit_token_based_on_sol)
                } else {
                    (deposit_sol_based_on_token, token_amount)
                };

                require!(final_deposit_sol <= max_sol && final_deposit_token <= max_token, AmmError::SlippageExceded);

                let lp_mint_amount = (final_deposit_sol as u128)
                    .checked_mul(lp_supply as u128).ok_or(AmmError::InvalidAmount)?
                    .checked_div(sol_balance as u128).ok_or(AmmError::InvalidAmount)? as u64;
                (final_deposit_sol, final_deposit_token, lp_mint_amount)
            };
            
            // --- Perform Transfers ---
            if deposit_sol > 0 {
                // transfer(
                //     CpiContext::new(
                //         self.system_program.to_account_info(), 
                //         Transfer {
                //             from: self.signer.to_account_info(),
                //             to: self.sol_vault.to_account_info(),
                //         }
                //     ),
                //     deposit_sol
                // )?;
            }

            if deposit_token > 0 {
                msg!("About to call transfer_checked");
                msg!("extra_account_meta_list: {}", self.extra_account_meta_list.key());
                msg!("mint: {}", self.mint.key());
                msg!("token_vault: {}", self.token_vault.key());
                msg!("user_token: {}", self.user_token.key());
                // Setup remaining accounts for invoke_transfer_checked
                // Include extra_account_meta_list first, then the extras in the exact order
                let remaining_accounts = vec![
                    // validation account (Execute index 4)
                    self.extra_account_meta_list.to_account_info(),
                    // Matches indices 5..11 configured in initialize_list.rs
                    self.wsol_mint.to_account_info(),
                    self.token_program.to_account_info(),
                    self.associated_token_program.to_account_info(),
                    self.config.to_account_info(),
                    self.wsol_vault.to_account_info(),
                    self.sender_wsol_token_account.to_account_info(),
                    self.system_program.to_account_info(),
                    // Last: transfer hook program id (as per your pattern)
                    self.transfer_hook_program.to_account_info(),
                ];
                invoke_transfer_checked(
                    &self.token_program.key(),
                    self.user_token.to_account_info(),
                    self.mint.to_account_info(),
                    self.token_vault.to_account_info(),
                    self.signer.to_account_info(),
                    &remaining_accounts,
                    deposit_token,
                    self.mint.decimals,
                    &[],
                )?;
                // let cpi_ctx = CpiContext::new(
                //     self.token_program.to_account_info(),
                //     TransferChecked{
                //       from: self.user_token.to_account_info(),
                //       to: self.token_vault.to_account_info(),
                //       authority: self.signer.to_account_info(),
                //     }
                //   )
                //   .with_remaining_accounts(vec![
                //     // Only the ExtraAccountMetaList is passed to Token-2022. It resolves the rest.
                //     self.extra_account_meta_list.to_account_info(),
                //   ]);
                //   transfer_checked(cpi_ctx, deposit_token,self.mint.decimals)?;
            }
            
            // --- Mint LP Tokens ---
            self.mint_lp_tokens(lp_amount)
        }

        fn mint_lp_tokens(&self, amount: u64) -> Result<()> {
            let seeds = &[
                b"config".as_ref(),
                &self.config.seed.to_le_bytes(),
                &[self.config.config_bump]
            ];
            let signer_seeds = &[&seeds[..]];

            mint_to(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    MintTo {
                        mint: self.lp_token.to_account_info(),
                        to: self.user_lp.to_account_info(),
                        authority: self.config.to_account_info(),
                    },
                    signer_seeds
                ), 
                amount
            )
        }
    }