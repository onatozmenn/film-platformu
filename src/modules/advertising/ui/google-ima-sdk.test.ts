import { afterEach, describe, expect, it, vi } from "vitest";

import { createGoogleImaSdkLoader, googleImaSdkUrl } from "./google-ima-sdk";

afterEach(() => {
  vi.useRealTimers();
  document
    .querySelectorAll('script[data-film-google-ima="true"]')
    .forEach((script) => script.remove());
  Reflect.deleteProperty(window, "google");
});

describe("Google IMA SDK loader", () => {
  it("does not add a script when the official SDK is already available", async () => {
    Reflect.set(window, "google", { ima: {} });

    await expect(createGoogleImaSdkLoader({ document, window }).load()).resolves.toBe("ready");
    expect(document.querySelector(`[src="${googleImaSdkUrl}"]`)).toBeNull();
  });

  it("loads the fixed SDK origin once and verifies the global", async () => {
    const loader = createGoogleImaSdkLoader({ document, window });
    const result = loader.load();
    const script = document.querySelector<HTMLScriptElement>('script[data-film-google-ima="true"]');

    expect(script?.src).toBe(googleImaSdkUrl);
    expect(script?.crossOrigin).toBe("anonymous");
    Reflect.set(window, "google", { ima: {} });
    script?.dispatchEvent(new Event("load"));

    await expect(result).resolves.toBe("ready");
    await expect(loader.load()).resolves.toBe("ready");
    expect(document.querySelectorAll('script[data-film-google-ima="true"]')).toHaveLength(1);
  });

  it("maps a blocked script and a missing post-load global to blocked", async () => {
    const blockedLoader = createGoogleImaSdkLoader({ document, window });
    const blocked = blockedLoader.load();
    document
      .querySelector<HTMLScriptElement>('script[data-film-google-ima="true"]')
      ?.dispatchEvent(new Event("error"));

    await expect(blocked).resolves.toBe("blocked");

    const missingGlobalLoader = createGoogleImaSdkLoader({ document, window });
    const missingGlobal = missingGlobalLoader.load();
    document
      .querySelector<HTMLScriptElement>('script[data-film-google-ima="true"]')
      ?.dispatchEvent(new Event("load"));

    await expect(missingGlobal).resolves.toBe("blocked");
  });

  it("times out and removes the incomplete script", async () => {
    vi.useFakeTimers();
    const result = createGoogleImaSdkLoader({ document, window }).load(100);

    await vi.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBe("timeout");
    expect(document.querySelector('script[data-film-google-ima="true"]')).toBeNull();
  });
});
