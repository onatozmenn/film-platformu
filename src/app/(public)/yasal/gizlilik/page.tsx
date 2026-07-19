import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { approvedPublicContent } from "@/modules/compliance/approved-public-content";
import { PublicDocument } from "@/modules/compliance/public-document";

export const metadata: Metadata = { title: "Gizlilik" };

export default function PrivacyPage() {
  const document = approvedPublicContent.privacy;
  if (document === null) notFound();
  return <PublicDocument contactEmail={null} document={document} logo={null} />;
}
