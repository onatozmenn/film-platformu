import { afterEach, describe, expect, it, vi } from "vitest";

import { playFakePreroll } from "./fake-preroll-client";

afterEach(() => vi.useRealTimers());

describe("fake preroll client", () => {
  it.each(["blocked", "empty", "error"] as const)(
    "returns the deterministic %s path without rendering",
    async (scenario) => {
      const container = document.createElement("div");

      await expect(
        playFakePreroll({ container, scenario, signal: new AbortController().signal }),
      ).resolves.toBe(scenario);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("renders and cleans up the completed fixture", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const result = playFakePreroll(
      { container, scenario: "completed", signal: new AbortController().signal },
      800,
    );

    expect(container).toHaveTextContent("Kısa gösterim");
    await vi.advanceTimersByTimeAsync(800);

    await expect(result).resolves.toBe("completed");
    expect(container).toBeEmptyDOMElement();
  });

  it("cleans up and returns timeout when aborted", async () => {
    const container = document.createElement("div");
    const controller = new AbortController();
    const result = playFakePreroll({ container, scenario: "timeout", signal: controller.signal });

    controller.abort();

    await expect(result).resolves.toBe("timeout");
    expect(container).toBeEmptyDOMElement();
  });
});
