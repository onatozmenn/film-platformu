import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addToWatchlist: vi.fn(),
  clearAllProgress: vi.fn(),
  clearProgress: vi.fn(),
  consume: vi.fn(),
  getOptionalMemberSession: vi.fn(),
  removeFromWatchlist: vi.fn(),
  removeRating: vi.fn(),
  run: vi.fn(),
  setRating: vi.fn(),
  updateProgress: vi.fn(),
}));

vi.mock("@/modules/identity/server", () => ({
  getOptionalMemberSession: mocks.getOptionalMemberSession,
}));
vi.mock("@/modules/library/server", () => ({
  libraryService: {
    addToWatchlist: mocks.addToWatchlist,
    clearAllProgress: mocks.clearAllProgress,
    clearProgress: mocks.clearProgress,
    removeFromWatchlist: mocks.removeFromWatchlist,
    removeRating: mocks.removeRating,
    setRating: mocks.setRating,
    updateProgress: mocks.updateProgress,
  },
  progressWriteCoalescer: { run: mocks.run },
  progressWriteRateLimiter: { consume: mocks.consume },
}));
vi.mock("@/shared/config/server-environment", () => ({
  getServerEnvironment: () => ({ siteOrigin: "https://film.example" }),
}));

import {
  DELETE as deleteProgress,
  PUT as putProgress,
} from "@/app/api/v1/me/progress/[movieId]/route";
import { DELETE as deleteAllProgress } from "@/app/api/v1/me/progress/route";
import { DELETE as deleteRating, PUT as putRating } from "@/app/api/v1/me/ratings/[movieId]/route";
import {
  DELETE as deleteWatchlist,
  PUT as putWatchlist,
} from "@/app/api/v1/me/watchlist/[movieId]/route";

const movieId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ movieId }) };

function request(method: "DELETE" | "PUT", body?: unknown) {
  return new NextRequest(`https://film.example/api/v1/me/library/${movieId}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      host: "film.example",
      origin: "https://film.example",
      "x-request-id": "req_member_route",
    },
    method,
  });
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }
  mocks.getOptionalMemberSession.mockResolvedValue({
    expires: "2026-08-18T00:00:00.000Z",
    user: { displayName: "Film üyesi", id: userId, roles: ["MEMBER"] },
  });
  mocks.addToWatchlist.mockResolvedValue({ kind: "success" });
  mocks.clearAllProgress.mockResolvedValue({ kind: "success" });
  mocks.clearProgress.mockResolvedValue({ kind: "success" });
  mocks.removeFromWatchlist.mockResolvedValue({ kind: "success" });
  mocks.removeRating.mockResolvedValue({ kind: "success" });
  mocks.setRating.mockResolvedValue({ kind: "success" });
  mocks.updateProgress.mockResolvedValue({ kind: "success" });
  mocks.consume.mockReturnValue(true);
  mocks.run.mockImplementation(async (_key, _observedAt, write: () => Promise<unknown>) => write());
});

describe("member library routes", () => {
  it("composes idempotent watchlist commands from the session actor", async () => {
    await expect(putWatchlist(request("PUT"), context)).resolves.toMatchObject({ status: 204 });
    await expect(deleteWatchlist(request("DELETE"), context)).resolves.toMatchObject({
      status: 204,
    });
    const command = { actorUserId: userId, movieId, ownerUserId: userId };
    expect(mocks.addToWatchlist).toHaveBeenCalledWith(command);
    expect(mocks.removeFromWatchlist).toHaveBeenCalledWith(command);
  });

  it("accepts only an integer half-star payload and composes rating removal", async () => {
    await expect(putRating(request("PUT", { valueHalfStars: 8 }), context)).resolves.toMatchObject({
      status: 204,
    });
    await expect(
      putRating(request("PUT", { userId: "other", valueHalfStars: 8 }), context),
    ).resolves.toMatchObject({ status: 400 });
    await expect(deleteRating(request("DELETE"), context)).resolves.toMatchObject({ status: 204 });
    expect(mocks.setRating).toHaveBeenCalledWith({
      actorUserId: userId,
      movieId,
      ownerUserId: userId,
      valueHalfStars: 8,
    });
    expect(mocks.removeRating).toHaveBeenCalledWith({
      actorUserId: userId,
      movieId,
      ownerUserId: userId,
    });
  });

  it("coalesces and rate-limits progress by the session user and film", async () => {
    const observedAt = "2026-07-19T12:00:00.000Z";
    const response = await putProgress(
      request("PUT", { durationSeconds: 100, observedAt, positionSeconds: 50 }),
      context,
    );

    expect(response.status).toBe(204);
    expect(mocks.consume).toHaveBeenCalledWith(`${userId}:${movieId}`);
    expect(mocks.run).toHaveBeenCalledWith(
      `${userId}:${movieId}`,
      new Date(observedAt),
      expect.any(Function),
    );
    expect(mocks.updateProgress).toHaveBeenCalledWith({
      actorUserId: userId,
      durationSeconds: 100,
      movieId,
      observedAt: new Date(observedAt),
      ownerUserId: userId,
      positionSeconds: 50,
    });

    mocks.consume.mockReturnValueOnce(false);
    await expect(
      putProgress(
        request("PUT", { durationSeconds: 100, observedAt, positionSeconds: 60 }),
        context,
      ),
    ).resolves.toMatchObject({ status: 429 });
  });

  it("treats stale progress as accepted and clears history idempotently", async () => {
    mocks.updateProgress.mockResolvedValueOnce({ kind: "stale" });

    await expect(
      putProgress(
        request("PUT", {
          durationSeconds: 100,
          observedAt: "2026-07-19T12:00:00.000Z",
          positionSeconds: 50,
        }),
        context,
      ),
    ).resolves.toMatchObject({ status: 204 });
    await expect(deleteProgress(request("DELETE"), context)).resolves.toMatchObject({
      status: 204,
    });
    expect(mocks.clearProgress).toHaveBeenCalledWith({
      actorUserId: userId,
      movieId,
      ownerUserId: userId,
    });
    await expect(deleteAllProgress(request("DELETE"))).resolves.toMatchObject({ status: 204 });
    expect(mocks.clearAllProgress).toHaveBeenCalledWith({
      actorUserId: userId,
      ownerUserId: userId,
    });
  });

  it("maps application and provider failures without exposing details", async () => {
    mocks.addToWatchlist.mockResolvedValueOnce({ kind: "not-found" });
    await expect(putWatchlist(request("PUT"), context)).resolves.toMatchObject({ status: 404 });

    mocks.removeRating.mockRejectedValueOnce(new Error("database detail"));
    const response = await deleteRating(request("DELETE"), context);
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.not.toContain("database detail");
  });
});
