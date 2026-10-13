import { describe, it, expect } from "vitest";
import { statement } from "./statement";
import type { ArData } from "./types";

function createStatementData(): ArData {
  return {
    customers: [
      {
        id: 1,
        code: "C002",
        name: "Statement Test Customer",
        city: "Pune",
        state: "Maharashtra",
        contactPerson: "Test Person",
        email: "test@example.com",
        phone: null,
        gstin: null,
        creditDays: 30,
        creditLimit: 500000,
        tdsRatePct: 0,
        isActive: true,
      },
    ],
    invoices: [
      {
        id: 1,
        invoiceNo: "INV-OPENING",
        customerId: 1,
        invoiceDate: "2026-04-01",
        dueDate: "2026-05-01",
        description: "Opening invoice",
        taxableValue: 84745.76,
        gstRatePct: 18,
        cgst: 7627.12,
        sgst: 7627.12,
        igst: 0,
        total: 100000,
        isCancelled: false,
        isDisputed: false,
      },
      {
        id: 2,
        invoiceNo: "INV-CURRENT",
        customerId: 1,
        invoiceDate: "2026-05-05",
        dueDate: "2026-06-04",
        description: "Current period invoice",
        taxableValue: 100000,
        gstRatePct: 18,
        cgst: 9000,
        sgst: 9000,
        igst: 0,
        total: 118000,
        isCancelled: false,
        isDisputed: false,
      },
      {
        id: 3,
        invoiceNo: "INV-OTHER-CUSTOMER",
        customerId: 2,
        invoiceDate: "2026-05-06",
        dueDate: "2026-06-05",
        description: "Another customer's invoice",
        taxableValue: 50000,
        gstRatePct: 18,
        cgst: 4500,
        sgst: 4500,
        igst: 0,
        total: 59000,
        isCancelled: false,
        isDisputed: false,
      },
      {
        id: 4,
        invoiceNo: "INV-CANCELLED",
        customerId: 1,
        invoiceDate: "2026-05-07",
        dueDate: "2026-06-06",
        description: "Cancelled invoice",
        taxableValue: 10000,
        gstRatePct: 18,
        cgst: 900,
        sgst: 900,
        igst: 0,
        total: 11800,
        isCancelled: true,
        isDisputed: false,
      },
    ],
    creditNotes: [
      {
        id: 1,
        creditNoteNo: "CN-001",
        invoiceId: 2,
        creditNoteDate: "2026-05-10",
        taxableValue: 10000,
        cgst: 900,
        sgst: 900,
        igst: 0,
        total: 11800,
        reason: "Sales return",
      },
    ],
    receipts: [
      {
        id: 1,
        receiptNo: "RCT-001",
        customerId: 1,
        receiptDate: "2026-05-10",
        bankAmount: 30000,
        tdsAmount: 2000,
        mode: "NEFT",
        reference: "TEST-REF",
      },
    ],
    allocations: [],
    notes: [],
  };
}

describe("statement", () => {
  it("calculates opening, closing and running balances correctly", () => {
    const result = statement(
      createStatementData(),
      1,
      "2026-05-01",
      "2026-05-31",
    );

    expect(result.openingBalance).toBe(100000);
    expect(result.closingBalance).toBe(174200);
    expect(result.lines).toHaveLength(4);

    expect(result.lines.map((line) => line.documentNo)).toEqual([
      "INV-CURRENT",
      "CN-001",
      "RCT-001",
      "RCT-001",
    ]);

    expect(result.lines.map((line) => line.runningBalance)).toEqual([
      218000,
      206200,
      176200,
      174200,
    ]);
  });

  it("shows invoices as debits and credit notes and receipts as credits", () => {
    const result = statement(
      createStatementData(),
      1,
      "2026-05-01",
      "2026-05-31",
    );

    expect(result.lines[0]).toMatchObject({
      documentNo: "INV-CURRENT",
      debit: 118000,
      credit: 0,
    });

    expect(result.lines[1]).toMatchObject({
      documentNo: "CN-001",
      debit: 0,
      credit: 11800,
    });

    expect(result.lines[2]).toMatchObject({
      documentNo: "RCT-001",
      description: "Payment received",
      debit: 0,
      credit: 30000,
    });

    expect(result.lines[3]).toMatchObject({
      documentNo: "RCT-001",
      description: "TDS deducted by you",
      debit: 0,
      credit: 2000,
    });
  });

  it("excludes transactions outside the period and other customers", () => {
    const result = statement(
      createStatementData(),
      1,
      "2026-05-01",
      "2026-05-31",
    );

    expect(
      result.lines.some((line) => line.documentNo === "INV-OPENING"),
    ).toBe(false);

    expect(
      result.lines.some((line) => line.documentNo === "INV-OTHER-CUSTOMER"),
    ).toBe(false);

    expect(
      result.lines.some((line) => line.documentNo === "INV-CANCELLED"),
    ).toBe(false);
  });

  it("returns an empty transaction list when there are no transactions in the period", () => {
    const result = statement(
      createStatementData(),
      1,
      "2026-06-01",
      "2026-06-30",
    );

    expect(result.lines).toHaveLength(0);
    expect(result.openingBalance).toBe(174200);
    expect(result.closingBalance).toBe(174200);
  });
});
