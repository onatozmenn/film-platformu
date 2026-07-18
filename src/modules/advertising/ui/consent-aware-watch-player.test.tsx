import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { playMux } = vi.hoisted(() => ({ playMux: vi.fn(async () => undefined) }));

vi.mock("@mux/mux-player-react", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  type MockPlayer = Readonly<{ play: () => Promise<void>; readyState: number }>;
  type MockProps = Readonly<{
    adTagUrl?: string;
    autoPlay?: boolean;
    children?: ReactNode;
    onCanPlay?: () => void;
    playbackId?: string;
    src?: string | null;
  }>;

  return {
    default: forwardRef<MockPlayer, MockProps>(function MockMuxPlayer(
      { adTagUrl, autoPlay, children, onCanPlay, playbackId, src },
      ref,
    ) {
      useImperativeHandle(ref, () => ({ play: playMux, readyState: 1 }));
      return (
        <button
          data-ad-tag-url={adTagUrl}
          data-autoplay={String(autoPlay)}
          data-playback-id={playbackId}
          data-src={src}
          data-track-count={Children.count(children)}
          data-testid="mux-player"
          type="button"
          onClick={onCanPlay}
        >
          Test player
        </button>
      );
    }),
  };
});

import { ConsentAwareWatchPlayer } from "./consent-aware-watch-player";

const movieId = "00000000-0000-4000-8000-000000000001";
const successfulPayload = {
  data: {
    advertising: null,
    movie: { durationSeconds: 5_880, id: movieId, title: "Kıyıdaki Sessizlik" },
    playback: {
      expiresAt: "2026-07-19T12:05:00.000Z",
      fixtureSourceUrl: "/fixtures/playback/guest-feature.mp4",
      fixtureTextTracks: [
        {
          default: true,
          kind: "captions",
          label: "Türkçe",
          languageTag: "tr",
          src: "/fixtures/playback/guest-feature-tr.vtt",
        },
      ],
      playbackId: "fake-playback-kiyidaki-sessizlik",
      provider: "mux",
      token: "fake_ps_opaque",
    },
    resumeAtSeconds: 0,
    sessionId: "ps_opaque",
  },
};
const adPayload = {
  data: {
    ...successfulPayload.data,
    advertising: {
      fixtureScenario: "error",
      personalized: false,
      placement: "preroll",
      provider: "google-ima",
      tagUrl: "https://pubads.g.doubleclick.net/gampad/ads?iu=test&npa=1",
    },
  },
};
const googleImaPayload = {
  data: {
    ...successfulPayload.data,
    advertising: {
      personalized: false,
      placement: "preroll",
      provider: "google-ima",
      tagUrl: "https://pubads.g.doubleclick.net/gampad/ads?iu=test&npa=1",
    },
  },
};

function jsonResponse(body: unknown, status: number, requestId: string = "req_watch") {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
    status,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  playMux.mockClear();
  Reflect.deleteProperty(window, "google");
  document
    .querySelectorAll('script[data-film-google-ima="true"]')
    .forEach((script) => script.remove());
});

