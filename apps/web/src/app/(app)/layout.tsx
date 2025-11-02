"use client";

import { useState } from "react";
import { Menu, X, Home, Receipt, TrendingUp, Eye, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { OrgSwitcher } from "@/components/org-switcher";
import { UserMenu } from "@/components/user-menu";
import { CommandPalette } from "@/components/command-palette";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "P&L", href: "/pl", icon: TrendingUp },
  { name: "Review", href: "/review", icon: Eye },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isCollapsed, toggleSidebar, isLoaded } = useSidebarState();
  const pathname = usePathname();

  const sidebarWidth = isCollapsed ? "w-16" : "w-60";

  return (
    <div className="h-full">
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300",
          sidebarWidth
        )}
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border-subtle bg-background px-4 pb-4">
          {/* Logo / Brand */}
          <div className="flex h-12 shrink-0 items-center justify-between mt-3">
            {!isCollapsed && <h1 className="text-lg font-semibold tracking-tight">Tally</h1>}
            <button
              onClick={toggleSidebar}
              className={cn(
                "p-1.5 rounded-md hover:bg-muted transition-colors",
                isCollapsed && "mx-auto"
              )}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-1">
              {navigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-x-3 rounded-md p-2 text-sm font-medium transition-colors relative",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        isCollapsed && "justify-center"
                      )}
                      title={isCollapsed ? item.name : undefined}
                    >
                      {/* Active indicator */}
                      {isActive && !isCollapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
                      )}
                      <item.icon
                        className={cn("h-5 w-5 shrink-0", isActive && "text-primary")}
                        aria-hidden="true"
                      />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={cn("lg:pl-60 transition-all duration-300", isCollapsed && "lg:pl-16")}>
        {/* Top Header */}
        <div className="sticky top-0 z-40 flex h-11 sm:h-12 shrink-0 items-center gap-x-2 sm:gap-x-4 border-b border-border-subtle bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-3 sm:px-6 lg:px-8">
          {/* Mobile menu button - larger touch target on mobile */}
          <button
            type="button"
            className="-m-2 p-2.5 text-muted-foreground lg:hidden touch-manipulation"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Spacer */}
          <div className="flex flex-1" />

          {/* Right side: Org Switcher + User Menu */}
          <div className="flex items-center gap-x-1.5 sm:gap-x-2">
            <div className="hidden sm:block">
              <OrgSwitcher />
            </div>
            <div className="h-5 w-px bg-border-subtle hidden sm:block" />
            <UserMenu />
          </div>
        </div>

        {/* Page Content */}
        <main className="py-4 sm:py-6 lg:py-8">
          <div className="px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-foreground/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-0 flex">
            <div className="relative mr-16 flex w-full max-w-xs flex-1">
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                <button
                  type="button"
                  className="-m-2 p-3 touch-manipulation"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <X className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>

              <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-background px-6 pb-4 border-r border-border-subtle">
                <div className="flex h-12 shrink-0 items-center mt-3">
                  <h1 className="text-lg font-semibold">Tally</h1>
                </div>
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-1">
                    {navigation.map((item) => {
                      const isActive = pathname.startsWith(item.href);
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={cn(
                              "group flex items-center gap-x-3 rounded-md p-3 text-base font-medium transition-colors relative touch-manipulation",
                              isActive
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
                            )}
                            <item.icon
                              className={cn("h-5 w-5 shrink-0", isActive && "text-primary")}
                            />
                            {item.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette - Global */}
      <CommandPalette />
    </div>
  );
}
