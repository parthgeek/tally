import { notFound } from "next/navigation";
import { isCategorizerLabEnabled } from "@/lib/flags";
import CategorizerLabClient from "./client";

export default function CategorizerLabPage() {
  // Guard: Only available in development or when explicitly enabled
  if (!isCategorizerLabEnabled()) {
    notFound();
  }

  return <CategorizerLabClient />;
}
