/**
 * Verify Supabase Setup for Sprint 3 Analysis Tools
 *
 * Checks:
 * 1. Environment variables are set
 * 2. Supabase connection works
 * 3. Categories table is populated
 * 4. Test org exists (if TEST_ORG_ID provided)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function verifySetup() {
  console.log('🔍 Verifying Supabase Setup\n');

  // Check environment variables
  console.log('Environment Variables:');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const testOrgId = process.env.TEST_ORG_ID;

  console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${url ? '✅ Set' : '❌ Missing'}`);
  console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${key ? '✅ Set (length: ' + key.length + ')' : '❌ Missing'}`);
  console.log(`  TEST_ORG_ID: ${testOrgId ? '✅ Set (' + testOrgId + ')' : '⚠️  Not set (will need --org-id flag)'}`);

  if (!url || !key) {
    console.log('\n❌ Missing required environment variables');
    console.log('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  // Test Supabase connection
  console.log('\n📡 Testing Supabase Connection...');
  const supabase = createClient(url, key);

  // Check categories table (global categories)
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name, type, parent_id')
    .is('org_id', null)
    .order('name');

  if (categoriesError) {
    console.log('❌ Failed to query categories table:', categoriesError.message);
    process.exit(1);
  }

  console.log('✅ Successfully connected to Supabase');
  console.log(`\n📊 Global Categories: ${categories?.length || 0}`);

  if (categories && categories.length > 0) {
    // Group by type
    const byType = categories.reduce((acc, cat) => {
      acc[cat.type] = (acc[cat.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nCategory Breakdown by Type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Show tier 1 parents
    const parents = categories.filter(c => c.parent_id === null);
    console.log(`\nTier 1 Parent Categories: ${parents.length}`);
    parents.forEach(p => console.log(`  - ${p.name} (${p.type})`));

    // Show tier 2 children
    const children = categories.filter(c => c.parent_id !== null);
    console.log(`\nTier 2 Child Categories: ${children.length}`);
    children.slice(0, 5).forEach(c => console.log(`  - ${c.name} (${c.type})`));
    if (children.length > 5) {
      console.log(`  ... and ${children.length - 5} more`);
    }
  }

  // Check if test org exists (if provided)
  if (testOrgId) {
    console.log(`\n🏢 Checking Test Organization (${testOrgId})...`);

    const { data: org, error: orgError } = await supabase
      .from('orgs')
      .select('id, name')
      .eq('id', testOrgId)
      .single();

    if (orgError) {
      console.log('❌ Test org not found or not accessible:', orgError.message);
      console.log('You may need to:');
      console.log('  1. Create an organization via the web app');
      console.log('  2. Ensure RLS policies allow access');
      console.log('  3. Use a different org ID via --org-id flag');
    } else {
      console.log(`✅ Test org found: ${org.name}`);
    }
  }

  console.log('\n✅ Setup verification complete!');
  console.log('\nYou can now run:');
  console.log('  npx tsx bench/llm-ablation-study.ts --dataset bench/labeled-dataset.json --org-id <uuid>');
  console.log('  npx tsx bench/threshold-optimizer.ts --dataset bench/labeled-dataset.json --org-id <uuid>');
}

verifySetup().catch((error) => {
  console.error('\n❌ Verification failed:', error.message);
  process.exit(1);
});
