import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PublicError from "./error";

describe("PublicError", () => {
  it("uses safe Turkish copy and invokes the retry boundary", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<PublicError reset={reset} />);

    expect(screen.getByRole("heading", { name: "Program şu anda açılamıyor" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Yeniden dene" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
