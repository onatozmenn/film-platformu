import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { approvedPublicContent } from "@/modules/compliance/approved-public-content";
import { PublicDocument } from "@/modules/compliance/public-document";

export const metadata: Metadata = { title: "Destek Ve Hak Bildirimi" };

export default function SupportPage() {
  const document = approvedPublicContent.support;
  if (document === null) notFound();
  return <PublicDocument contactEmail={document.contactEmail} document={document} logo={null} />;
}
