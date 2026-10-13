import Link from "next/link";
import { loadArData } from "@/lib/ar/load";
import { customerPositions } from "@/lib/ar/positions";
import { statement } from "@/lib/ar/statement";
import { balance, money, dateLabel } from "@/lib/format";
import { asOfDate } from "@/lib/asof";

export const dynamic = "force-dynamic";

type SearchParams = {
  asof?: string;
  customer?: string;
  from?: string;
  to?: string;
};

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default async function Statements({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const q = await searchParams;
  const asof = asOfDate(q.asof);

  try {
    const data = await loadArData();
    const positions = customerPositions(data, asof);

    const selectedCustomerId = Number(q.customer);
    const selectedCustomer = data.customers.find(
      (customer) =>
        Number.isFinite(selectedCustomerId) &&
        customer.id === selectedCustomerId
    );

    const defaultFrom = `${asof.slice(0, 4)}-04-01`;
    const from = q.from || defaultFrom;
    const to = q.to || asof;

    const validPeriod =
      /^\d{4}-\d{2}-\d{2}$/.test(from) &&
      /^\d{4}-\d{2}-\d{2}$/.test(to) &&
      from <= to;

    const result =
      selectedCustomer && validPeriod
        ? statement(data, selectedCustomer.id, from, to)
        : null;

    const statementCsv = result && selectedCustomer
      ? [
          ["Date", "Document", "Description", "Debit", "Credit", "Running balance"],
          [
            from,
            "OPENING",
            "Opening balance",
            result.openingBalance > 0 ? result.openingBalance / 100 : 0,
            result.openingBalance < 0 ? Math.abs(result.openingBalance) / 100 : 0,
            result.openingBalance / 100,
          ],
          ...result.lines.map((line) => [
            line.date,
            line.documentNo,
            line.description,
            line.debit / 100,
            line.credit / 100,
            line.runningBalance / 100,
          ]),
          [
            to,
            "CLOSING",
            "Closing balance",
            "",
            "",
            result.closingBalance / 100,
          ],
        ]
          .map((row) => row.map((value) => csvEscape(value)).join(","))
          .join("\r\n")
      : "";

    return (
      <>
        <div className="no-print">
          <h1>Statements &amp; reports</h1>
          <p className="muted">
            Ageing summary as at {dateLabel(asof)}
          </p>

          <form
            action="/statement"
            method="get"
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "end",
              marginBottom: 16,
            }}
          >
            <input type="hidden" name="asof" value={asof} />

            <label>
              Customer
              <select
                name="customer"
                defaultValue={q.customer || ""}
                required
              >
                <option value="" disabled>
                  Select customer
                </option>
                {data.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} · {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              From
              <input
                type="date"
                name="from"
                defaultValue={from}
                required
              />
            </label>

            <label>
              To
              <input
                type="date"
                name="to"
                defaultValue={to}
                required
              />
            </label>

            <button className="primary" type="submit">
              Open statement
            </button>

            <a className="button" href={`/api/ageing.csv?asof=${asof}`}>
              Ageing CSV
            </a>
          </form>
        </div>

        {!validPeriod ? (
          <div className="card">
            <p>Choose a valid statement period. The From date must not be after the To date.</p>
          </div>
        ) : null}

        <section className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Not due</th>
                <th className="num">1–30</th>
                <th className="num">31–60</th>
                <th className="num">61–90</th>
                <th className="num">91–180</th>
                <th className="num">Over 180</th>
                <th className="num">Unapplied credit</th>
                <th className="num">Net balance</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.customer.id}>
                  <td>
                    <Link
                      href={`/statement?asof=${asof}&customer=${position.customer.id}&from=${from}&to=${to}`}
                    >
                      {position.customer.code} · {position.customer.name}
                    </Link>
                  </td>
                  {(
                    ["Not due", "1-30", "31-60", "61-90", "91-180", "Over 180"] as const
                  ).map((bucket) => (
                    <td className="num" key={bucket}>
                      {money(position.buckets[bucket])}
                    </td>
                  ))}
                  <td className="num">{money(position.unapplied)}</td>
                  <td className="num">{balance(position.netBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {selectedCustomer && result ? (
          <section className="card" style={{ marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "start",
              }}
            >
              <div>
                <h2 style={{ marginTop: 0 }}>
                  Statement · {selectedCustomer.code}
                </h2>
                <p className="muted">
                  {selectedCustomer.name} · {dateLabel(from)} to {dateLabel(to)}
                </p>
              </div>

              <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  className="button"
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(statementCsv)}`}
                  download={`statement-${selectedCustomer.code}-${from}-to-${to}.csv`}
                >
                  Download statement CSV
                </a>
                <button type="button" onClick={undefined} className="button">
                  Print using browser menu
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div className="card">
                <div className="muted">Opening balance</div>
                <h3>{balance(result.openingBalance)}</h3>
              </div>
              <div className="card">
                <div className="muted">Closing balance</div>
                <h3>{balance(result.closingBalance)}</h3>
              </div>
              <div className="card">
                <div className="muted">Statement lines</div>
                <h3>{result.lines.length}</h3>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Document</th>
                    <th>Description</th>
                    <th className="num">Debit</th>
                    <th className="num">Credit</th>
                    <th className="num">Running balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{dateLabel(from)}</td>
                    <td>OPENING</td>
                    <td>Opening balance</td>
                    <td className="num">
                      {result.openingBalance > 0
                        ? money(result.openingBalance)
                        : "—"}
                    </td>
                    <td className="num">
                      {result.openingBalance < 0
                        ? money(Math.abs(result.openingBalance))
                        : "—"}
                    </td>
                    <td className="num">{balance(result.openingBalance)}</td>
                  </tr>

                  {result.lines.map((line, index) => (
                    <tr key={`${line.date}-${line.documentNo}-${line.kind}-${index}`}>
                      <td>{dateLabel(line.date)}</td>
                      <td>{line.documentNo}</td>
                      <td>{line.description}</td>
                      <td className="num">
                        {line.debit ? money(line.debit) : "—"}
                      </td>
                      <td className="num">
                        {line.credit ? money(line.credit) : "—"}
                      </td>
                      <td className="num">{balance(line.runningBalance)}</td>
                    </tr>
                  ))}

                  <tr>
                    <td>{dateLabel(to)}</td>
                    <td>CLOSING</td>
                    <td>Closing balance</td>
                    <td className="num">—</td>
                    <td className="num">—</td>
                    <td className="num">{balance(result.closingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="muted">
              Debit balances represent amounts receivable. Receipt bank amounts
              and TDS are displayed as separate credits.
            </p>
          </section>
        ) : q.customer ? (
          <div className="card" style={{ marginTop: 16 }}>
            Select a valid customer and statement period to view transactions.
          </div>
        ) : null}

        <div className="no-print muted" style={{ marginTop: 15 }}>
          Use your browser&apos;s Print command to print this report.
        </div>
      </>
    );
  } catch (error) {
    return (
      <div className="card">
        {error instanceof Error ? error.message : "Failed to load reports"}
      </div>
    );
  }
}