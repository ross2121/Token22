# Token-2022 Transfer Hook AMM

A complete Solana AMM implementation that supports Token-2022 with Transfer Hooks, enabling compliant DeFi trading for enterprise and RWA use cases.

## 🎯 Project Overview

This project solves the critical challenge of making Token-2022 with Transfer Hooks tradable on Solana AMMs. No major AMMs (Raydium, Orca, Meteora) currently support active transfer hooks, limiting Token-2022 adoption for enterprise DeFi and real-world asset tokenization.

**Key Features:**
- ✅ SOL + Token-2022 trading pairs
- ✅ Transfer hook fee collection (0.1% WSOL fee)
- ✅ Reentrancy-safe architecture
- ✅ Complete UI for token creation and pool management
- ✅ Enterprise-ready compliance features

## 📁 Project Structure

```
AMM/
├── 📋 PROJECT_IMPLEMENTATION_SUMMARY.txt    # Detailed implementation documentation
├── 📋 README.md                             # This file
│
├── 🦀 programs/                             # Rust Smart Contracts
│   ├── amm/                                 # Main AMM Program
│   │   ├── Cargo.toml                       # Dependencies and metadata
│   │   └── src/
│   │       ├── lib.rs                       # Program entry point
│   │       ├── instructions/                # All program instructions
│   │       │   ├── mod.rs                   # Module exports
│   │       │   ├── initialize.rs            # Pool initialization
│   │       │   ├── deposit.rs               # Liquidity deposits
│   │       │   ├── swap.rs                  # Token swapping
│   │       │   ├── withdraw.rs              # Liquidity withdrawal
│   │       │   ├── initialize_bridge_pool.rs # Bridge pool setup
│   │       │   ├── bridge_wrap.rs           # Token wrapping
│   │       │   └── bridge_unwrap.rs         # Token unwrapping
│   │       ├── state/
│   │       │   └── mod.rs                   # Program state structures
│   │       └── error.rs                     # Custom error definitions
│   │
│   └── transfer-hook/                       # Transfer Hook Program
│       ├── Cargo.toml                       # Dependencies and metadata
│       └── src/
│           └── lib.rs                       # Transfer hook implementation
│
├── 🧪 tests/                                # Test Suite
│   ├── amm.ts                               # Original AMM tests
│   └── comprehensive_amm_test.ts            # Complete system test
│
├── 🌐 solana-hook-amm/                      # Frontend Application
│   ├── package.json                         # Frontend dependencies
│   ├── next.config.mjs                      # Next.js configuration
│   ├── tsconfig.json                        # TypeScript configuration
│   │
│   ├── app/                                 # Next.js App Router
│   │   ├── layout.tsx                       # Root layout
│   │   ├── page.tsx                         # Home page
│   │   └── globals.css                      # Global styles
│   │
│   ├── components/                          # React Components
│   │   ├── ui/                              # Base UI components
│   │   ├── create-hooked-token.tsx          # Token-2022 creation UI
│   │   ├── create-pool.tsx                  # AMM pool management UI
│   │   └── wallet-adapter.tsx               # Solana wallet integration
│   │
│   ├── lib/                                 # Frontend Libraries
│   │   ├── amm-client.ts                    # AMM program client
│   │   ├── solana-hooks.ts                  # Transfer hook utilities
│   │   ├── utils.ts                         # General utilities
│   │   └── idl/                             # Program IDL files
│   │       ├── amm.json                     # AMM program IDL
│   │       └── transfer_hook.json           # Transfer hook IDL
│   │
│   └── hooks/                               # React Hooks
│       └── use-wallet.ts                    # Wallet state management
│
├── 🔧 Configuration Files
│   ├── Anchor.toml                          # Anchor workspace config
│   ├── Cargo.toml                           # Rust workspace config
│   ├── package.json                         # Node.js dependencies
│   └── tsconfig.json                        # TypeScript config
│
└── 📊 Generated Files
    ├── target/                              # Compiled Rust programs
    │   ├── deploy/                          # Deployable programs
    │   ├── idl/                             # Generated IDL files
    │   └── types/                           # TypeScript types
    └── test-ledger/                         # Local validator data
```

## 🦀 Smart Contracts

