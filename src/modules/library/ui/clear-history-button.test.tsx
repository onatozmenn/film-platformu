import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ClearHistoryButton } from "./clear-history-button";

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockReset();
});

describe("ClearHistoryButton", () => {
  it("requires confirmation and refreshes the server view after success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ClearHistoryButton />);

    await user.click(screen.getByRole("button", { name: "Geçmişi temizle" }));
    const dialog = screen.getByRole("dialog", { name: "İzleme geçmişini temizle" });
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Geçmişi temizle" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/progress", { method: "DELETE" });
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open with safe copy when deletion fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    render(<ClearHistoryButton />);

    await user.click(screen.getByRole("button", { name: "Geçmişi temizle" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Geçmişi temizle" }),
    );

    expect(screen.getByText("İzleme geçmişi temizlenemedi.")).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
