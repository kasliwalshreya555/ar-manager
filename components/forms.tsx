
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  allocateReceiptCredit,
  createCreditNote,
  createInvoice,
  createNote,
  createReceipt,
  saveCustomer,
  updateCustomer,
  setCustomerActive,
  setInvoiceDisputed,
  cancelInvoice,
  markFollowUpDone,
} from "@/lib/actions";
import type { Customer, Invoice } from "@/lib/ar/types";

function Result({ message }: { message: string }) {
  return (
    <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>
      {message}
    </p>
  );
}

function rupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function CustomerForm({
  asof,
  customer,
}: {
  asof: string;
  customer?: Customer;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(f: FormData) {
    setBusy(true);
    setError("");
    const r = customer
      ? await updateCustomer(customer.id, f)
      : await saveCustomer(f);
    setBusy(false);

    if (!r.ok) {
      setError(r.message);
      return;
    }

    router.push(`/customers?asof=${asof}`);
    router.refresh();
  }

  return (
    <form
      action={submit}
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
        gap: 14,
      }}
    >
      {(
        [
          ["code", "Customer code", customer?.code || ""],
          ["name", "Name", customer?.name || ""],
          ["city", "City", customer?.city || ""],
          ["state", "State", customer?.state || "Maharashtra"],
          ["contact_person", "Contact person", customer?.contactPerson || ""],
          ["email", "Email", customer?.email || ""],
          ["phone", "Phone", customer?.phone || ""],
          ["gstin", "GSTIN (optional)", customer?.gstin || ""],
          ["credit_days", "Credit days", String(customer?.creditDays ?? 30)],
          [
            "credit_limit",
            "Credit limit",
            String((customer?.creditLimit ?? 0) / 100),
          ],
          [
            "tds_rate_pct",
            "TDS rate %",
            String(customer?.tdsRatePct ?? 0),
          ],
        ] as const
      ).map(([name, label, value]) => (
        <label key={name}>
          {label}
          <input
            name={name}
            required={!["phone", "gstin"].includes(name)}
            defaultValue={value}
            disabled={name === "code" && !!customer}
            type={
              name === "email"
                ? "email"
                : ["credit_days", "credit_limit", "tds_rate_pct"].includes(
                      name,
                    )
                  ? "number"
                  : "text"
            }
            min={
              ["credit_days", "credit_limit", "tds_rate_pct"].includes(name)
                ? 0
                : undefined
            }
            max={name === "tds_rate_pct" ? 100 : undefined}
            step={
              name === "credit_limit" || name === "tds_rate_pct"
                ? ".01"
                : undefined
            }
          />
        </label>
      ))}

      <label>
        Active
        <select
          name="is_active"
          defaultValue={String(customer?.isActive ?? true)}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>

      {error ? (
        <div style={{ gridColumn: "1/-1" }}>
          <Result message={error} />
        </div>
      ) : null}

      <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save customer"}
        </button>
        <button type="button" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CustomerActions({
  id,
  active,
}: {
  id: number;
  active: boolean;
}) {
  const [message, setMessage] = useState("");
  const router = useRouter();

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        onClick={async () => {
          const r = await setCustomerActive(id, !active);
          setMessage(r.ok ? "Saved" : r.message);
          router.refresh();
        }}
      >
        {active ? "Deactivate" : "Reactivate"}
      </button>
      <button
        onClick={() => {
          location.href = `/receipts/new`;
        }}
      >
        Record payment
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}

export function InvoiceForm({
  asof,
  customers,
}: {
  asof: string;
  customers: Customer[];
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(f: FormData) {
    setBusy(true);
    setError("");
    const r = await createInvoice(f, asof);
    setBusy(false);

    if (!r.ok) {
      setError(r.message);
      return;
    }

    router.push(`/invoices?asof=${asof}`);
    router.refresh();
  }

  return (
    <form
      action={submit}
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: 14,
      }}
    >
      <label>
        Customer
        <select name="customer_id" required>
          {customers
            .filter((c) => c.isActive)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
        </select>
      </label>

      <label>
        Invoice date
        <input
          type="date"
          name="invoice_date"
          defaultValue={asof}
          max={asof}
          required
        />
      </label>

      <label>
        Taxable value
        <input
          type="number"
          name="taxable_value"
          min=".01"
          step=".01"
          required
        />
      </label>

      <label>
        GST rate %
        <input type="number" name="gst_rate_pct" value="18" readOnly />
      </label>

      <label style={{ gridColumn: "1/-1" }}>
        Description
        <input name="description" required />
      </label>

      {error ? (
        <div style={{ gridColumn: "1/-1" }}>
          <Result message={error} />
        </div>
      ) : null}

      <div>
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save invoice"}
        </button>
      </div>
    </form>
  );
}

type AllocationDraft = {
  invoiceId: number;
  amount: string;
};

export function ReceiptForm({
  asof,
  customers,
  invoices = [],
}: {
  asof: string;
  customers: Customer[];
  invoices?: Invoice[];
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [customerId, setCustomerId] = useState(
    String(customers.find((c) => c.isActive)?.id ?? ""),
  );
  const [receiptDate, setReceiptDate] = useState(asof);
  const [bankAmount, setBankAmount] = useState("");
  const [tdsAmount, setTdsAmount] = useState("0");
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const router = useRouter();

  const settlement = Math.round(
    (Math.max(0, Number(bankAmount) || 0) +
      Math.max(0, Number(tdsAmount) || 0)) *
      100,
  );

  const eligibleInvoices = useMemo(() => {
    return invoices
      .filter(
        (i) =>
          i.customerId === Number(customerId) &&
          !i.isCancelled &&
          i.invoiceDate <= receiptDate,
      )
      .sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate) ||
          a.invoiceNo.localeCompare(b.invoiceNo),
      );
  }, [invoices, customerId, receiptDate]);

  const allocationTotal = allocations.reduce(
    (sum, a) => sum + Math.round((Number(a.amount) || 0) * 100),
    0,
  );

  const unapplied = settlement - allocationTotal;

  function suggestAllocations() {
    let remaining = settlement;
    const next: AllocationDraft[] = [];

    for (const invoice of eligibleInvoices) {
      if (remaining <= 0) break;

      const amount = Math.min(remaining, Math.max(0, invoice.total));
      if (amount > 0) {
        next.push({
          invoiceId: invoice.id,
          amount: (amount / 100).toFixed(2),
        });
        remaining -= amount;
      }
    }

    setAllocations(next);
  }

  function updateAllocation(invoiceId: number, amount: string) {
    setAllocations((current) => {
      const exists = current.some((a) => a.invoiceId === invoiceId);
      if (!exists && amount !== "" && Number(amount) > 0) {
        return [...current, { invoiceId, amount }];
      }

      return current.map((a) =>
        a.invoiceId === invoiceId ? { ...a, amount } : a,
      );
    });
  }

  async function submit(f: FormData) {
    setBusy(true);
    setError("");

    f.set(
      "allocation_lines",
      JSON.stringify(
        allocations
          .filter((a) => Number(a.amount) > 0)
          .map((a) => ({
            invoiceId: a.invoiceId,
            amount: Number(a.amount),
          })),
      ),
    );

    const r = await createReceipt(f, asof);
    setBusy(false);

    if (!r.ok) {
      setError(r.message);
      return;
    }

    router.push(`/receipts?asof=${asof}`);
    router.refresh();
  }

  return (
    <form
      action={submit}
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
        gap: 14,
      }}
    >
      <label>
        Customer
        <select
          name="customer_id"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setAllocations([]);
          }}
          required
        >
          {customers
            .filter((c) => c.isActive)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
        </select>
      </label>

      <label>
        Receipt date
        <input
          name="receipt_date"
          type="date"
          value={receiptDate}
          max={asof}
          onChange={(e) => {
            setReceiptDate(e.target.value);
            setAllocations([]);
          }}
          required
        />
      </label>

      <label>
        Bank amount
        <input
          name="bank_amount"
          type="number"
          min="0"
          step=".01"
          value={bankAmount}
          onChange={(e) => setBankAmount(e.target.value)}
          required
        />
      </label>

      <label>
        TDS actually deducted
        <input
          name="tds_amount"
          type="number"
          min="0"
          step=".01"
          value={tdsAmount}
          onChange={(e) => setTdsAmount(e.target.value)}
          required
        />
      </label>

      <label>
        Mode
        <select name="mode">
          {["NEFT", "RTGS", "IMPS", "UPI", "Cheque"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>

      <label>
        Reference
        <input name="reference" />
      </label>

      <div style={{ gridColumn: "1/-1" }}>
        <h2 style={{ marginBottom: 4 }}>Invoice allocations</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          Suggested order: oldest due date first. You can change or clear
          individual amounts. The remaining settlement stays as unapplied
          customer credit.
        </p>
        <button type="button" onClick={suggestAllocations}>
          Suggest oldest-first allocations
        </button>
      </div>

      {eligibleInvoices.length === 0 ? (
        <p className="muted" style={{ gridColumn: "1/-1" }}>
          No invoices are available for this customer and receipt date.
        </p>
      ) : (
        <div style={{ gridColumn: "1/-1", overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Invoice date</th>
                <th>Due date</th>
                <th className="num">Outstanding</th>
                <th style={{ minWidth: 150 }}>Allocate (₹)</th>
              </tr>
            </thead>
            <tbody>
              {eligibleInvoices.map((invoice) => {
                const current = allocations.find(
                  (a) => a.invoiceId === invoice.id,
                );

                return (
                  <tr key={invoice.id}>
                    <td>{invoice.invoiceNo}</td>
                    <td>{invoice.invoiceDate}</td>
                    <td>{invoice.dueDate}</td>
                    <td className="num">{rupees(invoice.total / 100)}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step=".01"
                        value={current?.amount ?? ""}
                        onChange={(e) =>
                          updateAllocation(invoice.id, e.target.value)
                        }
                        aria-label={`Allocation for ${invoice.invoiceNo}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          gridColumn: "1/-1",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>
          <strong>Settlement:</strong> {rupees(settlement / 100)}
        </span>
        <span>
          <strong>Allocated:</strong> {rupees(allocationTotal / 100)}
        </span>
        <span>
          <strong>Unapplied credit:</strong> {rupees(unapplied / 100)}
        </span>
      </div>

      {allocationTotal > settlement ? (
        <p style={{ gridColumn: "1/-1", color: "#b42318" }}>
          Allocations exceed the receipt settlement. Reduce the amounts before
          saving.
        </p>
      ) : null}

      {error ? (
        <div style={{ gridColumn: "1/-1" }}>
          <Result message={error} />
        </div>
      ) : null}

      <div style={{ gridColumn: "1/-1" }}>
        <button
          className="primary"
          disabled={
            busy ||
            settlement <= 0 ||
            allocationTotal > settlement ||
            allocations.some(
              (a) =>
                a.amount !== "" &&
                (!Number.isFinite(Number(a.amount)) || Number(a.amount) < 0),
            )
          }
        >
          {busy ? "Saving…" : "Save receipt & allocations"}
        </button>
      </div>
    </form>
  );
}

export function AllocateCreditForm({
  asof,
  customerId,
  receiptId,
  receiptNo,
  unappliedPaise,
  invoices,
}: {
  asof: string;
  customerId: number;
  receiptId: number;
  receiptNo: string;
  unappliedPaise: number;
  invoices: Invoice[];
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invoiceId, setInvoiceId] = useState(String(invoices[0]?.id ?? ""));
  const [amount, setAmount] = useState((unappliedPaise / 100).toFixed(2));
  const [allocationDate, setAllocationDate] = useState(asof);
  const router = useRouter();

  async function submit(f: FormData) {
    setBusy(true);
    setError("");

    const r = await allocateReceiptCredit(f, asof);
    setBusy(false);

    if (!r.ok) {
      setError(r.message);
      return;
    }

    setAmount("");
    router.refresh();
  }

  return (
    <form
      action={submit}
      className="card"
      style={{ display: "grid", gap: 12, marginTop: 12 }}
    >
      <input type="hidden" name="receipt_id" value={receiptId} />
      <h3>Allocate credit from {receiptNo}</h3>
      <p className="muted">
        Available credit: <strong>{rupees(unappliedPaise / 100)}</strong>
      </p>

      <label>
        Invoice
        <select
          name="invoice_id"
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          required
        >
          {invoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.invoiceNo} · Due {invoice.dueDate} ·{" "}
              {rupees(invoice.total / 100)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Allocation date
        <input
          type="date"
          name="allocation_date"
          value={allocationDate}
          max={asof}
          onChange={(e) => setAllocationDate(e.target.value)}
          required
        />
      </label>

      <label>
        Amount (₹)
        <input
          type="number"
          name="amount"
          min=".01"
          max={(unappliedPaise / 100).toFixed(2)}
          step=".01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>

      {error ? <Result message={error} /> : null}

      <div>
        <button
          className="primary"
          disabled={
            busy ||
            invoices.length === 0 ||
            Number(amount) <= 0 ||
            Number(amount) * 100 > unappliedPaise
          }
        >
          {busy ? "Allocating…" : "Allocate credit"}
        </button>
      </div>
    </form>
  );
}

export function InvoiceActions({
  id,
  disputed,
  cancelled,
  asof,
}: {
  id: number;
  disputed: boolean;
  cancelled: boolean;
  asof: string;
}) {
  const [error, setError] = useState("");
  const router = useRouter();

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {!cancelled ? (
        <>
          <button className="action-btn warn" type="button"
            onClick={async () => {
              const r = await setInvoiceDisputed(id, !disputed);
              if (!r.ok) setError(r.message);
              else router.refresh();
            }}
          >
            {disputed ? "Clear disputed" : "Mark disputed"}
          </button>

          <button className="action-btn primary" type="button"
            onClick={() => {
              const taxable = prompt("Credit note taxable value (₹)");
              if (!taxable) return;

              const f = new FormData();
              f.set("invoice_id", String(id));
              f.set("credit_note_date", asof);
              f.set("taxable_value", taxable);
              f.set(
                "reason",
                prompt("Reason for credit note") || "Credit adjustment",
              );

              createCreditNote(f, asof).then((r) => {
                if (!r.ok) setError(r.message);
                else router.refresh();
              });
            }}
          >
            Raise credit note
          </button>

          <button className="action-btn danger" type="button"
            onClick={async () => {
              if (!confirm("Cancel this invoice?")) return;
              const r = await cancelInvoice(id);
              if (!r.ok) setError(r.message);
              else router.refresh();
            }}
          >
            Cancel invoice
          </button>
        </>
      ) : null}

      {error ? <Result message={error} /> : null}
    </div>
  );
}

export function EmailReminderForm({
  asof,
  customerId,
  invoiceId,
  to: initialTo,
  subject: initialSubject,
  body: initialBody,
  backHref,
}: {
  asof: string;
  customerId: number;
  invoiceId: number;
  to: string;
  subject: string;
  body: string;
  backHref: string;
}) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [logNote, setLogNote] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const router = useRouter();

  async function send() {
    setError("");
    setDone("");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    if (!logNote) {
      setDone("Opened in your email app.");
      return;
    }

    const f = new FormData();
    f.set("customer_id", String(customerId));
    f.set("invoice_id", String(invoiceId));
    f.set("note_date", asof);
    f.set("note_type", "Email");
    f.set("body", `Reminder emailed to ${to}: ${subject}`);
    const r = await createNote(f);
    if (!r.ok) setError(r.message);
    else {
      setDone("Opened in your email app and logged as an Email note.");
      router.refresh();
    }
  }

  return (
    <form
      className="card"
      style={{ display: "grid", gap: 14, maxWidth: 820 }}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label>
        To
        <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} />
      </label>

      <label>
        Subject
        <input required value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>

      <label>
        Message
        <textarea
          required
          rows={18}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ fontFamily: "inherit", lineHeight: 1.6, whiteSpace: "pre-wrap" }}
        />
      </label>

      <label style={{ flexDirection: "row", alignItems: "center", fontWeight: 400 }}>
        <input type="checkbox" checked={logNote} onChange={(e) => setLogNote(e.target.checked)} />
        Log this reminder as an Email note on the customer
      </label>

      {error ? <Result message={error} /> : null}
      {done ? <p className="tag green">{done}</p> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="primary" type="submit">
          Open in email app
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
            setDone("Subject and message copied.");
          }}
        >
          Copy message
        </button>
        <a className="button" href={backHref}>
          Cancel
        </a>
      </div>
    </form>
  );
}

export function NoteForm({
  asof,
  customerId,
  invoiceId,
  redirectTo,
}: {
  asof: string;
  customerId: number;
  invoiceId?: number;
  redirectTo?: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(f: FormData) {
    setBusy(true);
    setError("");
    const r = await createNote(f);
    setBusy(false);

    if (!r.ok) {
      setError(r.message);
      return;
    }

    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <form action={submit} className="card" style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="invoice_id" value={invoiceId || ""} />

      <label>
        Note date
        <input name="note_date" type="date" defaultValue={asof} max={asof} />
      </label>

      <label>
        Type
        <select name="note_type">
          {["Call", "Email", "Meeting", "Note"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>

      <label>
        Note
        <textarea name="body" required />
      </label>

      <label>
        Follow-up date
        <input name="follow_up_date" type="date" />
      </label>

      <label>
        Promise date
        <input name="promise_date" type="date" />
      </label>

      <label>
        Promise amount
        <input name="promise_amount" type="number" min=".01" step=".01" />
      </label>

      {error ? <Result message={error} /> : null}

      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}
