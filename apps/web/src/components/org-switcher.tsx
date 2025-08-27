"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { OrgId } from "@nexus/types/contracts";

interface OrganizationMembership {
  org_id: string;
  org_name: string;
  role: string;
}

export function OrgSwitcher() {
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentOrgName, setCurrentOrgName] = useState<string>("Loading...");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const supabase = createClient();
  const router = useRouter();

  // Function to get current org ID from cookie
  const getCurrentOrgId = () => {
    const cookies = document.cookie.split(';');
    const orgCookie = cookies.find(cookie => cookie.trim().startsWith('orgId='));
    return orgCookie ? orgCookie.split('=')[1] : null;
  };

  const handleOrgSwitch = useCallback(async (orgId: OrgId) => {
    try {
      // Set cookie
      document.cookie = `orgId=${orgId}; path=/; SameSite=Lax`;
      
      // Update local state
      const selectedOrg = memberships.find(m => m.org_id === orgId);
      if (selectedOrg) {
        setCurrentOrgId(orgId);
        setCurrentOrgName(selectedOrg.org_name);
      }
      
      setIsOpen(false);
      
      // Refresh the page to re-scope the app
      router.refresh();
    } catch (error) {
      console.error("Error switching organization:", error);
    }
  }, [memberships, router]);

  // Fetch user's organization memberships
  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Query user_org_roles joined with orgs to get org names
        const { data: roles, error } = await supabase
          .from("user_org_roles")
          .select(`
            org_id,
            role,
            orgs!inner(
              name
            )
          `)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching org memberships:", error);
          return;
        }

        const membershipData = roles?.map(role => ({
          org_id: role.org_id,
          org_name: (role.orgs && 'name' in role.orgs ? role.orgs.name : "Unknown Organization") as string,
          role: role.role,
        })) || [];

        setMemberships(membershipData);

        // Set current org from cookie or default to first membership
        const cookieOrgId = getCurrentOrgId();
        if (cookieOrgId && membershipData.some(m => m.org_id === cookieOrgId)) {
          setCurrentOrgId(cookieOrgId);
          const currentOrg = membershipData.find(m => m.org_id === cookieOrgId);
          setCurrentOrgName(currentOrg?.org_name || "Unknown Organization");
        } else if (membershipData.length > 0) {
          // Default to first org if no valid cookie
          const firstOrg = membershipData[0];
          if (firstOrg) {
            setCurrentOrgId(firstOrg.org_id);
            setCurrentOrgName(firstOrg.org_name);
            // Update cookie to match
            handleOrgSwitch(firstOrg.org_id as OrgId);
          }
        }
      } catch (error) {
        console.error("Error in fetchMemberships:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemberships();
  }, [supabase, handleOrgSwitch]);



  if (isLoading) {
    return (
      <Button variant="outline" className="justify-between w-48" disabled>
        <span className="truncate">Loading...</span>
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>
    );
  }

  if (memberships.length === 0) {
    return (
      <Button variant="outline" className="justify-between w-48" disabled>
        <span className="truncate">No Organizations</span>
        <Building2 className="ml-2 h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="justify-between w-48"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{currentOrgName}</span>
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50">
          <div className="p-1">
            {memberships.map((membership) => (
              <button
                key={membership.org_id}
                className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                onClick={() => handleOrgSwitch(membership.org_id as OrgId)}
              >
                <div className="flex flex-col">
                  <span className="truncate">{membership.org_name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {membership.role}
                  </span>
                </div>
                {currentOrgId === membership.org_id && (
                  <Check className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}