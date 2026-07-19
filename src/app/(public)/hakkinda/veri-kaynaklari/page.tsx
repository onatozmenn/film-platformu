import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { approvedPublicContent } from "@/modules/compliance/approved-public-content";
import { PublicDocument } from "@/modules/compliance/public-document";

export const metadata: Metadata = { title: "Veri Kaynakları" };

export default function DataSourcesPage() {
  const document = approvedPublicContent.tmdbAttribution;
  if (document === null) notFound();
  return <PublicDocument contactEmail={null} document={document} logo={document.logo} />;
}
