
import Link from "next/link";
import { loadArData } from "@/lib/ar/load";
import { customerPositions } from "@/lib/ar/positions";
import { money, balance, dateLabel } from "@/lib/format";
import { asOfDate } from "@/lib/asof";

export const dynamic = "force-dynamic";

/** Up to two initials for the avatar circle, e.g. "Tamhini Foods Pvt. Ltd." → "TF". */
function initials(name: string) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ asof?: string }>;
}) {
  const asof = asOfDate((await searchParams).asof);

  try {
    const data = await loadArData();
    const positions = customerPositions(data, asof);

    return (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="muted" style={{ marginTop: 4 }}>
              Customer balances and credit exposure as of {dateLabel(asof)}
            </p>
          </div>

          <Link
            className="button primary"
            href={`/customers/new?asof=${asof}`}
          >
            + Add customer
          </Link>
        </div>

        <section
          className="card"
          style={{ marginTop: 15, padding: 0, overflowX: "auto" }}
        >
          <table className="customers-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>City</th>
                <th className="num">Outstanding</th>
                <th className="num">Unapplied credit</th>
                <th className="num">Net balance</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {positions.map((p) => (
                <tr key={p.customer.id} className={p.customer.isActive ? undefined : "inactive"}>
                  <td>
                    <Link
                      className="customer-cell"
                      href={`/customers/${p.customer.id}?asof=${asof}`}
                    >
                      <span className="avatar">{initials(p.customer.name)}</span>
                      <span>
                        <strong>{p.customer.name}</strong>
                        <span className="code-pill">{p.customer.code}</span>
                      </span>
                    </Link>
                  </td>
                  <td>{p.customer.city}</td>
                  <td className={p.outstanding === 0 ? "num zero" : "num"}>{money(p.outstanding)}</td>
                  <td className={p.unapplied === 0 ? "num zero" : "num credit"}>{money(p.unapplied)}</td>
                  <td className={p.netBalance === 0 ? "num zero" : p.netBalance < 0 ? "num strong cr" : "num strong"}>
                    {balance(p.netBalance)}
                  </td>
                  <td>
                    {p.overLimit ? (
                      <span className="tag red">Over limit</span>
                    ) : p.customer.isActive ? (
                      <span className="tag green">Active</span>
                    ) : (
                      <span className="tag">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}

              {positions.length === 0 ? (
                <tr>
                  <td colSpan={6}>No customers found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </>
    );
  } catch (e) {
    return (
      <div className="card" role="alert">
        {e instanceof Error ? e.message : "Could not load customers"}
      </div>
    );
  }
}
