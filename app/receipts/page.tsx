
import { loadArData } from "@/lib/ar/load";
import { invoicePositions } from "@/lib/ar/positions";
import { ReceiptForm } from "@/components/forms";
import { asOfDate } from "@/lib/asof";

export const dynamic = "force-dynamic";

export default async function NewReceipt({
  searchParams,
}: {
  searchParams: Promise<{ asof?: string }>;
}) {
  const asof = asOfDate((await searchParams).asof);

  try {
    const data = await loadArData();
    const positions = invoicePositions(data, asof);

    // Pass invoice balances as of the selected date to the receipt form.
    const invoices = data.invoices.map((invoice) => {
      const position = positions.find(
        (p) => p.invoice.id === invoice.id,
      );

      return {
        ...invoice,
        total: position?.outstanding ?? 0,
      };
    });

    return (
      <>
        <h1>Record payment</h1>
        <p className="muted">
          Settlement = bank amount + TDS. Suggested allocations follow
          oldest due date first. Any remaining amount stays as unapplied
          customer credit.
        </p>

        <ReceiptForm
          asof={asof}
          customers={data.customers}
          invoices={invoices}
        />
      </>
    );
  } catch (e) {
    return (
      <div className="card">
        {e instanceof Error ? e.message : "Could not load receipt form"}
      </div>
    );
  }
}
