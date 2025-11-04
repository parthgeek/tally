import { redirect } from "next/navigation";

export default function ConnectionsPage() {
  // Redirect to new Settings v2 Workspace/Integrations
  redirect("/settings-v2/workspace");
}
