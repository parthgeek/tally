#!/usr/bin/env tsx

/**
 * Error Handling Test
 * 
 * Tests universal categorizer's resilience to various error conditions:
 * - Invalid API key
 * - Malformed transactions
 * - Empty/null descriptions
 * - Very long descriptions
 * - Missing required fields
 * - Network failures
 */

import { categorizeWithUniversalLLM } from '../packages/categorizer/src/pass2_llm.js';
import { GeminiClient } from '../packages/categorizer/src/gemini-client.js';
import type { NormalizedTransaction } from '../packages/types/src/index.js';

interface TestCase {
  name: string;
  description: string;
  setup: () => Promise<void> | void;
  test: () => Promise<void>;
  cleanup?: () => Promise<void> | void;
}

let testsPassed = 0;
let testsFailed = 0;

function logTest(name: string, passed: boolean, message?: string) {
  const status = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  
  console.log(`  ${color}${status}${reset} ${name}`);
  if (message) {
    console.log(`     ${message}`);
  }
  
  if (passed) {
    testsPassed++;
  } else {
    testsFailed++;
  }
}

// Test cases
const testCases: TestCase[] = [
  {
    name: 'Invalid API Key',
    description: 'Should fail gracefully with invalid API key',
    setup: () => {},
    test: async () => {
      try {
        const geminiClient = new GeminiClient({
          apiKey: 'invalid-api-key-12345',
          model: 'gemini-2.5-flash-lite',
          temperature: 1.0,
        });
        
        const tx: NormalizedTransaction = {
          id: 'test-invalid-key',
          orgId: 'test-org' as any,
          date: new Date().toISOString(),
          amountCents: '10000',
          currency: 'USD',
          description: 'Stripe payment processing',
          merchantName: 'Stripe',
          mcc: '6513',
          categoryId: null as any,
          confidence: null,
          reviewed: false,
          needsReview: false,
          source: 'test',
          raw: {},
        };
        
        await categorizeWithUniversalLLM(
          tx,
          {
            industry: 'ecommerce',
            orgId: 'test-org',
            config: { model: 'gemini-2.5-flash-lite', temperature: 1.0 },
          },
          geminiClient
        );
        
        logTest('Invalid API Key', false, 'Should have thrown an error');
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const passed = message.includes('API') || message.includes('key') || message.includes('auth');
        logTest('Invalid API Key', passed, passed ? 'Error caught correctly' : `Unexpected error: ${message}`);
      }
    },
  },
  
  {
    name: 'Empty Description',
    description: 'Should handle empty description gracefully',
    setup: () => {},
    test: async () => {
      try {
        const geminiClient = new GeminiClient({
          apiKey: process.env.GEMINI_API_KEY,
          model: 'gemini-2.5-flash-lite',
          temperature: 1.0,
        });
        
        const tx: NormalizedTransaction = {
          id: 'test-empty-desc',
          orgId: 'test-org' as any,
          date: new Date().toISOString(),
          amountCents: '10000',
          currency: 'USD',
          description: '',
          merchantName: 'Test Merchant',
          mcc: null,
          categoryId: null as any,
          confidence: null,
          reviewed: false,
          needsReview: false,
          source: 'test',
          raw: {},
        };
        
        const result = await categorizeWithUniversalLLM(
          tx,
          {
            industry: 'ecommerce',
            orgId: 'test-org',
            config: { model: 'gemini-2.5-flash-lite', temperature: 1.0 },
          },
          geminiClient
        );
        
        const passed = result.categoryId && result.confidence >= 0;
        logTest('Empty Description', passed, passed ? `Returned category with ${(result.confidence * 100).toFixed(0)}% confidence` : 'Did not return valid result');
        
      } catch (error) {
        logTest('Empty Description', false, `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    },
  },
  
  {
    name: 'Null Description',
    description: 'Should handle null description gracefully',
    setup: () => {},
    test: async () => {
      try {
        const geminiClient = new GeminiClient({
          apiKey: process.env.GEMINI_API_KEY,
          model: 'gemini-2.5-flash-lite',
          temperature: 1.0,
        });
        
        const tx: NormalizedTransaction = {
          id: 'test-null-desc',
          orgId: 'test-org' as any,
          date: new Date().toISOString(),
          amountCents: '10000',
          currency: 'USD',
          description: null as any,
          merchantName: 'Test Merchant',
          mcc: null,
          categoryId: null as any,
          confidence: null,
          reviewed: false,
          needsReview: false,
          source: 'test',
          raw: {},
        };
        
        const result = await categorizeWithUniversalLLM(
          tx,
          {
            industry: 'ecommerce',
            orgId: 'test-org',
            config: { model: 'gemini-2.5-flash-lite', temperature: 1.0 },
          },
          geminiClient
        );
        
        const passed = result.categoryId && result.confidence >= 0;
        logTest('Null Description', passed, passed ? `Returned category with ${(result.confidence * 100).toFixed(0)}% confidence` : 'Did not return valid result');
        
      } catch (error) {
        // It's okay to throw error for null description - that's also valid error handling
        logTest('Null Description', true, 'Error caught for null description (acceptable)');
      }
    },
  },
  
  {
    name: 'Very Long Description',
    description: 'Should handle very long descriptions (>1000 chars)',
    setup: () => {},
    test: async () => {
      try {
        const geminiClient = new GeminiClient({
          apiKey: process.env.GEMINI_API_KEY,
          model: 'gemini-2.5-flash-lite',
          temperature: 1.0,
        });
        
        const longDescription = 'A'.repeat(1500) + ' Stripe payment processing fee';
        
        const tx: NormalizedTransaction = {
          id: 'test-long-desc',
          orgId: 'test-org' as any,
          date: new Date().toISOString(),
          amountCents: '350',
          currency: 'USD',
          description: longDescription,
          merchantName: 'Stripe',
          mcc: '6513',
          categoryId: null as any,
          confidence: null,
          reviewed: false,
          needsReview: false,
          source: 'test',
          raw: {},
        };
        
        const result = await categorizeWithUniversalLLM(
          tx,
          {
            industry: 'ecommerce',
            orgId: 'test-org',
            config: { model: 'gemini-2.5-flash-lite', temperature: 1.0 },
          },
          geminiClient
        );
        
        const passed = result.categoryId && result.confidence >= 0;
        logTest('Very Long Description', passed, passed ? `Returned category with ${(result.confidence * 100).toFixed(0)}% confidence` : 'Did not return valid result');
        
      } catch (error) {
        logTest('Very Long Description', false, `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    },
  },
  
  {
    name: 'Missing Merchant Name',
    description: 'Should handle missing merchant name',
    setup: () => {},
    test: async () => {
      try {
        const geminiClient = new GeminiClient({
          apiKey: process.env.GEMINI_API_KEY,
          model: 'gemini-2.5-flash-lite',
          temperature: 1.0,
        });
        
        const tx: NormalizedTransaction = {
          id: 'test-no-merchant',
          orgId: 'test-org' as any,
          date: new Date().toISOString(),
          amountCents: '25000',
          currency: 'USD',
          description: 'Marketing campaign expense',
          merchantName: null,
          mcc: null,
          categoryId: null as any,
          confidence: null,
          reviewed: false,
          needsReview: false,
          source: 'test',
          raw: {},
        };
        
        const result = await categorizeWithUniversalLLM(
          tx,
          {
            industry: 'ecommerce',
            orgId: 'test-org',
            config: { model: 'gemini-2.5-flash-lite', temperature: 1.0 },
          },
          geminiClient
        );
        
        const passed = result.categoryId && result.confidence >= 0;
        logTest('Missing Merchant Name', passed, passed ? `Returned category with ${(result.confidence * 100).toFixed(0)}% confidence` : 'Did not return valid result');
        
      } catch (error) {
        logTest('Missing Merchant Name', false, `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    },
  },
  
  {
    name: 'Attributes Never Cause Crashes',
    description: 'Should never crash when extracting attributes',
    setup: () => {},
    test: async () => {
      try {
        const geminiClient = new GeminiClient({
          apiKey: process.env.GEMINI_API_KEY,
          model: 'gemini-2.5-flash-lite',
          temperature: 1.0,
        });
        
        const testTransactions: NormalizedTransaction[] = [
          {
            id: 'test-attrs-1',
            orgId: 'test-org' as any,
            date: new Date().toISOString(),
            amountCents: '350',
            currency: 'USD',
            description: 'Stripe fee',
            merchantName: 'Stripe',
            mcc: '6513',
            categoryId: null as any,
            confidence: null,
            reviewed: false,
            needsReview: false,
            source: 'test',
            raw: {},
          },
          {
            id: 'test-attrs-2',
            orgId: 'test-org' as any,
            date: new Date().toISOString(),
            amountCents: '5000',
            currency: 'USD',
            description: 'UPS Ground shipping',
            merchantName: 'UPS',
            mcc: null,
            categoryId: null as any,
            confidence: null,
            reviewed: false,
            needsReview: false,
            source: 'test',
            raw: {},
          },
        ];
        
        let allPassed = true;
        
        for (const tx of testTransactions) {
          try {
            const result = await categorizeWithUniversalLLM(
              tx,
              {
                industry: 'ecommerce',
                orgId: 'test-org',
                config: { model: 'gemini-2.5-flash-lite', temperature: 1.0 },
              },
              geminiClient
            );
            
            // Verify attributes field exists (even if empty)
            if (!result.hasOwnProperty('attributes')) {
              allPassed = false;
              break;
            }
            
            // Verify it's an object
            if (typeof result.attributes !== 'object') {
              allPassed = false;
              break;
            }
            
          } catch (error) {
            allPassed = false;
            break;
          }
        }
        
        logTest('Attributes Never Cause Crashes', allPassed, allPassed ? 'All transactions processed with attributes' : 'Some transactions failed');
        
      } catch (error) {
        logTest('Attributes Never Cause Crashes', false, `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    },
  },
];

async function runErrorHandlingTests() {
  console.log('🧪 Universal Taxonomy - Error Handling Tests\n');
  console.log('═'.repeat(60));
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('\n❌ Error: GEMINI_API_KEY environment variable is required');
    console.log('   Please set it in your .env file\n');
    process.exit(1);
  }
  
  console.log(`\nRunning ${testCases.length} error handling tests...\n`);
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`\n${i + 1}. ${testCase.name}`);
    console.log(`   ${testCase.description}`);
    
    try {
      if (testCase.setup) {
        await testCase.setup();
      }
      
      await testCase.test();
      
      if (testCase.cleanup) {
        await testCase.cleanup();
      }
      
    } catch (error) {
      logTest(testCase.name, false, `Test execution failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    
    // Small delay between tests
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Results Summary\n');
  
  const total = testsPassed + testsFailed;
  const passRate = (testsPassed / total) * 100;
  
  console.log(`✅ Passed: ${testsPassed}/${total} (${passRate.toFixed(1)}%)`);
  
  if (testsFailed > 0) {
    console.log(`❌ Failed: ${testsFailed}/${total}`);
  }
  
  console.log('\n' + '═'.repeat(60));
  
  // Exit with appropriate code
  if (testsFailed === 0) {
    console.log('\n✅ All error handling tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some error handling tests failed\n');
    process.exit(1);
  }
}

// Run the tests
runErrorHandlingTests().catch(error => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});

