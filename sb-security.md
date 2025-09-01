[
  {
    "name": "security_definer_view",
    "title": "Security Definer View",
    "level": "ERROR",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects views defined with the SECURITY DEFINER property. These views enforce Postgres permissions and row level security policies (RLS) of the view creator, rather than that of the querying user",
    "detail": "View \\`public.review_queue\\` is defined with the SECURITY DEFINER property",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view",
    "metadata": {
      "name": "review_queue",
      "type": "view",
      "schema": "public"
    },
    "cache_key": "security_definer_view_public_review_queue"
  }
]
[
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.normalize_vendor\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "name": "normalize_vendor",
      "type": "function",
      "schema": "public"
    },
    "cache_key": "function_search_path_mutable_public_normalize_vendor_ee267a4bcb8185b896d98af9d0bd48f8"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.bulk_correct_transactions\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "name": "bulk_correct_transactions",
      "type": "function",
      "schema": "public"
    },
    "cache_key": "function_search_path_mutable_public_bulk_correct_transactions_d285d72841a9e8052eedfb23f13d40c3"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.update_normalized_vendors\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "name": "update_normalized_vendors",
      "type": "function",
      "schema": "public"
    },
    "cache_key": "function_search_path_mutable_public_update_normalized_vendors_6aeffbaa1e05fbf43cba31cc47798bae"
  },
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.user_in_org\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "name": "user_in_org",
      "type": "function",
      "schema": "public"
    },
    "cache_key": "function_search_path_mutable_public_user_in_org_4a001ab74e4f99484d6257f1cce2ed3c"
  },
  {
    "name": "auth_otp_long_expiry",
    "title": "Auth OTP long expiry",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "OTP expiry exceeds recommended threshold",
    "detail": "We have detected that you have enabled the email provider with the OTP expiry set to more than an hour. It is recommended to set this value to less than an hour.",
    "cache_key": "auth_otp_long_expiry",
    "remediation": "https://supabase.com/docs/guides/platform/going-into-prod#security",
    "metadata": {
      "type": "auth",
      "entity": "Auth"
    }
  },
  {
    "name": "auth_leaked_password_protection",
    "title": "Leaked Password Protection Disabled",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Leaked password protection is currently disabled.",
    "detail": "Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.",
    "cache_key": "auth_leaked_password_protection",
    "remediation": "https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection",
    "metadata": {
      "type": "auth",
      "entity": "Auth"
    }
  }
]