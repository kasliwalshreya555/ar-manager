import type { Metadata } from "next";
import { SidebarNav } from "@/components/sidebar-nav";
import { Suspense } from "react";
import "./globals.css";
import { AsOfDatePicker } from "@/components/asof-date-picker";
import { GlobalSearch } from "@/components/global-search";

export const metadata: Metadata = {
  title: "Brightwater Receivables Hub",
  description: "Customer receivables and GST invoice management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nav: [string, string][] = [
    ["/", "Dashboard"],
    ["/customers", "Customers"],
    ["/invoices", "Invoices"],
    ["/receipts", "Receipts"],
    ["/follow-ups", "Follow-ups"],
    ["/ageing", "Ageing report"],
    ["/statement", "Statements"],
  ];

  return (
    <html lang="en">
      <body>
        <header
          className="app-header"
          style={{
            padding: "14px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 15,
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ fontSize: 17, color: "white" }}>
              Brightwater Advisory
            </strong>
            <div style={{ fontSize: 12, color: "#b8c8d9" }}>
              Receivables Hub · Baner, Pune 411045
            </div>
          </div>

          <Suspense fallback={<div className="global-search" />}>
            <GlobalSearch />
          </Suspense>

          <Suspense
            fallback={
              <span className="muted" style={{ fontSize: 12 }}>
                Loading reporting date…
              </span>
            }
          >
            <AsOfDatePicker />
          </Suspense>
        </header>

        <div style={{ display: "flex", minHeight: "calc(100vh - 76px)" }}>
          <aside
            className="no-print"
            style={{
              width: 205,
              flexShrink: 0,
              background: "#24507f",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <SidebarNav items={nav} />

            <div style={{ color: "#c9d8e8", fontSize: 11, marginTop: 20 }}>
              INR · India
              <br />
              As-at reporting
            </div>
          </aside>

          <main
            style={{
              padding: 24,
              width: "100%",
              minWidth: 0,
              maxWidth: 1600,
              margin: "0 auto",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}