/**
 * Get the current organization ID from cookie
 * This matches the pattern used in OrgSwitcher
 */
export function getCurrentOrgId(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(";");
  const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
  return orgCookie ? orgCookie.split("=")[1] : null;
}

/**
 * Set the current organization ID in cookie
 */
export function setCurrentOrgId(orgId: string): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = `orgId=${orgId}; path=/; SameSite=Lax`;
}