describe("ConsentAwareWatchPlayer", () => {
  it("loads the fake source without autoplay or token persistence", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(successfulPayload, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ConsentAwareWatchPlayer movieId={movieId} title="Kıyıdaki Sessizlik" />);

    const player = await screen.findByTestId("mux-player");
    expect(player).toHaveAttribute("data-src", "/fixtures/playback/guest-feature.mp4");
    expect(player).toHaveAttribute("data-autoplay", "false");
    expect(player).toHaveAttribute("data-track-count", "1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/playback/sessions",
      expect.objectContaining({
        body: JSON.stringify({ movieId }),
        cache: "no-store",
        method: "POST",
      }),
    );
    expect(JSON.stringify(localStorage)).not.toContain("fake_ps_opaque");
    expect(JSON.stringify(sessionStorage)).not.toContain("fake_ps_opaque");
    expect(document.querySelector('script[data-film-google-ima="true"]')).toBeNull();

    fireEvent.click(player);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("runs one fixture preroll and hands off without requesting another session", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse(adPayload, 200),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ConsentAwareWatchPlayer movieId={movieId} title="Kıyıdaki Sessizlik" />);

    const start = await screen.findByRole("button", { name: "Filmi başlat" });
    expect(screen.getByTestId("mux-player")).not.toHaveAttribute("data-ad-tag-url");
    fireEvent.click(start);

    await waitFor(() => expect(playMux).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/advertising/outcomes",
        expect.objectContaining({
          body: JSON.stringify({ outcome: "error", sessionId: "ps_opaque" }),
          method: "POST",
        }),
      ),
    );
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/v1/playback/sessions"),
    ).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Yeniden dene" })).not.toBeInTheDocument();
    expect(document.querySelector('script[data-film-google-ima="true"]')).toBeNull();
  });

  it("rejects an arbitrary ad tag before loading optional ad code", async () => {
    const payload = {
      data: {
        ...successfulPayload.data,
        advertising: {
          ...adPayload.data.advertising,
          tagUrl: "https://attacker.example/vast",
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(payload, 200)),
    );

    render(<ConsentAwareWatchPlayer movieId={movieId} title="Kıyıdaki Sessizlik" />);

    expect(await screen.findByRole("button", { name: "Yeniden dene" })).toBeVisible();
    expect(document.querySelector('script[data-film-google-ima="true"]')).toBeNull();
  });

  it("rejects a tag whose non-personalized mode contradicts the response", async () => {
    const payload = {
      data: {
        ...successfulPayload.data,
        advertising: {
          ...googleImaPayload.data.advertising,
          personalized: true,
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(payload, 200)),
    );

    render(<ConsentAwareWatchPlayer movieId={movieId} title="Kıyıdaki Sessizlik" />);

    expect(await screen.findByRole("button", { name: "Yeniden dene" })).toBeVisible();
    expect(document.querySelector('script[data-film-google-ima="true"]')).toBeNull();
  });

  it("hands a consent-approved tag to the managed Mux IMA integration", async () => {
    Reflect.set(window, "google", { ima: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(googleImaPayload, 200)),
    );

    render(<ConsentAwareWatchPlayer movieId={movieId} title="Kıyıdaki Sessizlik" />);

    await expect(screen.findByRole("button", { name: "Filmi başlat" })).resolves.toBeVisible();
    expect(screen.getByTestId("mux-player")).toHaveAttribute(
      "data-ad-tag-url",
      "https://pubads.g.doubleclick.net/gampad/ads?iu=test&npa=1",
    );
    expect(document.querySelector('script[data-film-google-ima="true"]')).toBeNull();
  });

  it("renders a stable policy denial without an automatic or manual retry", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          code: "PLAYBACK_NOT_AVAILABLE",
          requestId: "req_denied",
        },
        403,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ConsentAwareWatchPlayer movieId={movieId} title="Kıyıdaki Sessizlik" />);

    expect(await screen.findByText("Bu film şu anda oynatılamıyor")).toBeVisible();
    expect(screen.getByText("Destek kodu: req_denied")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Yeniden dene" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("recovers from a provider failure only after the user requests a retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ code: "PROVIDER_UNAVAILABLE", requestId: "req_provider" }, 503),
      )
      .mockResolvedValueOnce(jsonResponse(successfulPayload, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ConsentAwareWatchPlayer movieId={movieId} title="Kıyıdaki Sessizlik" />);

    const retry = await screen.findByRole("button", { name: "Yeniden dene" });
    expect(fetchMock).toHaveBeenCalledOnce();
    fireEvent.click(retry);

    expect(await screen.findByTestId("mux-player")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("offers retry when a session request reaches the eight-second timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    render(<ConsentAwareWatchPlayer movieId={movieId} title="Kıyıdaki Sessizlik" />);
    await act(() => vi.advanceTimersByTimeAsync(8_000));

    expect(screen.getByRole("button", { name: "Yeniden dene" })).toBeVisible();
  });
});
