-- Migration 043: Add mask field to accounts table
-- Stores the last 4 digits of account number from Plaid for display purposes

alter table accounts add column if not exists mask text;

-- Add index for faster queries that include mask
create index if not exists idx_accounts_mask on accounts(mask) where mask is not null;

-- Comment for clarity
comment on column accounts.mask is 'Last 4 digits of account number from provider (e.g., Plaid), used for display';

