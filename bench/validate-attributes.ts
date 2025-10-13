/**
 * Attribute Extraction Validation
 * 
 * Tests that the LLM correctly extracts attributes from transaction descriptions
 */

import { categorizeWithUniversalLLM } from '../packages/categorizer/src/pass2_llm.js';
import { GeminiClient } from '../packages/categorizer/src/gemini-client.js';

interface TestCase {
  description: string;
  merchantName: string | null;
  expectedCategory: string;
  expectedAttributes: Record<string, string>;
  amount: number; // in dollars
}

const TEST_CASES: TestCase[] = [
  // Payment Processing
  {
    description: "STRIPE PAYMENT PROCESSING FEE",
    merchantName: "Stripe",
    amount: 25.00,
    expectedCategory: "payment_processing_fees",
    expectedAttributes: { processor: "Stripe" }
  },
  {
    description: "PAYPAL TRANSACTION FEE",
    merchantName: "PayPal",
    amount: 15.50,
    expectedCategory: "payment_processing_fees",
    expectedAttributes: { processor: "PayPal" }
  },
  
  // Marketing & Advertising
  {
    description: "META ADS MANAGER - FACEBOOK ADVERTISING",
    merchantName: "Meta",
    amount: 500.00,
    expectedCategory: "marketing_ads",
    expectedAttributes: { platform: "Meta" }
  },
  {
    description: "GOOGLE ADS INVOICE",
    merchantName: "Google",
    amount: 750.00,
    expectedCategory: "marketing_ads",
    expectedAttributes: { platform: "Google" }
  },
  {
    description: "TIKTOK FOR BUSINESS - AD SPEND",
    merchantName: "TikTok",
    amount: 300.00,
    expectedCategory: "marketing_ads",
    expectedAttributes: { platform: "TikTok" }
  },
  
  // Software & Technology
  {
    description: "SHOPIFY SUBSCRIPTION - MONTHLY",
    merchantName: "Shopify",
    amount: 29.00,
    expectedCategory: "platform_fees",
    expectedAttributes: { platform: "Shopify" }
  },
  {
    description: "ADOBE CREATIVE CLOUD",
    merchantName: "Adobe",
    amount: 54.99,
    expectedCategory: "software_subscriptions",
    expectedAttributes: { vendor: "Adobe" }
  },
  
  // Fulfillment & Logistics
  {
    description: "SHIPBOB FULFILLMENT SERVICES",
    merchantName: "ShipBob",
    amount: 450.00,
    expectedCategory: "fulfillment_logistics",
    expectedAttributes: { provider: "ShipBob" }
  },
  {
    description: "DELIVERR PICK AND PACK FEES",
    merchantName: "Deliverr",
    amount: 200.00,
    expectedCategory: "fulfillment_logistics",
    expectedAttributes: { provider: "Deliverr" }
  },
  
  // Freight & Shipping
  {
    description: "FEDEX SHIPPING LABEL",
    merchantName: "FedEx",
    amount: 15.00,
    expectedCategory: "freight_shipping",
    expectedAttributes: { carrier: "FedEx" }
  },
  {
    description: "UPS GROUND SHIPPING",
    merchantName: "UPS",
    amount: 22.50,
    expectedCategory: "freight_shipping",
    expectedAttributes: { carrier: "UPS" }
  },
];

