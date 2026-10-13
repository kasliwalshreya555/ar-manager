import Link from "next/link";import {loadArData} from "@/lib/ar/load";import {invoicePositions} from "@/lib/ar/positions";import {money,dateLabel} from "@/lib/format";import {asOfDate} from "@/lib/asof";import type {Invoice,InvoicePosition} from "@/lib/ar/types";
export const dynamic="force-dynamic";
function SortIcon({state}:{state:"asc"|"desc"|null}){return <svg className="sort-icon" width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><path d="M5 1 9 5.5H1z" className={state==="asc"?"on":undefined}/><path d="M5 13 1 8.5h8z" className={state==="desc"?"on":undefined}/></svg>}
type Row={i:Invoice;p?:InvoicePosition;customer:string};
const statusRank=(r:Row)=>r.i.isCancelled?3:r.p?.status==="Overdue"?0:r.p?.status==="Due"?1:2;
const columns:{key:string;label:string;num?:boolean;value:(r:Row)=>string|number}[]=[
  {key:"invoice",label:"Invoice no.",value:r=>r.i.invoiceNo},
  {key:"customer",label:"Customer",value:r=>r.customer},
  {key:"invoiceDate",label:"Invoice date",value:r=>r.i.invoiceDate},
  {key:"dueDate",label:"Due date",value:r=>r.i.dueDate},
  {key:"total",label:"Total",num:true,value:r=>r.i.total},
  {key:"received",label:"Received",num:true,value:r=>r.p?.received??0},
  {key:"credited",label:"Credited",num:true,value:r=>r.p?.credited??0},
  {key:"outstanding",label:"Outstanding",num:true,value:r=>r.i.isCancelled?-1:r.p?.outstanding??0},
  {key:"status",label:"Status / labels",value:statusRank},
  {key:"daysLate",label:"Days late",num:true,value:r=>r.i.isCancelled?-1:Math.max(0,r.p?.daysPastDue??0)},
];
export default async function Invoices({searchParams}:{searchParams:Promise<{asof?:string;sort?:string;dir?:string}>}){
  const sp=await searchParams,asof=asOfDate(sp.asof);
  const col=columns.find(c=>c.key===sp.sort)??columns[2],dir=col.key===sp.sort?(sp.dir==="desc"?"desc":"asc"):"desc";
  try{
    const d=await loadArData(),ps=invoicePositions(d,asof),live=new Map(ps.map(p=>[p.invoice.id,p]));
    const data:Row[]=d.invoices.filter(i=>i.invoiceDate<=asof).map(i=>({i,p:live.get(i.id),customer:d.customers.find(c=>c.id===i.customerId)?.name??""}));
    data.sort((a,b)=>{const x=col.value(a),y=col.value(b);const c=typeof x==="number"&&typeof y==="number"?x-y:String(x).localeCompare(String(y),"en-IN",{numeric:true});return (dir==="asc"?c:-c)||b.i.invoiceNo.localeCompare(a.i.invoiceNo)});
    const rows=data.map(({i,p,customer})=>{const tint=i.isCancelled||!p||p.outstanding<=0?"":p.isPartPaid?"row-part-paid":p.status==="Overdue"?"row-overdue":"";return <tr key={i.id} className={tint||undefined}><td><Link href={`/invoices/${i.id}?asof=${asof}`}>{i.invoiceNo}</Link></td><td>{customer}</td><td>{dateLabel(i.invoiceDate)}</td><td>{dateLabel(i.dueDate)}</td><td className="num">{money(i.total)}</td><td className="num">{money(p?.received??0)}</td><td className="num">{money(p?.credited??0)}</td><td className="num">{i.isCancelled?"—":money(p?.outstanding??0)}</td><td>{i.isCancelled?<span className="tag">Cancelled</span>:<span className={`tag ${p?.status==="Overdue"?"red":p?.status==="Paid"?"green":""}`}>{p?.status}</span>} {p?.isPartPaid?<span className="tag amber">Part-paid</span>:null} {i.isDisputed?<span className="tag red">Disputed</span>:null}</td><td className="num">{i.isCancelled?"—":Math.max(0,p?.daysPastDue??0)}</td></tr>});
    const header=columns.map(c=>{const active=c.key===col.key,next=active&&dir==="asc"?"desc":"asc";return <th key={c.key} className={c.num?"num":undefined} aria-sort={active?(dir==="asc"?"ascending":"descending"):undefined}><Link className="sort-link" href={`/invoices?asof=${asof}&sort=${c.key}&dir=${next}`}>{c.label}<SortIcon state={active?dir:null}/></Link></th>});
    return <><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><div><h1>Invoices</h1><p className="muted">Invoice register as at {dateLabel(asof)}</p></div><Link className="button primary" href={`/invoices/new?asof=${asof}`}>＋ Create invoice</Link></div><section className="card" style={{padding:0,overflowX:"auto"}}><table><thead><tr>{header}</tr></thead><tbody>{rows}</tbody><tfoot><tr><th colSpan={4}>Filtered totals (live invoices dated by as-at date)</th><th className="num">{money(ps.reduce((s,p)=>s+p.invoice.total,0))}</th><th className="num">{money(ps.reduce((s,p)=>s+p.received,0))}</th><th className="num">{money(ps.reduce((s,p)=>s+p.credited,0))}</th><th className="num">{money(ps.reduce((s,p)=>s+p.outstanding,0))}</th><th colSpan={2}></th></tr></tfoot></table></section></>;
  }catch(e){return <div className="card">{e instanceof Error?e.message:"Failed to load invoices"}</div>}
}
