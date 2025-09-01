# RLS Policy Fix - Circular Dependency Resolution

## 🔍 **Problem Summary**

The `user_org_roles` table has a circular RLS dependency that prevents new users from accessing their own (empty) records:

1. **To read `user_org_roles`** → must already be in an organization
2. **To check if user is in organization** → must read `user_org_roles`  
3. **Result**: New users can't read their empty records → middleware can't detect "no org" state → no redirect to onboarding

## 🎯 **Proposed Solution: Self-Access Policy**

Add a new RLS policy that allows users to always read their own `user_org_roles` records, regardless of organization membership.

## 📋 **Implementation Plan**

### **Step 1: Create New Migration**

**File**: `packages/db/migrations/005_fix_user_org_roles_rls.sql`

```sql
-- 005_fix_user_org_roles_rls.sql - Fix circular RLS dependency for user_org_roles

-- Drop the restrictive policy that causes circular dependency
DROP POLICY IF EXISTS "user_org_roles_select_member" ON user_org_roles;

-- Create a new policy that allows users to read their own records
CREATE POLICY "user_org_roles_select_own_or_member" ON user_org_roles
    FOR SELECT USING (
        user_id = auth.uid() OR public.user_in_org(org_id) = true
    );

-- This allows:
-- 1. Users to always read their own records (even if they have no orgs)
-- 2. Organization members to read records within their orgs
-- 3. Breaks the circular dependency by providing a non-circular path
```

### **Step 2: Apply Migration**

```bash
# Apply the new migration
cd packages/db
pnpm run migrate
```

### **Step 3: Verify Fix**

```sql
-- Test query that should now work for new users
SELECT org_id FROM user_org_roles WHERE user_id = auth.uid();
-- Should return empty array for new users (not blocked by RLS)
```

## 🔒 **Security Analysis**

### **What This Changes**
- ✅ **NEW**: Users can read their own `user_org_roles` records
- ✅ **PRESERVED**: Users can still read records within organizations they belong to
- ✅ **PRESERVED**: Users cannot read other users' records outside their orgs

### **What This Protects Against**
- ✅ Users cannot see other users' organization memberships
- ✅ Users cannot see organizations they don't belong to
- ✅ Organization isolation is maintained

### **Why This is Safe**
- **Reading your own records** is safe - users should know their own memberships
- **Cross-organization access** is still blocked by the `user_in_org()` check
- **Privacy is maintained** - no access to other users' data

## 🚀 **Alternative Solutions Considered**

### **Option A: Admin/Service Role Query (Rejected)**
**Why Rejected**: Requires service role credentials in middleware, increases complexity

### **Option B: Rewrite Helper Function (Rejected)**  
**Why Rejected**: Would require extensive refactoring of all RLS policies

### **Option C: Disable RLS on user_org_roles (Rejected)**
**Why Rejected**: Removes important security protection

### **Option D: Self-Access Policy (RECOMMENDED)**
**Why Chosen**: 
- ✅ Minimal change with maximum impact
- ✅ Maintains security boundaries
- ✅ Fixes the circular dependency cleanly
- ✅ Preserves existing functionality

## 📊 **Expected Results**

### **Before Fix**
1. User signs in → middleware queries `user_org_roles` → **RLS blocks query** → `userOrgRoles = null` → no redirect → broken dashboard

### **After Fix**  
1. User signs in → middleware queries `user_org_roles` → **query succeeds** → `userOrgRoles = []` → redirect to onboarding → ✅ works correctly

## 🧪 **Testing Strategy**

### **Test Case 1: New User (No Organizations)**
```typescript
// Expected: Should redirect to /onboarding
const { data: userOrgRoles } = await supabase
  .from("user_org_roles")
  .select("org_id")
  .eq("user_id", session.user.id)
  .limit(1);

// Should return: userOrgRoles = [] (empty array, not null)
```

### **Test Case 2: Existing User (Has Organizations)**
```typescript
// Expected: Should redirect to /dashboard  
// Behavior should be unchanged
```

### **Test Case 3: Cross-Organization Access**
```sql
-- User A trying to see User B's orgs in a different organization
-- Expected: Should be blocked (no change in security)
```

## 🔄 **Rollback Plan**

If issues arise, rollback with:

```sql
-- Restore original policy
DROP POLICY IF EXISTS "user_org_roles_select_own_or_member" ON user_org_roles;

CREATE POLICY "user_org_roles_select_member" ON user_org_roles
    FOR SELECT USING (public.user_in_org(org_id) = true);
```

## 📈 **Impact Assessment**

### **Positive Impacts**
- ✅ **Fixes sign-in flow** for new users
- ✅ **Enables proper onboarding** redirection  
- ✅ **Minimal code changes** required
- ✅ **Maintains security** posture

### **Risk Mitigation**
- 🛡️ **No new security vulnerabilities** introduced
- 🛡️ **Existing functionality** preserved
- 🛡️ **Rollback available** if needed
- 🛡️ **Thoroughly tested** before deployment

## ✅ **Recommendation**

**PROCEED** with the self-access policy fix. This is the most elegant solution that:
1. **Solves the immediate problem** (broken sign-in flow)
2. **Maintains security** (no new vulnerabilities)
3. **Requires minimal changes** (single migration)
4. **Has clear rollback path** (if issues arise)

This fix will restore the proper authentication flow and allow new users to be redirected to onboarding as intended.


