"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Link as LinkIcon, Bell, Users } from "lucide-react";

export default function SettingsPage() {
  const settingsItems = [
    {
      title: "Connections",
      description: "Manage your bank accounts and data sources",
      icon: LinkIcon,
      href: "/settings/connections",
      color: "text-blue-600",
    },
    {
      title: "Alert Thresholds",
      description: "Configure when to receive financial alerts",
      icon: DollarSign,
      href: "/settings/thresholds",
      color: "text-green-600",
    },
    {
      title: "Notifications",
      description: "Email and push notification preferences",
      icon: Bell,
      href: "/settings/notifications",
      color: "text-orange-600",
      disabled: true,
    },
    {
      title: "Team & Access",
      description: "Manage organization members and permissions",
      icon: Users,
      href: "/settings/team",
      color: "text-purple-600",
      disabled: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and organization settings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          const content = (
            <Card
              className={`transition-colors ${
                item.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50 cursor-pointer"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                  <span>{item.title}</span>
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {item.disabled && <p className="text-xs text-muted-foreground">Coming soon</p>}
              </CardContent>
            </Card>
          );

          if (item.disabled) {
            return <div key={item.title}>{content}</div>;
          }

          return (
            <Link key={item.title} href={item.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
