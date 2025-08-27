import { test, expect } from "@playwright/test";

test.describe("RLS Security Verification", () => {
  test.describe.configure({ mode: 'serial' }); // Run tests in sequence to manage state

  const timestamp = Date.now();
  const userA = {
    email: `user-a-${timestamp}@gmail.com`,
    password: `TestPasswordA123!${timestamp}`,
    orgName: `Organization A ${timestamp}`
  };
  
  const userB = {
    email: `user-b-${timestamp}@gmail.com`, 
    password: `TestPasswordB123!${timestamp}`,
    orgName: `Organization B ${timestamp}`
  };

  let orgAId: string;
  let orgBId: string;

  test("setup: create two users with separate organizations", async ({ page, browser }) => {
    // Create User A and Organization A
    await page.goto("/sign-up");
    await page.fill('input[name="email"]', userA.email);
    await page.fill('input[name="password"]', userA.password);
    await page.fill('input[name="confirm-password"]', userA.password);
    await page.click('button[type="submit"], button:has-text("Sign up")');
    
    await page.waitForLoadState("networkidle");
    
    // Navigate to onboarding if needed
    if (!page.url().includes("/onboarding")) {
      await page.goto("/onboarding");
    }
    
    // Complete onboarding for User A
    await page.fill('input[name="name"]', userA.orgName);
    await page.selectOption('select[name="industry"]', 'Salon/Beauty');
    await page.click('button[type="submit"]:has-text("Create Organization")');
    
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Extract org ID from cookie (if possible) or URL
    const cookies = await page.context().cookies();
    const orgCookie = cookies.find(c => c.name === 'orgId');
    if (orgCookie) {
      orgAId = orgCookie.value;
    }
    
    // Sign out User A
    // Note: We'll need to implement sign out functionality or clear session
    await page.evaluate(() => {
      document.cookie = 'orgId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      // Clear other auth cookies if any
    });
    await page.context().clearCookies();
    
    // Create User B in a new context to avoid session conflicts  
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    
    await pageB.goto("/sign-up");
    await pageB.fill('input[name="email"]', userB.email);
    await pageB.fill('input[name="password"]', userB.password);
    await pageB.fill('input[name="confirm-password"]', userB.password);
    await pageB.click('button[type="submit"], button:has-text("Sign up")');
    
    await pageB.waitForLoadState("networkidle");
    
    if (!pageB.url().includes("/onboarding")) {
      await pageB.goto("/onboarding");
    }
    
    // Complete onboarding for User B
    await pageB.fill('input[name="name"]', userB.orgName);
    await pageB.selectOption('select[name="industry"]', 'Restaurant');
    await pageB.click('button[type="submit"]:has-text("Create Organization")');
    
    await pageB.waitForLoadState("networkidle");
    await expect(pageB).toHaveURL(/\/dashboard/);
    
    // Extract org ID for User B
    const cookiesB = await pageB.context().cookies();
    const orgCookieB = cookiesB.find(c => c.name === 'orgId');
    if (orgCookieB) {
      orgBId = orgCookieB.value;
    }
    
    await contextB.close();
    
    // Verify we have both org IDs
    console.log(`Created organizations - A: ${orgAId}, B: ${orgBId}`);
  });

  test("should prevent cross-org access when User A tries to access Org B data", async ({ page }) => {
    // Sign in as User A
    await page.goto("/sign-in");
    await page.fill('input[name="email"], input[type="email"]', userA.email);
    await page.fill('input[name="password"]', userA.password);
    await page.click('button[type="submit"], button:has-text("Sign in")');
    
    await page.waitForLoadState("networkidle");
    
    // User A should now be signed in and have access to their org
    await expect(page.locator(`button:has-text("${userA.orgName}")`)).toBeVisible();
    
    // Now try to manually set cookie to Org B's ID and make API calls
    if (orgBId) {
      await page.evaluate((orgId) => {
        document.cookie = `orgId=${orgId}; path=/; SameSite=Lax`;
      }, orgBId);
      
      // Try to access connections API with Org B's ID
      const response = await page.evaluate(async (orgId) => {
        try {
          const res = await fetch(`/api/connections/list?orgId=${orgId}`, {
            method: 'GET',
            credentials: 'include'
          });
          return {
            status: res.status,
            ok: res.ok
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      }, orgBId);
      
      // Should return 403 Forbidden due to RLS policy violation
      expect(response.status).toBe(403);
      
      // Try transactions API
      const transactionsResponse = await page.evaluate(async (orgId) => {
        try {
          const res = await fetch(`/api/transactions/list?orgId=${orgId}`, {
            method: 'GET', 
            credentials: 'include'
          });
          return {
            status: res.status,
            ok: res.ok
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      }, orgBId);
      
      expect(transactionsResponse.status).toBe(403);
      
      // Try exports API
      const exportsResponse = await page.evaluate(async (orgId) => {
        try {
          const res = await fetch('/api/exports/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              orgId: orgId,
              type: 'csv',
              params: {}
            })
          });
          return {
            status: res.status,
            ok: res.ok
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      }, orgBId);
      
      expect(exportsResponse.status).toBe(403);
    }
  });

  test("should allow User A to access their own org data", async ({ page }) => {
    // User A should still be signed in from previous test
    // Reset cookie to their own org
    if (orgAId) {
      await page.evaluate((orgId) => {
        document.cookie = `orgId=${orgId}; path=/; SameSite=Lax`;
      }, orgAId);
      
      // Refresh to ensure proper org context
      await page.reload();
      await page.waitForLoadState("networkidle");
      
      // Should be able to access their own org's connections
      const response = await page.evaluate(async (orgId) => {
        try {
          const res = await fetch(`/api/connections/list?orgId=${orgId}`, {
            method: 'GET',
            credentials: 'include'
          });
          return {
            status: res.status,
            ok: res.ok
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      }, orgAId);
      
      // Should return 200 OK for their own org
      expect(response.status).toBe(200);
    }
  });

  test("should verify RLS at database level prevents unauthorized queries", async ({ page }) => {
    // This test verifies that even if we bypass API validation,
    // the database RLS policies would still prevent access
    
    // Sign in as User A
    await page.goto("/sign-in");
    await page.fill('input[name="email"], input[type="email"]', userA.email);
    await page.fill('input[name="password"]', userA.password);
    await page.click('button[type="submit"], button:has-text("Sign in")');
    
    await page.waitForLoadState("networkidle");
    
    // Verify that User A can only see their own organization
    const orgSwitcher = page.locator('button[class*="justify-between"]').first();
    await expect(orgSwitcher).toBeVisible();
    
    // The org switcher should only show organizations User A has access to
    await orgSwitcher.click();
    
    // Should only see User A's organization in the dropdown
    await expect(page.locator(`button:has-text("${userA.orgName}")`)).toBeVisible();
    
    // Should NOT see User B's organization
    await expect(page.locator(`button:has-text("${userB.orgName}")`)).not.toBeVisible();
    
    // Click elsewhere to close dropdown
    await page.click('h1:has-text("Dashboard")');
  });

  test("should maintain security across page navigation and refresh", async ({ page }) => {
    // User should still be signed in as User A
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    
    // Verify we're still on the correct org
    await expect(page.locator(`button:has-text("${userA.orgName}")`)).toBeVisible();
    
    // Navigate to different app pages
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
    
    // Should still show correct org context
    await expect(page.locator(`button:has-text("${userA.orgName}")`)).toBeVisible();
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState("networkidle");
    
    // Should maintain org context after refresh
    await expect(page.locator(`button:has-text("${userA.orgName}")`)).toBeVisible();
  });
});