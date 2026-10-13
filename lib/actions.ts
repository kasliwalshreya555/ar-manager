
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDb } from "@/lib/db";
import { loadArData } from "@/lib/ar/load";
import {
  dueDate,
  invoicePositions,
  customerPositions,
} from "@/lib/ar/positions";
import { gstSplit, nextNumber } from "@/lib/ar/gst-numbering";
import { rupeesToPaise } from "@/lib/format";

const customerSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  contact_person: z.string().trim().min(1),
  email: z.email(),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  credit_days: z.coerce.number().int().min(0),
  credit_limit: z.coerce.number().min(0),
  tds_rate_pct: z.coerce.number().min(0).max(100),
  is_active: z.coerce.boolean().default(true),
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function err(e: unknown) {
  return {
    ok: false as const,
    message: e instanceof Error ? e.message : "Unexpected error",
  };
}

function refreshAr(customerId?: number) {
  revalidatePath("/");
  revalidatePath("/customers");
  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/statement");
  if (customerId !== undefined) {
    revalidatePath(`/customers/${customerId}`);
  }
}

export async function saveCustomer(form: FormData) {
  try {
    const v = customerSchema.parse(Object.fromEntries(form));
    const { error } = await requireDb().from("customers").insert(v);
    if (error) throw new Error(error.message);
    refreshAr();
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

export async function updateCustomer(id: number, form: FormData) {
  try {
    const v = customerSchema.parse(Object.fromEntries(form));
    const { error } = await requireDb().from("customers").update(v).eq("id", id);
    if (error) throw new Error(error.message);
    refreshAr(id);
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

export async function setCustomerActive(id: number, isActive: boolean) {
  try {
    const { error } = await requireDb()
      .from("customers")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw new Error(error.message);
    refreshAr(id);
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

const invoiceSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  invoice_date: date,
  description: z.string().trim().min(1),
  taxable_value: z.coerce.number().positive(),
  gst_rate_pct: z.coerce.number().min(0).max(100).default(18),
});

export async function createInvoice(form: FormData, asOf: string) {
  try {
    const v = invoiceSchema.parse(Object.fromEntries(form));

    if (v.invoice_date > asOf) {
      throw new Error("Invoice date cannot be after the selected as-at date.");
    }

    const data = await loadArData();
    const customer = data.customers.find((c) => c.id === v.customer_id);

    if (!customer) throw new Error("Customer not found.");
    if (!customer.isActive) {
      throw new Error("Inactive customers cannot receive new invoices.");
    }

    const taxable = rupeesToPaise(v.taxable_value);
    const gst = gstSplit(customer.state, taxable, v.gst_rate_pct);
    const total = taxable + gst.cgst + gst.sgst + gst.igst;
    const position = customerPositions(data, asOf).find(
      (p) => p.customer.id === customer.id,
    );
    const creditWarning =
      !!position && position.netBalance + total > customer.creditLimit;

    const invoiceNo = nextNumber("invoice", data, v.invoice_date);
    if (invoiceNo.length > 16) {
      throw new Error("Generated invoice number exceeds 16 characters.");
    }

    const { error } = await requireDb().from("invoices").insert({
      invoice_no: invoiceNo,
      customer_id: customer.id,
      invoice_date: v.invoice_date,
      due_date: dueDate(v.invoice_date, customer.creditDays),
      description: v.description,
      taxable_value: taxable / 100,
      gst_rate_pct: v.gst_rate_pct,
      cgst: gst.cgst / 100,
      sgst: gst.sgst / 100,
      igst: gst.igst / 100,
      total: total / 100,
      is_cancelled: false,
      is_disputed: false,
    });

    if (error) throw new Error(error.message);
    refreshAr(customer.id);
    return { ok: true as const, invoiceNo, creditWarning };
  } catch (e) {
    return err(e);
  }
}

export async function setInvoiceDisputed(id: number, isDisputed: boolean) {
  try {
    const { error } = await requireDb()
      .from("invoices")
      .update({ is_disputed: isDisputed })
      .eq("id", id);
    if (error) throw new Error(error.message);
    refreshAr();
    revalidatePath(`/invoices/${id}`);
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

export async function cancelInvoice(id: number) {
  try {
    const data = await loadArData();
    const invoice = data.invoices.find((i) => i.id === id);

    if (!invoice) throw new Error("Invoice not found.");
    if (
      data.allocations.some((a) => a.invoiceId === id) ||
      data.creditNotes.some((c) => c.invoiceId === id)
    ) {
      throw new Error("Cannot cancel: invoice has allocations or credit notes.");
    }

    const { error } = await requireDb()
      .from("invoices")
      .update({ is_cancelled: true })
      .eq("id", id);

    if (error) throw new Error(error.message);
    refreshAr(invoice.customerId);
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

const allocationLineSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
});

const receiptSchema = z
  .object({
    customer_id: z.coerce.number().int().positive(),
    receipt_date: date,
    bank_amount: z.coerce.number().nonnegative(),
    tds_amount: z.coerce.number().nonnegative(),
    mode: z.enum(["NEFT", "RTGS", "IMPS", "UPI", "Cheque"]),
    reference: z.string().optional(),
    allocation_lines: z.string().optional(),
  })
  .refine((v) => v.bank_amount + v.tds_amount > 0, {
    message: "Settlement value must be greater than zero.",
  });

export async function createReceipt(form: FormData, asOf: string) {
  let insertedId: number | undefined;

  try {
    const v = receiptSchema.parse(Object.fromEntries(form));

    if (v.receipt_date > asOf) {
      throw new Error("Receipt date cannot be after the selected as-at date.");
    }

    const data = await loadArData();
    const customer = data.customers.find((c) => c.id === v.customer_id);
    if (!customer) throw new Error("Customer not found.");

    const settlement =
      rupeesToPaise(v.bank_amount) + rupeesToPaise(v.tds_amount);

    const positions = invoicePositions(data, v.receipt_date)
      .filter(
        (p) =>
          p.invoice.customerId === customer.id &&
          !p.invoice.isCancelled &&
          p.invoice.invoiceDate <= v.receipt_date &&
          p.outstanding > 0,
      )
      .sort(
        (a, b) =>
          a.invoice.dueDate.localeCompare(b.invoice.dueDate) ||
          a.invoice.invoiceNo.localeCompare(b.invoice.invoiceNo),
      );

    let lines: z.infer<typeof allocationLineSchema>[];

    if (v.allocation_lines) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(v.allocation_lines);
      } catch {
        throw new Error("Allocation details are not valid JSON.");
      }
      lines = z.array(allocationLineSchema).parse(parsed);
    } else {
      // Backwards-compatible oldest-first suggestion.
      let remaining = settlement;
      lines = [];
      for (const p of positions) {
        const amount = Math.min(remaining, p.outstanding);
        if (amount > 0) {
          lines.push({ invoiceId: p.invoice.id, amount: amount / 100 });
          remaining -= amount;
        }
      }
    }

    const available = new Map(
      positions.map((p) => [p.invoice.id, p.outstanding]),
    );
    let allocated = 0;
    const seen = new Set<number>();
    const rows: {
      receipt_id: number;
      invoice_id: number;
      allocation_date: string;
      amount: number;
    }[] = [];

    for (const line of lines) {
      if (seen.has(line.invoiceId)) {
        throw new Error("An invoice can appear only once in the allocations.");
      }
      seen.add(line.invoiceId);

      const outstanding = available.get(line.invoiceId);
      if (outstanding === undefined) {
        throw new Error(
          "Allocations must use open invoices for the selected customer.",
        );
      }

      const amount = rupeesToPaise(line.amount);
      if (amount <= 0) throw new Error("Allocation amounts must be positive.");
      if (amount > outstanding) {
        throw new Error(
          `Allocation exceeds the outstanding balance for invoice ${line.invoiceId}.`,
        );
      }

      allocated += amount;
      rows.push({
        receipt_id: 0,
        invoice_id: line.invoiceId,
        allocation_date: v.receipt_date,
        amount: amount / 100,
      });
    }

    if (allocated > settlement) {
      throw new Error("Total allocations cannot exceed the receipt settlement.");
    }

    const db = requireDb();
    const receiptNo = nextNumber("receipt", data, v.receipt_date);

    const { data: receipt, error: receiptError } = await db
      .from("receipts")
      .insert({
        receipt_no: receiptNo,
        customer_id: customer.id,
        receipt_date: v.receipt_date,
        bank_amount: v.bank_amount,
        tds_amount: v.tds_amount,
        mode: v.mode,
        reference: v.reference || null,
      })
      .select("id")
      .single();

    if (receiptError) throw new Error(receiptError.message);
    insertedId = receipt.id;

    if (rows.length) {
      const allocationRows = rows.map((row) => ({
        ...row,
        receipt_id: receipt.id,
      }));
      const { error } = await db.from("allocations").insert(allocationRows);
      if (error) throw new Error(error.message);
    }

    refreshAr(customer.id);
    return {
      ok: true as const,
      receiptNo,
      unappliedPaise: settlement - allocated,
    };
  } catch (e) {
    if (insertedId !== undefined) {
      try {
        await requireDb().from("allocations").delete().eq("receipt_id", insertedId);
        await requireDb().from("receipts").delete().eq("id", insertedId);
      } catch {
        // Preserve the original error.
      }
    }
    return err(e);
  }
}

const allocateCreditSchema = z.object({
  receipt_id: z.coerce.number().int().positive(),
  invoice_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  allocation_date: date,
});

export async function allocateReceiptCredit(
  form: FormData,
  asOf: string,
) {
  try {
    const v = allocateCreditSchema.parse(Object.fromEntries(form));

    if (v.allocation_date > asOf) {
      throw new Error("Allocation date cannot be after the selected as-at date.");
    }

    const data = await loadArData();
    const receipt = data.receipts.find((r) => r.id === v.receipt_id);
    const invoice = data.invoices.find((i) => i.id === v.invoice_id);

    if (!receipt) throw new Error("Receipt not found.");
    if (!invoice || invoice.isCancelled) {
      throw new Error("Choose a valid, non-cancelled invoice.");
    }
    if (invoice.customerId !== receipt.customerId) {
      throw new Error("Receipt and invoice must belong to the same customer.");
    }
    if (
      v.allocation_date < receipt.receiptDate ||
      v.allocation_date < invoice.invoiceDate
    ) {
      throw new Error(
        "Allocation date cannot precede the receipt date or invoice date.",
      );
    }

    const amount = rupeesToPaise(v.amount);
    const settlement = receipt.bankAmount + receipt.tdsAmount;
    const allocatedOnDate = data.allocations
      .filter(
        (a) =>
          a.receiptId === receipt.id &&
          a.allocationDate <= v.allocation_date,
      )
      .reduce((sum, a) => sum + a.amount, 0);

    if (amount > settlement - allocatedOnDate) {
      throw new Error("Allocation exceeds the receipt's unapplied credit.");
    }

    const position = invoicePositions(data, v.allocation_date).find(
      (p) => p.invoice.id === invoice.id,
    );
    if (!position || position.outstanding <= 0) {
      throw new Error("This invoice has no outstanding balance.");
    }
    if (amount > position.outstanding) {
      throw new Error("Allocation exceeds the invoice's outstanding balance.");
    }

    const { error } = await requireDb().from("allocations").insert({
      receipt_id: receipt.id,
      invoice_id: invoice.id,
      allocation_date: v.allocation_date,
      amount: amount / 100,
    });

    if (error) throw new Error(error.message);
    refreshAr(receipt.customerId);
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

const creditSchema = z.object({
  invoice_id: z.coerce.number().int().positive(),
  credit_note_date: date,
  taxable_value: z.coerce.number().positive(),
  reason: z.string().trim().min(1),
});

export async function createCreditNote(form: FormData, asOf: string) {
  try {
    const v = creditSchema.parse(Object.fromEntries(form));
    if (v.credit_note_date > asOf) {
      throw new Error("Credit note date cannot be after the selected as-at date.");
    }

    const data = await loadArData();
    const invoice = data.invoices.find((i) => i.id === v.invoice_id);
    if (!invoice || invoice.isCancelled) throw new Error("Choose a live invoice.");
    if (v.credit_note_date < invoice.invoiceDate) {
      throw new Error("Credit note date cannot precede invoice date.");
    }

    const position = invoicePositions(data, asOf).find(
      (p) => p.invoice.id === invoice.id,
    );
    const taxable = rupeesToPaise(v.taxable_value);
    const customer = data.customers.find((c) => c.id === invoice.customerId);
    if (!customer) throw new Error("Customer not found.");

    const gst = gstSplit(customer.state, taxable, invoice.gstRatePct);
    const total = taxable + gst.cgst + gst.sgst + gst.igst;

    if (!position || total > position.outstanding) {
      throw new Error(
        `Credit note exceeds invoice outstanding (${(position?.outstanding ?? 0) / 100}).`,
      );
    }

    const creditNoteNo = nextNumber("creditNote", data, v.credit_note_date);
    const { error } = await requireDb().from("credit_notes").insert({
      credit_note_no: creditNoteNo,
      invoice_id: invoice.id,
      credit_note_date: v.credit_note_date,
      taxable_value: taxable / 100,
      cgst: gst.cgst / 100,
      sgst: gst.sgst / 100,
      igst: gst.igst / 100,
      total: total / 100,
      reason: v.reason,
    });

    if (error) throw new Error(error.message);
    refreshAr(invoice.customerId);
    return { ok: true as const, creditNoteNo };
  } catch (e) {
    return err(e);
  }
}

const noteSchema = z
  .object({
    customer_id: z.coerce.number().int().positive(),
    invoice_id: z.union([z.coerce.number().int().positive(), z.literal("")]).optional(),
    note_date: date,
    note_type: z.enum(["Call", "Email", "Meeting", "Note"]),
    body: z.string().trim().min(1),
    follow_up_date: z.union([date, z.literal("")]).optional(),
    promise_date: z.union([date, z.literal("")]).optional(),
    promise_amount: z.union([z.coerce.number().positive(), z.literal("")]).optional(),
    follow_up_done: z.coerce.boolean().default(false),
  })
  .refine(
    (v) =>
      (!!v.promise_date) ===
      (v.promise_amount !== "" && v.promise_amount !== undefined),
    { message: "Promise date and amount must both be supplied, or neither." },
  );

export async function createNote(form: FormData) {
  try {
    const v = noteSchema.parse(Object.fromEntries(form));
    const { error } = await requireDb().from("notes").insert({
      customer_id: v.customer_id,
      invoice_id: v.invoice_id || null,
      note_date: v.note_date,
      note_type: v.note_type,
      body: v.body,
      follow_up_date: v.follow_up_date || null,
      follow_up_done: v.follow_up_done,
      promise_date: v.promise_date || null,
      promise_amount:
        v.promise_amount === "" || v.promise_amount === undefined
          ? null
          : v.promise_amount,
    });

    if (error) throw new Error(error.message);
    refreshAr(v.customer_id);
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

export async function markFollowUpDone(id: number, done: boolean) {
  try {
    const { error } = await requireDb()
      .from("notes")
      .update({ follow_up_done: done })
      .eq("id", id);
    if (error) throw new Error(error.message);
    refreshAr();
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

export async function removeAllocation(id: number) {
  try {
    const data = await loadArData();
    const allocation = data.allocations.find((a) => a.id === id);
    if (!allocation) throw new Error("Allocation not found.");

    const { error } = await requireDb()
      .from("allocations")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);

    const receipt = data.receipts.find((r) => r.id === allocation.receiptId);
    refreshAr(receipt?.customerId);
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}

export async function deleteReceipt(id: number) {
  try {
    const data = await loadArData();
    if (data.allocations.some((a) => a.receiptId === id)) {
      throw new Error("Remove all allocations before deleting this receipt.");
    }

    const { error } = await requireDb().from("receipts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    refreshAr();
    return { ok: true as const };
  } catch (e) {
    return err(e);
  }
}
