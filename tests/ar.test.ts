
import { describe, it, expect } from "vitest";

import {
  addCalendarDays,
  bucketFor,
  daysBetween,
  dueDate,
  invoicePositions,
  receiptPositions,
  customerPositions,
  balanceCheck,
  dso,
  followUpsDue,
  promiseStatuses,
  type ArData,
} from "../lib/ar/positions";

import { fyLabel, gstSplit } from "../lib/ar/gst-numbering";

function makeCustomer() {
  return {
    id: 1,
    code: "C001",
    name: "Test Customer",
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
  };
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    invoiceNo: "TEST-001",
    customerId: 1,
    invoiceDate: "2026-04-01",
    dueDate: "2026-05-01",
    description: "Test invoice",
    taxableValue: 100000,
    gstRatePct: 18,
    cgst: 9000,
    sgst: 9000,
    igst: 0,
    total: 118000,
    isCancelled: false,
    isDisputed: false,
    ...overrides,
  };
}

function makeReceipt(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    receiptNo: "RCT-TEST-001",
    customerId: 1,
    receiptDate: "2026-05-10",
    bankAmount: 30000,
    tdsAmount: 0,
    mode: "NEFT",
    reference: null,
    ...overrides,
  };
}

describe("date and bucket rules", () => {
  it("counts calendar days without local time", () => {
    expect(daysBetween("2026-08-31", "2026-09-02")).toBe(2);
  });

  it("adds due days across month boundaries", () => {
    expect(dueDate("2026-04-05", 30)).toBe("2026-05-05");
  });

  it("covers ageing boundaries (not due, 1–15, 16–30, 31–45, 46–90, over 90)", () => {
    expect(bucketFor(-5)).toBe("Not due");
    expect(bucketFor(0)).toBe("Not due");
    expect(bucketFor(1)).toBe("1-15");
    expect(bucketFor(15)).toBe("1-15");
    expect(bucketFor(16)).toBe("16-30");
    expect(bucketFor(30)).toBe("16-30");
    expect(bucketFor(31)).toBe("31-45");
    expect(bucketFor(45)).toBe("31-45");
    expect(bucketFor(46)).toBe("46-90");
    expect(bucketFor(90)).toBe("46-90");
    expect(bucketFor(91)).toBe("Over 90");
    expect(bucketFor(400)).toBe("Over 90");
  });

  it("adds calendar days around leap year", () => {
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("GST and FY", () => {
  it("splits Maharashtra GST into half components", () => {
    expect(gstSplit("Maharashtra", 7500000, 18)).toEqual({
      cgst: 675000,
      sgst: 675000,
      igst: 0,
    });
  });

  it("uses IGST outside Maharashtra", () => {
    expect(gstSplit("Telangana", 35000000, 18)).toEqual({
      cgst: 0,
      sgst: 0,
      igst: 6300000,
    });
  });

  it("labels FY across April boundary", () => {
    expect(fyLabel("2026-03-31")).toBe("25-26");
    expect(fyLabel("2026-04-01")).toBe("26-27");
  });
});

describe("invoicePositions", () => {
  it("calculates overdue, part-paid invoice outstanding correctly", () => {
    const data: ArData = {
      customers: [makeCustomer()],
      invoices: [
        makeInvoice({
          total: 118000,
          dueDate: "2026-05-01",
        }) as ArData["invoices"][number],
      ],
      creditNotes: [],
      receipts: [makeReceipt() as ArData["receipts"][number]],
      allocations: [
        {
          id: 1,
          receiptId: 1,
          invoiceId: 1,
          allocationDate: "2026-05-10",
          amount: 35400,
        },
      ],
      notes: [],
    };

    const result = invoicePositions(data, "2026-05-15");

    expect(result).toHaveLength(1);
    expect(result[0].received).toBe(35400);
    expect(result[0].credited).toBe(0);
    expect(result[0].outstanding).toBe(82600);
    expect(result[0].daysPastDue).toBe(14);
    expect(result[0].status).toBe("Overdue");
    expect(result[0].isPartPaid).toBe(true);
    expect(result[0].bucket).toBe("1-15");
  });

  it("ignores allocations dated after the as-at date", () => {
    const data: ArData = {
      customers: [],
      invoices: [makeInvoice({ invoiceNo: "TEST-002" }) as ArData["invoices"][number]],
      creditNotes: [],
      receipts: [],
      allocations: [
        {
          id: 1,
          receiptId: 1,
          invoiceId: 1,
          allocationDate: "2026-05-10",
          amount: 35400,
        },
      ],
      notes: [],
    };

    const result = invoicePositions(data, "2026-05-05");

    expect(result).toHaveLength(1);
    expect(result[0].received).toBe(0);
    expect(result[0].outstanding).toBe(118000);
    expect(result[0].status).toBe("Overdue");
    expect(result[0].daysPastDue).toBe(4);
  });

  it("subtracts credit notes from invoice outstanding", () => {
    const data: ArData = {
      customers: [],
      invoices: [makeInvoice({ invoiceNo: "TEST-003" }) as ArData["invoices"][number]],
      creditNotes: [
        {
          id: 1,
          creditNoteNo: "CN-TEST-001",
          invoiceId: 1,
          creditNoteDate: "2026-05-10",
          taxableValue: 10000,
          cgst: 900,
          sgst: 900,
          igst: 0,
          total: 11800,
          reason: "Test credit note",
        },
      ],
      receipts: [],
      allocations: [],
      notes: [],
    };

    const result = invoicePositions(data, "2026-05-15");

    expect(result).toHaveLength(1);
    expect(result[0].credited).toBe(11800);
    expect(result[0].received).toBe(0);
    expect(result[0].outstanding).toBe(106200);
    expect(result[0].status).toBe("Overdue");
    expect(result[0].isPartPaid).toBe(true);
  });

  it("excludes cancelled invoices from invoice positions", () => {
    const data: ArData = {
      customers: [],
      invoices: [
        makeInvoice({
          invoiceNo: "TEST-004",
          isCancelled: true,
        }) as ArData["invoices"][number],
      ],
      creditNotes: [],
      receipts: [],
      allocations: [],
      notes: [],
    };

    expect(invoicePositions(data, "2026-05-15")).toHaveLength(0);
  });

  it("calculates receipt settlement, allocated and unapplied amounts", () => {
    const data: ArData = {
      customers: [],
      invoices: [],
      creditNotes: [],
      receipts: [
        makeReceipt({
          bankAmount: 90000,
          tdsAmount: 10000,
          reference: "TEST-REF",
        }) as ArData["receipts"][number],
      ],
      allocations: [
        {
          id: 1,
          receiptId: 1,
          invoiceId: 1,
          allocationDate: "2026-05-12",
          amount: 60000,
        },
      ],
      notes: [],
    };

    const result = receiptPositions(data, "2026-05-15");

    expect(result).toHaveLength(1);
    expect(result[0].settlement).toBe(100000);
    expect(result[0].allocated).toBe(60000);
    expect(result[0].unapplied).toBe(40000);
  });

  it("ignores receipts dated after the as-at date", () => {
    const data: ArData = {
      customers: [],
      invoices: [],
      creditNotes: [],
      receipts: [
        makeReceipt({
          receiptDate: "2026-05-10",
          bankAmount: 50000,
        }) as ArData["receipts"][number],
      ],
      allocations: [],
      notes: [],
    };

    expect(receiptPositions(data, "2026-05-05")).toHaveLength(0);
  });

  it("calculates customer outstanding, unapplied credit and net balance", () => {
    const data: ArData = {
      customers: [
        {
          ...makeCustomer(),
          creditLimit: 50000,
        },
      ],
      invoices: [makeInvoice() as ArData["invoices"][number]],
      creditNotes: [],
      receipts: [makeReceipt()],
      allocations: [
        {
          id: 1,
          receiptId: 1,
          invoiceId: 1,
          allocationDate: "2026-05-10",
          amount: 20000,
        },
      ],
      notes: [],
    };

    const result = customerPositions(data, "2026-05-15");

    expect(result).toHaveLength(1);
    expect(result[0].outstanding).toBe(98000);
    expect(result[0].unapplied).toBe(10000);
    expect(result[0].netBalance).toBe(88000);
    expect(result[0].overdue).toBe(98000);
    expect(result[0].overLimit).toBe(true);
    expect(result[0].buckets["1-15"]).toBe(98000);
  });
});

describe("balanceCheck", () => {
  it("returns no differences when customer balances reconcile", () => {
    const data: ArData = {
      customers: [makeCustomer()],
      invoices: [makeInvoice({ invoiceNo: "TEST-006" }) as ArData["invoices"][number]],
      creditNotes: [],
      receipts: [
        makeReceipt({
          bankAmount: 20000,
          receiptNo: "RCT-TEST-005",
        }) as ArData["receipts"][number],
      ],
      allocations: [
        {
          id: 1,
          receiptId: 1,
          invoiceId: 1,
          allocationDate: "2026-05-10",
          amount: 20000,
        },
      ],
      notes: [],
    };

    expect(balanceCheck(data, "2026-05-15")).toEqual([]);
  });

  it("returns no differences for every as-at date from January through October 2026", () => {
    const data: ArData = {
      customers: [makeCustomer()],
      invoices: [
        makeInvoice({
          invoiceNo: "TEST-007",
          invoiceDate: "2026-01-01",
          dueDate: "2026-01-31",
        }) as ArData["invoices"][number],
      ],
      creditNotes: [],
      receipts: [
        makeReceipt({
          receiptDate: "2026-02-01",
          bankAmount: 30000,
          receiptNo: "RCT-TEST-006",
        }) as ArData["receipts"][number],
      ],
      allocations: [
        {
          id: 1,
          receiptId: 1,
          invoiceId: 1,
          allocationDate: "2026-02-01",
          amount: 30000,
        },
      ],
      notes: [],
    };

    const current = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-10-31T00:00:00.000Z");

    while (current <= end) {
      const asOf = current.toISOString().slice(0, 10);

      expect(
        balanceCheck(data, asOf),
        `Expected no balance differences on ${asOf}`,
      ).toEqual([]);

      current.setUTCDate(current.getUTCDate() + 1);
    }
  });
});

describe("DSO", () => {
  it("calculates DSO using outstanding invoices and 90-day sales", () => {
    const data: ArData = {
      customers: [makeCustomer()],
      invoices: [
        makeInvoice({
          invoiceDate: "2026-08-01",
          dueDate: "2026-08-31",
          total: 118000,
        }) as ArData["invoices"][number],
      ],
      creditNotes: [],
      receipts: [],
      allocations: [],
      notes: [],
    };

    expect(dso(data, "2026-08-31")).toBe(90);
  });

  it("returns null when sales for the 90-day period are zero", () => {
    const data: ArData = {
      customers: [makeCustomer()],
      invoices: [],
      creditNotes: [],
      receipts: [],
      allocations: [],
      notes: [],
    };

    expect(dso(data, "2026-08-31")).toBeNull();
  });
});

describe("followUpsDue", () => {
  it("returns only unfinished follow-ups due on or before the as-at date", () => {
    const data = {
      customers: [],
      invoices: [],
      creditNotes: [],
      receipts: [],
      allocations: [],
      notes: [
        {
          id: 1,
          customerId: 1,
          noteDate: "2026-08-01",
          noteType: "Call",
          content: "Follow up due",
          followUpDate: "2026-08-10",
          followUpDone: false,
          promiseDate: null,
          promiseAmount: null,
        },
        {
          id: 2,
          customerId: 1,
          noteDate: "2026-08-01",
          noteType: "Call",
          content: "Already completed",
          followUpDate: "2026-08-10",
          followUpDone: true,
          promiseDate: null,
          promiseAmount: null,
        },
        {
          id: 3,
          customerId: 1,
          noteDate: "2026-08-01",
          noteType: "Call",
          content: "Future follow up",
          followUpDate: "2026-09-10",
          followUpDone: false,
          promiseDate: null,
          promiseAmount: null,
        },
        {
          id: 4,
          customerId: 1,
          noteDate: "2026-09-01",
          noteType: "Call",
          content: "Note not yet recorded",
          followUpDate: "2026-08-10",
          followUpDone: false,
          promiseDate: null,
          promiseAmount: null,
        },
      ],
    } as unknown as ArData;

    const result = followUpsDue(data, "2026-08-31");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe("promiseStatuses", () => {
  it("classifies promises as Kept, Broken or Pending", () => {
    const data = {
      customers: [],
      invoices: [],
      creditNotes: [],
      allocations: [],
      receipts: [
        {
          id: 1,
          receiptNo: "RCT-001",
          customerId: 1,
          receiptDate: "2026-08-15",
          bankAmount: 50000,
          tdsAmount: 0,
          mode: "NEFT",
          reference: null,
        },
      ],
      notes: [
        {
          id: 1,
          customerId: 1,
          noteDate: "2026-08-01",
          noteType: "Promise",
          content: "Promise kept",
          followUpDate: null,
          followUpDone: false,
          promiseDate: "2026-09-10",
          promiseAmount: 50000,
        },
        {
          id: 2,
          customerId: 1,
          noteDate: "2026-07-01",
          noteType: "Promise",
          content: "Promise broken",
          followUpDate: null,
          followUpDone: false,
          promiseDate: "2026-08-10",
          promiseAmount: 25000,
        },
        {
          id: 3,
          customerId: 1,
          noteDate: "2026-08-01",
          noteType: "Promise",
          content: "Promise pending",
          followUpDate: null,
          followUpDone: false,
          promiseDate: "2026-09-15",
          promiseAmount: 100000,
        },
      ],
    } as unknown as ArData;

    const result = promiseStatuses(data, "2026-08-31");

    expect(result).toHaveLength(3);

    expect(result.find((item) => item.note.id === 1)?.status).toBe("Kept");
    expect(result.find((item) => item.note.id === 1)?.settled).toBe(50000);

    expect(result.find((item) => item.note.id === 2)?.status).toBe("Broken");
    expect(result.find((item) => item.note.id === 2)?.settled).toBe(0);

    expect(result.find((item) => item.note.id === 3)?.status).toBe("Pending");
    expect(result.find((item) => item.note.id === 3)?.settled).toBe(50000);
  });
});
