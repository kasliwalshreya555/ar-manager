import Link from "next/link";
import { loadArData } from "@/lib/ar/load";
import { searchAr, type SearchKind } from "@/lib/ar/search";
import { asOfDate } from "@/lib/asof";

export const dynamic = "force-dynamic";

const kinds: SearchKind[] = ["Customer", "Invoice", "Receipt", "Follow-up"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ asof?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const asof = asOfDate(sp.asof);
  const q = (sp.q ?? "").trim();

  try {
    const results = q ? searchAr(await loadArData(), q, asof) : [];
    return (
      <>
        <h1 style={{ marginBottom: 4 }}>Search results</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {q ? (
            <>
              {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
            </>
          ) : (
            "Type in the search box at the top to search customers, invoices, receipts and follow-ups."
          )}
        </p>
        {kinds.map((kind) => {
          const group = results.filter((r) => r.kind === kind);
          if (!group.length) return null;
          return (
            <section className="card" key={kind} style={{ marginTop: 15, padding: 0, overflow: "hidden" }}>
              <h2 style={{ fontSize: 16, margin: 0, padding: 16 }}>
                {kind}s <span className="muted" style={{ fontWeight: 400 }}>({group.length})</span>
              </h2>
              <ul className="search-list">
                {group.map((r) => (
                  <li key={r.key}>
                    <Link href={r.href}>{r.title}</Link>
                    <div className="muted">{r.subtitle}</div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {q && results.length === 0 ? (
          <div className="card" style={{ marginTop: 15 }}>
            No matches. Try a customer name, invoice or receipt number, amount, email or a word from a note.
          </div>
        ) : null}
      </>
    );
  } catch (e) {
    return <div className="card">{e instanceof Error ? e.message : "Search failed"}</div>;
  }
}
