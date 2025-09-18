import { describe, expect, test } from 'vitest';
import {
  normalizeAccountType,
  balanceToCents,
  transformPlaidAccounts,
} from './account-service.ts';
import type { PlaidAccount } from './account-service.ts';

describe('normalizeAccountType', () => {
  test('maps checking account correctly', () => {
    expect(normalizeAccountType('depository', 'checking')).toBe('checking');
  });

  test('maps savings account correctly', () => {
    expect(normalizeAccountType('depository', 'savings')).toBe('savings');
  });

  test('maps credit card correctly', () => {
    expect(normalizeAccountType('credit', 'credit card')).toBe('credit_card');
  });

  test('maps money market to savings', () => {
    expect(normalizeAccountType('depository', 'money market')).toBe('savings');
  });

  test('maps investment accounts correctly', () => {
    expect(normalizeAccountType('investment', 'ira')).toBe('investment');
    expect(normalizeAccountType('investment', '401k')).toBe('investment');
  });

  test('falls back to other for unknown types', () => {
    expect(normalizeAccountType('unknown', 'mysterious')).toBe('other');
  });
});

describe('balanceToCents', () => {
  test('converts dollars to cents correctly', () => {
    expect(balanceToCents(123.45)).toBe('12345');
  });

  test('handles whole dollar amounts', () => {
    expect(balanceToCents(100)).toBe('10000');
  });

  test('handles fractional cents by rounding', () => {
    expect(balanceToCents(123.456)).toBe('12346');
    expect(balanceToCents(123.454)).toBe('12345');
  });

  test('handles null balance', () => {
    expect(balanceToCents(null)).toBe('0');
  });

  test('handles undefined balance', () => {
    expect(balanceToCents(undefined as any)).toBe('0');
  });

  test('handles zero balance', () => {
    expect(balanceToCents(0)).toBe('0');
  });

  test('handles negative balance', () => {
    expect(balanceToCents(-50.25)).toBe('-5025');
  });
});

describe('transformPlaidAccounts', () => {
  const mockPlaidAccounts: PlaidAccount[] = [
    {
      account_id: 'plaid-account-1',
      name: 'Chase Checking',
      type: 'depository',
      subtype: 'checking',
      balances: {
        available: 1500.00,
        current: 1750.25,
        iso_currency_code: 'USD',
      },
    },
    {
      account_id: 'plaid-account-2',
      name: 'Savings Account',
      type: 'depository',
      subtype: 'savings',
      balances: {
        available: 5000.00,
        current: 5250.75,
        iso_currency_code: 'USD',
      },
    },
    {
      account_id: 'plaid-account-3',
      name: 'Credit Card',
      type: 'credit',
      subtype: 'credit card',
      balances: {
        available: null,
        current: -1200.50,
        iso_currency_code: 'USD',
      },
    },
  ];

  test('transforms Plaid accounts to normalized format', () => {
    const result = transformPlaidAccounts(
      mockPlaidAccounts,
      'org-123',
      'conn-456'
    );

    expect(result).toHaveLength(3);
    
    // Check first account
    expect(result[0]).toEqual({
      org_id: 'org-123',
      connection_id: 'conn-456',
      provider_account_id: 'plaid-account-1',
      name: 'Chase Checking',
      type: 'checking',
      currency: 'USD',
      is_active: true,
      current_balance_cents: '175025', // $1750.25 in cents
    });

    // Check second account
    expect(result[1]).toEqual({
      org_id: 'org-123',
      connection_id: 'conn-456',
      provider_account_id: 'plaid-account-2',
      name: 'Savings Account',
      type: 'savings',
      currency: 'USD',
      is_active: true,
      current_balance_cents: '525075', // $5250.75 in cents
    });

    // Check third account (credit card with negative balance)
    expect(result[2]).toEqual({
      org_id: 'org-123',
      connection_id: 'conn-456',
      provider_account_id: 'plaid-account-3',
      name: 'Credit Card',
      type: 'credit_card',
      currency: 'USD',
      is_active: true,
      current_balance_cents: '-120050', // -$1200.50 in cents
    });
  });

  test('handles missing currency code', () => {
    const accountWithNoCurrency: PlaidAccount = {
      account_id: 'test-account',
      name: 'Test Account',
      type: 'depository',
      subtype: 'checking',
      balances: {
        available: 100.00,
        current: 150.00,
        iso_currency_code: '',
      },
    };

    const result = transformPlaidAccounts(
      [accountWithNoCurrency],
      'org-123',
      'conn-456'
    );

    expect(result[0].currency).toBe('USD'); // Should default to USD
  });

  test('handles null balance', () => {
    const accountWithNullBalance: PlaidAccount = {
      account_id: 'test-account',
      name: 'Test Account',
      type: 'depository',
      subtype: 'checking',
      balances: {
        available: 100.00,
        current: null,
        iso_currency_code: 'USD',
      },
    };

    const result = transformPlaidAccounts(
      [accountWithNullBalance],
      'org-123',
      'conn-456'
    );

    expect(result[0].current_balance_cents).toBe('0');
  });

  test('handles empty accounts array', () => {
    const result = transformPlaidAccounts([], 'org-123', 'conn-456');
    expect(result).toHaveLength(0);
  });
});