### AMM Program (`programs/amm/`)
**Program ID:** `3D6uyMfYh3s315PgTRJQNsTNYfThWKoCfUaG1we6ZC8c`

**Core Instructions:**
- `initialize`: Create new SOL + Token-2022 pool
- `deposit`: Add liquidity to pool
- `swap`: Exchange tokens with transfer hook support
- `withdraw`: Remove liquidity from pool

**Key Files:**
- `src/lib.rs`: Program entry point and instruction routing
- `src/instructions/initialize.rs`: Pool creation with Token-2022 support
- `src/instructions/deposit.rs`: Liquidity deposits with hook integration
- `src/instructions/swap.rs`: Token swapping with fee collection
- `src/instructions/withdraw.rs`: Liquidity withdrawal
- `src/state/mod.rs`: Pool configuration and state structures
- `src/error.rs`: Custom error definitions

### Transfer Hook Program (`programs/transfer-hook/`)
**Program ID:** `88CNX3Y7TyzjPtD76YhpmnPAsrmhSsYRVS5ad2wKMjuk`

**Purpose:** Collects 0.1% WSOL fee on every token transfer
**Mechanism:** Uses delegate PDA to collect fees from user's WSOL-2022 account

**Key Files:**
- `src/lib.rs`: Complete transfer hook implementation
  - `initialize_extra_account_meta_list`: Register required accounts
  - `transfer_hook`: Execute fee collection logic
  - `fallback`: Route Transfer Hook Execute instructions

## 🌐 Frontend Application

### Location: `solana-hook-amm/`

**Technology Stack:**
- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Shadcn/ui
- **Wallet:** Solana Wallet Adapter
- **State:** React hooks + Context

### Core Components

#### 1. Token Creation (`components/create-hooked-token.tsx`)
**Features:**
- Creates Token-2022 mint with transfer hook extension
- Initializes ExtraAccountMetaList for hook requirements
- Prepares delegate fee system with WSOL-2022
- Shows success alerts with mint address and transaction ID

**Key Functions:**
- `createHookedMintAndMintTo()`: Main token creation logic
- `prepareHookFeeAccounts()`: Setup fee collection system
- Toast notifications for user feedback

#### 2. Pool Management (`components/create-pool.tsx`)
**Features:**
- Creates SOL + Token-2022 liquidity pools
- Auto-detects Token-2022 vs standard SPL tokens
- Handles ExtraAccountMetaList integration
- "Use Latest Created Token" auto-fill functionality
- Deposit, swap, and withdraw operations

**Key Functions:**
- `onInit()`: Initialize new AMM pool
- `onDeposit()`: Add liquidity with hook support
- `onSwap()`: Execute token swaps
- `detectTokenProgram()`: Auto-detect token standard

### Client Libraries

#### AMM Client (`lib/amm-client.ts`)
**Purpose:** Interface with AMM program from frontend

**Key Functions:**
- `initializePool()`: Create new pool
- `depositLiquidity()`: Add liquidity
- `swapTokens()`: Execute swaps
- `withdrawLiquidity()`: Remove liquidity
- `getAmmClient()`: Program connection setup

#### Solana Hooks (`lib/solana-hooks.ts`)
**Purpose:** Transfer hook utilities and token creation

**Key Functions:**
- `createHookedMintAndMintTo()`: Create Token-2022 with hooks
- `prepareHookFeeAccounts()`: Setup fee accounts
- Transaction management and error handling

### IDL Files (`lib/idl/`)
- `amm.json`: AMM program interface definition
- `transfer_hook.json`: Transfer hook program interface

## 🧪 Testing

### Test Files (`tests/`)

#### 1. Original Tests (`amm.ts`)
- Legacy test implementations
- Token-2022 integration testing
- Transfer hook integration

#### 2. Comprehensive Test Suite (`comprehensive_amm_test.ts`)
**Complete end-to-end testing:**
1. ✅ Create Token-2022 with transfer hook
2. ✅ Initialize transfer hook extra account meta list
3. ✅ Setup transfer hook fee system
4. ✅ Initialize AMM pool
5. ✅ Deposit liquidity
6. ✅ Perform token-to-SOL swap
7. ✅ Perform SOL-to-token swap
8. ✅ Withdraw liquidity
9. ✅ Verify transfer hook fee collection

