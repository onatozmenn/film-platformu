"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { HomeRailView } from "../application/catalog-query-port";
import { MoviePosterItem } from "./movie-poster-item";

type RailState = Readonly<{ canMoveBack: boolean; canMoveForward: boolean }>;

export function MovieRail({ rail }: Readonly<{ rail: HomeRailView }>) {
  const railRef = useRef<HTMLDivElement>(null);
  const [railState, setRailState] = useState<RailState>({
    canMoveBack: false,
    canMoveForward: false,
  });

  useEffect(() => {
    const element = railRef.current;
    if (element === null) {
      return;
    }

    const update = () => {
      const maximum = element.scrollWidth - element.clientWidth;
      setRailState({
        canMoveBack: element.scrollLeft > 1,
        canMoveForward: maximum > 1 && element.scrollLeft < maximum - 1,
      });
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const frame = window.requestAnimationFrame(update);
    resizeObserver?.observe(element);
    element.addEventListener("scroll", update, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  const move = (direction: -1 | 1) => {
    const element = railRef.current;
    if (element === null) {
      return;
    }

    element.scrollBy({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      left: direction * Math.max(176, element.clientWidth * 0.8),
    });
  };

  return (
    <section className="catalog-section" aria-labelledby={`rail-${rail.id}`}>
      <div className="catalog-section__inner">
        <div className="catalog-section__heading">
          <h2 id={`rail-${rail.id}`}>{rail.title}</h2>
          <div className="catalog-section__actions">
            {rail.viewAllHref === null ? null : <Link href={rail.viewAllHref}>Tümünü gör</Link>}
            <div className="rail-controls" aria-label={`${rail.title} gezinme kontrolleri`}>
              <button
                aria-label="Önceki filmler"
                disabled={!railState.canMoveBack}
                type="button"
                onClick={() => move(-1)}
              >
                <ChevronLeft aria-hidden="true" size={20} strokeWidth={2} />
              </button>
              <button
                aria-label="Sonraki filmler"
                disabled={!railState.canMoveForward}
                type="button"
                onClick={() => move(1)}
              >
                <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
        <div className="film-rail" ref={railRef} data-testid={`rail-${rail.id}`}>
          {rail.movies.map((movie, index) => (
            <MoviePosterItem
              eager={index === 0}
              movie={movie}
              key={movie.id}
              {...(rail.variant === "ranked" ? { rank: index + 1 } : {})}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
