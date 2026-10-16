import Link from "next/link";
import { loadArData } from "@/lib/ar/load";
import { customerPositions, BUCKETS, bucketLabel } from "@/lib/ar/positions";
import { balance, money, dateLabel } from "@/lib/format";
import { asOfDate } from "@/lib/asof";
import { AutoSubmitCheckbox } from "@/components/auto-submit-checkbox";

export const dynamic = "force-dynamic";

const buckets = BUCKETS;

export default async function AgeingReport({
  searchParams,
}: {
  searchParams: Promise<{ asof?: string; hideZero?: string }>;
}) {
  const q = await searchParams;
  const asof = asOfDate(q.asof);
  const hideZero = q.hideZero === "1";

  try {
    const data = await loadArData();
    const all = customerPositions(data, asof);
    const positions = hideZero
      ? all.filter((p) => p.outstanding !== 0 || p.unapplied !== 0)
      : all;

    const total = (pick: (p: (typeof all)[number]) => number) =>
      positions.reduce((s, p) => s + pick(p), 0);
    const statementYearStart = `${asof.slice(0, 4)}-04-01`;

    return (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ marginBottom: 4 }}>Ageing report</h1>
            <p className="muted" style={{ marginTop: 0 }}>
              Customer balances by days overdue, as at {dateLabel(asof)}
            </p>
          </div>
          <a className="button no-print" href={`/api/ageing.csv?asof=${asof}`}>
            Download ageing CSV
          </a>
        </div>

        <form
          className="no-print"
          method="get"
          style={{ margin: "4px 0 14px" }}
        >
          <input type="hidden" name="asof" value={asof} />
          <label
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              fontWeight: 400,
              cursor: "pointer",
              fontSize: 15,
              color: "var(--ink)",
              display: "inline-flex",
            }}
          >
            <AutoSubmitCheckbox
              key={String(hideZero)}
              name="hideZero"
              value="1"
              defaultChecked={hideZero}
            />
            Hide customers with zero balance
          </label>
        </form>

        <section className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                {buckets.map((b) => (
                  <th className="num" key={b}>
                    {bucketLabel(b)}
                  </th>
                ))}
                <th className="num">Unapplied credit</th>
                <th className="num">Net balance</th>
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.customer.id}>
                  <td>
                    <Link href={`/customers/${position.customer.id}?asof=${asof}`}>
                      {position.customer.code} · {position.customer.name}
                    </Link>
                  </td>
                  {buckets.map((bucket) => (
                    <td className="num" key={bucket}>
                      {money(position.buckets[bucket])}
                    </td>
                  ))}
                  <td className="num">{money(position.unapplied)}</td>
                  <td className="num">
                    <b>{balance(position.netBalance)}</b>
                  </td>
                  <td className="no-print">
                    <Link
                      href={`/statement?asof=${asof}&customer=${position.customer.id}&from=${statementYearStart}&to=${asof}`}
                    >
                      Statement →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total ({positions.length} customers)</th>
                {buckets.map((bucket) => (
                  <th className="num" key={bucket}>
                    {money(total((p) => p.buckets[bucket]))}
                  </th>
                ))}
                <th className="num">{money(total((p) => p.unapplied))}</th>
                <th className="num">{balance(total((p) => p.netBalance))}</th>
                <th className="no-print"></th>
              </tr>
            </tfoot>
          </table>
          {positions.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>
              No customers to show.
            </p>
          ) : null}
        </section>

        <p className="muted" style={{ fontSize: 12 }}>
          Unapplied credit is shown separately and is not netted into the ageing
          buckets. Click a customer to open their profile, or “Statement →” for
          their account statement.
        </p>
      </>
    );
  } catch (error) {
    return (
      <div className="card">
        {error instanceof Error ? error.message : "Failed to load ageing report"}
      </div>
    );
  }
}
