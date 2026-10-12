import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { asOfDate } from "@/lib/asof";

export const metadata: Metadata = { title: "Brightwater Receivables Hub", description: "Customer receivables and GST invoice management" };

export default async function RootLayout({ children, searchParams }: Readonly<{children: React.ReactNode; searchParams: Promise<{asof?: string}>}>) {
  const params = await searchParams;
  const asof = asOfDate(params.asof);
  const nav = [["/","Dashboard"],["/customers","Customers"],["/invoices","Invoices"],["/receipts","Receipts"],["/statement","Statements & reports"]];
  return <html lang="en"><body>
    <header style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:15,flexWrap:"wrap"}}>
      <div><strong style={{fontSize:17,color:"#142b45"}}>Brightwater Advisory</strong><div className="muted" style={{fontSize:12}}>Receivables Hub · Baner, Pune 411045</div></div>
      <form action="/" method="get" className="no-print" style={{display:"flex",alignItems:"center",gap:8}}><label>AS-AT DATE<input aria-label="As-at date" type="date" name="asof" defaultValue={asof}/></label><button className="primary">Apply</button></form>
    </header>
    <div style={{display:"flex",minHeight:"calc(100vh - 76px)"}}>
      <aside className="no-print" style={{width:205,flexShrink:0,background:"#142b45",padding:16,display:"flex",flexDirection:"column",gap:7}}>
        {nav.map(([href,label])=><Link key={href} href={`${href}?asof=${asof}`} style={{color:"white",padding:"11px 12px",borderRadius:8,background:"transparent"}}>{label}</Link>)}
        <div style={{color:"#b8c8d9",fontSize:11,marginTop:20}}>INR · India<br/>As-at reporting</div>
      </aside>
      <main style={{padding:24,width:"100%",minWidth:0,maxWidth:1600,margin:"0 auto"}}>{children}</main>
    </div>
  </body></html>;
}