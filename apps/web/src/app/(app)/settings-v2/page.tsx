import { redirect } from "next/navigation";

export default function SettingsV2Page() {
  // Redirect to Account tab by default
  redirect("/settings-v2/account");
}

