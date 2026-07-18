import { afterEach, describe, expect, it, vi } from "vitest";

import { playFixturePreroll } from "./preroll-client";

afterEach(() => vi.useRealTimers());

describe("preroll client", () => {
  it("returns an immediate deterministic adapter outcome", async () => {
    const container = document.createElement("div");

    await expect(playFixturePreroll({ container, scenario: "error" })).resolves.toBe("error");
    expect(container).toBeEmptyDOMElement();
  });

  it("bounds an unresponsive fake and cleans its surface", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const result = playFixturePreroll({
      container,
      scenario: "timeout",
      timeoutMilliseconds: 100,
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBe("timeout");
    expect(container).toBeEmptyDOMElement();
  });
});
