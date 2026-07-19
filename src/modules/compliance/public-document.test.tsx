import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicDocument } from "./public-document";

describe("approved public document", () => {
  it("renders only reviewed structured copy and an explicit support address", () => {
    render(
      <PublicDocument
        contactEmail="support@film.example"
        document={{
          reviewedAt: new Date("2026-07-19T00:00:00.000Z"),
          sections: [{ heading: "Reviewed section", paragraphs: ["Reviewed paragraph."] }],
          summary: "Reviewed summary.",
          title: "Reviewed title",
        }}
        logo={null}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Reviewed title" })).toBeVisible();
    expect(screen.getByText("Reviewed paragraph.")).toBeVisible();
    expect(screen.getByRole("link", { name: "support@film.example" })).toHaveAttribute(
      "href",
      "mailto:support@film.example",
    );
  });
});
