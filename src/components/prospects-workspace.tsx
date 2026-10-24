"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";

export type ProspectView={id:string;name:string;domain:string|null;status:"NEW"|"REVIEWING"|"QUALIFIED"|"REJECTED";industry:string|null;location:string|null;source:"Apollo"|"CSV import";tags:string[];updatedAt:string;retrievedAt:string};
type SortKey="updated"|"name";
const label=(value:ProspectView["status"])=>value[0]+value.slice(1).toLowerCase();
const tone=(value:ProspectView["status"])=>value==="QUALIFIED"?"green":value==="REVIEWING"?"amber":value==="REJECTED"?"red":"blue";
const unique=(values:(string|null)[])=>[...new Set(values.filter((value):value is string=>Boolean(value)))].sort((a,b)=>a.localeCompare(b));
const parseTags=(value:string)=>[...new Set(value.split(",").map(tag=>tag.trim().toLowerCase()).filter(Boolean))].slice(0,20);

export function ProspectsWorkspace({initial}:{initial:ProspectView[]}){
  const [rows,setRows]=useState(initial),[selected,setSelected]=useState<ProspectView|null>(initial[0]??null),[query,setQuery]=useState(""),[status,setStatus]=useState(""),[source,setSource]=useState(""),[industry,setIndustry]=useState(""),[location,setLocation]=useState(""),[sort,setSort]=useState<SortKey>("updated"),[note,setNote]=useState(""),[tagText,setTagText]=useState(initial[0]?.tags.join(", ")??""),[updateMessage,setUpdateMessage]=useState(""),[saving,setSaving]=useState(false);
  const industries=useMemo(()=>unique(rows.map(row=>row.industry)),[rows]);
  const locations=useMemo(()=>unique(rows.map(row=>row.location)),[rows]);
  const filtered=useMemo(()=>rows.filter(row=>(!query||`${row.name} ${row.domain??""} ${row.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()))&&(!status||row.status===status)&&(!source||row.source===source)&&(!industry||row.industry===industry)&&(!location||row.location===location)).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):Date.parse(b.updatedAt)-Date.parse(a.updatedAt)),[rows,query,status,source,industry,location,sort]);
  function selectProspect(row:ProspectView){setSelected(row);setTagText(row.tags.join(", "));setNote("");setUpdateMessage("")}
  async function update(){
    if(!selected||saving)return;
    setSaving(true);
    setUpdateMessage("Saving…");
    const statusEl=document.getElementById("detail-status") as HTMLSelectElement;
    const newStatus=statusEl.value as ProspectView["status"];
    const tags=parseTags(tagText);
    try{
      const response=await fetch(`/api/prospects/${selected.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:newStatus,note:note||undefined,tags})});
      const result=await response.json().catch(()=>null);
      if(!response.ok){setUpdateMessage(result?.error?.message??"Update failed. Try again.");return}
      const next={...selected,status:newStatus,tags,updatedAt:new Date().toISOString()};
      setRows(current=>current.map(row=>row.id===selected.id?next:row));
      setSelected(next);
      setNote("");
      setUpdateMessage("Changes saved.");
    }catch{
      setUpdateMessage("Agent.Raven could not reach the server. Your changes were not saved; try again.");
    }finally{
      setSaving(false);
    }
  }
  return <><h1 className="page-title">Prospects</h1><p className="page-subtitle">Durable, organization-scoped company records.</p><div className="toolbar">
    <div className="field wide"><label htmlFor="prospect-search">Search</label><input className="input" id="prospect-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search companies, domains, or tags…"/></div>
    <div className="field"><label htmlFor="status-filter">Status</label><select className="select" id="status-filter" value={status} onChange={event=>setStatus(event.target.value)}><option value="">All statuses</option><option value="NEW">New</option><option value="REVIEWING">Reviewing</option><option value="QUALIFIED">Qualified</option><option value="REJECTED">Rejected</option></select></div>
    <div className="field"><label htmlFor="source-filter">Source</label><select className="select" id="source-filter" value={source} onChange={event=>setSource(event.target.value)}><option value="">All sources</option><option value="Apollo">Apollo</option><option value="CSV import">CSV import</option></select></div>
    <div className="field"><label htmlFor="industry-filter">Industry</label><select className="select" id="industry-filter" value={industry} onChange={event=>setIndustry(event.target.value)}><option value="">All industries</option>{industries.map(value=><option key={value}>{value}</option>)}</select></div>
    <div className="field"><label htmlFor="location-filter">Location</label><select className="select" id="location-filter" value={location} onChange={event=>setLocation(event.target.value)}><option value="">All locations</option>{locations.map(value=><option key={value}>{value}</option>)}</select></div>
    <div className="field"><label htmlFor="sort-filter">Sort by</label><select className="select" id="sort-filter" value={sort} onChange={event=>setSort(event.target.value as SortKey)}><option value="updated">Recently updated</option><option value="name">Company A–Z</option></select></div>
  </div><section className="panel drawer-layout"><div><div className="panel-head"><div><h2>Prospect records</h2><p>Saved provider and CSV records.</p></div><Link className="btn" href="/find-businesses#csv-import"><Upload/>Import CSV</Link></div>{filtered.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Company</th><th>Status</th><th>Industry</th><th>Location</th><th>Source</th><th>Tags</th><th>Updated</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} className={selected?.id===row.id?"selected":""} onClick={()=>selectProspect(row)} tabIndex={0} onKeyDown={event=>{if(event.key==="Enter")selectProspect(row)}}><td className="company-cell"><strong>{row.name}</strong><span>{row.domain??"No domain"}</span></td><td><span className={`badge ${tone(row.status)}`}>{label(row.status)}</span></td><td>{row.industry??"—"}</td><td>{row.location??"—"}</td><td>{row.source}</td><td>{row.tags.length?row.tags.map(tag=><span className="badge" key={tag} style={{marginRight:4}}>{tag}</span>):"—"}</td><td>{new Date(row.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>:<div className="empty"><strong>No prospects found</strong>Adjust the filters or import a validated CSV.</div>}<div className="pagination"><span>Showing {filtered.length} of {rows.length}</span><div className="pages"><span className="page active">1</span></div></div></div>
    <aside className="detail-drawer">{selected?<><h2>{selected.name}</h2><div className="domain">{selected.domain??"Domain unavailable"}</div><div className="detail-section"><div className="detail-list"><div className="detail-item"><span>Source</span><strong>{selected.source}</strong></div><div className="detail-item"><span>Last retrieved</span><strong>{new Date(selected.retrievedAt).toLocaleString()}</strong></div><div className="detail-item"><span>Location</span><strong>{selected.location??"Unavailable"}</strong></div></div></div><div className="detail-section stack"><div className="field"><label htmlFor="detail-status">Status</label><select id="detail-status" className="select" defaultValue={selected.status} key={selected.id}><option value="NEW">New</option><option value="REVIEWING">Reviewing</option><option value="QUALIFIED">Qualified</option><option value="REJECTED">Rejected</option></select></div><div className="field"><label htmlFor="tags">Tags</label><input id="tags" className="input" value={tagText} onChange={event=>setTagText(event.target.value)} placeholder="priority, roofing, vegas"/><span className="field-hint">Separate tags with commas.</span></div><div className="field"><label htmlFor="note">Add note</label><textarea id="note" className="textarea" value={note} onChange={event=>setNote(event.target.value)} placeholder="Record review context…"/></div><button className="btn primary" type="button" disabled={saving} onClick={update}>{saving?"Saving…":"Save changes"}</button>{updateMessage&&<div role="status" className="alert">{updateMessage}</div>}</div></>:<div className="empty">Select a prospect to review details.</div>}</aside>
  </section></>
}
