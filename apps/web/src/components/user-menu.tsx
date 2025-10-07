"use client";

import { useState, useEffect } from "react";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface UserData {
  email: string;
  name?: string;
}

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          email: authUser.email || "",
          name: authUser.user_metadata?.name,
        });
      }
    };
    fetchUser();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "U";
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
          {getInitials(user.name, user.email)}
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-notion-lg z-50">
            <div className="p-2">
              {/* User info */}
              <div className="px-3 py-2 border-b border-border-subtle">
                <p className="text-sm font-medium">{user.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>

              {/* Menu items */}
              <div className="mt-1 space-y-0.5">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/settings");
                  }}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-destructive-background hover:text-destructive transition-colors"
                  onClick={() => {
                    setIsOpen(false);
                    handleSignOut();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Click outside to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
        </>
      )}
    </div>
  );
}
