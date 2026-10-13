import type { ArData, Customer, InvoicePosition, Note, Paise } from "./types";
import { invoicePositions, promiseStatuses } from "./positions";

/** Days after the last contact before an invoice is due for another follow-up. */
export const FOLLOW_UP_INTERVAL_DAYS = 7;

export type Priority = "High" | "Medium" | "Low";
export type FollowUpStatus = "Never contacted" | "Overdue" | "Due today" | "Upcoming";

export interface FollowUpRow {
  position: InvoicePosition;
  customer: Customer | undefined;
  priority: Priority;
  lastContact: Note | null;
  nextDate: string;
  status: FollowUpStatus;
  promise: { amount: Paise; date: string; status: "Kept" | "Broken" | "Pending" } | null;
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** High: >60 days overdue or ₹50,000+ outstanding. Medium: 31–60 days or ₹25,000+. Low: anything else. */
export function priorityFor(daysPastDue: number, outstanding: Paise): Priority {
  if (daysPastDue > 60 || outstanding >= 50_000_00) return "High";
  if (daysPastDue > 30 || outstanding >= 25_000_00) return "Medium";
  return "Low";
}

const priorityRank: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
const statusRank: Record<FollowUpStatus, number> = { "Never contacted": 0, Overdue: 1, "Due today": 2, Upcoming: 3 };

/**
 * One row per unpaid overdue invoice. A note counts as contact for an invoice when it is logged
 * against that invoice or against the customer generally. The next follow-up is the latest note's
 * own follow-up date when it set one, otherwise last contact + 7 days; never contacted = due now.
 */
export function followUps(data: ArData, asOf: string): FollowUpRow[] {
  const promises = promiseStatuses(data, asOf);
  return invoicePositions(data, asOf)
    .filter((p) => p.outstanding > 0 && p.daysPastDue > 0 && !p.invoice.isCancelled)
    .map((position) => {
      const { invoice } = position;
      const notes = data.notes
        .filter((n) => n.customerId === invoice.customerId && n.noteDate <= asOf && (n.invoiceId === null || n.invoiceId === invoice.id))
        .sort((a, b) => b.noteDate.localeCompare(a.noteDate) || b.id - a.id);
      const lastContact = notes[0] ?? null;
      const nextDate = !lastContact
        ? asOf
        : lastContact.followUpDate && !lastContact.followUpDone
          ? lastContact.followUpDate
          : addDays(lastContact.noteDate, FOLLOW_UP_INTERVAL_DAYS);
      const status: FollowUpStatus = !lastContact ? "Never contacted" : nextDate < asOf ? "Overdue" : nextDate === asOf ? "Due today" : "Upcoming";
      const latestPromise = promises
        .filter((p) => notes.includes(p.note))
        .sort((a, b) => b.note.noteDate.localeCompare(a.note.noteDate))[0];
      return {
        position,
        customer: data.customers.find((c) => c.id === invoice.customerId),
        priority: priorityFor(position.daysPastDue, position.outstanding),
        lastContact,
        nextDate,
        status,
        promise: latestPromise
          ? { amount: latestPromise.note.promiseAmount!, date: latestPromise.note.promiseDate!, status: latestPromise.status as "Kept" | "Broken" | "Pending" }
          : null,
      };
    })
    .sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        statusRank[a.status] - statusRank[b.status] ||
        b.position.daysPastDue - a.position.daysPastDue,
    );
}

/** Notes logged in the `days` days up to and including asOf, newest first. */
export function completedFollowUps(data: ArData, asOf: string, days: number) {
  const from = addDays(asOf, -(days - 1));
  return {
    from,
    notes: data.notes
      .filter((n) => n.noteDate >= from && n.noteDate <= asOf)
      .sort((a, b) => b.noteDate.localeCompare(a.noteDate) || b.id - a.id),
  };
}