async function testModel(modelName: string) {
  console.log(`\n🤖 Testing: ${modelName}`);
  console.log('=' .repeat(70));

  const geminiClient = new GeminiClient({
    apiKey: process.env.GEMINI_API_KEY,
    model: modelName,
    temperature: 1.0,
  });

  let totalTests = 0;
  let passedTests = 0;
  let categoryCorrect = 0;
  let attributesCorrect = 0;
  const results: Array<{test: string; status: string; details: string}> = [];

  for (const testCase of TEST_CASES) {
    totalTests++;
    
    console.log(`\n📝 Test ${totalTests}: ${testCase.description}`);
    console.log(`   Expected: ${testCase.expectedCategory} + ${JSON.stringify(testCase.expectedAttributes)}`);
    
    try {
      const transaction = {
        id: `test-${totalTests}` as any,
        orgId: 'test-org' as any,
        date: '2025-01-15',
        amountCents: (testCase.amount * 100).toString(),
        currency: 'USD',
        description: testCase.description,
        merchantName: testCase.merchantName,
        mcc: null,
        reviewed: false,
      };

      const result = await categorizeWithUniversalLLM(
        transaction,
        {
          industry: 'ecommerce',
          orgId: 'test-org',
          config: {
            model: modelName,
            temperature: 1.0,
          },
        },
        geminiClient
      );

      // Check category
      const categoryMatch = result.categoryId && result.categoryId.toLowerCase().includes(testCase.expectedCategory);
      
      // Check attributes (at least one expected attribute should be present)
      const attributeKeys = Object.keys(testCase.expectedAttributes);
      let attributesMatch = false;
      
      if (result.attributes && typeof result.attributes === 'object') {
        // Check if any expected attribute key-value pairs match
        attributesMatch = attributeKeys.some(key => {
          const expected = testCase.expectedAttributes[key].toLowerCase();
          const actual = result.attributes[key]?.toLowerCase();
          return actual && actual.includes(expected);
        });
      }

      if (categoryMatch) categoryCorrect++;
      if (attributesMatch) attributesCorrect++;
      
      const testPassed = categoryMatch && attributesMatch;
      if (testPassed) passedTests++;

      const status = testPassed ? '✅ PASS' : '❌ FAIL';
      console.log(`   Result: ${status}`);
      console.log(`     Category: ${categoryMatch ? '✓' : '✗'} (got: ${result.categoryId || 'none'})`);
      console.log(`     Attributes: ${attributesMatch ? '✓' : '✗'} (got: ${JSON.stringify(result.attributes || {})})`);
      console.log(`     Confidence: ${(result.confidence * 100).toFixed(1)}%`);

      results.push({
        test: testCase.description.substring(0, 40),
        status: testPassed ? 'PASS' : 'FAIL',
        details: `Cat:${categoryMatch?'✓':'✗'} Attr:${attributesMatch?'✓':'✗'}`,
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`   Result: ❌ ERROR`);
      console.log(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      results.push({
        test: testCase.description.substring(0, 40),
        status: 'ERROR',
        details: error instanceof Error ? error.message.substring(0, 30) : 'Unknown',
      });
    }
  }

  // Print summary
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 Summary:\n');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${(passedTests/totalTests*100).toFixed(1)}%)`);
  console.log(`Category Accuracy: ${categoryCorrect}/${totalTests} (${(categoryCorrect/totalTests*100).toFixed(1)}%)`);
  console.log(`Attribute Extraction: ${attributesCorrect}/${totalTests} (${(attributesCorrect/totalTests*100).toFixed(1)}%)`);
  
  // Print results table
  console.log('\n📋 Detailed Results:\n');
  results.forEach((r, i) => {
    console.log(`${(i+1).toString().padStart(2)}. ${r.test.padEnd(42)} ${r.status.padEnd(6)} ${r.details}`);
  });
  
  console.log('\n' + '=' .repeat(70));
  
  const success = passedTests / totalTests >= 0.70; // 70% pass rate
  if (success) {
    console.log(`\n✅ ${modelName} PASSED! (≥70% accuracy)\n`);
  } else {
    console.log(`\n⚠️  ${modelName} needs improvement (<70% accuracy)\n`);
  }
  
  return {
    model: modelName,
    totalTests,
    passedTests,
    categoryCorrect,
    attributesCorrect,
    success,
  };
}

async function runAttributeValidation() {
  console.log('🧪 Attribute Extraction Validation - Comparing Models\n');
  console.log('=' .repeat(70));
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('\n❌ GEMINI_API_KEY environment variable not set');
    console.error('   Cannot run attribute extraction tests without API key\n');
    return false;
  }

  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const allResults = [];

  for (const model of models) {
    const result = await testModel(model);
    allResults.push(result);
    
    // Delay between models to avoid rate limiting
    if (models.indexOf(model) < models.length - 1) {
      console.log('\n⏳ Waiting 3 seconds before testing next model...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Print comparison
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 MODEL COMPARISON\n');
  console.log('Model                    | Pass Rate | Category | Attributes | Overall');
  console.log('------------------------|-----------|----------|------------|--------');
  
  for (const r of allResults) {
    const passRate = (r.passedTests / r.totalTests * 100).toFixed(1) + '%';
    const catRate = (r.categoryCorrect / r.totalTests * 100).toFixed(1) + '%';
    const attrRate = (r.attributesCorrect / r.totalTests * 100).toFixed(1) + '%';
    const status = r.success ? '✅ PASS' : '⚠️  WARN';
    
    console.log(`${r.model.padEnd(24)} | ${passRate.padEnd(9)} | ${catRate.padEnd(8)} | ${attrRate.padEnd(10)} | ${status}`);
  }
  
  console.log('\n' + '=' .repeat(70));
  
  const anySuccess = allResults.some(r => r.success);
  if (anySuccess) {
    console.log('\n✅ At least one model passed validation!\n');
  } else {
    console.log('\n⚠️  Both models need improvement\n');
  }
  
  return anySuccess;
}

runAttributeValidation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n❌ Validation failed with error:', error);
  process.exit(1);
});

