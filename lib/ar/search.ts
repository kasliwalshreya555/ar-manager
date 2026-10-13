import type { ArData } from "./types";
import { money, dateLabel } from "../format";

export type SearchKind = "Customer" | "Invoice" | "Receipt" | "Follow-up";

export interface SearchResult {
  kind: SearchKind;
  key: string;
  title: string;
  subtitle: string;
  href: string;
}

/** Lower-cases and drops spaces/commas so "88,500" matches 88500 and "bwa 26" matches "BWA/26". */
const norm = (s: string) => s.toLowerCase().replace(/[\s,₹]/g, "");
const rupees = (paise: number) => String(paise / 100);

/**
 * Searches customers, invoices, receipts and follow-up notes. Every word of the query must appear
 * somewhere in the record's searchable text. Results are grouped by kind, in that order.
 */
export function searchAr(data: ArData, query: string, asOf: string, limitPerKind = Infinity): SearchResult[] {
  const words = query.trim().toLowerCase().split(/\s+/).map(norm).filter(Boolean);
  if (words.length === 0) return [];
  const matches = (...fields: (string | null | undefined)[]) => {
    const text = norm(fields.filter(Boolean).join(" | "));
    return words.every((w) => text.includes(w));
  };
  const customerName = (id: number) => data.customers.find((c) => c.id === id)?.name ?? "";
  const q = `asof=${asOf}`;

  const customers = data.customers
    .filter((c) => matches(c.code, c.name, c.contactPerson, c.email, c.phone, c.gstin, c.city, c.state))
    .map((c): SearchResult => ({
      kind: "Customer",
      key: `c${c.id}`,
      title: `${c.code} · ${c.name}`,
      subtitle: [c.contactPerson, c.email, c.city].filter(Boolean).join(" · "),
      href: `/customers/${c.id}?${q}`,
    }));

  const invoices = data.invoices
    .filter((i) => i.invoiceDate <= asOf && matches(i.invoiceNo, i.description, customerName(i.customerId), rupees(i.total)))
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
    .map((i): SearchResult => ({
      kind: "Invoice",
      key: `i${i.id}`,
      title: `${i.invoiceNo} · ${customerName(i.customerId)}`,
      subtitle: `${money(i.total)} · dated ${dateLabel(i.invoiceDate)}${i.isCancelled ? " · Cancelled" : ""}`,
      href: `/invoices/${i.id}?${q}`,
    }));

  const receipts = data.receipts
    .filter((r) => r.receiptDate <= asOf && matches(r.receiptNo, r.reference, r.mode, customerName(r.customerId), rupees(r.bankAmount), rupees(r.bankAmount + r.tdsAmount)))
    .sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))
    .map((r): SearchResult => ({
      kind: "Receipt",
      key: `r${r.id}`,
      title: `${r.receiptNo} · ${customerName(r.customerId)}`,
      subtitle: `${money(r.bankAmount + r.tdsAmount)} · ${r.mode}${r.reference ? ` ${r.reference}` : ""} · ${dateLabel(r.receiptDate)}`,
      href: `/statement?${q}&customer=${r.customerId}&from=${asOf.slice(0, 4)}-04-01&to=${asOf}`,
    }));

  const notes = data.notes
    .filter((n) => n.noteDate <= asOf && matches(n.body, n.noteType, customerName(n.customerId), data.invoices.find((i) => i.id === n.invoiceId)?.invoiceNo))
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate))
    .map((n): SearchResult => {
      const inv = data.invoices.find((i) => i.id === n.invoiceId);
      return {
        kind: "Follow-up",
        key: `n${n.id}`,
        title: `${n.noteType} · ${customerName(n.customerId)}${inv ? ` · ${inv.invoiceNo}` : ""}`,
        subtitle: `${dateLabel(n.noteDate)} · ${n.body.length > 90 ? `${n.body.slice(0, 90)}…` : n.body}`,
        href: inv ? `/invoices/${inv.id}?${q}` : `/customers/${n.customerId}?${q}`,
      };
    });

  return [customers, invoices, receipts, notes].flatMap((group) => group.slice(0, limitPerKind));
}
