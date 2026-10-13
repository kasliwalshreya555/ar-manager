import Link from "next/link";import {notFound} from "next/navigation";import {loadArData} from "@/lib/ar/load";import {invoicePositions} from "@/lib/ar/positions";import {money,dateLabel} from "@/lib/format";import {asOfDate} from "@/lib/asof";import {NoteForm} from "@/components/forms";
export const dynamic="force-dynamic";
export default async function LogFollowUpPage({searchParams}:{searchParams:Promise<{asof?:string;invoice?:string}>}){
  const sp=await searchParams,asof=asOfDate(sp.asof);
  try{
    const d=await loadArData(),i=d.invoices.find(x=>x.id===Number(sp.invoice));if(!i)return notFound();
    const p=invoicePositions(d,asof).find(x=>x.invoice.id===i.id),c=d.customers.find(x=>x.id===i.customerId);
    return <>
      <Link href={`/follow-ups?asof=${asof}`} className="no-print back-link">← All follow-ups</Link>
      <h1 style={{marginBottom:4}}>Log follow-up</h1>
      <p className="muted" style={{marginTop:0}}>{i.invoiceNo} · {c?.name} ({c?.contactPerson}{c?.phone?`, ${c.phone}`:""}) · Balance {money(p?.outstanding??0)} · Due {dateLabel(i.dueDate)}{p&&p.daysPastDue>0?` · ${p.daysPastDue} days overdue`:""}</p>
      <div style={{maxWidth:640}}><NoteForm asof={asof} customerId={i.customerId} invoiceId={i.id} redirectTo={`/follow-ups?asof=${asof}`}/></div>
    </>;
  }catch(e){return <div className="card">{e instanceof Error?e.message:"Could not load invoice"}</div>}
}
