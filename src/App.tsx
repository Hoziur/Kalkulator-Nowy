
import React, { useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Plus, Trash2, Download } from "lucide-react";

type Category =
  | "Szafki dolne" | "Szafki górne" | "Słupki" | "Wyspa"
  | "Fronty" | "Korpusy" | "Blat" | "Okucia" | "Akcesoria" | "Robocizna";

type BaseProduct = { id: string; category: Category | string; name: string; unit: string; unitPrice: number; attrs?: Record<string, any>; };
type OfferItem = {
  id: string; category: Category | string; title: string; kind?: "Szafka" | "Blat" | "Element";
  width?: number; height?: number; depth?: number;
  unit?: string; qty: number; materialRef?: string; overrideUnitPrice?: number | null;
  accessories?: { name: string; qty: number; unitPrice?: number }[];
};
type ProjectData = { client: string; address: string; date: string; layout: string; notes?: string; };
type Settings = { vat: number; margin: number };
type Brand = { company: string; contact: string; mainColor: string; accentColor: string; logoUrl?: string };

const CATEGORIES: Category[] = ["Szafki dolne","Szafki górne","Słupki","Wyspa","Fronty","Korpusy","Blat","Okucia","Akcesoria","Robocizna"];
const uid = (p="id") => `${p}_${Math.random().toString(36).slice(2,10)}`;
const currency = (n:number) => new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN"}).format(isFinite(n)?n:0);

