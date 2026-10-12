import "server-only";
import { requireDb } from "@/lib/db";
import type { ArData } from "./types";
const paise=(x:unknown)=>Math.round(Number(x??0)*100);
export async function loadArData():Promise<ArData>{
 const db=requireDb();
 const [cu,iv,cn,re,al,no]=await Promise.all([
  db.from("customers").select("*"),db.from("invoices").select("*"),db.from("credit_notes").select("*"),
  db.from("receipts").select("*"),db.from("allocations").select("*"),db.from("notes").select("*")
 ]);
 for(const r of [cu,iv,cn,re,al,no])if(r.error)throw new Error(r.error.message);
 return {
 customers:(cu.data??[]).map(r=>({id:r.id,code:r.code,name:r.name,city:r.city,state:r.state,contactPerson:r.contact_person,email:r.email,phone:r.phone,gstin:r.gstin,creditDays:r.credit_days,creditLimit:paise(r.credit_limit),tdsRatePct:Number(r.tds_rate_pct),isActive:r.is_active})),
 invoices:(iv.data??[]).map(r=>({id:r.id,invoiceNo:r.invoice_no,customerId:r.customer_id,invoiceDate:r.invoice_date,dueDate:r.due_date,description:r.description,taxableValue:paise(r.taxable_value),gstRatePct:Number(r.gst_rate_pct),cgst:paise(r.cgst),sgst:paise(r.sgst),igst:paise(r.igst),total:paise(r.total),isCancelled:r.is_cancelled,isDisputed:r.is_disputed})),
 creditNotes:(cn.data??[]).map(r=>({id:r.id,creditNoteNo:r.credit_note_no,invoiceId:r.invoice_id,creditNoteDate:r.credit_note_date,taxableValue:paise(r.taxable_value),cgst:paise(r.cgst),sgst:paise(r.sgst),igst:paise(r.igst),total:paise(r.total),reason:r.reason})),
 receipts:(re.data??[]).map(r=>({id:r.id,receiptNo:r.receipt_no,customerId:r.customer_id,receiptDate:r.receipt_date,bankAmount:paise(r.bank_amount),tdsAmount:paise(r.tds_amount),mode:r.mode,reference:r.reference})),
 allocations:(al.data??[]).map(r=>({id:r.id,receiptId:r.receipt_id,invoiceId:r.invoice_id,allocationDate:r.allocation_date,amount:paise(r.amount)})),
 notes:(no.data??[]).map(r=>({id:r.id,customerId:r.customer_id,invoiceId:r.invoice_id,noteDate:r.note_date,noteType:r.note_type,body:r.body,followUpDate:r.follow_up_date,followUpDone:r.follow_up_done,promiseDate:r.promise_date,promiseAmount:r.promise_amount===null?null:paise(r.promise_amount)}))
 };
}
