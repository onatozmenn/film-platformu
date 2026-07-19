"use client";

import { Bookmark, BookmarkCheck, Star, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { formatNumber } from "@/shared/i18n/formatters";

import type { MemberMovieState } from "../application/library-ports";

async function mutateLibrary(
  path: string,
  method: "DELETE" | "PUT",
  body?: Readonly<Record<string, number>>,
): Promise<boolean> {
  try {
    const response = await fetch(path, {
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }),
      method,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function MemberLibraryControls({
  initialState,
  movieId,
}: Readonly<{ initialState: MemberMovieState | null; movieId: string }>) {
  const ratingId = useId();
  const [inWatchlist, setInWatchlist] = useState(initialState?.inWatchlist ?? false);
  const [ratingHalfStars, setRatingHalfStars] = useState(initialState?.ratingHalfStars ?? null);
  const [draftRating, setDraftRating] = useState(initialState?.ratingHalfStars ?? 1);
  const [pendingAction, setPendingAction] = useState<"rating" | "watchlist" | null>(null);
  const [status, setStatus] = useState("");

  if (initialState === null) {
    return (
      <div className="member-library-controls" aria-label="Üye kütüphanesi">
        <Link className="secondary-action" href="/giris">
          <Bookmark aria-hidden="true" size={18} strokeWidth={2} />
          Listeme ekle
        </Link>
        <Link className="ghost-action" href="/giris">
          <Star aria-hidden="true" size={18} strokeWidth={2} />
          Puan ver
        </Link>
      </div>
    );
  }

  const updateWatchlist = async () => {
    if (pendingAction !== null) {
      return;
    }
    const previous = inWatchlist;
    const next = !previous;
    setInWatchlist(next);
    setPendingAction("watchlist");
    setStatus("");
    const saved = await mutateLibrary(`/api/v1/me/watchlist/${movieId}`, next ? "PUT" : "DELETE");
    if (!saved) {
      setInWatchlist(previous);
      setStatus("Liste değişikliği kaydedilemedi.");
    }
    setPendingAction(null);
  };

  const saveRating = async (valueHalfStars: number) => {
    if (pendingAction !== null || valueHalfStars === ratingHalfStars) {
      return;
    }
    const previous = ratingHalfStars;
    setRatingHalfStars(valueHalfStars);
    setPendingAction("rating");
    setStatus("");
    const saved = await mutateLibrary(`/api/v1/me/ratings/${movieId}`, "PUT", {
      valueHalfStars,
    });
    if (!saved) {
      setRatingHalfStars(previous);
      setDraftRating(previous ?? 1);
      setStatus("Puanınız kaydedilemedi.");
    }
    setPendingAction(null);
  };

  const removeRating = async () => {
    if (pendingAction !== null || ratingHalfStars === null) {
      return;
    }
    const previous = ratingHalfStars;
    setRatingHalfStars(null);
    setDraftRating(1);
    setPendingAction("rating");
    setStatus("");
    const saved = await mutateLibrary(`/api/v1/me/ratings/${movieId}`, "DELETE");
    if (!saved) {
      setRatingHalfStars(previous);
      setDraftRating(previous);
      setStatus("Puanınız kaldırılamadı.");
    }
    setPendingAction(null);
  };

  const displayRating = ratingHalfStars === null ? null : ratingHalfStars / 2;

  return (
    <div className="member-library-controls" aria-label="Üye kütüphanesi">
      <button
        aria-pressed={inWatchlist}
        className="secondary-action"
        disabled={pendingAction !== null}
        type="button"
        onClick={() => void updateWatchlist()}
      >
        {inWatchlist ? (
          <BookmarkCheck aria-hidden="true" size={18} strokeWidth={2} />
        ) : (
          <Bookmark aria-hidden="true" size={18} strokeWidth={2} />
        )}
        {inWatchlist ? "Listemde" : "Listeme ekle"}
      </button>

      <div className="member-rating-control">
        <label htmlFor={ratingId}>Puanınız</label>
        <div className="member-rating-input">
          <input
            aria-valuetext={
              ratingHalfStars === null
                ? "Henüz puan verilmedi"
                : `${formatNumber(draftRating / 2)} yıldız`
            }
            disabled={pendingAction !== null}
            id={ratingId}
            max="10"
            min="1"
            step="1"
            type="range"
            value={draftRating}
            onBlur={(event) => void saveRating(Number(event.currentTarget.value))}
            onChange={(event) => setDraftRating(Number(event.currentTarget.value))}
            onKeyUp={(event) => void saveRating(Number(event.currentTarget.value))}
            onPointerUp={(event) => void saveRating(Number(event.currentTarget.value))}
          />
          <span className="member-rating-stars" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((star) => {
              const fill = Math.max(0, Math.min(2, draftRating - (star - 1) * 2)) * 50;
              return (
                <span className="member-rating-star" key={star}>
                  <Star size={22} strokeWidth={1.8} />
                  <span style={{ width: `${fill}%` }}>
                    <Star fill="currentColor" size={22} strokeWidth={1.8} />
                  </span>
                </span>
              );
            })}
          </span>
        </div>
        <output htmlFor={ratingId}>
          {displayRating === null ? "Puan yok" : `${formatNumber(displayRating)} / 5`}
        </output>
        {ratingHalfStars === null ? null : (
          <button
            aria-label="Puanı kaldır"
            className="icon-button"
            disabled={pendingAction !== null}
            title="Puanı kaldır"
            type="button"
            onClick={() => void removeRating()}
          >
            <X aria-hidden="true" size={17} strokeWidth={2} />
          </button>
        )}
      </div>
      <p className="member-library-status" role="status">
        {status}
      </p>
    </div>
  );
}
