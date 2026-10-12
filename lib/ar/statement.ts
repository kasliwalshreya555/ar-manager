import type { ArData, Paise } from "./types";
import { balanceByDocuments } from "./positions";
export function statement(data:ArData,customerId:number,from:string,to:string){
 const openingDate=new Date(`${from}T00:00:00Z`);openingDate.setUTCDate(openingDate.getUTCDate()-1);const openingAsOf=openingDate.toISOString().slice(0,10);
 const opening=balanceByDocuments(data,customerId,openingAsOf);
 const lines:{date:string;kind:number;documentNo:string;description:string;debit:Paise;credit:Paise}[]=[];
 for(const i of data.invoices.filter(i=>i.customerId===customerId&&!i.isCancelled&&i.invoiceDate>=from&&i.invoiceDate<=to))lines.push({date:i.invoiceDate,kind:0,documentNo:i.invoiceNo,description:`Invoice · ${i.description}`,debit:i.total,credit:0});
 for(const c of data.creditNotes.filter(c=>c.creditNoteDate>=from&&c.creditNoteDate<=to&&data.invoices.some(i=>i.id===c.invoiceId&&i.customerId===customerId)))lines.push({date:c.creditNoteDate,kind:1,documentNo:c.creditNoteNo,description:"Credit note",debit:0,credit:c.total});
 for(const r of data.receipts.filter(r=>r.customerId===customerId&&r.receiptDate>=from&&r.receiptDate<=to)){lines.push({date:r.receiptDate,kind:2,documentNo:r.receiptNo,description:"Payment received",debit:0,credit:r.bankAmount});if(r.tdsAmount>0)lines.push({date:r.receiptDate,kind:3,documentNo:r.receiptNo,description:"TDS deducted by you",debit:0,credit:r.tdsAmount})}
 lines.sort((a,b)=>a.date.localeCompare(b.date)||a.kind-b.kind||a.documentNo.localeCompare(b.documentNo));
 let running=opening;const entries=lines.map(l=>{running+=l.debit-l.credit;return {...l,runningBalance:running}});return {openingBalance:opening,lines:entries,closingBalance:balanceByDocuments(data,customerId,to)};
}
