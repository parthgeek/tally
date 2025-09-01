-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  connection_id uuid,
  provider_account_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  currency text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id),
  CONSTRAINT accounts_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  name text NOT NULL,
  parent_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id),
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id)
);
CREATE TABLE public.connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  provider text NOT NULL,
  status text NOT NULL,
  scopes ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT connections_pkey PRIMARY KEY (id),
  CONSTRAINT connections_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id)
);
CREATE TABLE public.corrections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  tx_id uuid NOT NULL,
  old_category_id uuid,
  new_category_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT corrections_pkey PRIMARY KEY (id),
  CONSTRAINT corrections_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id),
  CONSTRAINT corrections_tx_id_fkey FOREIGN KEY (tx_id) REFERENCES public.transactions(id),
  CONSTRAINT corrections_old_category_id_fkey FOREIGN KEY (old_category_id) REFERENCES public.categories(id),
  CONSTRAINT corrections_new_category_id_fkey FOREIGN KEY (new_category_id) REFERENCES public.categories(id),
  CONSTRAINT corrections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  tx_id uuid NOT NULL,
  category_id uuid,
  confidence numeric,
  source text NOT NULL CHECK (source = ANY (ARRAY['pass1'::text, 'llm'::text, 'manual'::text])),
  rationale ARRAY,
  llm_trace_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT decisions_pkey PRIMARY KEY (id),
  CONSTRAINT decisions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id),
  CONSTRAINT decisions_tx_id_fkey FOREIGN KEY (tx_id) REFERENCES public.transactions(id),
  CONSTRAINT decisions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.exports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  type text CHECK (type = ANY (ARRAY['csv'::text, 'qbo'::text, 'xero'::text])),
  params jsonb,
  status text NOT NULL,
  url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exports_pkey PRIMARY KEY (id),
  CONSTRAINT exports_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id)
);
CREATE TABLE public.orgs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  timezone text,
  owner_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orgs_pkey PRIMARY KEY (id),
  CONSTRAINT orgs_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  storage_path text NOT NULL,
  ocr_text text,
  vendor text,
  total_cents bigint,
  created_at timestamp with time zone DEFAULT now(),
  uploaded_by uuid,
  original_filename text,
  file_type text,
  file_size integer,
  processing_status text DEFAULT 'pending'::text CHECK (processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  ocr_data jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT receipts_pkey PRIMARY KEY (id),
  CONSTRAINT receipts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id),
  CONSTRAINT receipts_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);
CREATE TABLE public.rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  pattern jsonb NOT NULL,
  category_id uuid,
  weight numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rules_pkey PRIMARY KEY (id),
  CONSTRAINT rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id),
  CONSTRAINT rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.transaction_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  attached_by uuid NOT NULL,
  attached_at timestamp with time zone NOT NULL DEFAULT now(),
  org_id uuid NOT NULL,
  CONSTRAINT transaction_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_receipts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT transaction_receipts_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id),
  CONSTRAINT transaction_receipts_attached_by_fkey FOREIGN KEY (attached_by) REFERENCES auth.users(id),
  CONSTRAINT transaction_receipts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  account_id uuid,
  date date NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL,
  description text NOT NULL,
  merchant_name text,
  mcc text,
  raw jsonb NOT NULL,
  category_id uuid,
  confidence numeric,
  source text CHECK (source = ANY (ARRAY['plaid'::text, 'square'::text, 'manual'::text])),
  receipt_id uuid,
  reviewed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  needs_review boolean DEFAULT false,
  normalized_vendor text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT transactions_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id)
);
CREATE TABLE public.user_org_roles (
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  role text CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_org_roles_pkey PRIMARY KEY (user_id, org_id),
  CONSTRAINT user_org_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_org_roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text,
  name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);