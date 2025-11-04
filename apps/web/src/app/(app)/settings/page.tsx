import { redirect } from "next/navigation";

export default function SettingsPage() {
  // Redirect to new Settings v2
  redirect("/settings-v2/account");
}
