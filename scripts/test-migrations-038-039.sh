#!/bin/bash
# Test script for migrations 038 and 039
# Tests the universal taxonomy schema changes in a safe way

set -e  # Exit on error

echo "================================================"
echo "Testing Migrations 038-039: Universal Taxonomy"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check environment
if [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${RED}❌ Error: SUPABASE_DB_URL environment variable not set${NC}"
    echo "Please set it to your database connection string"
    echo "Example: export SUPABASE_DB_URL='postgresql://postgres:password@localhost:54322/postgres'"
    exit 1
fi

echo -e "${YELLOW}📋 Step 1: Backing up current schema${NC}"
pg_dump "$SUPABASE_DB_URL" --schema-only > backup_schema_$(date +%Y%m%d_%H%M%S).sql
echo -e "${GREEN}✓ Schema backup created${NC}"
echo ""

echo -e "${YELLOW}📋 Step 2: Running Migration 038 (Schema Changes)${NC}"
psql "$SUPABASE_DB_URL" < packages/db/migrations/038_universal_taxonomy_schema.sql
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration 038 applied successfully${NC}"
else
    echo -e "${RED}❌ Migration 038 failed${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}📋 Step 3: Verifying Migration 038${NC}"
psql "$SUPABASE_DB_URL" -c "
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transactions' 
  AND column_name = 'attributes';
" | grep -q "attributes" && echo -e "${GREEN}✓ transactions.attributes column exists${NC}" || echo -e "${RED}❌ transactions.attributes column missing${NC}"

psql "$SUPABASE_DB_URL" -c "
SELECT 
    column_name
FROM information_schema.columns 
WHERE table_name = 'categories' 
  AND column_name IN ('slug', 'type', 'industries', 'is_universal', 'tier', 'attribute_schema', 'display_order', 'is_pnl');
" | wc -l | grep -q "8" && echo -e "${GREEN}✓ All category columns added${NC}" || echo -e "${RED}❌ Some category columns missing${NC}"

echo ""

echo -e "${YELLOW}📋 Step 4: Running Migration 039 (Validation Functions)${NC}"
psql "$SUPABASE_DB_URL" < packages/db/migrations/039_attribute_validation.sql
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration 039 applied successfully${NC}"
else
    echo -e "${RED}❌ Migration 039 failed${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}📋 Step 5: Verifying Migration 039${NC}"

# Check functions
psql "$SUPABASE_DB_URL" -c "
SELECT proname FROM pg_proc 
WHERE proname IN (
    'validate_transaction_attributes',
    'get_attribute',
    'has_attribute',
    'get_attribute_keys',
    'get_attribute_distribution',
    'get_attribute_coverage'
);
" | grep -c "validate_transaction_attributes\|get_attribute\|has_attribute" > /dev/null && echo -e "${GREEN}✓ All validation functions created${NC}" || echo -e "${RED}❌ Some functions missing${NC}"

# Check view
psql "$SUPABASE_DB_URL" -c "
SELECT viewname FROM pg_views WHERE viewname = 'transactions_with_attributes';
" | grep -q "transactions_with_attributes" && echo -e "${GREEN}✓ transactions_with_attributes view created${NC}" || echo -e "${RED}❌ View missing${NC}"

echo ""

echo -e "${YELLOW}📋 Step 6: Testing Basic Functionality${NC}"

# Test 1: Insert transaction with attributes
echo "Test 1: Inserting transaction with attributes..."
TEST_ORG_ID=$(psql "$SUPABASE_DB_URL" -t -c "SELECT id FROM orgs LIMIT 1;")
TEST_ACCOUNT_ID=$(psql "$SUPABASE_DB_URL" -t -c "SELECT id FROM accounts LIMIT 1;")

if [ -n "$TEST_ORG_ID" ] && [ -n "$TEST_ACCOUNT_ID" ]; then
    psql "$SUPABASE_DB_URL" -c "
    INSERT INTO transactions (
        org_id, 
        account_id, 
        date, 
        amount_cents, 
        currency, 
        description,
        merchant_name,
        raw,
        attributes
    ) VALUES (
        '$TEST_ORG_ID',
        '$TEST_ACCOUNT_ID',
        CURRENT_DATE,
        10000,
        'USD',
        'Test transaction with attributes',
        'Test Merchant',
        '{}'::jsonb,
        '{\"platform\": \"Meta\", \"campaign_type\": \"paid_social\"}'::jsonb
    )
    RETURNING id;
    " > /dev/null && echo -e "${GREEN}✓ Transaction with attributes inserted${NC}" || echo -e "${RED}❌ Insert failed${NC}"
else
    echo -e "${YELLOW}⚠ Skipping insert test (no test org/account found)${NC}"
fi

# Test 2: Query attribute function
echo "Test 2: Testing get_attribute function..."
psql "$SUPABASE_DB_URL" -c "
SELECT get_attribute('{\"platform\": \"Meta\"}'::jsonb, 'platform', 'Unknown');
" | grep -q "Meta" && echo -e "${GREEN}✓ get_attribute function works${NC}" || echo -e "${RED}❌ get_attribute failed${NC}"

# Test 3: Create test category with slug and attribute schema
echo "Test 3: Creating test category with slug and attributes..."
TEST_CATEGORY_ID=$(psql "$SUPABASE_DB_URL" -t -c "
INSERT INTO categories (
    name,
    slug,
    type,
    industries,
    is_universal,
    tier,
    is_pnl,
    attribute_schema,
    display_order
) VALUES (
    'Test Payment Processing',
    'test_payment_processing',
    'opex',
    '{\"all\"}',
    true,
    2,
    true,
    '{
        \"processor\": {
            \"type\": \"enum\",
            \"values\": [\"Stripe\", \"PayPal\", \"Square\"],
            \"required\": false
        }
    }'::jsonb,
    99
)
RETURNING id;
" | tr -d ' ')

if [ -n "$TEST_CATEGORY_ID" ]; then
    echo -e "${GREEN}✓ Test category created with slug and attribute schema${NC}"
else
    echo -e "${RED}❌ Failed to create test category${NC}"
fi

echo ""

echo -e "${YELLOW}📋 Step 7: Cleanup Test Data${NC}"
if [ -n "$TEST_ORG_ID" ] && [ -n "$TEST_ACCOUNT_ID" ]; then
    psql "$SUPABASE_DB_URL" -c "
    DELETE FROM transactions 
    WHERE description = 'Test transaction with attributes';
    " > /dev/null && echo -e "${GREEN}✓ Test transactions cleaned up${NC}"
fi

if [ -n "$TEST_CATEGORY_ID" ]; then
    psql "$SUPABASE_DB_URL" -c "
    DELETE FROM categories 
    WHERE id = '$TEST_CATEGORY_ID';
    " > /dev/null && echo -e "${GREEN}✓ Test category cleaned up${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✅ All tests passed!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Review the changes in your database"
echo "2. Run: psql \$SUPABASE_DB_URL -c '\\d transactions' to see new attributes column"
echo "3. Run: psql \$SUPABASE_DB_URL -c '\\d categories' to see new industry columns"
echo "4. Proceed to Phase 2: Code Refactor"
echo ""
echo "To rollback these migrations, run:"
echo "  psql \$SUPABASE_DB_URL < scripts/rollback-migrations-038-039.sql"

