import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PublicShell } from "./public-shell";

describe("PublicShell", () => {
  it("opens and closes the mobile menu with focus return", async () => {
    const user = userEvent.setup();
    render(
      <PublicShell siteName="Film Platform">
        <main id="ana-icerik">İçerik</main>
      </PublicShell>,
    );
    const trigger = screen.getByRole("button", { name: "Menü" });

    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Menü" })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Menü" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens a labeled GET search form and returns focus on Escape", async () => {
    const user = userEvent.setup();
    render(
      <PublicShell siteName="Film Platform">
        <main id="ana-icerik">İçerik</main>
      </PublicShell>,
    );
    const trigger = screen.getByRole("button", { name: "Ara" });

    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Film ara" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Film adı" })).toHaveAttribute("name", "q");
    expect(screen.getByRole("searchbox", { name: "Film adı" })).toHaveFocus();
    await user.type(screen.getByRole("searchbox", { name: "Film adı" }), "Kıyı");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(await screen.findByRole("searchbox", { name: "Film adı" })).toHaveValue("Kıyı");
  });
});
