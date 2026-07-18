import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfflineNotice } from "./offline-notice";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfflineNotice", () => {
  it("preserves content and announces when the browser goes offline", () => {
    let isOnline = true;
    vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => isOnline);
    render(<OfflineNotice />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      isOnline = false;
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByRole("status")).toHaveTextContent("Çevrimdışısınız");
  });
});
