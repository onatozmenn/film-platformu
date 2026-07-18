import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CatalogFilterControls } from "./catalog-filter-controls";

describe("CatalogFilterControls", () => {
  it("opens the mobile sheet and returns focus on Escape", async () => {
    const user = userEvent.setup();
    render(
      <CatalogFilterControls
        availableGenres={[{ name: "Dram", slug: "dram" }]}
        availableYears={[2026]}
        filters={{ genre: null, page: 1, sort: "editor-secimi", year: null }}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Filtreler" });

    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Filmleri filtrele" })).toBeVisible();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
