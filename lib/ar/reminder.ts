import type { Customer, InvoicePosition } from "./types";
import { money, dateLabel } from "../format";

export type ReminderKind = "overdue" | "balance-due" | "due";

/** Builds the reminder email for an invoice: overdue, part-paid balance, or upcoming due. */
export function reminderEmail(position: InvoicePosition, customer: Customer | undefined) {
  const { invoice: i, received, credited, outstanding, daysPastDue } = position;
  const paid = received + credited;
  const overdue = outstanding > 0 && daysPastDue > 0;
  const kind: ReminderKind = paid > 0 ? "balance-due" : overdue ? "overdue" : "due";

  const subject =
    kind === "balance-due"
      ? `Balance due: ${money(outstanding)} on invoice ${i.invoiceNo}`
      : kind === "overdue"
        ? `Payment overdue: invoice ${i.invoiceNo} (${daysPastDue} days)`
        : `Payment reminder: invoice ${i.invoiceNo} due ${dateLabel(i.dueDate)}`;

  const status =
    kind === "balance-due"
      ? `Thank you for your payment of ${money(paid)} against invoice ${i.invoiceNo}. A balance of ${money(outstanding)} remains outstanding${overdue ? `, which was due on ${dateLabel(i.dueDate)} and is now ${daysPastDue} days overdue` : ` and is due on ${dateLabel(i.dueDate)}`}.`
      : kind === "overdue"
        ? `This is a reminder that invoice ${i.invoiceNo} for ${money(i.total)} was due on ${dateLabel(i.dueDate)} and is now ${daysPastDue} days overdue.`
        : `This is a friendly reminder that invoice ${i.invoiceNo} for ${money(i.total)} is due on ${dateLabel(i.dueDate)}.`;

  const body = [
    `Dear ${customer?.contactPerson || customer?.name || "Sir/Madam"},`,
    "",
    status,
    "",
    "Invoice details:",
    `  Invoice no.:   ${i.invoiceNo}`,
    `  Invoice date:  ${dateLabel(i.invoiceDate)}`,
    `  Due date:      ${dateLabel(i.dueDate)}`,
    `  Amount:        ${money(i.total)}`,
    ...(paid > 0 ? [`  Paid:          ${money(paid)}`] : []),
    `  Balance due:   ${money(outstanding)}`,
    "",
    `We request you to kindly arrange the payment of ${money(outstanding)} at the earliest. If the payment has already been made, please share the payment details so we can update our records.`,
    "",
    "Regards,",
    "Accounts Receivable",
    "Brightwater",
  ].join("\n");

  return { kind, to: customer?.email ?? "", subject, body };
}
