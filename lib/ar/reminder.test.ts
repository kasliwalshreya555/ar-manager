import { describe, it, expect } from "vitest";
import { reminderEmail } from "./reminder";
import type { Customer, InvoicePosition } from "./types";

const customer: Customer = {
  id: 1, code: "C001", name: "Reliance Retail", city: "Mumbai", state: "Maharashtra",
  contactPerson: "Amit", email: "amit@example.com", phone: null, gstin: null,
  creditDays: 30, creditLimit: 0, tdsRatePct: 0, isActive: true,
};

function position(over: Partial<InvoicePosition>): InvoicePosition {
  return {
    invoice: {
      id: 1, invoiceNo: "INV-001", customerId: 1, invoiceDate: "2026-07-01", dueDate: "2026-07-31",
      description: "Goods", taxableValue: 7500000, gstRatePct: 18, cgst: 675000, sgst: 675000, igst: 0,
      total: 8850000, isCancelled: false, isDisputed: false,
    },
    received: 0, credited: 0, outstanding: 8850000, daysPastDue: 0, status: "Due", isPartPaid: false, bucket: "Not due",
    ...over,
  };
}

describe("reminderEmail", () => {
  it("writes an overdue reminder when nothing is paid", () => {
    const e = reminderEmail(position({ daysPastDue: 74, status: "Overdue" }), customer);
    expect(e.kind).toBe("overdue");
    expect(e.to).toBe("amit@example.com");
    expect(e.subject).toBe("Payment overdue: invoice INV-001 (74 days)");
    expect(e.body).toContain("Dear Amit,");
    expect(e.body).toContain("is now 74 days overdue");
  });

  it("asks for the balance when the invoice is part-paid", () => {
    const e = reminderEmail(position({ received: 3000000, outstanding: 5850000, daysPastDue: 10, isPartPaid: true }), customer);
    expect(e.kind).toBe("balance-due");
    expect(e.subject).toContain("Balance due");
    expect(e.subject).toContain("58,500.00");
    expect(e.body).toContain("Thank you for your payment of ₹30,000.00");
    expect(e.body).toContain("10 days overdue");
    expect(e.body).toMatch(/Paid:\s+₹30,000\.00/);
  });

  it("writes a plain reminder before the due date", () => {
    const e = reminderEmail(position({}), customer);
    expect(e.kind).toBe("due");
    expect(e.body).toContain("is due on 31-Jul-2026");
  });
});
