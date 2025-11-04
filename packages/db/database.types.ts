/**
 * Generated Supabase Database Types
 * Based on migrations 001-040
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      orgs: {
        Row: {
          id: string
          name: string
          industry: string | null
          timezone: string | null
          owner_user_id: string | null
          created_at: string
          slug: string | null
          logo_url: string | null
          default_timezone: string | null
          region: string | null
          updated_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          billing_email: string | null
          plan: string | null
          billing_status: string | null
          current_period_end: string | null
        }
        Insert: {
          id?: string
          name: string
          industry?: string | null
          timezone?: string | null
          owner_user_id?: string | null
          created_at?: string
          slug?: string | null
          logo_url?: string | null
          default_timezone?: string | null
          region?: string | null
          updated_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          billing_email?: string | null
          plan?: string | null
          billing_status?: string | null
          current_period_end?: string | null
        }
        Update: {
          id?: string
          name?: string
          industry?: string | null
          timezone?: string | null
          owner_user_id?: string | null
          created_at?: string
          slug?: string | null
          logo_url?: string | null
          default_timezone?: string | null
          region?: string | null
          updated_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          billing_email?: string | null
          plan?: string | null
          billing_status?: string | null
          current_period_end?: string | null
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          org_id: string
          connection_id: string
          provider_account_id: string
          name: string
          type: string
          currency: string
          is_active: boolean
          created_at: string
          current_balance_cents: string | null
          mask: string | null
        }
        Insert: {
          id?: string
          org_id: string
          connection_id: string
          provider_account_id: string
          name: string
          type: string
          currency: string
          is_active?: boolean
          created_at?: string
          current_balance_cents?: string | null
          mask?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          connection_id?: string
          provider_account_id?: string
          name?: string
          type?: string
          currency?: string
          is_active?: boolean
          created_at?: string
          current_balance_cents?: string | null
          mask?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          org_id: string | null
          name: string
          parent_id: string | null
          created_at: string
          slug: string | null
          industries: string[] | null
          is_universal: boolean | null
          tier: number | null
          type: 'revenue' | 'cogs' | 'opex' | 'liability' | 'clearing' | 'asset' | 'equity' | null
          attribute_schema: Json | null
          display_order: number | null
          is_pnl: boolean | null
          is_active: boolean | null
        }
        Insert: {
          id?: string
          org_id?: string | null
          name: string
          parent_id?: string | null
          created_at?: string
          slug?: string | null
          industries?: string[] | null
          is_universal?: boolean | null
          tier?: number | null
          type?: 'revenue' | 'cogs' | 'opex' | 'liability' | 'clearing' | 'asset' | 'equity' | null
          attribute_schema?: Json | null
          display_order?: number | null
          is_pnl?: boolean | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          org_id?: string | null
          name?: string
          parent_id?: string | null
          created_at?: string
          slug?: string | null
          industries?: string[] | null
          is_universal?: boolean | null
          tier?: number | null
          type?: 'revenue' | 'cogs' | 'opex' | 'liability' | 'clearing' | 'asset' | 'equity' | null
          attribute_schema?: Json | null
          display_order?: number | null
          is_pnl?: boolean | null
          is_active?: boolean | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          org_id: string
          account_id: string | null
          date: string
          amount_cents: string
          currency: string
          description: string
          merchant_name: string | null
          mcc: string | null
          raw: Json
          category_id: string | null
          confidence: number | null
          source: 'plaid' | 'square' | 'manual' | 'bench' | null
          receipt_id: string | null
          reviewed: boolean
          created_at: string
          needs_review: boolean | null
          attributes: Json | null
        }
        Insert: {
          id?: string
          org_id: string
          account_id?: string | null
          date: string
          amount_cents: string
          currency: string
          description: string
          merchant_name?: string | null
          mcc?: string | null
          raw: Json
          category_id?: string | null
          confidence?: number | null
          source?: 'plaid' | 'square' | 'manual' | 'bench' | null
          receipt_id?: string | null
          reviewed?: boolean
          created_at?: string
          needs_review?: boolean | null
          attributes?: Json | null
        }
        Update: {
          id?: string
          org_id?: string
          account_id?: string | null
          date?: string
          amount_cents?: string
          currency?: string
          description?: string
          merchant_name?: string | null
          mcc?: string | null
          raw?: Json
          category_id?: string | null
          confidence?: number | null
          source?: 'plaid' | 'square' | 'manual' | 'bench' | null
          receipt_id?: string | null
          reviewed?: boolean
          created_at?: string
          needs_review?: boolean | null
          attributes?: Json | null
        }
        Relationships: []
      }
      corrections: {
        Row: {
          id: string
          org_id: string
          tx_id: string
          old_category_id: string | null
          new_category_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          tx_id: string
          old_category_id?: string | null
          new_category_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          tx_id?: string
          old_category_id?: string | null
          new_category_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      vendor_embeddings: {
        Row: {
          org_id: string
          vendor: string
          embedding: number[]
          last_refreshed: string
          category_id: string | null
          confidence: number | null
          transaction_count: number | null
        }
        Insert: {
          org_id: string
          vendor: string
          embedding: number[]
          last_refreshed?: string
          category_id?: string | null
          confidence?: number | null
          transaction_count?: number | null
        }
        Update: {
          org_id?: string
          vendor?: string
          embedding?: number[]
          last_refreshed?: string
          category_id?: string | null
          confidence?: number | null
          transaction_count?: number | null
        }
        Relationships: []
      }
      embedding_matches: {
        Row: {
          id: string
          org_id: string
          tx_id: string
          matched_vendor: string
          similarity_score: number
          contributed_to_decision: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          tx_id: string
          matched_vendor: string
          similarity_score: number
          contributed_to_decision: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          tx_id?: string
          matched_vendor?: string
          similarity_score?: number
          contributed_to_decision?: boolean
          created_at?: string
        }
        Relationships: []
      }
      embedding_stability_snapshots: {
        Row: {
          id: string
          org_id: string
          snapshot_date: string
          vendor: string
          category_id: string
          sample_matches: Json
          avg_similarity: number
          match_count: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          snapshot_date: string
          vendor: string
          category_id: string
          sample_matches: Json
          avg_similarity: number
          match_count: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          snapshot_date?: string
          vendor?: string
          category_id?: string
          sample_matches?: Json
          avg_similarity?: number
          match_count?: number
          created_at?: string
        }
        Relationships: []
      }
      rule_versions: {
        Row: {
          id: string
          org_id: string
          version: number
          rule_type: 'mcc' | 'vendor' | 'keyword' | 'embedding'
          rule_identifier: string
          category_id: string
          confidence: number
          is_active: boolean
          source: 'system' | 'learned' | 'manual'
          parent_version_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          version: number
          rule_type: 'mcc' | 'vendor' | 'keyword' | 'embedding'
          rule_identifier: string
          category_id: string
          confidence: number
          is_active?: boolean
          source: 'system' | 'learned' | 'manual'
          parent_version_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          version?: number
          rule_type?: 'mcc' | 'vendor' | 'keyword' | 'embedding'
          rule_identifier?: string
          category_id?: string
          confidence?: number
          is_active?: boolean
          source?: 'system' | 'learned' | 'manual'
          parent_version_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      rule_effectiveness: {
        Row: {
          id: string
          org_id: string
          rule_version_id: string
          measurement_date: string
          applications_count: number
          correct_count: number
          incorrect_count: number
          avg_confidence: number
          precision: number | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          rule_version_id: string
          measurement_date: string
          applications_count: number
          correct_count: number
          incorrect_count: number
          avg_confidence: number
          precision?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          rule_version_id?: string
          measurement_date?: string
          applications_count?: number
          correct_count?: number
          incorrect_count?: number
          avg_confidence?: number
          precision?: number | null
          created_at?: string
        }
        Relationships: []
      }
      category_oscillations: {
        Row: {
          id: string
          org_id: string
          tx_id: string
          oscillation_sequence: Json
          oscillation_count: number
          is_resolved: boolean
          resolution_category_id: string | null
          resolved_by: string | null
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          tx_id: string
          oscillation_sequence: Json
          oscillation_count: number
          is_resolved?: boolean
          resolution_category_id?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          tx_id?: string
          oscillation_sequence?: Json
          oscillation_count?: number
          is_resolved?: boolean
          resolution_category_id?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      canary_test_results: {
        Row: {
          id: string
          org_id: string
          rule_version_id: string
          test_date: string
          test_set_size: number
          correct_count: number
          incorrect_count: number
          accuracy: number
          precision: number | null
          recall: number | null
          f1_score: number | null
          passed_threshold: boolean
          test_metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          rule_version_id: string
          test_date: string
          test_set_size: number
          correct_count: number
          incorrect_count: number
          accuracy: number
          precision?: number | null
          recall?: number | null
          f1_score?: number | null
          passed_threshold: boolean
          test_metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          rule_version_id?: string
          test_date?: string
          test_set_size?: number
          correct_count?: number
          incorrect_count?: number
          accuracy?: number
          precision?: number | null
          recall?: number | null
          f1_score?: number | null
          passed_threshold?: boolean
          test_metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string | null
          name: string | null
          created_at: string
          username: string | null
          avatar_url: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          name?: string | null
          created_at?: string
          username?: string | null
          avatar_url?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          name?: string | null
          created_at?: string
          username?: string | null
          avatar_url?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          user_id: string
          theme: string | null
          locale: string | null
          date_format: string | null
          number_format: string | null
          reduced_motion: boolean | null
          high_contrast: boolean | null
          timezone: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          user_id: string
          theme?: string | null
          locale?: string | null
          date_format?: string | null
          number_format?: string | null
          reduced_motion?: boolean | null
          high_contrast?: boolean | null
          timezone?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          theme?: string | null
          locale?: string | null
          date_format?: string | null
          number_format?: string | null
          reduced_motion?: boolean | null
          high_contrast?: boolean | null
          timezone?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      billing_invoices: {
        Row: {
          id: string
          org_id: string
          stripe_invoice_id: string
          hosted_invoice_url: string | null
          invoice_pdf: string | null
          amount_cents: string
          currency: string | null
          status: string
          invoice_date: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          stripe_invoice_id: string
          hosted_invoice_url?: string | null
          invoice_pdf?: string | null
          amount_cents: string
          currency?: string | null
          status: string
          invoice_date: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          stripe_invoice_id?: string
          hosted_invoice_url?: string | null
          invoice_pdf?: string | null
          amount_cents?: string
          currency?: string | null
          status?: string
          invoice_date?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_attribute_coverage: {
        Args: {
          p_org_id: string
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          category_name: string
          category_slug: string
          total_transactions: number
          transactions_with_attributes: number
          coverage_percentage: number
          avg_attributes_per_transaction: number
        }[]
      }
      get_attribute_distribution: {
        Args: {
          p_org_id: string
          p_category_slug?: string
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          attribute_key: string
          attribute_value: string
          transaction_count: number
          percentage: number
        }[]
      }
      run_canary_test: {
        Args: {
          p_org_id: string
          p_rule_version_id: string
          p_test_set_size?: number
          p_accuracy_threshold?: number
        }
        Returns: Json
      }
      track_rule_effectiveness: {
        Args: {
          p_org_id: string
          p_measurement_date?: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

