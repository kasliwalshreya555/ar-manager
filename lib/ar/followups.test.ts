import { describe, it, expect } from "vitest";
import { followUps, completedFollowUps, priorityFor, addDays } from "./followups";
import type { ArData, Invoice, Note } from "./types";

const invoice = (id: number, dueDate: string, total: number): Invoice => ({
  id, invoiceNo: `INV-00${id}`, customerId: 1, invoiceDate: "2026-07-01", dueDate, description: "Goods",
  taxableValue: total, gstRatePct: 0, cgst: 0, sgst: 0, igst: 0, total, isCancelled: false, isDisputed: false,
});
const note = (id: number, over: Partial<Note>): Note => ({
  id, customerId: 1, invoiceId: null, noteDate: "2026-10-01", noteType: "Call", body: "Called",
  followUpDate: null, followUpDone: false, promiseDate: null, promiseAmount: null, ...over,
});

function data(notes: Note[]): ArData {
  return {
    customers: [{ id: 1, code: "C1", name: "Reliance Retail", city: "Mumbai", state: "MH", contactPerson: "Amit", email: "a@x.com", phone: null, gstin: null, creditDays: 30, creditLimit: 0, tdsRatePct: 0, isActive: true }],
    invoices: [
      invoice(1, "2026-07-31", 50_000_00), // overdue, high value
      invoice(2, "2026-10-01", 10_000_00), // overdue, small
      invoice(3, "2026-12-31", 10_000_00), // not yet due: excluded
    ],
    creditNotes: [], receipts: [], allocations: [], notes,
  };
}

const ASOF = "2026-10-13";

describe("followUps", () => {
  it("lists only overdue unpaid invoices, never-contacted ones due now", () => {
    const rows = followUps(data([]), ASOF);
    expect(rows.map((r) => r.position.invoice.id)).toEqual([1, 2]);
    expect(rows.every((r) => r.status === "Never contacted" && r.nextDate === ASOF)).toBe(true);
  });

  it("uses last contact + 7 days, and counts customer-level notes for every invoice", () => {
    const rows = followUps(data([note(1, { noteDate: "2026-10-06" })]), ASOF);
    expect(rows.map((r) => [r.nextDate, r.status])).toEqual([["2026-10-13", "Due today"], ["2026-10-13", "Due today"]]);
  });

  it("prefers the follow-up date set on the latest note", () => {
    const rows = followUps(data([note(1, { invoiceId: 1, noteDate: "2026-10-10", followUpDate: "2026-10-20" })]), ASOF);
    const r1 = rows.find((r) => r.position.invoice.id === 1)!;
    const r2 = rows.find((r) => r.position.invoice.id === 2)!;
    expect([r1.nextDate, r1.status]).toEqual(["2026-10-20", "Upcoming"]);
    expect(r2.status).toBe("Never contacted"); // that note was for invoice 1 only
  });

  it("marks a follow-up overdue when its date has passed, and reports broken promises", () => {
    const rows = followUps(data([note(1, { invoiceId: 1, noteDate: "2026-09-25", promiseDate: "2026-09-26", promiseAmount: 50_000_00 })]), ASOF);
    const r1 = rows.find((r) => r.position.invoice.id === 1)!;
    expect([r1.nextDate, r1.status]).toEqual(["2026-10-02", "Overdue"]);
    expect(r1.promise).toEqual({ amount: 50_000_00, date: "2026-09-26", status: "Broken" });
  });

  it("ignores notes dated after the as-at date", () => {
    const rows = followUps(data([note(1, { noteDate: "2026-10-20" })]), ASOF);
    expect(rows[0].status).toBe("Never contacted");
  });
});

describe("helpers", () => {
  it("assigns priority by days overdue and amount", () => {
    expect(priorityFor(74, 10_000_00)).toBe("High");
    expect(priorityFor(12, 90_000_00)).toBe("High");
    expect(priorityFor(45, 10_000_00)).toBe("Medium");
    expect(priorityFor(5, 30_000_00)).toBe("Medium");
    expect(priorityFor(5, 10_000_00)).toBe("Low");
  });

  it("counts completed follow-ups in the window", () => {
    const d = data([note(1, { noteDate: "2026-10-07" }), note(2, { noteDate: "2026-10-06" }), note(3, { noteDate: "2026-10-14" })]);
    const done = completedFollowUps(d, ASOF, 7);
    expect(done.from).toBe("2026-10-07");
    expect(done.notes.map((n) => n.id)).toEqual([1]);
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });
});
