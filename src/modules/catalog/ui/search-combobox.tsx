"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { CatalogImage, SearchSuggestion } from "../application/catalog-query-port";

type Suggestion = SearchSuggestion;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const slugPattern = /^[a-z0-9-]{1,96}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodePoster(value: unknown): CatalogImage | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error("Invalid suggestion poster");
  }

  const { alt, focalPosition, height, src, width } = value;
  if (
    typeof alt !== "string" ||
    typeof focalPosition !== "string" ||
    typeof height !== "number" ||
    !Number.isInteger(height) ||
    height <= 0 ||
    typeof src !== "string" ||
    typeof width !== "number" ||
    !Number.isInteger(width) ||
    width <= 0
  ) {
    throw new Error("Invalid suggestion poster");
  }

  return { alt, focalPosition, height, src, width };
}

function decodeSuggestion(value: unknown): Suggestion {
  if (!isRecord(value)) {
    throw new Error("Invalid suggestion");
  }

  const { id, kind, poster, slug, title, year } = value;
  if (
    typeof id !== "string" ||
    !uuidPattern.test(id) ||
    kind !== "movie" ||
    typeof slug !== "string" ||
    !slugPattern.test(slug) ||
    typeof title !== "string" ||
    title.length === 0 ||
    (year !== null && (typeof year !== "number" || !Number.isInteger(year)))
  ) {
    throw new Error("Invalid suggestion");
  }

  return {
    id,
    kind,
    poster: decodePoster(poster),
    slug,
    title,
    year,
  };
}

function decodeSuggestionPayload(value: unknown): readonly Suggestion[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error("Invalid suggestion payload");
  }

  return value.data.map(decodeSuggestion);
}

export function SearchCombobox({ initialQuery = "" }: Readonly<{ initialQuery?: string }>) {
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<readonly Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState(() =>
    [...initialQuery.trim()].length === 1 ? "Aramak için en az 2 karakter girin." : "",
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if ([...normalized].length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setStatus("Öneriler yükleniyor.");
      void fetch(`/api/v1/search/suggestions?q=${encodeURIComponent(normalized)}&limit=6`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Suggestion request failed");
          }
          return decodeSuggestionPayload(await response.json());
        })
        .then((nextSuggestions) => {
          setSuggestions(nextSuggestions);
          setActiveIndex(-1);
          setIsOpen(nextSuggestions.length > 0 && document.activeElement === inputRef.current);
          setStatus(
            nextSuggestions.length === 0
              ? "Eşleşen öneri yok."
              : `${nextSuggestions.length} öneri bulundu.`,
          );
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setSuggestions([]);
          setIsOpen(false);
          setStatus("Arama önerileri şu anda kullanılamıyor.");
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const activeSuggestion = activeIndex < 0 ? undefined : suggestions[activeIndex];

  return (
    <form className="combobox-form" action="/arama" method="get" role="search">
      <label htmlFor={`${listboxId}-input`}>Film veya kişi ara</label>
      <div className="combobox-form__row">
        <Search aria-hidden="true" size={20} strokeWidth={2} />
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          name="q"
          type="search"
          autoComplete="off"
          aria-activedescendant={
            activeSuggestion === undefined
              ? undefined
              : `${listboxId}-option-${activeSuggestion.id}`
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          role="combobox"
          maxLength={80}
          value={query}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            const nextQuery = event.currentTarget.value;
            const nextLength = [...nextQuery.trim()].length;
            setQuery(nextQuery);
            setSuggestions([]);
            setActiveIndex(-1);
            setIsOpen(false);
            setStatus(
              nextLength === 0
                ? ""
                : nextLength < 2
                  ? "Aramak için en az 2 karakter girin."
                  : "Öneriler yükleniyor.",
            );
          }}
          onFocus={() => setIsOpen(suggestions.length > 0)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && suggestions.length > 0) {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => (current + 1) % suggestions.length);
            } else if (event.key === "ArrowUp" && suggestions.length > 0) {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
            } else if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
              setActiveIndex(-1);
            } else if (event.key === "Enter" && activeSuggestion !== undefined) {
              event.preventDefault();
              router.push(`/film/${activeSuggestion.slug}`);
            }
          }}
        />
        <button className="primary-action" type="submit">
          Ara
        </button>
      </div>

      {isOpen ? (
        <ul className="suggestion-list" id={listboxId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              id={`${listboxId}-option-${suggestion.id}`}
              key={suggestion.id}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => router.push(`/film/${suggestion.slug}`)}
            >
              <span>{suggestion.title}</span>
              {suggestion.year === null ? null : <span>{suggestion.year}</span>}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="visually-hidden" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
