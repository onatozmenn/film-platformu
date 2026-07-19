import { describe, expect, it } from "vitest";

import {
  approvedFooterLinks,
  isApprovedPublicContentComplete,
  parseApprovedPublicContent,
} from "./approved-public-content";

const document = {
  reviewedAt: "2026-07-19",
  sections: [{ heading: "Reviewed section", paragraphs: ["Reviewed paragraph."] }],
  summary: "Reviewed summary.",
  title: "Reviewed title",
} as const;
const logo = {
  alt: "Approved brand mark",
  height: 128,
  src: "/brand/approved-mark.png",
  width: 256,
} as const;

describe("approved public content", () => {
  it("keeps every unapproved section absent from routes and navigation", () => {
    const content = parseApprovedPublicContent({
      brand: null,
      consent: null,
      privacy: null,
      support: null,
      terms: null,
      tmdbAttribution: null,
    });

    expect(isApprovedPublicContentComplete(content)).toBe(false);
    expect(approvedFooterLinks(content)).toEqual([]);
  });

  it("accepts complete reviewed plain-text content and exposes stable footer routes", () => {
    const content = parseApprovedPublicContent({
      brand: { description: "Approved description.", logo },
      consent: document,
      privacy: document,
      support: { ...document, contactEmail: "SUPPORT@FILM.EXAMPLE" },
      terms: document,
      tmdbAttribution: { ...document, logo },
    });

    expect(isApprovedPublicContentComplete(content)).toBe(true);
    expect(content.support?.contactEmail).toBe("support@film.example");
    expect(approvedFooterLinks(content)).toHaveLength(5);
  });

  it.each([
    { ...document, summary: "<strong>Unreviewed HTML</strong>" },
    { ...document, reviewedAt: "not-a-date" },
  ])("rejects unsafe or malformed public copy %#", (privacy) => {
    expect(() =>
      parseApprovedPublicContent({
        brand: null,
        consent: null,
        privacy,
        support: null,
        terms: null,
        tmdbAttribution: null,
      }),
    ).toThrow();
  });
});
