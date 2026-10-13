
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadArData } from "@/lib/ar/load";
import {
  customerPositions,
  invoicePositions,
  receiptPositions,
} from "@/lib/ar/positions";
import { money, balance, dateLabel } from "@/lib/format";
import { asOfDate } from "@/lib/asof";
import {
  AllocateCreditForm,
  CustomerActions,
} from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asof?: string }>;
}) {
  const { id } = await params;
  const asof = asOfDate((await searchParams).asof);

  try {
    const data = await loadArData();
    const customer = data.customers.find((c) => c.id === Number(id));

    if (!customer) return notFound();

    const position = customerPositions(data, asof).find(
      (p) => p.customer.id === customer.id,
    )!;

    const unappliedReceipts = receiptPositions(data, asof).filter(
      (p) =>
        p.receipt.customerId === customer.id &&
        p.unapplied > 0,
    );

    const openInvoices = invoicePositions(data, asof)
      .filter(
        (p) =>
          p.invoice.customerId === customer.id &&
          p.outstanding > 0,
      )
      .map((p) => p.invoice);

    return (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1>{customer.name}</h1>
            <p className="muted">
              {customer.code} · {customer.city}, {customer.state} ·{" "}
              {customer.email}
            </p>
          </div>

          <Link
            className="button"
            href={`/customers/${id}/edit?asof=${asof}`}
          >
            Edit customer
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            margin: "15px 0",
          }}
        >
          {[
            ["Net balance", balance(position.netBalance)],
            ["Outstanding", money(position.outstanding)],
            ["Unapplied credit", money(position.unapplied)],
            ["Overdue", money(position.overdue)],
          ].map(([label, value]) => (
            <div className="card" key={label}>
              <div className="muted">{label}</div>
              <h2>{value}</h2>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>Profile</h2>
          <p>
            {customer.contactPerson} · {customer.phone || "No phone"} ·
            Credit terms {customer.creditDays} days · Limit{" "}
            {money(customer.creditLimit)} · TDS {customer.tdsRatePct}%
          </p>

          <p>
            Ageing:{" "}
            {Object.entries(position.buckets)
              .map(([key, value]) => `${key}: ${money(value)}`)
              .join(" · ")}
          </p>

          {position.overLimit ? (
            <p className="tag red">Over credit limit</p>
          ) : null}

          <CustomerActions id={customer.id} active={customer.isActive} />
        </div>

        <section className="card" style={{ marginTop: 15 }}>
          <h2>Allocate unapplied credit</h2>
          <p className="muted">
            Select an existing receipt to apply its remaining credit to an
            open invoice. The allocation date determines when the invoice
            balance changes in historical reports.
          </p>

          {unappliedReceipts.length === 0 ? (
            <p className="muted">
              No unapplied receipt credit as of {dateLabel(asof)}.
            </p>
          ) : openInvoices.length === 0 ? (
            <p className="muted">
              There is no open invoice available for this customer.
            </p>
          ) : (
            unappliedReceipts.map((receiptPosition) => (
              <AllocateCreditForm
                key={receiptPosition.receipt.id}
                asof={asof}
                customerId={customer.id}
                receiptId={receiptPosition.receipt.id}
                receiptNo={receiptPosition.receipt.receiptNo}
                unappliedPaise={receiptPosition.unapplied}
                invoices={openInvoices}
              />
            ))
          )}
        </section>

        <section
          className="card"
          style={{ marginTop: 15, overflowX: "auto" }}
        >
          <h2>Invoices</h2>

          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Outstanding</th>
              </tr>
            </thead>

            <tbody>
              {position.invoices.map((item) => (
                <tr key={item.invoice.id}>
                  <td>
                    <Link
                      href={`/invoices/${item.invoice.id}?asof=${asof}`}
                    >
                      {item.invoice.invoiceNo}
                    </Link>
                  </td>
                  <td>{dateLabel(item.invoice.invoiceDate)}</td>
                  <td>{dateLabel(item.invoice.dueDate)}</td>
                  <td>{item.status}</td>
                  <td className="num">{money(item.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </>
    );
  } catch (e) {
    return (
      <div className="card">
        {e instanceof Error ? e.message : "Could not load customer"}
      </div>
    );
  }
}
