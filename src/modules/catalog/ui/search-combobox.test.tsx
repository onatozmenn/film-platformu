import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchCombobox } from "./search-combobox";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

describe("SearchCombobox", () => {
  it("keeps DOM focus in the input while keyboard selection tracks an option", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              kind: "movie",
              poster: null,
              slug: "kiyidaki-sessizlik",
              title: "Kıyıdaki Sessizlik",
              year: 2026,
            },
          ],
        }),
      ),
    );
    render(<SearchCombobox />);
    const input = screen.getByRole("combobox", { name: "Film veya kişi ara" });

    await user.type(input, "Kıyı");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Kıyıdaki Sessizlik/u })).toBeVisible(),
    );
    await user.keyboard("{ArrowDown}");

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("00000000-0000-4000-8000-000000000001"),
    );

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/film/kiyidaki-sessizlik");
  });

  it("closes suggestions with Escape without clearing the query", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [] })),
    );
    render(<SearchCombobox initialQuery="Ay" />);
    const input = screen.getByRole("combobox", { name: "Film veya kişi ara" });

    await user.keyboard("{Escape}");
    expect(input).toHaveValue("Ay");
  });
});
