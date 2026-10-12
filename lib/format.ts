import type { Paise } from "@/lib/ar/types";
export function money(paise: Paise): string { return new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", minimumFractionDigits:2, maximumFractionDigits:2 }).format(paise / 100); }
export function balance(paise: Paise): string { return `${money(Math.abs(paise))} ${paise < 0 ? "Cr" : "Dr"}`; }
export function dateLabel(value: string): string { const [y,m,d]=value.split("-"); const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${d}-${months[Number(m)-1]}-${y}`; }
export function rupeesToPaise(value: number|string): number { const n=Number(value); if(!Number.isFinite(n)) throw new Error("Invalid amount"); return Math.round(n*100); }
