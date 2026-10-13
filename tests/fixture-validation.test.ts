
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { statement } from "../lib/ar/statement";
import type { ArData } from "../lib/ar/types";

const fixturePath = resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "sample.json",
);

const raw: Record<string, any> = JSON.parse(
  readFileSync(fixturePath, "utf8"),
);

function normalizeFixture(source: Record<string, any>): ArData {
  const customers = (source.customers ?? []).map((c: any) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    city: c.city,
    state: c.state,
    contactPerson: c.contact_person,
    email: c.email,
    phone: c.phone,
    gstin: c.gstin,
    creditDays: c.credit_days,
    creditLimit: c.credit_limit,
    tdsRatePct: c.tds_rate_pct,
    isActive: c.is_active,
  }));

  const invoices = (source.invoices ?? []).map((i: any) => ({
    id: i.id,
    invoiceNo: i.invoice_no,
    customerId: i.customer_id,
    invoiceDate: i.invoice_date,
    dueDate: i.due_date,
    description: i.description,
    taxableValue: i.taxable_value,
    gstRatePct: i.gst_rate_pct,
    cgst: i.cgst,
    sgst: i.sgst,
    igst: i.igst,
    total: i.total,
    isCancelled: i.is_cancelled,
    isDisputed: i.is_disputed,
  }));

  const creditNotes = (source.credit_notes ?? source.creditNotes ?? []).map(
    (c: any) => ({
      id: c.id,
      creditNoteNo: c.credit_note_no,
      invoiceId: c.invoice_id,
      creditNoteDate: c.credit_note_date,
      taxableValue: c.taxable_value,
      cgst: c.cgst,
      sgst: c.sgst,
      igst: c.igst,
      total: c.total,
      reason: c.reason,
    }),
  );

  const receipts = (source.receipts ?? []).map((r: any) => ({
    id: r.id,
    receiptNo: r.receipt_no,
    customerId: r.customer_id,
    receiptDate: r.receipt_date,
    bankAmount: r.bank_amount,
    tdsAmount: r.tds_amount,
    mode: r.mode,
    reference: r.reference,
  }));

  const allocations = (source.allocations ?? []).map((a: any) => ({
    id: a.id,
    receiptId: a.receipt_id,
    invoiceId: a.invoice_id,
    allocationDate: a.allocation_date,
    amount: a.amount,
  }));

  const notes = (source.notes ?? []).map((n: any) => ({
    id: n.id,
    customerId: n.customer_id,
    noteDate: n.note_date,
    noteType: n.note_type,
    content: n.content,
    followUpDate: n.follow_up_date,
    followUpDone: n.follow_up_done,
    promiseDate: n.promise_date,
    promiseAmount: n.promise_amount,
  }));

  return {
    customers,
    invoices,
    creditNotes,
    receipts,
    allocations,
    notes,
  } as ArData;
}

const data = normalizeFixture(raw);

describe("assignment fixture validation", () => {
  it("contains customer C002", () => {
    expect(
      data.customers.some((customer) => customer.code === "C002"),
    ).toBe(true);
  });

  it("matches the required C002 statement for 1 April to 31 August 2026", () => {
    const customer = data.customers.find(
      (item) => item.code === "C002",
    );

    if (!customer) {
      throw new Error("Customer C002 was not found in the fixture.");
    }

    const result = statement(
      data,
      customer.id,
      "2026-04-01",
      "2026-08-31",
    );

    expect(result.openingBalance).toBe(70800);
    expect(result.closingBalance).toBe(223000);
    expect(result.lines).toHaveLength(7);
  });
});
