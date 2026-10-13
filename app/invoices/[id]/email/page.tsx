import Link from "next/link";import {notFound} from "next/navigation";import {loadArData} from "@/lib/ar/load";import {invoicePositions} from "@/lib/ar/positions";import {reminderEmail} from "@/lib/ar/reminder";import {asOfDate} from "@/lib/asof";import {money} from "@/lib/format";import {EmailReminderForm} from "@/components/forms";
export const dynamic="force-dynamic";
const kindTag={overdue:["red","Overdue reminder"],"balance-due":["amber","Balance due reminder"],due:["","Payment reminder"]} as const;
export default async function InvoiceEmailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{asof?:string}>}){
  const {id}=await params,asof=asOfDate((await searchParams).asof);
  try{
    const d=await loadArData(),i=d.invoices.find(x=>x.id===Number(id));if(!i)return notFound();
    const p=invoicePositions(d,asof).find(x=>x.invoice.id===i.id),customer=d.customers.find(c=>c.id===i.customerId);
    const back=<Link href={`/invoices/${i.id}?asof=${asof}`} className="no-print back-link">← Back to {i.invoiceNo}</Link>;
    if(!p||p.outstanding<=0||i.isCancelled)return <>{back}<h1>Send email</h1><div className="card">{i.isCancelled?"This invoice is cancelled.":"This invoice is fully paid."} No reminder is needed.</div></>;
    const email=reminderEmail(p,customer),[tag,label]=kindTag[email.kind];
    return <>{back}<h1>Send email</h1>
      <p className="muted">{i.invoiceNo} · {customer?.name} · Balance due {money(p.outstanding)} <span className={`tag ${tag}`}>{label}</span></p>
      <EmailReminderForm asof={asof} customerId={i.customerId} invoiceId={i.id} to={email.to} subject={email.subject} body={email.body} backHref={`/invoices/${i.id}?asof=${asof}`}/></>;
  }catch(e){return <div className="card">{e instanceof Error?e.message:"Could not load invoice"}</div>}
}
