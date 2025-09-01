[
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.users\\` has a row level security policy \\`users_select_own\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "users",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_users_users_select_own"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.users\\` has a row level security policy \\`users_update_own\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "users",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_users_users_update_own"
  },
  {
    "name": "duplicate_index",
    "title": "Duplicate Index",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects cases where two ore more identical indexes exist.",
    "detail": "Table \\`public.receipts\\` has identical indexes {idx_receipts_org_id,receipts_org_id_idx}. Drop all except one of them",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index",
    "metadata": {
      "name": "receipts",
      "type": "table",
      "schema": "public",
      "indexes": [
        "idx_receipts_org_id",
        "receipts_org_id_idx"
      ]
    },
    "cache_key": "duplicate_index_public_receipts_{idx_receipts_org_id,receipts_org_id_idx}"
  }
]
[
  {
    "name": "unindexed_foreign_keys",
    "title": "Unindexed foreign keys",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Identifies foreign key constraints without a covering index, which can impact database performance.",
    "detail": "Table \\`public.corrections\\` has a foreign key \\`corrections_new_category_id_fkey\\` without a covering index. This can lead to suboptimal query performance.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys",
    "metadata": {
      "name": "corrections",
      "type": "table",
      "schema": "public",
      "fkey_name": "corrections_new_category_id_fkey",
      "fkey_columns": [
        5
      ]
    },
    "cache_key": "unindexed_foreign_keys_public_corrections_corrections_new_category_id_fkey"
  },
  {
    "name": "unindexed_foreign_keys",
    "title": "Unindexed foreign keys",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Identifies foreign key constraints without a covering index, which can impact database performance.",
    "detail": "Table \\`public.corrections\\` has a foreign key \\`corrections_old_category_id_fkey\\` without a covering index. This can lead to suboptimal query performance.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys",
    "metadata": {
      "name": "corrections",
      "type": "table",
      "schema": "public",
      "fkey_name": "corrections_old_category_id_fkey",
      "fkey_columns": [
        4
      ]
    },
    "cache_key": "unindexed_foreign_keys_public_corrections_corrections_old_category_id_fkey"
  },
  {
    "name": "unindexed_foreign_keys",
    "title": "Unindexed foreign keys",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Identifies foreign key constraints without a covering index, which can impact database performance.",
    "detail": "Table \\`public.corrections\\` has a foreign key \\`corrections_user_id_fkey\\` without a covering index. This can lead to suboptimal query performance.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys",
    "metadata": {
      "name": "corrections",
      "type": "table",
      "schema": "public",
      "fkey_name": "corrections_user_id_fkey",
      "fkey_columns": [
        6
      ]
    },
    "cache_key": "unindexed_foreign_keys_public_corrections_corrections_user_id_fkey"
  },
  {
    "name": "unindexed_foreign_keys",
    "title": "Unindexed foreign keys",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Identifies foreign key constraints without a covering index, which can impact database performance.",
    "detail": "Table \\`public.decisions\\` has a foreign key \\`decisions_category_id_fkey\\` without a covering index. This can lead to suboptimal query performance.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys",
    "metadata": {
      "name": "decisions",
      "type": "table",
      "schema": "public",
      "fkey_name": "decisions_category_id_fkey",
      "fkey_columns": [
        4
      ]
    },
    "cache_key": "unindexed_foreign_keys_public_decisions_decisions_category_id_fkey"
  },
  {
    "name": "unindexed_foreign_keys",
    "title": "Unindexed foreign keys",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Identifies foreign key constraints without a covering index, which can impact database performance.",
    "detail": "Table \\`public.rules\\` has a foreign key \\`rules_category_id_fkey\\` without a covering index. This can lead to suboptimal query performance.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys",
    "metadata": {
      "name": "rules",
      "type": "table",
      "schema": "public",
      "fkey_name": "rules_category_id_fkey",
      "fkey_columns": [
        4
      ]
    },
    "cache_key": "unindexed_foreign_keys_public_rules_rules_category_id_fkey"
  },
  {
    "name": "unindexed_foreign_keys",
    "title": "Unindexed foreign keys",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Identifies foreign key constraints without a covering index, which can impact database performance.",
    "detail": "Table \\`public.transaction_receipts\\` has a foreign key \\`transaction_receipts_org_id_fkey\\` without a covering index. This can lead to suboptimal query performance.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys",
    "metadata": {
      "name": "transaction_receipts",
      "type": "table",
      "schema": "public",
      "fkey_name": "transaction_receipts_org_id_fkey",
      "fkey_columns": [
        6
      ]
    },
    "cache_key": "unindexed_foreign_keys_public_transaction_receipts_transaction_receipts_org_id_fkey"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_orgs_owner_user_id\\` on table \\`public.orgs\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "orgs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_orgs_idx_orgs_owner_user_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_user_org_roles_org_id\\` on table \\`public.user_org_roles\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "user_org_roles",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_user_org_roles_idx_user_org_roles_org_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_accounts_org_id\\` on table \\`public.accounts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "accounts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_accounts_idx_accounts_org_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_accounts_connection_id\\` on table \\`public.accounts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "accounts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_accounts_idx_accounts_connection_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_categories_org_id\\` on table \\`public.categories\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "categories",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_categories_idx_categories_org_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_categories_parent_id\\` on table \\`public.categories\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "categories",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_categories_idx_categories_parent_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_rules_org_id\\` on table \\`public.rules\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "rules",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_rules_idx_rules_org_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_receipts_org_id\\` on table \\`public.receipts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "receipts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_receipts_idx_receipts_org_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_transactions_account_id\\` on table \\`public.transactions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "transactions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_transactions_idx_transactions_account_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_transactions_org_date\\` on table \\`public.transactions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "transactions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_transactions_idx_transactions_org_date"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_transactions_category_id\\` on table \\`public.transactions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "transactions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_transactions_idx_transactions_category_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_transactions_receipt_id\\` on table \\`public.transactions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "transactions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_transactions_idx_transactions_receipt_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`idx_exports_org_id\\` on table \\`public.exports\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "exports",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_exports_idx_exports_org_id"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`categories_id_name_idx\\` on table \\`public.categories\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "categories",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_categories_categories_id_name_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`decisions_tx_latest_idx\\` on table \\`public.decisions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "decisions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_decisions_decisions_tx_latest_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`corrections_org_user_idx\\` on table \\`public.corrections\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "corrections",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_corrections_corrections_org_user_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`transactions_normalized_vendor_idx\\` on table \\`public.transactions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "transactions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_transactions_transactions_normalized_vendor_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`decisions_org_id_idx\\` on table \\`public.decisions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "decisions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_decisions_decisions_org_id_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`decisions_tx_id_idx\\` on table \\`public.decisions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "decisions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_decisions_decisions_tx_id_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`decisions_created_at_idx\\` on table \\`public.decisions\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "decisions",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_decisions_decisions_created_at_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`corrections_tx_id_idx\\` on table \\`public.corrections\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "corrections",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_corrections_corrections_tx_id_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`corrections_created_at_idx\\` on table \\`public.corrections\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "corrections",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_corrections_corrections_created_at_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`receipts_org_id_idx\\` on table \\`public.receipts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "receipts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_receipts_receipts_org_id_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`receipts_uploaded_by_idx\\` on table \\`public.receipts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "receipts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_receipts_receipts_uploaded_by_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`receipts_created_at_idx\\` on table \\`public.receipts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "receipts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_receipts_receipts_created_at_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`receipts_processing_status_idx\\` on table \\`public.receipts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "receipts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_receipts_receipts_processing_status_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`transaction_receipts_tx_idx\\` on table \\`public.transaction_receipts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "transaction_receipts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_transaction_receipts_transaction_receipts_tx_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`transaction_receipts_receipt_idx\\` on table \\`public.transaction_receipts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "transaction_receipts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_transaction_receipts_transaction_receipts_receipt_idx"
  },
  {
    "name": "unused_index",
    "title": "Unused Index",
    "level": "INFO",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if an index has never been used and may be a candidate for removal.",
    "detail": "Index \\`transaction_receipts_attached_by_idx\\` on table \\`public.transaction_receipts\\` has not been used",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index",
    "metadata": {
      "name": "transaction_receipts",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "unused_index_public_transaction_receipts_transaction_receipts_attached_by_idx"
  }
]