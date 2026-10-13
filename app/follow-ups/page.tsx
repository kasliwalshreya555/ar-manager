import Link from "next/link";import {loadArData} from "@/lib/ar/load";import {followUps,completedFollowUps,FOLLOW_UP_INTERVAL_DAYS,type FollowUpStatus} from "@/lib/ar/followups";import {money,dateLabel} from "@/lib/format";import {asOfDate} from "@/lib/asof";
export const dynamic="force-dynamic";
const statusFilters:[string,string,FollowUpStatus[]][]=[["all","All",[]],["action","Needs a call today (overdue, never contacted or due today)",["Overdue","Never contacted","Due today"]],["overdue","Overdue (incl. never contacted)",["Overdue","Never contacted"]],["never","Never contacted",["Never contacted"]],["today","Due today",["Due today"]],["upcoming","Upcoming",["Upcoming"]]];
const statusTag:Record<FollowUpStatus,string>={"Never contacted":"red",Overdue:"red","Due today":"amber",Upcoming:""};
const priorityTag={High:"red",Medium:"amber",Low:""};
const promiseTag={Kept:"green",Broken:"red",Pending:"amber"};
export default async function FollowUpsPage({searchParams}:{searchParams:Promise<{asof?:string;customer?:string;status?:string;days?:string}>}){
  const sp=await searchParams,asof=asOfDate(sp.asof);
  const customerId=Number(sp.customer)||0,statusKey=statusFilters.some(s=>s[0]===sp.status)?sp.status!:"all",days=[7,30,90].includes(Number(sp.days))?Number(sp.days):7;
  try{
    const d=await loadArData(),all=followUps(d,asof);
    const wanted=statusFilters.find(s=>s[0]===statusKey)![2];
    const rows=all.filter(r=>(!customerId||r.position.invoice.customerId===customerId)&&(!wanted.length||wanted.includes(r.status)));
    const done=completedFollowUps(d,asof,days),doneNotes=done.notes.filter(n=>!customerId||n.customerId===customerId);
    const forCustomer=all.filter(r=>!customerId||r.position.invoice.customerId===customerId);
    const count=(...s:FollowUpStatus[])=>forCustomer.filter(r=>s.includes(r.status)).length;
    const callToday=new Set(forCustomer.filter(r=>r.status!=="Upcoming").map(r=>r.position.invoice.customerId)).size;
    const link=(status:string,anchor:string)=>{const q=new URLSearchParams({asof,status,days:String(days)});if(customerId)q.set("customer",String(customerId));return `/follow-ups?${q}#${anchor}`};
    // [title, count, subtitle, colour, link, highlighted when this filter is active]
    const cards:[string,number,string,string,string,boolean][]=[
      ["Customers needing a call today",callToday,"Have at least one overdue or due-today follow-up","#142b45",link("action","next-follow-ups"),statusKey==="action"],
      ["Overdue follow-ups",count("Overdue","Never contacted"),`Next follow-up date has passed, or never contacted (${count("Never contacted")})`,"#b42318",link("overdue","next-follow-ups"),statusKey==="overdue"],
      ["Due today",count("Due today"),`Last contact was ${FOLLOW_UP_INTERVAL_DAYS} days ago, or a follow-up was set for today`,"#93370d",link("today","next-follow-ups"),statusKey==="today"],
      ["Upcoming",count("Upcoming"),"Contacted recently; next follow-up is later","#142b45",link("upcoming","next-follow-ups"),statusKey==="upcoming"],
      [`Completed (last ${days} days)`,doneNotes.length,`Calls, emails and meetings logged since ${dateLabel(done.from)}`,"#067647",link(statusKey,"completed"),false],
    ];
    const customers=[...d.customers].sort((a,b)=>a.name.localeCompare(b.name));
    const invoiceNo=(id:number|null)=>id===null?null:d.invoices.find(i=>i.id===id);
    return <>
      <h1 style={{marginBottom:4}}>Follow-ups</h1>
      <p className="muted" style={{marginTop:0}}>Unpaid overdue invoices and when to contact the customer next, as at {dateLabel(asof)}. The next follow-up is the date set on the last logged note; if none was set, it is last contact + {FOLLOW_UP_INTERVAL_DAYS} days. Never contacted = due now.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,margin:"16px 0"}}>{cards.map(([t,v,s,c,href,active])=><Link className={active?"card stat-card active":"card stat-card"} href={href} key={t} aria-current={active?"true":undefined}><div className="detail-label">{t}</div><div style={{fontSize:26,fontWeight:750,margin:"8px 0 4px",color:c}}>{v}</div><div className="muted" style={{fontSize:12}}>{s}</div><div className="stat-card-cta">{active?"Showing below ↓":"View →"}</div></Link>)}</div>
      <form className="card no-print" method="get" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,alignItems:"end"}}>
        <input type="hidden" name="asof" value={asof}/>
        <label>Customer<select name="customer" defaultValue={customerId||""}><option value="">All customers</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Follow-up status<select name="status" defaultValue={statusKey}>{statusFilters.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
        <label>Completed in the last<select name="days" defaultValue={days}>{[7,30,90].map(n=><option key={n} value={n}>{n} days</option>)}</select></label>
        <div style={{display:"flex",gap:8}}><button className="primary">Apply</button><Link className="button" href={`/follow-ups?asof=${asof}`}>Reset</Link></div>
      </form>
      <section id="next-follow-ups" className="card" style={{marginTop:15,padding:0,overflow:"hidden",scrollMarginTop:16}}>
        <div style={{padding:"16px 16px 0"}}><h2 style={{fontSize:16,margin:0}}>Next follow-ups <span className="muted" style={{fontWeight:400}}>({rows.length})</span></h2><p className="muted" style={{fontSize:12}}>Priority: <b>High</b> = more than 60 days overdue or ₹50,000+ outstanding · <b>Medium</b> = 31–60 days or ₹25,000+ · <b>Low</b> = any other overdue.</p></div>
        <div style={{overflowX:"auto"}}><table><thead><tr><th>Priority</th><th>Customer</th><th>Invoice no.</th><th className="num">Days overdue</th><th className="num">Balance</th><th>Last follow-up</th><th>Next follow-up</th><th>Status</th><th>Latest promise</th><th className="no-print">Actions</th></tr></thead>
        <tbody>{rows.map(r=>{const i=r.position.invoice,n=r.lastContact;return <tr key={i.id} className={r.status==="Upcoming"?undefined:"row-overdue"}>
          <td><span className={`tag ${priorityTag[r.priority]}`}>{r.priority}</span></td>
          <td><Link href={`/customers/${i.customerId}?asof=${asof}`}>{r.customer?.name}</Link></td>
          <td><Link href={`/invoices/${i.id}?asof=${asof}`}>{i.invoiceNo}</Link></td>
          <td className="num">{r.position.daysPastDue}</td>
          <td className="num">{money(r.position.outstanding)}</td>
          <td>{n?<>{dateLabel(n.noteDate)} · {n.noteType}</>:<span className="muted">Never</span>}</td>
          <td>{r.status==="Never contacted"?<b>Now</b>:dateLabel(r.nextDate)}</td>
          <td><span className={`tag ${statusTag[r.status]}`}>{r.status}</span></td>
          <td>{r.promise?<>{money(r.promise.amount)} by {dateLabel(r.promise.date)} <span className={`tag ${promiseTag[r.promise.status]}`}>{r.promise.status==="Broken"?"Missed":r.promise.status}</span></>:<span className="muted">—</span>}</td>
          <td className="no-print"><div style={{display:"flex",gap:10}}><Link href={`/follow-ups/log?invoice=${i.id}&asof=${asof}`}>Log follow-up</Link><Link href={`/invoices/${i.id}/email?asof=${asof}`}>Email</Link></div></td>
        </tr>})}</tbody></table>{rows.length===0?<p className="muted" style={{padding:"0 16px 16px"}}>No follow-ups match these filters.</p>:null}</div>
      </section>
      <section id="completed" className="card" style={{marginTop:15,padding:0,overflow:"hidden",scrollMarginTop:16}}>
        <h2 style={{fontSize:16,margin:0,padding:16}}>Completed follow-ups <span className="muted" style={{fontWeight:400}}>(since {dateLabel(done.from)})</span></h2>
        {doneNotes.length?<div style={{overflowX:"auto"}}><table><thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Type</th><th>Note</th><th>Next follow-up set</th><th>Promise</th></tr></thead><tbody>{doneNotes.map(n=>{const inv=invoiceNo(n.invoiceId);return <tr key={n.id}><td>{dateLabel(n.noteDate)}</td><td>{d.customers.find(c=>c.id===n.customerId)?.name}</td><td>{inv?<Link href={`/invoices/${inv.id}?asof=${asof}`}>{inv.invoiceNo}</Link>:<span className="muted">General</span>}</td><td>{n.noteType}</td><td style={{whiteSpace:"normal",minWidth:240}}>{n.body}</td><td>{n.followUpDate?dateLabel(n.followUpDate):"—"}</td><td>{n.promiseAmount!==null&&n.promiseDate?`${money(n.promiseAmount)} by ${dateLabel(n.promiseDate)}`:"—"}</td></tr>})}</tbody></table></div>:<p className="muted" style={{padding:"0 16px 16px",margin:0}}>No follow-ups logged in this period.</p>}
      </section>
    </>;
  }catch(e){return <div className="card">{e instanceof Error?e.message:"Could not load follow-ups"}</div>}
}
