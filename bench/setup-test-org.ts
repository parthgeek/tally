/**
 * Setup Test Organization for Sprint 3 Analysis
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function setupTestOrg() {
  console.log('🏢 Setting up test organization\n');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.log('❌ Missing environment variables');
    console.log('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Use service role to bypass RLS
  const supabase = createClient(url, serviceKey);

  // Check for existing orgs
  const { data: orgs, error: fetchError } = await supabase
    .from('orgs')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (fetchError) {
    console.log('❌ Error fetching orgs:', fetchError.message);
    process.exit(1);
  }

  console.log(`📊 Found ${orgs?.length || 0} existing organizations`);

  if (orgs && orgs.length > 0) {
    console.log('\nExisting organizations:');
    orgs.forEach((o, i) => {
      console.log(`  ${i + 1}. ${o.name}`);
      console.log(`     ID: ${o.id}`);
      console.log(`     Created: ${new Date(o.created_at).toLocaleDateString()}\n`);
    });

    console.log('✅ You can use any of these org IDs for testing:');
    console.log(`   --org-id ${orgs[0]!.id}`);
    console.log('\nOr set in .env:');
    console.log(`   TEST_ORG_ID=${orgs[0]!.id}`);
  } else {
    console.log('\n⚠️  No organizations found. Creating test organization...');

    const { data: newOrg, error: createError } = await supabase
      .from('orgs')
      .insert({ name: 'Sprint 3 Test Organization' })
      .select()
      .single();

    if (createError) {
      console.log('❌ Error creating org:', createError.message);
      process.exit(1);
    }

    console.log('✅ Created test organization:');
    console.log(`   Name: ${newOrg.name}`);
    console.log(`   ID: ${newOrg.id}`);
    console.log('\nAdd to .env:');
    console.log(`   TEST_ORG_ID=${newOrg.id}`);
  }
}

setupTestOrg().catch((error) => {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
});