export default function App(){
  const [project,setProject]=useState<ProjectData>({client:"",address:"",date:new Date().toISOString().slice(0,10),layout:"",notes:""});
  const [settings,setSettings]=useState<Settings>({vat:0.23,margin:0.2});
  const [brand,setBrand]=useState<Brand>({company:"ARVORE",contact:"biuro@arvore.pl / +48 000 000 000",mainColor:"#111827",accentColor:"#0ea5e9",logoUrl:""});
  const [catalog,setCatalog]=useState<BaseProduct[]>([
    {id:uid("p"),category:"Fronty",name:"MDF lakier mat",unit:"m2",unitPrice:420},
    {id:uid("p"),category:"Korpusy",name:"Płyta laminowana Egger",unit:"m2",unitPrice:180},
    {id:uid("p"),category:"Blat",name:"Blat laminowany 38mm",unit:"mb",unitPrice:240},
    {id:uid("p"),category:"Okucia",name:"Blum Tandembox (komplet)",unit:"szt",unitPrice:95},
    {id:uid("p"),category:"Akcesoria",name:"Cargo 150mm",unit:"szt",unitPrice:420},
    {id:uid("p"),category:"Robocizna",name:"Montaż",unit:"zest",unitPrice:1200},
  ]);
  const [items,setItems]=useState<OfferItem[]>([]);
  const priceByName=useMemo(()=>{ const m=new Map<string,BaseProduct>(); for(const p of catalog) m.set(p.name.toLowerCase(),p); return m;},[catalog]);

  function deriveQty(it:OfferItem){ if(it.unit&&it.qty) return {qty:it.qty,unit:it.unit}; if(it.kind==="Blat"&&it.width) return {qty:it.width/1000,unit:"mb"}; if(it.kind==="Szafka"&&it.width&&it.height){const m2=(it.width*it.height)/1_000_000; return {qty:m2,unit:"m2"};} return {qty:it.qty||1,unit:it.unit||"szt"}; }
  function resolveUnitPrice(it:OfferItem){ if(it.overrideUnitPrice && it.overrideUnitPrice>0) return it.overrideUnitPrice; const p = it.materialRef? priceByName.get(it.materialRef.toLowerCase()): undefined; return p? p.unitPrice : 0; }

  const enriched = useMemo(()=> items.map(it=>{
    const {qty,unit}=deriveQty(it);
    const unitPrice=resolveUnitPrice(it);
    const accSum=(it.accessories||[]).reduce((s,a)=> s+(a.qty||0)*(a.unitPrice||0),0);
    const value=qty*unitPrice + accSum;
    return {...it,resolvedQty:qty,resolvedUnit:unit,resolvedUnitPrice:unitPrice,accessoriesTotal:accSum,value};
  }),[items,priceByName]);

  const totals = useMemo(()=>{
    const sumNet = enriched.reduce((a:any,r:any)=>a+r.value,0);
    const netWithMargin = sumNet*(1+settings.margin);
    const gross = netWithMargin*(1+settings.vat);
    const byCat = new Map<string,number>();
    for(const r of enriched) byCat.set(r.category as string, (byCat.get(r.category as string)||0)+ (r as any).value);
    return { sumNet, netWithMargin, gross, byCat };
  },[enriched,settings]);

  function addCabinet(){ setItems(p=>[...p,{id:uid("i"),category:"Szafki dolne",title:"Szafka dolna",kind:"Szafka",width:600,height:720,depth:560,qty:1,materialRef:"MDF lakier mat"}]); }
  function addWorktop(){ setItems(p=>[...p,{id:uid("i"),category:"Blat",title:"Blat roboczy",kind:"Blat",width:2400,depth:600,qty:1,materialRef:"Blat laminowany 38mm"}]); }
  function addCustom(){ setItems(p=>[...p,{id:uid("i"),category:"Akcesoria",title:"Pozycja niestandardowa",kind:"Element",qty:1,unit:"szt",overrideUnitPrice:0}]); }

  function exportPDF(){
    const doc=new jsPDF({unit:"pt",format:"a4"}); const pad=40; const pageW=doc.internal.pageSize.getWidth();
    doc.setFontSize(16); doc.text("Oferta – Zabudowa kuchenna",pad,48);
    doc.setFontSize(10); doc.text(`Data: ${project.date}`,pad,64); doc.text(`Klient: ${project.client}`,pad,78); doc.text(`Adres montażu: ${project.address}`,pad,92);
    doc.setFillColor(14,165,233); doc.rect(pad,102,pageW-2*pad,4,"F");
    const body = enriched.map((r:any)=>[r.category,r.title,`${Math.round(r.resolvedQty*100)/100} ${r.resolvedUnit}`,currency(r.resolvedUnitPrice),currency(r.accessoriesTotal),currency(r.value)]);
    autoTable(doc,{startY:118, head:[["Kategoria","Opis","Ilość","Cena jedn.","Dodatki","Wartość netto"]], body, styles:{fontSize:9,cellPadding:6}, headStyles:{fillColor:[245,245,245],textColor:20}, columnStyles:{2:{halign:"right"},3:{halign:"right"},4:{halign:"right"},5:{halign:"right"}}, theme:"grid"});
    let end=(doc as any).lastAutoTable?.finalY||200; const sumY=end+18;
    doc.setFontSize(11); doc.text(`Suma netto: ${currency(totals.sumNet)}`,pad,sumY);
    doc.text(`Z marżą ${Math.round(settings.margin*100)}%: ${currency(totals.netWithMargin)}`,pad,sumY+16);
    doc.text(`Brutto (VAT ${Math.round(settings.vat*100)}%): ${currency(totals.gross)}`,pad,sumY+32);
    doc.setFontSize(9); doc.setTextColor(120); doc.text(`${brand.company} • ${brand.contact}`,pad,820);
    doc.save(`Oferta_${project.client||"klient"}.pdf`);
  }

  return (<div className="min-h-screen bg-white text-slate-900">
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kalkulator wyceny mebli kuchennych</h1>
        <button onClick={exportPDF} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 shadow-sm hover:shadow"><Download className="h-4 w-4"/> Eksportuj PDF</button>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={addCabinet} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-slate-50"><Plus className="h-4 w-4"/> Dodaj szafkę</button>
        <button onClick={addWorktop} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-slate-50"><Plus className="h-4 w-4"/> Dodaj blat</button>
        <button onClick={addCustom} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-slate-50"><Plus className="h-4 w-4"/> Dodaj element</button>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b bg-slate-50">{["Kategoria","Tytuł","Materiał","Ilość","Cena jedn.","Dodatki","Wartość",""].map(h=> (<th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>))}</tr></thead>
          <tbody>
            {enriched.map((r:any)=>(<tr key={r.id} className="border-b hover:bg-slate-50/60">
              <td className="px-3 py-2">{r.category}</td>
              <td className="px-3 py-2">{r.title}</td>
              <td className="px-3 py-2">{r.materialRef||"—"}</td>
              <td className="px-3 py-2">{Math.round(r.resolvedQty*100)/100} {r.resolvedUnit}</td>
              <td className="px-3 py-2 text-right">{currency(r.resolvedUnitPrice)}</td>
              <td className="px-3 py-2 text-right">{currency(r.accessoriesTotal)}</td>
              <td className="px-3 py-2 text-right">{currency(r.value)}</td>
              <td className="px-3 py-2"><button onClick={()=> setItems(p=>p.filter(x=>x.id!==r.id))} className="rounded-lg border px-2 py-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4"/></button></td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm">
        <div>Suma netto: <b>{currency(totals.sumNet)}</b></div>
        <div>Z marżą ({Math.round(settings.margin*100)}%): <b>{currency(totals.netWithMargin)}</b></div>
        <div>Brutto (VAT {Math.round(settings.vat*100)}%): <b>{currency(totals.gross)}</b></div>
      </div>
    </div>
  </div>);
}
