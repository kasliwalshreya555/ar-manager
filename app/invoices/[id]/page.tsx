import Link from "next/link";import {notFound} from "next/navigation";import {loadArData} from "@/lib/ar/load";import {invoicePositions} from "@/lib/ar/positions";import {money,dateLabel} from "@/lib/format";import {asOfDate} from "@/lib/asof";import {InvoiceActions} from "@/components/forms";
export const dynamic="force-dynamic";
export default async function InvoicePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{asof?:string}>}){
  const {id}=await params,asof=asOfDate((await searchParams).asof);
  try{
    const d=await loadArData(),i=d.invoices.find(x=>x.id===Number(id));if(!i)return notFound();
    const p=invoicePositions(d,asof).find(x=>x.invoice.id===i.id),customer=d.customers.find(c=>c.id===i.customerId);
    const outstanding=p?.outstanding??0,paid=i.total-outstanding,pct=i.total>0?Math.round(paid/i.total*100):0;
    const overdue=outstanding>0&&(p?.daysPastDue??0)>0;
    const allocations=d.allocations.filter(a=>a.invoiceId===i.id&&a.allocationDate<=asof);
    const fields:[string,string,boolean?][]=[["Customer",customer?.name??"—"],["Contact",customer?.contactPerson??"—"],["Invoice date",dateLabel(i.invoiceDate)],["Due date",dateLabel(i.dueDate)],["Amount",money(i.total)],["Balance",money(outstanding)],["Days overdue",overdue?String(p!.daysPastDue):"0",overdue]];
    return <><Link href={`/invoices?asof=${asof}`} className="no-print back-link">← All invoices</Link><h1>{i.invoiceNo}</h1>
      <div className="detail-grid">{fields.map(([label,value,red])=><div key={label}><div className="label">{label}</div><div className={red?"value red":"value"}>{value}</div></div>)}</div>
      <div className="progress"><div style={{width:`${Math.min(100,Math.max(0,pct))}%`}}/></div>
      <p className="muted" style={{marginTop:8}}>{money(paid)} paid of {money(i.total)} ({pct}%)</p>
      {outstanding>0&&!i.isCancelled?<div className="no-print" style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}><Link className="button primary" href={`/invoices/${i.id}/email?asof=${asof}`}>{overdue?"Send overdue reminder":paid>0?"Send balance due reminder":"Send email"}</Link><Link className="button" href={`/receipts/new?asof=${asof}`}>Record payment</Link></div>:null}
      <div className="card" style={{marginTop:15}}>
        <p style={{marginTop:0}}><strong>Description:</strong> {i.description}</p>
        <p>Status: <span className={`tag ${i.isCancelled?"":p?.status==="Paid"?"green":p?.status==="Overdue"?"red":"amber"}`}>{i.isCancelled?"Cancelled":p?.status}</span> {p?.isPartPaid?<span className="tag amber">Part-paid</span>:null} {i.isDisputed?<span className="tag red">Disputed</span>:null}</p>
        <div className="summary-cols" style={{margin:"18px 0"}}>
          <div><h3>Tax breakdown</h3>{([["Taxable value",i.taxableValue],["CGST",i.cgst],["SGST",i.sgst],["IGST",i.igst]] as const).map(([k,v])=><div className="kv" key={k}><span>{k}</span><span>{money(v)}</span></div>)}<div className="kv total"><span>Invoice total</span><span>{money(i.total)}</span></div></div>
          <div><h3>Payments</h3>{([["Received",p?.received??0],["Credited",p?.credited??0]] as const).map(([k,v])=><div className="kv" key={k}><span>{k}</span><span>{money(v)}</span></div>)}<div className="kv total"><span>Balance due</span><span>{money(outstanding)}</span></div></div>
        </div>
        <InvoiceActions id={i.id} disputed={i.isDisputed} cancelled={i.isCancelled} asof={asof}/></div>
      <section className="card" style={{marginTop:15}}><h2>Allocations</h2>{allocations.length?allocations.map(a=><p key={a.id}>{dateLabel(a.allocationDate)} · {money(a.amount)} <span className="muted">receipt #{a.receiptId}</span></p>):<p className="muted">No allocations</p>}</section></>;
  }catch(e){return <div className="card">{e instanceof Error?e.message:"Could not load invoice"}</div>}
}
