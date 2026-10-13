import { describe, it, expect } from "vitest";
import { searchAr } from "./search";
import type { ArData } from "./types";

const data: ArData = {
  customers: [
    { id: 1, code: "C001", name: "Tamhini Foods Pvt. Ltd.", city: "Pune", state: "Maharashtra", contactPerson: "Neha Joshi", email: "accounts@tamhinifoods.example", phone: "9800000000", gstin: null, creditDays: 30, creditLimit: 0, tdsRatePct: 0, isActive: true },
    { id: 2, code: "C002", name: "Varandha Freight LLP", city: "Mumbai", state: "Maharashtra", contactPerson: "Amit", email: "ap@varandha.example", phone: null, gstin: "27ABCDE1234F1Z5", creditDays: 30, creditLimit: 0, tdsRatePct: 0, isActive: true },
  ],
  invoices: [
    { id: 10, invoiceNo: "BWA/26-27/0024", customerId: 1, invoiceDate: "2026-09-05", dueDate: "2026-10-05", description: "Audit fees", taxableValue: 75_000_00, gstRatePct: 18, cgst: 6_750_00, sgst: 6_750_00, igst: 0, total: 88_500_00, isCancelled: false, isDisputed: false },
    { id: 11, invoiceNo: "BWA/26-27/0099", customerId: 2, invoiceDate: "2026-12-01", dueDate: "2026-12-31", description: "Future", taxableValue: 0, gstRatePct: 0, cgst: 0, sgst: 0, igst: 0, total: 1_000_00, isCancelled: false, isDisputed: false },
  ],
  creditNotes: [],
  receipts: [{ id: 20, receiptNo: "RCPT-0007", customerId: 2, receiptDate: "2026-09-10", bankAmount: 45_000_00, tdsAmount: 5_000_00, mode: "NEFT", reference: "UTR998877", }],
  allocations: [],
  notes: [{ id: 30, customerId: 2, invoiceId: null, noteDate: "2026-10-01", noteType: "Call", body: "Promised payment next week", followUpDate: null, followUpDone: false, promiseDate: null, promiseAmount: null }],
};
const ASOF = "2026-10-13";
const kinds = (q: string) => searchAr(data, q, ASOF).map((r) => `${r.kind}:${r.key}`);

describe("searchAr", () => {
  it("finds customers by name, contact, email and GSTIN, case-insensitively", () => {
    expect(kinds("tamhini")).toEqual(["Customer:c1", "Invoice:i10"]);
    expect(kinds("NEHA")).toEqual(["Customer:c1"]);
    expect(kinds("27abcde")).toEqual(["Customer:c2"]);
  });

  it("finds invoices by number (ignoring spaces) and by amount with or without commas", () => {
    expect(kinds("0024")).toEqual(["Invoice:i10"]);
    expect(kinds("88,500")).toEqual(["Invoice:i10"]);
    expect(kinds("88500")).toEqual(["Invoice:i10"]);
  });

  it("finds receipts by number, UTR and settlement amount, and notes by text", () => {
    expect(kinds("rcpt-0007")).toEqual(["Receipt:r20"]);
    expect(kinds("UTR998877")).toEqual(["Receipt:r20"]);
    expect(kinds("50000")).toEqual(["Receipt:r20"]);
    expect(kinds("promised")).toEqual(["Follow-up:n30"]);
  });

  it("requires every word to match and hides documents dated after the as-at date", () => {
    expect(kinds("varandha neft")).toEqual(["Receipt:r20"]);
    expect(kinds("0099")).toEqual([]);
    expect(kinds("   ")).toEqual([]);
  });

  it("limits results per kind", () => {
    expect(searchAr(data, "maharashtra", ASOF, 1).map((r) => r.key)).toEqual(["c1"]);
  });
});
