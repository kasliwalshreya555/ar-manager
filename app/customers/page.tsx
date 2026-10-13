
import Link from "next/link";
import { loadArData } from "@/lib/ar/load";
import { customerPositions } from "@/lib/ar/positions";
import { money, balance } from "@/lib/format";
import { asOfDate } from "@/lib/asof";

export const dynamic = "force-dynamic";

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
            <h1>Customers</h1>
            <p className="muted">
              Customer balances and credit exposure as of {asof}
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
          <table>
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
                <tr key={p.customer.id}>
                  <td>
                    <Link
                      href={`/customers/${p.customer.id}?asof=${asof}`}
                    >
                      <strong>{p.customer.name}</strong>
                    </Link>
                    <div className="muted">{p.customer.code}</div>
                  </td>
                  <td>{p.customer.city}</td>
                  <td className="num">{money(p.outstanding)}</td>
                  <td className="num">{money(p.unapplied)}</td>
                  <td className="num">{balance(p.netBalance)}</td>
                  <td>
                    {p.overLimit ? (
                      <span className="tag red">Over limit</span>
                    ) : p.customer.isActive ? (
                      <span className="tag">Active</span>
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
