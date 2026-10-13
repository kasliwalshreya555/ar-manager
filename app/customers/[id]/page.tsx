import Link from "next/link";import {notFound} from "next/navigation";import {loadArData} from "@/lib/ar/load";import {customerPositions} from "@/lib/ar/positions";import {money,balance,dateLabel} from "@/lib/format";import {asOfDate} from "@/lib/asof";import {CustomerActions} from "@/components/forms";import type {Bucket} from "@/lib/ar/types";
export const dynamic="force-dynamic";
const bucketColors:Record<Bucket,string>={"Not due":"#16a34a","1-30":"#eab308","31-60":"#f97316","61-90":"#ea580c","91-180":"#dc2626","Over 180":"#7f1d1d"};
export default async function CustomerPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{asof?:string}>}){
  const {id}=await params,asof=asOfDate((await searchParams).asof);
  try{
    const d=await loadArData(),c=d.customers.find(x=>x.id===Number(id));if(!c)return notFound();
    const p=customerPositions(d,asof).find(x=>x.customer.id===c.id)!;
    const limitUsed=c.creditLimit>0?Math.round(Math.max(0,p.netBalance)/c.creditLimit*100):null;
    const profile:[string,string][]=[["Contact person",c.contactPerson],["Email",c.email],["Phone",c.phone||"—"],["GSTIN",c.gstin||"—"],["Location",`${c.city}, ${c.state}`],["Credit terms",`${c.creditDays} days`],["Credit limit",money(c.creditLimit)],["TDS rate",`${c.tdsRatePct}%`]];
    const buckets=Object.entries(p.buckets) as [Bucket,number][];
    return <>
      <Link href={`/customers?asof=${asof}`} className="no-print back-link">← All customers</Link>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",flexWrap:"wrap",gap:12}}>
        <div><h1 style={{fontSize:28,fontWeight:750,color:"#142b45",margin:"0 0 6px",lineHeight:1.2}}>{c.name}</h1><p className="muted" style={{marginTop:0}}>{c.code} · {c.city}, {c.state} <span className={`tag ${c.isActive?"green":""}`}>{c.isActive?"Active":"Inactive"}</span> {p.overLimit?<span className="tag red">Over credit limit</span>:null}</p></div>
        <Link className="button no-print" href={`/customers/${id}/edit?asof=${asof}`}>Edit customer</Link>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,margin:"15px 0"}}>
        {([["Net balance",balance(p.netBalance),"#142b45"],["Outstanding",money(p.outstanding),"#142b45"],["Overdue",money(p.overdue),p.overdue>0?"#b42318":"#142b45"],["Unapplied credit",money(p.unapplied),"#142b45"]] as const).map(([a,b,color])=><div className="card" key={a}><div className="detail-label">{a}</div><div style={{fontSize:22,fontWeight:750,marginTop:8,color}}>{b}</div></div>)}
        <div className="card"><div className="detail-label">Credit limit used</div><div style={{fontSize:22,fontWeight:750,marginTop:8,color:p.overLimit?"#b42318":"#142b45"}}>{limitUsed===null?"No limit":`${limitUsed}%`}</div>{limitUsed!==null?<div className="progress" style={{marginTop:8}}><div style={{width:`${Math.min(100,limitUsed)}%`,background:p.overLimit?"#d92d20":undefined}}/></div>:null}</div>
      </div>
      <section className="card">
        <h2 style={{fontSize:16,marginTop:0}}>Profile</h2>
        <div className="detail-grid">{profile.map(([label,value])=><div key={label}><div className="label">{label}</div><div className="value" style={{wordBreak:"break-word"}}>{value}</div></div>)}</div>
        <div className="no-print" style={{marginTop:14}}><CustomerActions id={c.id} active={c.isActive}/></div>
      </section>
      <section className="card" style={{marginTop:15,padding:0,overflow:"hidden"}}>
        <h2 style={{fontSize:16,margin:0,padding:16}}>Ageing <span className="muted" style={{fontWeight:400}}>(as at {dateLabel(asof)})</span></h2>
        <div style={{overflowX:"auto"}}><table><thead><tr><th>Bucket (days overdue)</th><th className="num">Amount</th><th className="num">% of outstanding</th><th style={{width:"40%"}}></th></tr></thead>
        <tbody>{buckets.map(([k,v])=>{const pct=p.outstanding>0?v/p.outstanding*100:0;return <tr key={k}><td><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:bucketColors[k],marginRight:8}}/>{k}</td><td className="num" style={{fontWeight:v>0?650:400,color:v>0?undefined:"#98a2b3"}}>{money(v)}</td><td className="num">{pct.toFixed(1)}%</td><td><div style={{height:8,background:"#eef0f4",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:bucketColors[k]}}/></div></td></tr>})}</tbody>
        <tfoot><tr><th>Total outstanding</th><th className="num">{money(p.outstanding)}</th><th className="num">{p.outstanding>0?"100.0%":"—"}</th><th></th></tr></tfoot></table></div>
      </section>
      <section className="card" style={{marginTop:15,padding:0,overflow:"hidden"}}>
        <h2 style={{fontSize:16,margin:0,padding:16}}>Invoices <span className="muted" style={{fontWeight:400}}>({p.invoices.length})</span></h2>
        <div style={{overflowX:"auto"}}><table><thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th className="num">Total</th><th className="num">Outstanding</th><th>Status</th><th className="num">Days late</th></tr></thead>
        <tbody>{p.invoices.map(x=>{const tint=x.outstanding<=0?undefined:x.isPartPaid?"row-part-paid":x.status==="Overdue"?"row-overdue":undefined;return <tr key={x.invoice.id} className={tint}><td><Link href={`/invoices/${x.invoice.id}?asof=${asof}`}>{x.invoice.invoiceNo}</Link></td><td>{dateLabel(x.invoice.invoiceDate)}</td><td>{dateLabel(x.invoice.dueDate)}</td><td className="num">{money(x.invoice.total)}</td><td className="num">{money(x.outstanding)}</td><td><span className={`tag ${x.status==="Overdue"?"red":x.status==="Paid"?"green":""}`}>{x.status}</span> {x.isPartPaid?<span className="tag amber">Part-paid</span>:null} {x.invoice.isDisputed?<span className="tag red">Disputed</span>:null}</td><td className="num">{x.outstanding>0?Math.max(0,x.daysPastDue):"—"}</td></tr>})}</tbody></table>{p.invoices.length===0?<p className="muted" style={{padding:"0 16px 16px"}}>No invoices.</p>:null}</div>
      </section>
    </>;
  }catch(e){return <div className="card">{e instanceof Error?e.message:"Could not load customer"}</div>}
}