**Test Coverage:**
- Token-2022 creation and configuration
- Transfer hook registration and fee setup
- AMM pool operations with active hooks
- Fee collection verification
- Balance and state validations

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm/pnpm
- **Rust** 1.70+ and Cargo
- **Solana CLI** 1.16+
- **Anchor CLI** 0.29+

### 1. Clone and Setup
```bash
git clone <repository-url>
cd AMM
npm install
anchor build
```

### 2. Start Local Development
```bash
# Terminal 1: Start local validator
solana-test-validator --reset

# Terminal 2: Deploy programs
anchor deploy

# Terminal 3: Start frontend
cd solana-hook-amm
pnpm install
pnpm dev
```

### 3. Access Application
- **Frontend:** http://localhost:3000
- **RPC Endpoint:** http://localhost:8899

## 🎮 Usage Guide

### Creating Token-2022 with Transfer Hook

1. **Navigate** to "Create Hooked Token" tab
2. **Configure** token details:
   - Token name and symbol
   - Initial supply
   - Hook program ID (pre-filled)
3. **Click** "Create Hooked Token"
4. **Receive** success notification with:
   - Token mint address
   - Transaction signature
   - Link to explorer

### Creating AMM Pool

1. **Navigate** to "Create Pool" tab
2. **Input** Token-2022 mint address
   - Or click "Use Latest Created Token"
3. **Configure** pool parameters:
   - Fee rate (default 3%)
   - Initial liquidity amounts
4. **Click** "Initialize SOL + Token-2022 Pool"
5. **Pool created** with automatic WSOL pairing

### Trading Operations

1. **Deposit Liquidity:**
   - Enter SOL and Token amounts
   - Confirm transaction
   - Receive LP tokens

2. **Swap Tokens:**
   - Select swap direction (Token↔SOL)
   - Enter amount and slippage
   - Execute swap with transfer hook fees

3. **Withdraw Liquidity:**
   - Enter LP token amount
   - Receive proportional tokens + SOL

## 🔧 Configuration

### Program IDs
```typescript
// AMM Program
const AMM_PROGRAM_ID = "3D6uyMfYh3s315PgTRJQNsTNYfThWKoCfUaG1we6ZC8c"

// Transfer Hook Program  
const TRANSFER_HOOK_PROGRAM_ID = "88CNX3Y7TyzjPtD76YhpmnPAsrmhSsYRVS5ad2wKMjuk"

// WSOL Token-2022 Mint
const WSOL_MINT = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
```

### Network Settings
```toml
# Anchor.toml
[provider]
cluster = "localnet"
wallet = "~/.config/solana/id.json"

[programs.localnet]
amm = "3D6uyMfYh3s315PgTRJQNsTNYfThWKoCfUaG1we6ZC8c"
transfer_hook = "88CNX3Y7TyzjPtD76YhpmnPAsrmhSsYRVS5ad2wKMjuk"
```

## 🧪 Running Tests

### All Tests
```bash
anchor test
```

### Specific Test Files
```bash
# Original AMM tests
ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-mocha -p ./tsconfig.json -t 300000 tests/amm.ts

# Comprehensive system test
ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-mocha -p ./tsconfig.json -t 300000 tests/comprehensive_amm_test.ts
```

### Test Output Example
```
✅ Token-2022 with transfer hook created
✅ Transfer hook extra account meta list initialized  
✅ Transfer hook fee system configured
✅ AMM pool initialized
✅ Liquidity deposited to pool
✅ Token-to-SOL swap executed
✅ SOL-to-token swap executed
✅ Liquidity withdrawn from pool
✅ Transfer hook fees collected and verified
```

## 🔍 Key Innovations

### 1. Reentrancy Solution
**Problem:** AMM calls Token-2022 transfers → triggers transfer hook → calls back to AMM
**Solution:** Separate transfer hook program prevents circular calls

### 2. Fee Collection Mechanism
**Implementation:** Delegate PDA pattern for secure WSOL fee collection
**Rate:** 0.1% WSOL fee on every token transfer
**Security:** Users maintain control, transparent fee calculation

