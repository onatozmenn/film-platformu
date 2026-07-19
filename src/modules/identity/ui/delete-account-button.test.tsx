import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh, replace } = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

import { DeleteAccountButton } from "./delete-account-button";

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockReset();
  replace.mockReset();
});

describe("DeleteAccountButton", () => {
  it("names the irreversible consequence before deletion and signs out after success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DeleteAccountButton />);

    await user.click(screen.getByRole("button", { name: "Hesabı sil" }));
    const dialog = screen.getByRole("dialog", { name: "Hesabı kalıcı olarak sil" });
    expect(within(dialog).getByText(/Bu işlem geri alınamaz/u)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Hesabı kalıcı olarak sil" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/account", { method: "DELETE" });
    expect(replace).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps final-admin and generic failures inside the confirmation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 409 })),
    );
    render(<DeleteAccountButton />);

    await user.click(screen.getByRole("button", { name: "Hesabı sil" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Hesabı kalıcı olarak sil" }));

    expect(screen.getByText("Son etkin yönetici hesabı silinemez.")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});
