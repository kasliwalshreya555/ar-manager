"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SearchResult } from "@/lib/ar/search";

export function GlobalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const asof = searchParams.get("asof") ?? "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // Fetch quick results 200ms after typing stops; ignore responses for older queries.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&asof=${encodeURIComponent(asof)}`, { signal: controller.signal });
        const body = await res.json();
        setResults(body.results ?? []);
        setTotal(body.total ?? 0);
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, asof]);

  // Close when clicking outside; "/" or Ctrl+K focuses the box from anywhere.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    input.current?.blur();
    router.push(href);
  }

  const allResultsHref = `/search?q=${encodeURIComponent(query.trim())}${asof ? `&asof=${asof}` : ""}`;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && results[active]) go(results[active].href);
      else if (query.trim()) go(allResultsHref);
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div className="global-search no-print" ref={box}>
      <svg className="global-search-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        type="search"
        value={query}
        placeholder="Search customers, invoices, receipts, follow-ups…"
        aria-label="Search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <kbd className="global-search-kbd">/</kbd>
      {showPanel ? (
        <div className="global-search-panel" id="global-search-results" role="listbox">
          {loading && results.length === 0 ? <div className="global-search-empty">Searching…</div> : null}
          {!loading && results.length === 0 ? <div className="global-search-empty">No matches for “{query.trim()}”</div> : null}
          {results.map((r, i) => (
            <div key={r.key}>
              {i === 0 || results[i - 1].kind !== r.kind ? <div className="global-search-group">{r.kind}s</div> : null}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={i === active ? "global-search-item active" : "global-search-item"}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.href)}
              >
                <span className="global-search-title">{r.title}</span>
                <span className="global-search-sub">{r.subtitle}</span>
              </button>
            </div>
          ))}
          {results.length > 0 ? (
            <button type="button" className="global-search-all" onClick={() => go(allResultsHref)}>
              See all {total} result{total === 1 ? "" : "s"} →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