### 3. Seamless Integration
**Token Detection:** Automatic TOKEN_PROGRAM_ID vs TOKEN_2022_PROGRAM_ID detection
**Account Management:** Proper ExtraAccountMetaList handling
**User Experience:** Auto-fill, error handling, success notifications

## 🔒 Security Features

### Smart Contract Security
- **Reentrancy Protection:** Separate hook program architecture
- **Access Control:** Authority-based pool management
- **Input Validation:** Comprehensive parameter checking
- **Error Handling:** Detailed error messages and recovery

### Frontend Security  
- **Wallet Integration:** Official Solana Wallet Adapter
- **Transaction Simulation:** Pre-execution validation
- **Error Boundaries:** Graceful failure handling
- **Input Sanitization:** XSS prevention and validation

## 📈 Performance Optimizations

### Smart Contracts
- **Efficient PDAs:** Minimal seed computation
- **Optimized Instructions:** Reduced compute unit usage
- **Batch Operations:** Multiple operations per transaction

### Frontend
- **React Optimization:** Memoization and efficient re-renders
- **Parallel Calls:** Simultaneous program interactions
- **Caching:** IDL and account data caching
- **Error Recovery:** Automatic retry mechanisms

## 🌟 Enterprise Features

### Compliance Ready
- **Transfer Hook Fees:** Regulatory/taxation compliance
- **Audit Trail:** All transfers logged on-chain
- **Whitelisting Support:** Foundation for KYC/AML integration
- **Configurable Rules:** Extensible compliance framework

### Scalability
- **Multi-Hook Support:** Architecture supports multiple hook programs
- **Governance Integration:** Framework for decentralized hook approval
- **Protocol Compatibility:** Can integrate with existing AMMs

## 🛠️ Development

### Adding New Features

#### New AMM Instructions
1. Create instruction file in `programs/amm/src/instructions/`
2. Add to `mod.rs` exports
3. Implement in `lib.rs`
4. Add tests in `tests/`
5. Update frontend client

#### New Transfer Hooks
1. Create new hook program in `programs/`
2. Update whitelist in AMM program
3. Add frontend integration
4. Update test suite

### Building and Deployment

#### Local Development
```bash
# Build programs
anchor build

# Deploy to localnet
anchor deploy

# Generate TypeScript types
anchor run generate-types
```

#### Devnet Deployment
```bash
# Configure for devnet
solana config set --url devnet

# Deploy programs
anchor deploy --provider.cluster devnet

# Update frontend config
# Update program IDs in frontend
```

## 📚 Additional Resources

### Documentation
- **Implementation Summary:** `PROJECT_IMPLEMENTATION_SUMMARY.txt`
- **Anchor Documentation:** https://www.anchor-lang.com/
- **Solana Token-2022:** https://spl.solana.com/token-2022
- **Transfer Hooks:** https://spl.solana.com/token-2022/extensions#transfer-hook

### Troubleshooting

#### Common Issues
1. **"AccountOwnedByWrongProgram"**
   - Verify token program IDs (TOKEN_PROGRAM_ID vs TOKEN_2022_PROGRAM_ID)
   - Check mint account ownership

2. **"Cross-program invocation reentrancy"**
   - Ensure separate transfer hook program
   - Verify program IDs in configuration

3. **"Invalid public key input"**
   - Validate mint addresses before use
   - Check for empty input fields

4. **Transaction simulation failed**
   - Verify account initialization
   - Check balance requirements
   - Ensure proper ExtraAccountMetaList setup

### Support
For technical support or questions about implementation, refer to:
- Test files for usage examples
- Implementation summary for architectural decisions
- Code comments for specific functionality

## 🎯 Project Goals Achieved

✅ **Complete AMM Implementation** supporting Token-2022 with Transfer Hooks
✅ **User-Friendly Interface** for token creation and pool management  
✅ **Production-Ready Code** with comprehensive testing
✅ **Security-First Architecture** preventing reentrancy and ensuring fund safety
✅ **Enterprise Compliance** features for regulated token trading
✅ **Extensible Framework** for future DeFi protocol integration

This project successfully demonstrates that Token-2022 with Transfer Hooks can be seamlessly integrated into DeFi protocols while maintaining security, compliance, and user experience standards.