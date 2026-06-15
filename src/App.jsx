import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

const C = {
  sidebar:"#18181b", sH:"rgba(255,255,255,.08)", sA:"rgba(255,255,255,.15)",
  p:"#6366f1", pL:"#eef2ff", pD:"#4f46e5",
  ok:"#10b981", warn:"#f59e0b", err:"#ef4444", pur:"#8b5cf6",
  bg:"#f8fafc", card:"#ffffff", border:"#e2e8f0",
  tx:"#0f172a", mu:"#64748b", hi:"#94a3b8",
};
const PRIORITIES = {
  high:  {label:"High",   color:"#ef4444", bg:"#fef2f2"},
  medium:{label:"Medium", color:"#f59e0b", bg:"#fffbeb"},
  low:   {label:"Low",    color:"#6366f1", bg:"#eef2ff"},
};
const STATUSES = {
  not_started:{label:"Not started", color:"#94a3b8", bg:"#f8fafc", icon:"○"},
  in_progress: {label:"In progress",  color:"#3b82f6", bg:"#eff6ff", icon:"◑"},
  in_review:   {label:"In review",    color:"#8b5cf6", bg:"#f5f3ff", icon:"◔"},
  blocked:     {label:"Blocked",      color:"#f59e0b", bg:"#fffbeb", icon:"⊘"},
  done:        {label:"Done",         color:"#10b981", bg:"#f0fdf4", icon:"●"},
  abandoned:   {label:"Abandoned",    color:"#6b7280", bg:"#f3f4f6", icon:"✕"},
};
const TAG_PAL   = ["#6366f1","#ec4899","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#06b6d4","#84cc16","#f97316"];
const CAT_COLS  = [...TAG_PAL];
const autoTagC  = t => { let h=0; for(let c of t) h=(h*31+c.charCodeAt(0))%TAG_PAL.length; return TAG_PAL[h]; };
const fmtDt     = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "";
const fmtDay    = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}) : "";
const fmtFull   = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
const isOD      = (dt,done) => !done&&dt&&new Date(dt)<new Date();
const sameDay   = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WDAYS     = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const PO        = {high:0,medium:1,low:2};
const toDateStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const fromDB = (r,assignees=[]) => ({
  id:r.id, title:r.title, desc:r.description||"", descHtml:r.description_html||"",
  cat:r.category||"work", priority:r.priority||"medium", status:r.status||"not_started",
  due:r.due_date||"", startDate:r.start_date||"", closedAt:r.closed_at||null,
  done:r.done||false, tags:r.tags||[], parentId:r.parent_id||null,
  createdAt:r.created_at, createdBy:r.created_by||null, assignees, deps:[],
  customCategoryId:r.custom_category_id||null, taskCode:r.task_code||null,
});

function useIsMobile() {
  const [m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{ const h=()=>setM(window.innerWidth<768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);
  return m;
}

// ── Date Range Picker ─────────────────────────────────────────
function DateRangePicker({ startDate, endDate, onChangeStart, onChangeEnd }) {
  const [viewDate,setViewDate]=useState(()=> startDate ? new Date(startDate) : new Date());
  const [phase,setPhase]=useState("start"); // "start" | "end"
  const [hover,setHover]=useState(null);

  const yr=viewDate.getFullYear(), mo=viewDate.getMonth();
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const firstDay=(d=>d===0?6:d-1)(new Date(yr,mo,1).getDay());

  const sD=startDate?new Date(startDate.slice(0,10)+"T12:00"):null;
  const eD=endDate  ?new Date(endDate.slice(0,10)+"T12:00"):null;

  const clickDay=d=>{
    const ds=toDateStr(d);
    const time=(iso)=>iso?iso.slice(11,16):"";
    if(phase==="start"||!sD){
      onChangeStart(ds+"T"+(time(startDate)||"09:00")); onChangeEnd(""); setPhase("end");
    } else {
      if(d<sD){ onChangeStart(ds+"T"+(time(startDate)||"09:00")); onChangeEnd(""); setPhase("end"); }
      else { onChangeEnd(ds+"T"+(time(endDate)||"18:00")); setPhase("start"); }
    }
  };

  const inRange=d=>{ if(!sD) return false; const e=eD||hover; if(!e) return false; return d>sD&&d<e; };
  const isS=d=>sD&&sameDay(d,sD); const isE=d=>eD&&sameDay(d,eD);
  const isToday=d=>sameDay(d,new Date());

  const updateTime=(which,val)=>{
    if(which==="start"&&startDate) onChangeStart(startDate.slice(0,10)+"T"+val);
    if(which==="end"  &&endDate)   onChangeEnd(endDate.slice(0,10)+"T"+val);
  };

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",userSelect:"none"}}>
      {/* Phase indicator */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <div style={{flex:1,padding:"7px 10px",borderRadius:8,border:`1.5px solid ${phase==="start"?C.p:startDate?C.ok:C.border}`,background:phase==="start"?C.pL:"#fff",cursor:"pointer"}} onClick={()=>setPhase("start")}>
          <div style={{fontSize:9,fontWeight:600,color:C.hi,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Start date</div>
          <div style={{fontSize:13,fontWeight:600,color:startDate?C.tx:C.hi}}>{startDate?fmtDay(startDate):"Click to set"}</div>
          {startDate&&<div style={{fontSize:11,color:C.mu}}>{startDate.slice(11,16)}</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",color:C.hi,fontSize:18}}>→</div>
        <div style={{flex:1,padding:"7px 10px",borderRadius:8,border:`1.5px solid ${phase==="end"?C.p:endDate?C.ok:C.border}`,background:phase==="end"?C.pL:"#fff",cursor:"pointer"}} onClick={()=>startDate&&setPhase("end")}>
          <div style={{fontSize:9,fontWeight:600,color:C.hi,textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>End date</div>
          <div style={{fontSize:13,fontWeight:600,color:endDate?C.tx:C.hi}}>{endDate?fmtDay(endDate):"Click to set"}</div>
          {endDate&&<div style={{fontSize:11,color:C.mu}}>{endDate.slice(11,16)}</div>}
        </div>
        {(startDate||endDate)&&<button onClick={()=>{onChangeStart("");onChangeEnd("");setPhase("start");}} style={{border:"none",background:"none",color:C.hi,cursor:"pointer",fontSize:18,padding:"0 4px",alignSelf:"center"}}>×</button>}
      </div>

      {/* Month nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>setViewDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={{border:"none",background:"none",cursor:"pointer",color:C.mu,fontSize:18,padding:"0 4px"}}>‹</button>
        <span style={{fontSize:13,fontWeight:600,color:C.tx}}>{MONTHS[mo]} {yr}</span>
        <button onClick={()=>setViewDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={{border:"none",background:"none",cursor:"pointer",color:C.mu,fontSize:18,padding:"0 4px"}}>›</button>
      </div>

      {/* Day headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
        {WDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:C.hi,padding:"3px 0"}}>{d[0]}</div>)}
      </div>

      {/* Days grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
        {Array.from({length:daysInMo}).map((_,i)=>{
          const day=i+1;
          const d=new Date(yr,mo,day);
          const start=isS(d), end=isE(d), range=inRange(d), today=isToday(d);
          const hov=hover&&sameDay(d,hover);
          const endpointStyle=start||end ? {background:C.p,color:"#fff",borderRadius:"50%",fontWeight:700} : {};
          const rangeStyle=range ? {background:C.pL} : {};
          const rounding=start&&!end ? "50% 0 0 50%" : !start&&end ? "0 50% 50% 0" : start&&end ? "50%" : range ? "0" : "50%";
          return(
            <div key={day} onClick={()=>clickDay(d)} onMouseEnter={()=>setHover(d)} onMouseLeave={()=>setHover(null)}
              style={{height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",borderRadius:range?rounding:"50%",
                background:start||end?C.p:range?C.pL:"transparent",
                fontSize:12, fontWeight:start||end?700:today?600:400,
                color:start||end?"#fff":today?C.p:C.tx,
                border:today&&!start&&!end?`1.5px solid ${C.p}`:"none",
                outline:hov&&!start&&!end?`1.5px solid ${C.p}`:"none",
                transition:"all .1s"}}>
              {day}
            </div>
          );
        })}
      </div>

      {/* Time pickers */}
      <div style={{display:"flex",gap:10,marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <div style={{flex:1}}>
          <label style={{fontSize:10,fontWeight:600,color:C.hi,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>Start time</label>
          <input type="time" value={startDate?startDate.slice(11,16):"09:00"} onChange={e=>updateTime("start",e.target.value)} disabled={!startDate}
            style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 8px",fontSize:13,color:startDate?C.tx:C.hi,background:startDate?"#fff":C.bg,boxSizing:"border-box"}}/>
        </div>
        <div style={{flex:1}}>
          <label style={{fontSize:10,fontWeight:600,color:C.hi,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>End time</label>
          <input type="time" value={endDate?endDate.slice(11,16):"18:00"} onChange={e=>updateTime("end",e.target.value)} disabled={!endDate}
            style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 8px",fontSize:13,color:endDate?C.tx:C.hi,background:endDate?"#fff":C.bg,boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",paddingBottom:2}}>
          <button onClick={()=>{onChangeStart("");onChangeEnd("");setPhase("start");}} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",color:C.mu}}>Clear</button>
        </div>
      </div>
    </div>
  );
}

// ── Tag Picker ────────────────────────────────────────────────
function TagPicker({ selected, onChange, customTags, onCreateTag }) {
  const [newName,setNewName]=useState(""); const [newColor,setNewColor]=useState("#6366f1"); const [showNew,setShowNew]=useState(false);
  const getC = name => { const ct=customTags.find(t=>t.name===name); return ct?ct.color:autoTagC(name); };
  const toggle = name => onChange(selected.includes(name)?selected.filter(t=>t!==name):[...selected,name]);
  const create = async() => {
    if(!newName.trim()) return;
    const name=newName.trim().toLowerCase().replace(/\s+/g,"-");
    await onCreateTag({name,color:newColor});
    if(!selected.includes(name)) onChange([...selected,name]);
    setNewName(""); setShowNew(false);
  };
  // All known tags (custom + used in selected but not in catalog)
  const allKnown=[...customTags.map(t=>t.name),...selected.filter(s=>!customTags.find(t=>t.name===s))];
  const unique=[...new Set(allKnown)];
  return (
    <div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        {unique.map(name=>{ const c=getC(name); const sel=selected.includes(name); return(
          <button key={name} onClick={()=>toggle(name)} style={{
            background: sel?c:"#fff",
            color: sel?"#fff":c,
            border:`1.5px solid ${c}`,
            borderRadius:99, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer", transition:"all .15s"}}>
            {sel?"✓ ":""}<span style={{opacity:.8}}>#</span>{name}
          </button>
        );})}
        <button onClick={()=>setShowNew(!showNew)} style={{border:`1.5px dashed ${C.border}`,background:"none",borderRadius:99,padding:"4px 10px",fontSize:11,color:C.mu,cursor:"pointer"}}>+ New tag</button>
      </div>
      {showNew&&(
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:10,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&create()} placeholder="tag name" autoFocus
            style={{border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 10px",fontSize:13,outline:"none",fontFamily:"inherit",flex:"1 1 100px"}}/>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{TAG_PAL.map(c=><button key={c} onClick={()=>setNewColor(c)} style={{width:20,height:20,borderRadius:"50%",background:c,border:newColor===c?"3px solid #111":"2px solid transparent",cursor:"pointer"}}/>)}</div>
          <div style={{display:"flex",gap:5}}>
            <button onClick={create} style={{background:newColor,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Add</button>
            <button onClick={()=>setShowNew(false)} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"6px 10px",fontSize:12,color:C.mu,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}
      {/* Preview of selected */}
      {selected.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
        {selected.map(name=>{ const c=getC(name); return(
          <span key={name} style={{display:"inline-flex",alignItems:"center",gap:4,background:c,color:"#fff",borderRadius:99,padding:"3px 9px",fontSize:11,fontWeight:600}}>
            #{name}
            <span onClick={()=>onChange(selected.filter(t=>t!==name))} style={{cursor:"pointer",opacity:.75,fontSize:14,lineHeight:1}}>×</span>
          </span>
        );})}
      </div>}
    </div>
  );
}

// ── Comments Section ──────────────────────────────────────────
function CommentsSection({ taskId, session }) {
  const [items,setItems]=useState([]); const [input,setInput]=useState(""); const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{ const {data}=await supabase.from("task_comments").select("*, profiles(email,full_name)").eq("task_id",taskId).order("created_at"); setItems(data||[]); setLoading(false); },[taskId]);
  useEffect(()=>{ load(); },[load]);
  const add=async()=>{ if(!input.trim()) return; await supabase.from("task_comments").insert({task_id:taskId,user_id:session.user.id,content:input.trim(),is_log:false}); setInput(""); load(); };
  const del=async id=>{ await supabase.from("task_comments").delete().eq("id",id); load(); };
  if(loading) return <div style={{color:C.hi,fontSize:13,padding:"8px 0"}}>Loading…</div>;
  return (
    <div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {items.length===0&&<p style={{color:C.hi,fontSize:13,margin:0}}>No activity yet.</p>}
        {items.map(item=>(
          <div key={item.id} style={{display:"flex",gap:9,alignItems:"flex-start"}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:item.is_log?C.bg:C.pL,border:`1px solid ${item.is_log?C.border:C.p+"44"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:item.is_log?C.hi:C.p,flexShrink:0}}>
              {item.is_log?"⚡":(item.profiles?.full_name||item.profiles?.email||"?")[0].toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:2}}>
                <span style={{fontSize:11,fontWeight:600,color:item.is_log?C.mu:C.tx}}>{item.is_log?"System":(item.profiles?.full_name||item.profiles?.email||"User")}</span>
                <span style={{fontSize:10,color:C.hi}}>{fmtFull(item.created_at)}</span>
                {!item.is_log&&item.user_id===session.user.id&&<button onClick={()=>del(item.id)} style={{border:"none",background:"none",color:C.hi,cursor:"pointer",fontSize:12,padding:0,marginLeft:"auto"}}>×</button>}
              </div>
              <div style={{fontSize:13,color:item.is_log?C.mu:C.tx,fontStyle:item.is_log?"italic":"normal",background:item.is_log?"transparent":C.bg,border:item.is_log?"none":`1px solid ${C.border}`,borderRadius:8,padding:item.is_log?"0":"8px 10px",lineHeight:1.5}}>{item.content}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:7}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),add())} placeholder="Add a comment…"
          style={{flex:1,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
        <button onClick={add} disabled={!input.trim()} style={{background:C.p,color:"#fff",border:"none",borderRadius:9,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer",opacity:!input.trim()?.5:1}}>Send</button>
      </div>
    </div>
  );
}

// ── Rich Editor ───────────────────────────────────────────────
function RichEditor({content,onChange}) {
  const ed=useEditor({extensions:[StarterKit],content,onUpdate:({editor})=>onChange(editor.getHTML())});
  if(!ed) return null;
  const tb=(fn,l,a)=><button type="button" onClick={fn} style={{border:`1px solid ${a?"#6366f1":"#e5e5e5"}`,borderRadius:5,background:a?"#eef2ff":"#fff",color:a?"#6366f1":"#555",padding:"3px 7px",fontSize:11,cursor:"pointer",fontWeight:600}}>{l}</button>;
  return (
    <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
      <div style={{display:"flex",gap:3,padding:"5px 8px",borderBottom:"1px solid #f0f0f0",flexWrap:"wrap",background:"#fafafa"}}>
        {tb(()=>ed.chain().focus().toggleBold().run(),"B",ed.isActive("bold"))}
        {tb(()=>ed.chain().focus().toggleItalic().run(),"I",ed.isActive("italic"))}
        {tb(()=>ed.chain().focus().toggleHeading({level:2}).run(),"H2",ed.isActive("heading",{level:2}))}
        {tb(()=>ed.chain().focus().toggleBulletList().run(),"• List",ed.isActive("bulletList"))}
        {tb(()=>ed.chain().focus().toggleCode().run(),"</>",ed.isActive("code"))}
      </div>
      <EditorContent editor={ed} style={{padding:"9px 12px",minHeight:70,fontSize:14,lineHeight:1.6}}/>
    </div>
  );
}

// ── Task Form (centré, backdrop-close, onglets) ───────────────
function TaskForm({task,tasks,profiles,categories,customTags,onSave,onClose,onCreateCategory,onCreateTag,onChangeStatus,session}) {
  const mob=useIsMobile(), isEdit=!!task?.id;
  const [tab,setTab]=useState("edit");
  const [form,setForm]=useState({
    title:task?.title||"", descHtml:task?.descHtml||"",
    cat:task?.cat||"work", priority:task?.priority||"medium", status:task?.status||"not_started",
    due:task?.due||"", startDate:task?.startDate||"",
    tags:task?.tags||[], assignees:task?.assignees?.map(a=>a.id)||[],
    parentId:task?.parentId?String(task.parentId):"",
    deps:task?.deps?.map(d=>d.id)||[],
    customCategoryId:task?.customCategoryId?String(task.customCategoryId):"",
  });
  const [saving,setSaving]=useState(false); const [err,setErr]=useState("");
  const [showNewCat,setShowNewCat]=useState(false);
  const [newCatName,setNewCatName]=useState(""); const [newCatCode,setNewCatCode]=useState(""); const [newCatColor,setNewCatColor]=useState("#6366f1");

  const toggle=(field,id)=>setForm(f=>({...f,[field]:f[field].includes(id)?f[field].filter(x=>x!==id):[...f[field],id]}));
  const avail=tasks.filter(t=>t.id!==task?.id);

  const createCat=async()=>{
    if(!newCatName.trim()||!newCatCode.trim()) return;
    const cat=await onCreateCategory({name:newCatName.trim(),code:newCatCode,color:newCatColor});
    if(cat){setForm(f=>({...f,customCategoryId:String(cat.id)}));setShowNewCat(false);setNewCatName("");setNewCatCode("");}
  };

  const handleSave=async()=>{
    if(!form.title.trim()){setErr("Title is required.");return;}
    if(!form.customCategoryId){setErr("Please select or create a category.");return;}
    setErr(""); setSaving(true); await onSave(form,task?.id); setSaving(false);
  };

  const IS={
    inp:{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 11px",fontSize:14,marginBottom:0,boxSizing:"border-box",outline:"none",fontFamily:"inherit",color:C.tx},
    lbl:{fontSize:10,fontWeight:600,color:C.mu,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
    sel:{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:"inherit",background:"#fff",boxSizing:"border-box",color:C.tx},
  };

  const cat=categories.find(c=>String(c.id)===form.customCategoryId);

  return (
    // Backdrop — click outside to close
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?"0":"16px"}}>
      <div style={{background:C.card,borderRadius:mob?0:16,width:"100%",maxWidth:680,maxHeight:mob?"100vh":"90vh",height:mob?"100%":undefined,display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,.25)"}}>
        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            {cat&&<span style={{fontSize:10,fontWeight:700,color:cat.color,fontFamily:"monospace",background:cat.color+"18",borderRadius:5,padding:"2px 7px"}}>{task?.taskCode||cat.code}</span>}
            <div style={{flex:1,position:"relative"}}>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Task title"
                style={{width:"100%",border:`1.5px solid ${!form.title.trim()?C.err:"transparent"}`,borderRadius:7,fontSize:17,fontWeight:600,color:C.tx,outline:"none",fontFamily:"inherit",background:"transparent",padding:"2px 4px",boxSizing:"border-box"}}/>
              <span style={{position:"absolute",top:-8,left:0,fontSize:9,color:C.err,fontWeight:700,background:C.card,padding:"0 3px"}}>Title *</span>
            </div>
            <button onClick={onClose} style={{border:"none",background:C.bg,borderRadius:8,width:30,height:30,fontSize:18,cursor:"pointer",color:C.hi,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
          {/* Status row */}
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {Object.entries(STATUSES).map(([k,v])=>(
              <button key={k} onClick={()=>{setForm(f=>({...f,status:k})); if(isEdit&&onChangeStatus) onChangeStatus(task.id,k);}}
                style={{border:`1.5px solid ${form.status===k?v.color:C.border}`,background:form.status===k?v.color+"20":"#fff",color:form.status===k?v.color:C.mu,borderRadius:99,padding:"4px 10px",fontSize:11,fontWeight:form.status===k?700:400,cursor:"pointer"}}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>
        {/* Tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0,padding:"0 20px"}}>
          {[["edit","✏️ Edit"],["comments","💬 Log & Comments"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{border:"none",background:"none",padding:"10px 14px 10px 0",fontSize:13,fontWeight:tab===t?600:400,color:tab===t?C.p:C.mu,borderBottom:tab===t?`2px solid ${C.p}`:"2px solid transparent",cursor:"pointer",marginRight:8}}>{l}</button>
          ))}
        </div>
        {/* Body */}
        <div style={{overflowY:"auto",flex:1,padding:"16px 20px"}}>
          {tab==="edit"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"7px 11px",fontSize:13,color:C.err}}>{err}</div>}

              {/* Category */}
              <div>
                <label style={IS.lbl}>Category <span style={{color:C.err}}>*</span></label>
                <div style={{display:"flex",gap:7}}>
                  <select value={form.customCategoryId} onChange={e=>setForm(f=>({...f,customCategoryId:e.target.value}))} style={{...IS.sel,flex:1,borderColor:!form.customCategoryId?"#fca5a5":C.border}}>
                    <option value="">— Select a category —</option>
                    {categories.map(c=><option key={c.id} value={c.id}>[{c.code}] {c.name}</option>)}
                  </select>
                  <button onClick={()=>setShowNewCat(!showNewCat)} style={{border:`1.5px solid ${showNewCat?C.p:C.border}`,background:showNewCat?C.pL:"#fff",borderRadius:8,padding:"0 12px",fontSize:12,cursor:"pointer",color:showNewCat?C.p:C.mu,whiteSpace:"nowrap"}}>+ New</button>
                </div>
                {showNewCat&&(
                  <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:10,marginTop:7}}>
                    <div style={{display:"flex",gap:7,marginBottom:7}}>
                      <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Name" style={{...IS.inp,flex:1}}/>
                      <input value={newCatCode} onChange={e=>setNewCatCode(e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,5))} placeholder="CODE" style={{...IS.inp,width:75,fontFamily:"monospace",fontWeight:700,textAlign:"center"}}/>
                    </div>
                    <div style={{display:"flex",gap:3,marginBottom:7,flexWrap:"wrap"}}>{CAT_COLS.map(c=><button key={c} onClick={()=>setNewCatColor(c)} style={{width:20,height:20,borderRadius:"50%",background:c,border:newCatColor===c?"3px solid #111":"1px solid transparent",cursor:"pointer"}}/>)}</div>
                    <button onClick={createCat} style={{background:newCatColor,color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Create & select</button>
                  </div>
                )}
              </div>

              {/* Priority + Type */}
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={IS.lbl}>Priority</label>
                  <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={IS.sel}>
                    <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🔵 Low</option>
                  </select>
                </div>
                <div style={{flex:1}}>
                  <label style={IS.lbl}>Type</label>
                  <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={IS.sel}>
                    <option value="work">💼 Work</option><option value="personal">🏠 Personal</option>
                  </select>
                </div>
              </div>

              {/* Date range picker */}
              <div>
                <label style={IS.lbl}>Dates</label>
                <DateRangePicker startDate={form.startDate} endDate={form.due} onChangeStart={v=>setForm(f=>({...f,startDate:v}))} onChangeEnd={v=>setForm(f=>({...f,due:v}))}/>
              </div>

              {/* Description */}
              <div>
                <label style={IS.lbl}>Description</label>
                <RichEditor content={form.descHtml} onChange={html=>setForm(f=>({...f,descHtml:html}))}/>
              </div>

              {/* Tags */}
              <div>
                <label style={IS.lbl}>Tags</label>
                <TagPicker selected={form.tags} onChange={tags=>setForm(f=>({...f,tags}))} customTags={customTags} onCreateTag={onCreateTag}/>
              </div>

              {/* Assignees */}
              <div>
                <label style={IS.lbl}>Assignees</label>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {profiles.map(p=>{const a=form.assignees.includes(p.id);return(
                    <button key={p.id} type="button" onClick={()=>toggle("assignees",p.id)} style={{border:`1.5px solid ${a?C.p:C.border}`,background:a?C.pL:"#fff",color:a?C.p:C.mu,borderRadius:99,padding:"5px 12px",fontSize:12,fontWeight:a?600:400,cursor:"pointer"}}>{a?"✓ ":""}{p.full_name||p.email}</button>
                  );})}
                </div>
              </div>

              {/* Parent + Deps */}
              <div>
                <label style={IS.lbl}>Parent task</label>
                <select value={form.parentId} onChange={e=>setForm(f=>({...f,parentId:e.target.value}))} style={IS.sel}>
                  <option value="">— None —</option>
                  {avail.map(t=><option key={t.id} value={t.id}>{t.taskCode?`[${t.taskCode}] `:""}{t.title.slice(0,40)}</option>)}
                </select>
              </div>
              <div>
                <label style={IS.lbl}>Blocked by</label>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {avail.map(t=>{const a=form.deps.includes(t.id);return(
                    <button key={t.id} type="button" onClick={()=>toggle("deps",t.id)} style={{border:`1.5px solid ${a?"#ef4444":C.border}`,background:a?"#fef2f2":"#fff",color:a?C.err:C.mu,borderRadius:99,padding:"4px 9px",fontSize:11,fontWeight:a?600:400,cursor:"pointer"}}>
                      {a?"🔒 ":""}{t.taskCode?`[${t.taskCode}] `:""}{t.title.slice(0,22)}
                    </button>
                  );})}
                  {!avail.length&&<span style={{fontSize:11,color:C.hi}}>No other tasks</span>}
                </div>
              </div>

              {/* Metadata (edit mode) */}
              {isEdit&&task&&(
                <div style={{background:C.bg,borderRadius:9,padding:"10px 14px"}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.hi,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Activity</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {[["Created",fmtFull(task.createdAt)],["Started",task.startDate?fmtFull(task.startDate):"—"],["Due",task.due?fmtFull(task.due):"—"],["Closed",task.closedAt?fmtFull(task.closedAt):"—"]].map(([l,v])=>(
                      <div key={l}><div style={{fontSize:9,color:C.hi,textTransform:"uppercase",letterSpacing:.4}}>{l}</div><div style={{fontSize:11,color:C.tx,marginTop:1}}>{v}</div></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab==="comments"&&task?.id&&<CommentsSection taskId={task.id} session={session}/>}
          {tab==="comments"&&!task?.id&&<p style={{color:C.hi,fontSize:13}}>Save the task first to add comments.</p>}
        </div>
        {/* Footer */}
        <div style={{padding:"12px 20px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,justifyContent:"flex-end",flexShrink:0,background:C.card}}>
          <button onClick={onClose} style={{border:`1.5px solid ${C.border}`,background:"#fff",borderRadius:9,padding:"9px 18px",fontSize:13,cursor:"pointer",color:C.mu}}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{background:`linear-gradient(135deg,${C.p},${C.pur})`,color:"#fff",border:"none",borderRadius:9,padding:"9px 22px",fontSize:13,fontWeight:600,cursor:"pointer",opacity:saving?.7:1}}>
            {saving?"Saving…":isEdit?"Save changes":"Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────
function TaskCard({ t, categories, customTags, onEdit, onChangeStatus }) {
  const mob=useIsMobile();
  const p=PRIORITIES[t.priority]||PRIORITIES.medium;
  const st=STATUSES[t.status]||STATUSES.not_started;
  const cat=categories.find(c=>c.id==t.customCategoryId);
  const late=isOD(t.due,t.done);
  const getC=name=>{ const ct=customTags.find(t=>t.name===name); return ct?ct.color:autoTagC(name); };
  const [showStatus,setShowStatus]=useState(false);

  return (
    <div style={{background:C.card,border:`1px solid ${late?"#fecaca":C.border}`,borderRadius:11,padding:mob?"11px 13px":"12px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",transition:"box-shadow .15s",borderLeft:`4px solid ${t.done?"#e2e8f0":p.color}`,position:"relative"}}
      onClick={()=>onEdit(t)}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,.08)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
      {/* Status */}
      <div style={{position:"relative",flexShrink:0}} onClick={e=>{e.stopPropagation();setShowStatus(s=>!s);}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:st.color+"15",border:`2px solid ${st.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,cursor:"pointer",color:st.color}}>
          {st.icon}
        </div>
        {showStatus&&(
          <div style={{position:"absolute",top:32,left:0,background:"#fff",border:`1px solid ${C.border}`,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:50,minWidth:150,padding:4}}>
            {Object.entries(STATUSES).map(([k,v])=>(
              <button key={k} onClick={e=>{e.stopPropagation();onChangeStatus(t.id,k);setShowStatus(false);}}
                style={{display:"flex",alignItems:"center",gap:7,width:"100%",padding:"7px 10px",border:"none",background:(t.status||"not_started")===k?C.pL:"transparent",borderRadius:7,fontSize:12,fontWeight:(t.status||"not_started")===k?600:400,color:(t.status||"not_started")===k?C.p:C.tx,cursor:"pointer",textAlign:"left"}}>
                <span style={{color:v.color}}>{v.icon}</span>{v.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Content */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:3}}>
          {t.taskCode&&cat&&<span style={{fontSize:9,fontWeight:700,color:cat.color,fontFamily:"monospace",background:cat.color+"18",borderRadius:4,padding:"1px 5px",flexShrink:0}}>{t.taskCode}</span>}
          <span style={{fontSize:mob?13:14,fontWeight:600,color:t.done?"#94a3b8":C.tx,textDecoration:t.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{t.title}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
          <span style={{fontSize:10,padding:"1px 6px",borderRadius:99,background:p.bg,color:p.color,fontWeight:600}}>{p.label}</span>
          <span style={{fontSize:10,padding:"1px 6px",borderRadius:99,background:st.color+"15",color:st.color,fontWeight:500}}>{st.label}</span>
          {(t.tags||[]).slice(0,mob?1:2).map(tag=>{const c=getC(tag);return<span key={tag} style={{fontSize:9,background:c,color:"#fff",borderRadius:99,padding:"1px 6px",fontWeight:600}}>#{tag}</span>;})}
          {(t.assignees||[]).length>0&&<span style={{fontSize:10,color:C.hi}}>👤×{t.assignees.length}</span>}
          {t.due&&<span style={{fontSize:10,color:late?C.err:C.hi,marginLeft:"auto",whiteSpace:"nowrap"}}>🕐 {fmtDay(t.due)}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Sprint View ────────────────────────────────────────────────
function SprintView({ tasks, categories, customTags, onEdit, onChangeStatus }) {
  const mob=useIsMobile();
  const [sprintCat,setSprintCat]=useState("all");
  const [showDone,setShowDone]=useState(false);
  const getC=name=>{ const ct=customTags.find(t=>t.name===name); return ct?ct.color:autoTagC(name); };
  const filtered=tasks
    .filter(t=>sprintCat==="all"||String(t.customCategoryId||"none")===sprintCat)
    .filter(t=>showDone||(t.status||"not_started")!=="done");
  const catOptions=[["all","All",null],...categories.map(c=>[String(c.id),c.code+" "+c.name,c.color]),["none","No cat",null]];
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        <span style={{fontSize:11,fontWeight:600,color:C.hi}}>📁</span>
        {catOptions.map(([v,l,col])=>{
          const active=sprintCat===v;
          return (
            <button key={v} onClick={()=>setSprintCat(active?"all":v)}
              style={{border:`1px solid ${active?(col||C.p):C.border}`,background:active?(col||C.p)+"22":"#fff",color:active?(col||C.p):C.mu,borderRadius:99,padding:"4px 10px",fontSize:11,fontWeight:active?700:400,cursor:"pointer"}}>
              {l}
            </button>
          );
        })}
        <button onClick={()=>setShowDone(s=>!s)}
          style={{marginLeft:"auto",border:`1px solid ${showDone?C.ok:C.border}`,background:showDone?C.ok+"18":"#fff",color:showDone?C.ok:C.mu,borderRadius:99,padding:"4px 10px",fontSize:11,fontWeight:showDone?600:400,cursor:"pointer"}}>
          {showDone?"✓ Showing done":"Show done"}
        </button>
      </div>
      <div style={{overflowX:"auto",paddingBottom:8}}>
      <div style={{display:"flex",gap:10,minWidth:mob?"800px":"auto"}}>
        {Object.entries(STATUSES).map(([key,st])=>{
          const col=filtered.filter(t=>(t.status||"not_started")===key);
          return(
            <div key={key} style={{flex:1,minWidth:mob?"190px":"auto",display:"flex",flexDirection:"column"}}>
              <div style={{padding:"8px 10px",borderRadius:"9px 9px 0 0",background:st.color+"18",border:`1px solid ${st.color}33`,borderBottom:"none",display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:st.color}}>{st.icon}</span>
                <span style={{fontSize:12,fontWeight:700,color:C.tx}}>{st.label}</span>
                <span style={{marginLeft:"auto",fontSize:11,fontWeight:600,color:st.color,background:st.color+"20",borderRadius:99,padding:"1px 7px"}}>{col.length}</span>
              </div>
              <div style={{flex:1,border:`1px solid ${st.color}22`,borderTop:"none",borderRadius:"0 0 9px 9px",background:"#f9fafb",padding:7,minHeight:180,display:"flex",flexDirection:"column",gap:6}}>
                {col.map(t=>{
                  const p=PRIORITIES[t.priority]||PRIORITIES.medium;
                  const cat=categories.find(c=>c.id==t.customCategoryId);
                  return(
                    <div key={t.id} onClick={()=>onEdit(t)} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",cursor:"pointer",borderLeft:`3px solid ${p.color}`}}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.08)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                      {t.taskCode&&cat&&<div style={{fontSize:9,fontWeight:700,color:cat.color,fontFamily:"monospace",marginBottom:2}}>{t.taskCode}</div>}
                      <div style={{fontSize:12,fontWeight:600,color:C.tx,lineHeight:1.3,marginBottom:5}}>{t.title}</div>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap",alignItems:"center"}}>
                        <span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:p.bg,color:p.color,fontWeight:600}}>{p.label}</span>
                        {t.due&&<span style={{fontSize:9,color:isOD(t.due,t.done)?C.err:C.hi}}>📅 {fmtDay(t.due)}</span>}
                        {(t.tags||[]).slice(0,2).map(tag=>{const c=getC(tag);return<span key={tag} style={{fontSize:8,background:c,color:"#fff",borderRadius:99,padding:"1px 5px",fontWeight:600}}>#{tag}</span>;})}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ── Gantt View ─────────────────────────────────────────────────
function GanttView({tasks,categories,onEdit}) {
  const mob=useIsMobile(), ref=useRef(null), LABEL_W=mob?110:175, ROW_H=38;
  const [chartW,setChartW]=useState(500), [zoom,setZoom]=useState(30);
  const [vs,setVs]=useState(()=>{ const d=new Date(); d.setDate(d.getDate()-(zoom===7?0:7)); d.setHours(0,0,0,0); return d; });
  useEffect(()=>{ if(!ref.current) return; const obs=new ResizeObserver(e=>setChartW(Math.max(280,e[0].contentRect.width-LABEL_W))); obs.observe(ref.current); return()=>obs.disconnect(); },[LABEL_W]);
  const today=new Date(); today.setHours(0,0,0,0);
  const dayW=chartW/zoom, ve=new Date(vs.getTime()+zoom*86400000);
  const diff=(a,b)=>(new Date(b)-new Date(a))/86400000;
  const todayX=Math.max(0,Math.min(chartW,diff(vs,today)*dayW));
  const getBar=t=>{ const s=new Date(t.startDate||t.createdAt); s.setHours(0,0,0,0); const e=t.due?new Date(t.due):null; if(e)e.setHours(0,0,0,0); if(s>ve||(e&&e<vs)) return null; const sx=Math.max(0,diff(vs,s))*dayW,ex=e?Math.min(zoom,diff(vs,e))*dayW:sx+Math.max(dayW,16); return{left:sx,width:Math.max(16,ex-sx)}; };
  const step=zoom<=7?1:zoom<=14?1:zoom<=30?3:7, ticks=[];
  for(let i=0;i<=zoom;i+=step){const d=new Date(vs.getTime()+i*86400000);ticks.push({x:i*dayW,label:zoom<=7?d.toLocaleDateString("en-GB",{weekday:"short",day:"2-digit"}):fmtDay(d)});}
  const navigate=dir=>setVs(d=>new Date(d.getTime()+dir*(zoom<=7?7:Math.floor(zoom/2))*86400000));
  const grouped=[]; [{id:"none",name:"General",code:"GEN",color:C.hi},...categories].forEach(cat=>{
    const items=tasks.filter(t=>String(t.customCategoryId||"none")===String(cat.id)); if(!items.length) return;
    grouped.push({cat,items});
  });
  const renderRow=(task,cat)=>{ const bar=getBar(task); const st=STATUSES[task.status]||STATUSES.not_started; const p=PRIORITIES[task.priority]||PRIORITIES.medium;
    return(<div key={task.id} style={{display:"flex",height:ROW_H,alignItems:"center",borderBottom:`1px solid ${C.bg}`}} onMouseEnter={e=>e.currentTarget.style.background="#fafafa"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{width:LABEL_W,flexShrink:0,padding:"0 8px",borderRight:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:4,overflow:"hidden",cursor:"pointer"}} onClick={()=>onEdit(task)}>
        {task.taskCode&&<span style={{fontSize:9,fontWeight:700,color:cat.color,fontFamily:"monospace",background:cat.color+"18",borderRadius:3,padding:"1px 4px",flexShrink:0}}>{task.taskCode}</span>}
        <span style={{fontSize:11,color:task.done?"#94a3b8":C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</span>
        <span style={{fontSize:10,color:st.color,flexShrink:0,marginLeft:"auto"}}>{st.icon}</span>
      </div>
      <div style={{flex:1,position:"relative",height:"100%",minWidth:0,overflow:"hidden"}}>
        {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:2,background:C.p,opacity:.4,pointerEvents:"none"}}/>}
        {zoom<=7&&Array.from({length:zoom}).map((_,i)=>{ const d=new Date(vs.getTime()+i*86400000); const isWe=d.getDay()===0||d.getDay()===6; return isWe?<div key={i} style={{position:"absolute",left:i*dayW,width:dayW,top:0,bottom:0,background:"rgba(0,0,0,.025)",pointerEvents:"none"}}/>:null; })}
        {bar&&<div onClick={()=>onEdit(task)} style={{position:"absolute",left:bar.left,width:bar.width,top:6,height:26,borderRadius:6,background:task.done?C.hi:p.color,opacity:task.done?.6:1,cursor:"pointer",display:"flex",alignItems:"center",paddingLeft:6,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.1)"}}>
          <span style={{fontSize:10,color:"#fff",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{task.title}</span>
        </div>}
      </div>
    </div>);
  };
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        {[[7,"1W"],[14,"2W"],[30,"1M"],[60,"2M"]].map(([d,l])=><button key={d} onClick={()=>{setZoom(d);const nd=new Date();nd.setDate(nd.getDate()-(d===7?0:7));nd.setHours(0,0,0,0);setVs(nd);}} style={{border:`1px solid ${zoom===d?C.p:C.border}`,background:zoom===d?C.pL:"#fff",color:zoom===d?C.p:C.mu,borderRadius:7,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:zoom===d?600:400}}>{l}</button>)}
        <button onClick={()=>navigate(-1)} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"4px 10px",fontSize:12,cursor:"pointer",color:C.mu}}>← Prev</button>
        <button onClick={()=>{const d=new Date();d.setDate(d.getDate()-(zoom===7?0:7));d.setHours(0,0,0,0);setVs(d);}} style={{border:`1px solid ${C.p}`,background:C.pL,color:C.p,borderRadius:7,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>Today</button>
        <button onClick={()=>navigate(1)} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"4px 10px",fontSize:12,cursor:"pointer",color:C.mu}}>Next →</button>
        <span style={{fontSize:11,color:C.hi}}>{fmtDay(vs)} → {fmtDay(ve)}</span>
      </div>
      <div ref={ref} style={{border:`1px solid ${C.border}`,borderRadius:11,background:C.card,overflowX:"auto"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:"#fff",zIndex:5}}>
          <div style={{width:LABEL_W,flexShrink:0,padding:"7px 10px",fontSize:10,fontWeight:600,color:C.hi,borderRight:`1px solid ${C.border}`}}>Task</div>
          <div style={{width:Math.max(chartW,280),flexShrink:0,position:"relative",height:32}}>
            {ticks.map(({x,label},i)=><div key={i} style={{position:"absolute",left:x,fontSize:9,color:C.hi,top:8,transform:"translateX(-50%)",whiteSpace:"nowrap",pointerEvents:"none"}}>{label}</div>)}
            {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:2,background:C.p,opacity:.6}}/>}
          </div>
        </div>
        {grouped.length===0&&<div style={{padding:40,textAlign:"center",color:C.hi}}>No tasks on timeline</div>}
        {grouped.map(({cat,items})=>(
          <div key={cat.id}>
            <div style={{display:"flex",background:cat.color+"10",borderBottom:`1px solid ${cat.color}20`}}>
              <div style={{width:LABEL_W,flexShrink:0,padding:"5px 10px",borderRight:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:5}}>
                <span style={{background:cat.color,color:"#fff",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>{cat.code}</span>
                <span style={{fontSize:11,fontWeight:600,color:C.tx}}>{cat.name}</span>
              </div>
              <div style={{width:Math.max(chartW,280),flexShrink:0,position:"relative",height:26}}>
                {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:1,background:cat.color,opacity:.3}}/>}
              </div>
            </div>
            {items.map(t=>renderRow(t,cat))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────
function CalendarView({ tasks, categories, customTags, onEdit }) {
  const mob=useIsMobile(), [calMode,setCalMode]=useState("month"), [calDate,setCalDate]=useState(new Date()), [selDay,setSelDay]=useState(null);
  const yr=calDate.getFullYear(), mo=calDate.getMonth();
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const firstDay=(d=>d===0?6:d-1)(new Date(yr,mo,1).getDay());
  const dayTasks=day=>tasks.filter(t=>t.due&&sameDay(new Date(t.due),new Date(yr,mo,day)));
  const getWeekDays=()=>{ const d=new Date(calDate); const day=d.getDay(); d.setDate(d.getDate()-(day===0?6:day-1)); return Array.from({length:7},(_,i)=>{ const dd=new Date(d); dd.setDate(d.getDate()+i); return dd; }); };
  const weekDays=getWeekDays();
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          {[["month","Month"],["week","Week"]].map(([m,l])=><button key={m} onClick={()=>setCalMode(m)} style={{border:"none",background:calMode===m?C.p:"#fff",color:calMode===m?"#fff":C.mu,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:calMode===m?600:400}}>{l}</button>)}
        </div>
        <button onClick={()=>calMode==="month"?setCalDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1)):setCalDate(d=>{const nd=new Date(d);nd.setDate(nd.getDate()-7);return nd;})} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"5px 10px",cursor:"pointer",color:C.mu,fontSize:12}}>←</button>
        <span style={{fontSize:13,fontWeight:700,color:C.tx,minWidth:120,textAlign:"center"}}>{calMode==="month"?`${MONTHS[mo]} ${yr}`:`${fmtDay(weekDays[0])} – ${fmtDay(weekDays[6])}`}</span>
        <button onClick={()=>calMode==="month"?setCalDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1)):setCalDate(d=>{const nd=new Date(d);nd.setDate(nd.getDate()+7);return nd;})} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"5px 10px",cursor:"pointer",color:C.mu,fontSize:12}}>→</button>
        <button onClick={()=>setCalDate(new Date())} style={{border:`1px solid ${C.p}`,background:C.pL,color:C.p,borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>Today</button>
      </div>
      {calMode==="month"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:11,padding:mob?10:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>{WDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:C.hi,padding:"3px 0"}}>{mob?d[0]:d}</div>)}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:mob?3:4}}>
            {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
            {Array.from({length:daysInMo}).map((_,i)=>{
              const day=i+1,dt=dayTasks(day),isT=sameDay(new Date(yr,mo,day),new Date()),isSel=selDay===day;
              return(<div key={day} onClick={()=>setSelDay(isSel?null:day)} style={{minHeight:mob?42:54,borderRadius:8,border:`1px solid ${isSel?C.p:isT?"#c7d2fe":C.border}`,background:isSel?C.pL:isT?"#f5f3ff":"#fff",cursor:"pointer",padding:mob?"4px":"5px 7px"}}>
                <div style={{fontSize:mob?11:12,fontWeight:isT?700:500,color:isT?C.p:C.tx,marginBottom:2,textAlign:mob?"center":"left"}}>{day}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:2,justifyContent:mob?"center":"flex-start"}}>{dt.slice(0,3).map(t=><div key={t.id} style={{width:6,height:6,borderRadius:"50%",background:PRIORITIES[t.priority]?.color}}/>)}{dt.length>3&&<span style={{fontSize:7,color:C.hi}}>+{dt.length-3}</span>}</div>
              </div>);
            })}
          </div>
          {selDay&&<div style={{marginTop:12,padding:"12px 14px",background:C.bg,borderRadius:9}}>
            <h3 style={{margin:"0 0 8px",fontSize:12,fontWeight:600,color:C.tx}}>{MONTHS[mo]} {selDay} — {dayTasks(selDay).length} task(s)</h3>
            {dayTasks(selDay).length===0?<p style={{color:C.hi,fontSize:12,margin:0}}>No tasks.</p>
              :<div style={{display:"flex",flexDirection:"column",gap:5}}>{dayTasks(selDay).map(t=><TaskCard key={t.id} t={t} categories={categories} customTags={customTags} onEdit={onEdit} onChangeStatus={()=>{}}/>)}</div>}
          </div>}
        </div>
      )}
      {calMode==="week"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:11,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:`${mob?80:140}px repeat(7,1fr)`,borderBottom:`1px solid ${C.border}`}}>
            <div style={{padding:"8px 10px",fontSize:10,fontWeight:600,color:C.hi,borderRight:`1px solid ${C.border}`}}>Task</div>
            {weekDays.map((d,i)=>{ const isT=sameDay(d,new Date()),isWe=d.getDay()===0||d.getDay()===6; return(<div key={i} style={{padding:"7px 3px",textAlign:"center",background:isT?C.pL:isWe?"#f8fafc":"transparent",borderRight:i<6?`1px solid ${C.border}`:"none"}}>
              <div style={{fontSize:9,color:isT?C.p:C.mu,fontWeight:600}}>{WDAYS[i]}</div>
              <div style={{fontSize:13,fontWeight:isT?700:500,color:isT?C.p:C.tx}}>{d.getDate()}</div>
            </div>);})}
          </div>
          {tasks.filter(t=>{ const s=t.startDate?new Date(t.startDate):new Date(t.createdAt); const e=t.due?new Date(t.due):s; return e>=weekDays[0]&&s<=weekDays[6]; }).map(t=>{
            const s=t.startDate?new Date(t.startDate):new Date(t.createdAt); s.setHours(0,0,0,0);
            const e=t.due?new Date(t.due):s; e.setHours(0,0,0,0);
            const p=PRIORITIES[t.priority]||PRIORITIES.medium;
            const cat=categories.find(c=>c.id==t.customCategoryId);
            return(<div key={t.id} style={{display:"grid",gridTemplateColumns:`${mob?80:140}px repeat(7,1fr)`,borderBottom:`1px solid ${C.bg}`,minHeight:36,alignItems:"center"}} onMouseEnter={e=>e.currentTarget.style.background="#fafafa"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{padding:"0 7px",borderRight:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer"}} onClick={()=>onEdit(t)}>
                {t.taskCode&&cat&&<div style={{fontSize:8,color:cat.color,fontFamily:"monospace",fontWeight:700}}>{t.taskCode}</div>}
                <div style={{fontSize:11,fontWeight:500,color:C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
              </div>
              {weekDays.map((d,i)=>{ const inR=d>=s&&d<=e; const isSt=sameDay(d,s); const isEn=sameDay(d,e); const isWe=d.getDay()===0||d.getDay()===6;
                return(<div key={i} style={{padding:"5px 2px",background:isWe?"#f8fafc":"transparent",borderRight:i<6?`1px solid ${C.bg}`:"none",cursor:"pointer"}} onClick={()=>inR&&onEdit(t)}>
                  {inR&&<div style={{height:20,borderRadius:isSt&&isEn?"5px":isSt?"5px 0 0 5px":isEn?"0 5px 5px 0":"0",background:p.color,opacity:.85,display:"flex",alignItems:"center",paddingLeft:isSt?4:0}}>
                    {isSt&&<span style={{fontSize:8,color:"#fff",fontWeight:600,overflow:"hidden",whiteSpace:"nowrap",padding:"0 3px"}}>{t.title}</span>}
                  </div>}
                </div>);
              })}
            </div>);
          })}
          {tasks.filter(t=>{ const s=t.startDate?new Date(t.startDate):new Date(t.createdAt); const e=t.due?new Date(t.due):s; return e>=weekDays[0]&&s<=weekDays[6]; }).length===0&&<div style={{padding:28,textAlign:"center",color:C.hi,fontSize:13}}>No tasks with dates this week</div>}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
function Dashboard({tasks,categories,onEdit,onNewTask}) {
  const now=new Date(), wEnd=new Date(now.getTime()+7*86400000);
  const active=tasks.filter(t=>!t.done);
  const stats={total:tasks.length,done:tasks.filter(t=>t.done).length,urgent:active.filter(t=>t.priority==="high").length,overdue:active.filter(t=>t.due&&new Date(t.due)<now).length};
  const rate=stats.total?Math.round(stats.done/stats.total*100):0;
  const upcoming=active.filter(t=>t.due&&new Date(t.due)>=now&&new Date(t.due)<=wEnd).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,6);
  const catStats=categories.map(c=>{const ct=tasks.filter(t=>t.customCategoryId==c.id),d=ct.filter(t=>t.done).length;return{...c,total:ct.length,done:d,rate:ct.length?Math.round(d/ct.length*100):0};}).filter(c=>c.total>0);
  const byStatus=Object.keys(STATUSES).map(k=>({key:k,...STATUSES[k],count:tasks.filter(t=>(t.status||"not_started")===k).length}));
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div><h1 style={{margin:0,fontSize:20,fontWeight:700,color:C.tx}}>Dashboard</h1><p style={{margin:"2px 0 0",fontSize:12,color:C.mu}}>{now.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</p></div>
        <button onClick={onNewTask} style={{background:`linear-gradient(135deg,${C.p},${C.pur})`,color:"#fff",border:"none",borderRadius:9,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Task</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:9,marginBottom:16}}>
        {[["Total",stats.total,"📋",C.p,`${rate}% done`],["Done",stats.done,"✅",C.ok,`${stats.total-stats.done} left`],["Urgent",stats.urgent,"🔴",C.err,"High priority"],["Overdue",stats.overdue,"⚠️",C.warn,"Past due"]].map(([l,v,ic,col,sub])=>(
          <div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><div style={{width:32,height:32,borderRadius:8,background:col+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{ic}</div><span style={{fontSize:24,fontWeight:700,color:col}}>{v}</span></div>
            <div style={{fontSize:11,fontWeight:600,color:C.tx}}>{l}</div><div style={{fontSize:10,color:C.hi,marginTop:1}}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,fontWeight:600,color:C.tx}}>Overall completion</span><span style={{fontSize:12,fontWeight:700,color:C.p}}>{rate}%</span></div>
        <div style={{height:8,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:rate+"%",background:`linear-gradient(90deg,${C.p},${C.pur})`,borderRadius:99,transition:"width .6s"}}/></div>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px",marginBottom:14}}>
        <h3 style={{margin:"0 0 10px",fontSize:12,fontWeight:600,color:C.tx}}>By status</h3>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{byStatus.map(s=>(
          <div key={s.key} style={{flex:1,minWidth:70,background:s.color+"10",border:`1px solid ${s.color}22`,borderRadius:8,padding:"9px 10px",textAlign:"center"}}>
            <div style={{fontSize:16,marginBottom:2}}>{s.icon}</div><div style={{fontSize:18,fontWeight:700,color:s.color}}>{s.count}</div>
            <div style={{fontSize:9,color:C.mu,marginTop:1}}>{s.label}</div>
          </div>
        ))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px"}}>
          <h3 style={{margin:"0 0 10px",fontSize:12,fontWeight:600,color:C.tx}}>Category progress</h3>
          {catStats.length===0&&<p style={{color:C.hi,fontSize:12,margin:0}}>No categories yet</p>}
          {catStats.map(c=>(
            <div key={c.id} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:c.color,background:c.color+"18",borderRadius:3,padding:"1px 4px"}}>{c.code}</span><span style={{fontSize:11,color:C.tx}}>{c.name}</span></div><span style={{fontSize:10,color:C.mu}}>{c.done}/{c.total}</span></div>
              <div style={{height:5,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:c.rate+"%",background:c.color,borderRadius:99}}/></div>
            </div>
          ))}
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px"}}>
          <h3 style={{margin:"0 0 10px",fontSize:12,fontWeight:600,color:C.tx}}>Upcoming (7 days)</h3>
          {upcoming.length===0&&<p style={{color:C.hi,fontSize:12,margin:0}}>Nothing due soon 🎉</p>}
          {upcoming.map(t=>{const p=PRIORITIES[t.priority]||PRIORITIES.medium,days=Math.ceil((new Date(t.due)-now)/86400000);return(
            <div key={t.id} onClick={()=>onEdit(t)} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 0",borderBottom:`1px solid ${C.bg}`,cursor:"pointer"}}>
              <div style={{width:3,height:28,borderRadius:2,background:p.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:500,color:C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div><div style={{fontSize:10,color:C.hi}}>{fmtDt(t.due)}</div></div>
              <span style={{fontSize:10,fontWeight:700,color:days===0?C.err:days<=2?C.warn:C.hi,whiteSpace:"nowrap"}}>{days===0?"Today":days===1?"Tomor.":days+"d"}</span>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────
function ShareModal({tasks,categories,onClose}) {
  const [cp,setCp]=useState(false); const now=new Date(), todo=tasks.filter(t=>!t.done);
  const allCats=[{id:"none",name:"General",code:"GEN"},...categories];
  const text=()=>{const l=[`📋 *Task Update — ${now.toLocaleDateString("en-GB")}*`,`📊 *${tasks.filter(t=>t.done).length}/${tasks.length} done*`,""];allCats.forEach(cat=>{const ct=todo.filter(t=>String(t.customCategoryId||"none")===String(cat.id));if(!ct.length)return;l.push(`*[${cat.code}] ${cat.name}*`);ct.forEach(t=>{const p=t.priority==="high"?"🔴":t.priority==="medium"?"🟡":"🔵";l.push(`  ${p} ${t.taskCode?`[${t.taskCode}] `:""}${t.title}${t.due?` _(${fmtDay(t.due)})_`:""}`);});l.push("");});return l.join("\n");};
  const txt=text();
  const exportCSV=()=>{const h=["Code","Title","Priority","Status","Category","Start","Due","Tags"];const rows=tasks.map(t=>{const cat=categories.find(c=>c.id==t.customCategoryId);return[t.taskCode||"",`"${t.title}"`,t.priority,t.status,cat?cat.name:"General",t.startDate?new Date(t.startDate).toLocaleDateString("en-GB"):"",t.due?new Date(t.due).toLocaleDateString("en-GB"):"",`"${(t.tags||[]).join("; ")}"`].join(",");});const blob=new Blob([[h.join(","),...rows].join("\n")],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`tasks-${now.toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);};
  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,borderRadius:14,padding:24,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><h2 style={{margin:0,fontSize:16,fontWeight:700,color:C.tx}}>Share & Export</h2><button onClick={onClose} style={{border:"none",background:"none",fontSize:20,cursor:"pointer",color:C.hi}}>×</button></div>
        <div style={{background:"#f8fafc",border:`1px solid ${C.border}`,borderRadius:8,padding:11,marginBottom:14,maxHeight:130,overflowY:"auto"}}><pre style={{margin:0,fontSize:10,color:C.mu,whiteSpace:"pre-wrap",fontFamily:"monospace"}}>{txt}</pre></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,"_blank")} style={{background:"#25d366",color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer"}}>💬 WhatsApp</button>
          <button onClick={async()=>{await navigator.clipboard.writeText(txt);setCp(true);setTimeout(()=>setCp(false),2000);}} style={{background:cp?C.ok:C.p,color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer"}}>{cp?"✓ Copied!":"📋 Copy"}</button>
          <button onClick={exportCSV} style={{background:"#fff",color:C.ok,border:`2px solid ${C.ok}`,borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer"}}>📊 CSV</button>
          <button onClick={()=>window.print()} style={{background:"#fff",color:C.mu,border:`2px solid ${C.border}`,borderRadius:8,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer"}}>🖨️ Print</button>
        </div>
      </div>
    </div>
  );
}

// ── Category Modal ────────────────────────────────────────────
function CategoryModal({categories, tasks, onSave, onDelete, onClose}) {
  const [name,setName]=useState(""); const [code,setCode]=useState(""); const [color,setColor]=useState("#6366f1");
  const [delErr,setDelErr]=useState("");

  const handleDelete=async id=>{
    const linked=(tasks||[]).filter(t=>t.customCategoryId==id);
    if(linked.length>0){
      setDelErr(`Cannot delete: ${linked.length} task${linked.length>1?"s":""} linked to this category.`);
      setTimeout(()=>setDelErr(""),4000); return;
    }
    await onDelete(id); setDelErr("");
  };
  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,borderRadius:14,padding:20,width:"100%",maxWidth:400,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><h2 style={{margin:0,fontSize:15,fontWeight:700,color:C.tx}}>📁 Categories</h2><button onClick={onClose} style={{border:"none",background:"none",fontSize:20,cursor:"pointer",color:C.hi}}>×</button></div>
        {delErr&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,padding:"7px 11px",marginBottom:10,fontSize:12,color:C.err}}>⚠️ {delErr}</div>}
        {categories.map(c=>{ const linked=(tasks||[]).filter(t=>t.customCategoryId==c.id).length; return(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",background:C.bg,borderRadius:7,marginBottom:5}}>
            <div style={{width:4,height:22,borderRadius:2,background:c.color}}/><span style={{fontSize:11,fontWeight:700,color:c.color,minWidth:48,fontFamily:"monospace"}}>{c.code}</span>
            <span style={{fontSize:12,flex:1,color:C.tx}}>{c.name}</span>
            <span style={{fontSize:10,color:C.hi,marginRight:4}}>{linked>0?`${linked} task${linked>1?"s":""}`:""}</span>
            <button onClick={()=>handleDelete(c.id)} title={linked>0?"Has linked tasks — cannot delete":"Delete"} style={{border:"none",background:"none",color:linked>0?"#fca5a5":C.hi,cursor:linked>0?"not-allowed":"pointer",fontSize:15}}>×</button>
          </div>
        );})}
        {!categories.length&&<p style={{fontSize:12,color:C.hi,textAlign:"center",padding:"8px 0"}}>No categories yet</p>}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:8}}>
          <div style={{fontSize:10,fontWeight:600,color:C.mu,marginBottom:7,textTransform:"uppercase",letterSpacing:.4}}>New category</div>
          <div style={{display:"flex",gap:6,marginBottom:7}}>
            <div style={{flex:1,position:"relative"}}>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" style={{width:"100%",border:`1.5px solid ${!name&&C.err||C.border}`,borderRadius:7,padding:"7px 10px",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              {!name&&<span style={{position:"absolute",top:-6,right:6,fontSize:9,color:C.err,background:"#fff",padding:"0 2px",fontWeight:700}}>required</span>}
            </div>
            <div style={{position:"relative"}}>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,5))} placeholder="CODE" style={{width:70,border:`1.5px solid ${!code&&C.err||C.border}`,borderRadius:7,padding:"7px 8px",fontSize:12,outline:"none",fontFamily:"monospace",fontWeight:700,textAlign:"center"}}/>
              {!code&&<span style={{position:"absolute",top:-6,right:2,fontSize:9,color:C.err,background:"#fff",padding:"0 2px",fontWeight:700}}>req.</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:3,marginBottom:9,flexWrap:"wrap"}}>{CAT_COLS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:19,height:19,borderRadius:"50%",background:c,border:color===c?"3px solid #111":"1px solid transparent",cursor:"pointer"}}/>)}</div>
          <button onClick={async()=>{ if(!name.trim()||!code.trim())return; await onSave({name:name.trim(),code,color}); setName("");setCode(""); }} style={{background:name&&code?C.p:"#cbd5e1",color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:name&&code?"pointer":"not-allowed"}}>+ Add</button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({view,setView,categories,session,counts,customCatFilter,setCustomCatFilter,onNewTask,onShare,onCatModal}) {
  const NAV=[["dashboard","📊","Dashboard"],["list","📋","Tasks"],["sprint","🏃","Sprint"],["calendar","📅","Calendar"],["gantt","🗂️","Gantt"]];
  return(
    <div style={{width:205,flexShrink:0,background:C.sidebar,minHeight:"100vh",position:"sticky",top:0,display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <div style={{padding:"18px 16px 12px"}}>
        <div style={{fontSize:22,marginBottom:2}}>📋</div>
        <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>My Tasks</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session?.user?.email}</div>
      </div>
      <div style={{padding:"0 10px 12px"}}><button onClick={onNewTask} style={{width:"100%",background:C.p,color:"#fff",border:"none",borderRadius:7,padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ New Task</button></div>
      <div style={{padding:"0 5px",flex:1}}>
        {NAV.map(([v,ic,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 9px",border:"none",borderRadius:7,background:view===v?C.sA:"transparent",color:view===v?"#fff":"rgba(255,255,255,.55)",cursor:"pointer",fontSize:12,fontWeight:view===v?600:400,marginBottom:1,textAlign:"left",transition:"all .15s"}}
            onMouseEnter={e=>{if(view!==v)e.currentTarget.style.background=C.sH;}} onMouseLeave={e=>{if(view!==v)e.currentTarget.style.background="transparent";}}>
            <span style={{fontSize:15}}>{ic}</span><span style={{flex:1}}>{l}</span>
            {v==="list"&&counts.urgent>0&&<span style={{background:C.err,color:"#fff",borderRadius:99,padding:"1px 6px",fontSize:9,fontWeight:700}}>{counts.urgent}</span>}
          </button>
        ))}
        {categories.length>0&&<div style={{marginTop:14}}>
          <div style={{fontSize:9,fontWeight:600,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:1,padding:"0 9px",marginBottom:5}}>Categories</div>
          {[["all","All",null,null],...categories.map(c=>[String(c.id),c.name,c.color,c.code])].map(([v,l,col,cd])=>(
            <button key={v} onClick={()=>{setCustomCatFilter(v);if(v!=="all")setView("list");}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:6,padding:"5px 9px",border:"none",borderRadius:6,background:customCatFilter===v?"rgba(255,255,255,.1)":"transparent",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:11,textAlign:"left",marginBottom:1}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.07)"} onMouseLeave={e=>e.currentTarget.style.background=customCatFilter===v?"rgba(255,255,255,.1)":"transparent"}>
              <div style={{width:6,height:6,borderRadius:"50%",background:col||"rgba(255,255,255,.3)",flexShrink:0}}/>
              {cd&&<span style={{fontFamily:"monospace",fontSize:9,color:col,fontWeight:700}}>{cd}</span>}
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l}</span>
            </button>
          ))}
        </div>}
      </div>
      <div style={{padding:"10px 5px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
        {[["🚀","Share & Export",onShare],["📁","Categories",onCatModal],["🚪","Sign out",()=>supabase.auth.signOut()]].map(([ic,l,fn])=>(
          <button key={l} onClick={fn} style={{width:"100%",display:"flex",alignItems:"center",gap:7,padding:"7px 9px",border:"none",borderRadius:6,background:"transparent",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:11,textAlign:"left",marginBottom:1}}
            onMouseEnter={e=>e.currentTarget.style.background=C.sH} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:14}}>{ic}</span>{l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────
function LoginScreen() {
  const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const login=async()=>{ setErr("");setLoading(true); const{error}=await supabase.auth.signInWithPassword({email,password:pw}); setLoading(false); if(error)setErr("Incorrect email or password."); };
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4f46e5 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",padding:16}}>
      <div style={{background:"rgba(255,255,255,.97)",borderRadius:18,padding:32,width:"100%",maxWidth:370,boxShadow:"0 24px 64px rgba(0,0,0,.25)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:52,height:52,background:`linear-gradient(135deg,${C.p},${C.pur})`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 10px"}}>📋</div>
          <h1 style={{margin:0,fontSize:21,fontWeight:700,color:C.tx}}>My Tasks</h1>
          <p style={{margin:"5px 0 0",fontSize:13,color:C.mu}}>Sign in to continue</p>
        </div>
        <label style={{fontSize:11,fontWeight:600,color:C.mu,display:"block",marginBottom:4}}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&login()} style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",marginBottom:10}} autoFocus/>
        <label style={{fontSize:11,fontWeight:600,color:C.mu,display:"block",marginBottom:4}}>Password</label>
        <input value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()} style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",marginBottom:err?8:14}}/>
        {err&&<p style={{color:C.err,fontSize:12,margin:"0 0 10px"}}>{err}</p>}
        <button onClick={login} disabled={loading} style={{width:"100%",background:`linear-gradient(135deg,${C.p},${C.pur})`,color:"#fff",border:"none",borderRadius:9,padding:12,fontSize:14,fontWeight:600,cursor:"pointer",opacity:loading?.7:1}}>{loading?"Signing in…":"Sign in →"}</button>
      </div>
    </div>
  );
}

// ── Admin View ────────────────────────────────────────────────
function AdminView({ abandonedTasks, allTasks, categories, customTags, onEdit, onChangeStatus }) {
  const mob=useIsMobile();
  const getC=name=>{ const ct=customTags.find(t=>t.name===name); return ct?ct.color:autoTagC(name); };
  const byCategory=categories.map(c=>({...c,count:abandonedTasks.filter(t=>t.customCategoryId==c.id).length})).filter(c=>c.count>0);
  const totalRate=allTasks.length?Math.round(abandonedTasks.length/allTasks.length*100):0;
  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{margin:0,fontSize:mob?16:18,fontWeight:700,color:C.tx}}>🗄️ Administration</h1>
        <p style={{margin:"3px 0 0",fontSize:12,color:C.mu}}>Abandoned tasks — hidden from all other views</p>
      </div>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:9,marginBottom:16}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><div style={{width:32,height:32,borderRadius:8,background:"#6b728018",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✕</div><span style={{fontSize:24,fontWeight:700,color:"#6b7280"}}>{abandonedTasks.length}</span></div>
          <div style={{fontSize:11,fontWeight:600,color:C.tx}}>Abandoned</div><div style={{fontSize:10,color:C.hi,marginTop:1}}>{totalRate}% of all tasks</div>
        </div>
        {byCategory.map(c=>(
          <div key={c.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:c.color,background:c.color+"18",borderRadius:5,padding:"2px 7px",alignSelf:"center"}}>{c.code}</span><span style={{fontSize:24,fontWeight:700,color:c.color}}>{c.count}</span></div>
            <div style={{fontSize:11,fontWeight:600,color:C.tx}}>{c.name}</div>
          </div>
        ))}
      </div>
      {/* Task list */}
      {abandonedTasks.length===0
        ?<div style={{textAlign:"center",padding:"60px 0",color:C.hi}}><div style={{fontSize:36,marginBottom:8}}>✅</div><p style={{margin:0,fontSize:13}}>No abandoned tasks</p></div>
        :<div style={{display:"flex",flexDirection:"column",gap:7}}>
          {abandonedTasks.map(t=>{
            const cat=categories.find(c=>c.id==t.customCategoryId);
            const p=PRIORITIES[t.priority]||PRIORITIES.medium;
            return(
              <div key={t.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:mob?"11px 13px":"12px 16px",display:"flex",alignItems:"center",gap:10,borderLeft:"4px solid #9ca3af",opacity:.8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:3}}>
                    {t.taskCode&&cat&&<span style={{fontSize:9,fontWeight:700,color:cat.color,fontFamily:"monospace",background:cat.color+"18",borderRadius:4,padding:"1px 5px",flexShrink:0}}>{t.taskCode}</span>}
                    <span style={{fontSize:mob?13:14,fontWeight:600,color:"#6b7280",textDecoration:"line-through",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{t.title}</span>
                    <span style={{fontSize:10,padding:"1px 6px",borderRadius:99,background:p.bg,color:p.color,fontWeight:600,flexShrink:0}}>{p.label}</span>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {cat&&<span style={{fontSize:10,color:C.hi}}>[{cat.code}] {cat.name}</span>}
                    {t.closedAt&&<span style={{fontSize:10,color:C.hi}}>· Abandoned {fmtFull(t.closedAt)}</span>}
                    {(t.tags||[]).slice(0,2).map(tag=>{const c=getC(tag);return<span key={tag} style={{fontSize:9,background:c,color:"#fff",borderRadius:99,padding:"1px 5px",fontWeight:600}}>#{tag}</span>;})}
                  </div>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0}}>
                  <button onClick={()=>onEdit(t)} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:12,color:C.mu}}>✏️</button>
                  <button onClick={()=>onChangeStatus(t.id,"not_started")}
                    style={{border:`1px solid ${C.p}`,background:C.pL,color:C.p,borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>↩ Reopen</button>
                </div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const mob=useIsMobile();
  const [session,setSession]=useState(undefined);
  const [tasks,setTasks]=useState([]);
  const [profiles,setProfiles]=useState([]);
  const [categories,setCategories]=useState([]);
  const [customTags,setCustomTags]=useState([]);
  const [loading,setLoading]=useState(false);
  const [editTask,setEditTask]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [showCatModal,setShowCatModal]=useState(false);
  const [showShare,setShowShare]=useState(false);
  const [view,setView]=useState("dashboard");
  const [filter,setFilter]=useState("active");
  const [catFilter,setCatFilter]=useState("all");
  const [customCatFilter,setCustomCatFilter]=useState("all");
  const [tagFilter,setTagFilter]=useState(null);
  const [sortBy,setSortBy]=useState("priority");
  const [toast,setToast]=useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));
    return()=>subscription.unsubscribe();
  },[]);

  const loadData=async()=>{
    setLoading(true);
    const [tr,ar,dr,pr,cr,tgr]=await Promise.all([
      supabase.from("tasks").select("*").order("created_at",{ascending:true}),
      supabase.from("task_assignees").select("*, profiles(id,email,full_name)"),
      supabase.from("task_dependencies").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("custom_categories").select("*").order("name"),
      supabase.from("custom_tags").select("*").order("name"),
    ]);
    setProfiles(pr.data||[]); setCategories(cr.data||[]); setCustomTags(tgr.data||[]);
    const aMap={},dMap={};
    (ar.data||[]).forEach(a=>{ if(!aMap[a.task_id])aMap[a.task_id]=[]; if(a.profiles)aMap[a.task_id].push(a.profiles); });
    (dr.data||[]).forEach(d=>{ if(!dMap[d.task_id])dMap[d.task_id]=[]; dMap[d.task_id].push(d.depends_on); });
    const map={}; (tr.data||[]).forEach(r=>{ map[r.id]=fromDB(r,aMap[r.id]||[]); });
    Object.values(map).forEach(t=>{ t.deps=(dMap[t.id]||[]).map(id=>map[id]).filter(Boolean); });
    setTasks(Object.values(map)); setLoading(false);
  };

  useEffect(()=>{ if(session) loadData(); },[session]);

  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const changeStatus=async(taskId,newStatus)=>{
    const updates={status:newStatus,done:newStatus==="done",closed_at:newStatus==="done"?new Date().toISOString():null};
    setTasks(p=>p.map(t=>t.id===taskId?{...t,...updates,closedAt:updates.closed_at}:t));
    await supabase.from("tasks").update(updates).eq("id",taskId);
    await supabase.from("task_comments").insert({task_id:taskId,user_id:session.user.id,content:`Status → "${STATUSES[newStatus]?.label}"`,is_log:true}).catch(()=>{});
  };

  const saveCategory=async data=>{ const {data:d}=await supabase.from("custom_categories").insert(data).select().single(); await loadData(); return d; };
  const deleteCategory=async id=>{ await supabase.from("custom_categories").delete().eq("id",id); await loadData(); };
  const createTag=async data=>{ await supabase.from("custom_tags").upsert(data,{onConflict:"name"}); await loadData(); };

  const generateCode=async catId=>{ if(!catId) return null; const cat=categories.find(c=>c.id===parseInt(catId)); if(!cat) return null; const {count}=await supabase.from("tasks").select("*",{count:"exact",head:true}).eq("custom_category_id",catId); return `${cat.code}-${String((count||0)+1).padStart(3,"0")}`; };

  const saveTask=async(form,existingId)=>{
    const existing=tasks.find(t=>t.id===existingId);
    const task_code=existingId?(existing?.taskCode||null):await generateCode(form.customCategoryId);
    const isDone=form.status==="done";
    const db={
      title:form.title.trim(), description:"", description_html:form.descHtml,
      category:form.cat, priority:form.priority, status:form.status, done:isDone,
      due_date:form.due||null, start_date:form.startDate||null,
      closed_at:isDone?(existing?.closedAt||new Date().toISOString()):null,
      tags:form.tags, parent_id:form.parentId?parseInt(form.parentId):null,
      custom_category_id:form.customCategoryId?parseInt(form.customCategoryId):null,
      task_code, created_by:session.user.id,
    };
    let taskId=existingId;
    if(existingId){const{error}=await supabase.from("tasks").update(db).eq("id",existingId);if(error){showToast("Error: "+error.message,"error");return;}}
    else{const{data,error}=await supabase.from("tasks").insert(db).select().single();if(error){showToast("Error: "+error.message,"error");return;}taskId=data.id;
      await supabase.from("task_comments").insert({task_id:taskId,user_id:session.user.id,content:"Task created",is_log:true}).catch(()=>{});
    }
    await supabase.from("task_assignees").delete().eq("task_id",taskId);
    if(form.assignees.length) await supabase.from("task_assignees").insert(form.assignees.map(uid=>({task_id:taskId,user_id:uid})));
    await supabase.from("task_dependencies").delete().eq("task_id",taskId);
    if(form.deps.length) await supabase.from("task_dependencies").insert(form.deps.map(did=>({task_id:taskId,depends_on:did})));
    await loadData(); setShowForm(false); setEditTask(null);
    showToast(existingId?"Task updated ✓":"Task created ✓");
  };

  const deleteTask=async id=>{ setTasks(p=>p.filter(t=>t.id!==id)); await supabase.from("tasks").delete().eq("id",id); };

  if(session===undefined) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:C.hi,fontSize:14,fontFamily:"system-ui"}}>Loading…</div>;
  if(!session) return <LoginScreen/>;

  // ── Filter tasks by visibility (creator or assignee) ──
  const myTasks=tasks.filter(t=>
    !t.assignees?.length||!t.createdBy||t.createdBy===session.user.id||(t.assignees||[]).some(a=>a.id===session.user.id)
  );
  const activeTasks=myTasks.filter(t=>(t.status||"not_started")!=="abandoned");
  const abandonedTasks=myTasks.filter(t=>(t.status||"not_started")==="abandoned");

  const allTags=[...new Set(activeTasks.flatMap(t=>t.tags||[]))];
  const getTagColor=name=>{ const ct=customTags.find(t=>t.name===name); return ct?ct.color:autoTagC(name); };
  const sortFn=(a,b)=>{ if(a.done!==b.done)return a.done?1:-1; if(sortBy==="priority")return PO[a.priority]-PO[b.priority]; if(sortBy==="status"){const so={not_started:0,in_progress:1,in_review:2,blocked:3,done:4,abandoned:5};return so[a.status||"not_started"]-so[b.status||"not_started"];} if(sortBy==="added_desc")return new Date(b.createdAt)-new Date(a.createdAt); if(sortBy==="added_asc")return new Date(a.createdAt)-new Date(b.createdAt); if(sortBy==="due_asc"){if(!a.due&&!b.due)return 0;if(!a.due)return 1;if(!b.due)return -1;return new Date(a.due)-new Date(b.due);} if(sortBy==="alpha")return a.title.localeCompare(b.title); return 0; };
  const visible=activeTasks.filter(t=>{ if(filter==="active"&&t.done)return false; if(filter==="done"&&!t.done)return false; if(catFilter!=="all"&&t.cat!==catFilter)return false; if(customCatFilter!=="all"&&String(t.customCategoryId||"none")!==customCatFilter)return false; if(tagFilter&&!(t.tags||[]).includes(tagFilter))return false; return true; }).sort(sortFn);
  const counts={total:activeTasks.length,done:activeTasks.filter(t=>t.done).length,urgent:activeTasks.filter(t=>t.priority==="high"&&!t.done).length};
  const VIEWS=[["dashboard","📊","Dashboard"],["list","📋","Tasks"],["sprint","🏃","Sprint"],["calendar","📅","Calendar"],["gantt","🗂️","Gantt"],["admin","🗄️","Admin"]];

  const openEdit=t=>{ setEditTask(t||null); setShowForm(true); };

  return(
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:"'Inter',system-ui,sans-serif"}}>
      {toast&&<div style={{position:"fixed",bottom:mob?78:22,left:"50%",transform:"translateX(-50%)",background:toast.type==="success"?C.ok:C.err,color:"#fff",borderRadius:9,padding:"8px 16px",fontSize:12,fontWeight:500,zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,.2)",whiteSpace:"nowrap"}}>{toast.msg}</div>}

      {(showForm||editTask)&&(
        <TaskForm task={editTask} tasks={myTasks} profiles={profiles} categories={categories} customTags={customTags}
          onSave={saveTask} onClose={()=>{setShowForm(false);setEditTask(null);}}
          onCreateCategory={saveCategory} onCreateTag={createTag}
          onChangeStatus={changeStatus} session={session}/>
      )}
      {showCatModal&&<CategoryModal categories={categories} tasks={myTasks} onSave={saveCategory} onDelete={deleteCategory} onClose={()=>setShowCatModal(false)}/>}
      {showShare&&<ShareModal tasks={myTasks} categories={categories} onClose={()=>setShowShare(false)}/>}

      {!mob&&<Sidebar view={view} setView={setView} categories={categories} session={session} counts={counts} customCatFilter={customCatFilter} setCustomCatFilter={setCustomCatFilter} onNewTask={()=>openEdit(null)} onShare={()=>setShowShare(true)} onCatModal={()=>setShowCatModal(true)}/>}

      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",paddingBottom:mob?68:0}}>
        {mob&&<div style={{background:C.sidebar,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
          <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>📋 {VIEWS.find(v=>v[0]===view)?.[2]||"My Tasks"}</span>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>setShowShare(true)} style={{border:"none",background:"rgba(255,255,255,.1)",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:13,color:"#fff"}}>🚀</button>
            <button onClick={()=>openEdit(null)} style={{background:C.p,color:"#fff",border:"none",borderRadius:6,padding:"5px 11px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+</button>
          </div>
        </div>}

        <div style={{flex:1,padding:mob?"11px":"22px 26px",maxWidth:880,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>

          {view==="dashboard"&&<Dashboard tasks={activeTasks} categories={categories} onEdit={openEdit} onNewTask={()=>openEdit(null)}/>}

          {view==="list"&&<>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div><h1 style={{margin:0,fontSize:mob?16:18,fontWeight:700,color:C.tx}}>Tasks</h1><p style={{margin:"1px 0 0",fontSize:11,color:C.mu}}>{counts.done}/{counts.total} · {counts.urgent} urgent</p></div>
              {!mob&&<button onClick={()=>openEdit(null)} style={{background:C.p,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ New Task</button>}
            </div>
            {/* Filters */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",marginBottom:11}}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center",marginBottom:categories.length>0||allTags.length>0?9:0}}>
                {[["all","All"],["active","Active"],["done","Done"]].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} style={{border:`1px solid ${filter===v?C.p:C.border}`,background:filter===v?C.pL:"#fff",color:filter===v?C.p:C.mu,borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:filter===v?600:400,cursor:"pointer"}}>{l}</button>)}
                <div style={{width:1,background:C.border,height:14,margin:"0 2px"}}/>
                {[["all","All"],["work","💼"],["personal","🏠"]].map(([v,l])=><button key={v} onClick={()=>setCatFilter(v)} style={{border:`1px solid ${catFilter===v?C.p:C.border}`,background:catFilter===v?C.pL:"#fff",color:catFilter===v?C.p:C.mu,borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:catFilter===v?600:400,cursor:"pointer"}}>{l}</button>)}
                <div style={{marginLeft:"auto"}}>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 7px",fontSize:11,color:C.mu,background:"#fff",cursor:"pointer"}}>
                    <option value="priority">🔴 Priority</option><option value="status">○ Status</option>
                    <option value="added_desc">🕐 Newest</option><option value="due_asc">📅 Due</option><option value="alpha">🔤 A→Z</option>
                  </select>
                </div>
              </div>
              {categories.length>0&&<div style={{marginBottom:allTags.length>0?7:0}}>
                <div style={{fontSize:9,fontWeight:600,color:C.hi,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>📁 Category</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[["all","All"],["none","None"],...categories.map(c=>[String(c.id),c.code,c.color])].map(([v,l,col])=>{const active=customCatFilter===v;return<button key={v} onClick={()=>setCustomCatFilter(active?"all":v)} style={{border:`1px solid ${active?(col||C.p):C.border}`,background:active?(col||C.p)+"20":"#fff",color:active?(col||C.p):C.mu,borderRadius:99,padding:"3px 9px",fontSize:10,fontWeight:active?700:400,cursor:"pointer"}}>{l}</button>;})}
                </div>
              </div>}
              {allTags.length>0&&<div>
                <div style={{fontSize:9,fontWeight:600,color:C.hi,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>🏷️ Tags</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {allTags.map(tag=>{const c=getTagColor(tag),active=tagFilter===tag;return<button key={tag} onClick={()=>setTagFilter(active?null:tag)} style={{border:`1px solid ${active?c:C.border}`,background:active?c:"#fff",color:active?"#fff":c,borderRadius:99,padding:"3px 9px",fontSize:10,fontWeight:active?700:500,cursor:"pointer"}}>#{tag}</button>;})}
                  {tagFilter&&<button onClick={()=>setTagFilter(null)} style={{border:`1px solid ${C.border}`,background:"none",color:C.hi,borderRadius:99,padding:"3px 9px",fontSize:10,cursor:"pointer"}}>× clear</button>}
                </div>
              </div>}
            </div>
            {loading?<div style={{textAlign:"center",padding:"48px 0",color:C.hi}}>Loading…</div>
              :visible.length===0?<div style={{textAlign:"center",padding:"48px 0",color:C.hi}}><div style={{fontSize:32,marginBottom:8}}>✅</div><p style={{margin:0,fontSize:13}}>No tasks</p></div>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>{visible.map(t=><TaskCard key={t.id} t={t} categories={categories} customTags={customTags} onEdit={openEdit} onChangeStatus={changeStatus}/>)}</div>}
            {counts.done>0&&<div style={{marginTop:10,display:"flex",justifyContent:"center"}}>
              <button onClick={()=>setFilter(f=>f==="done"?"active":"done")} style={{border:`1px solid ${filter==="done"?C.ok:C.border}`,background:filter==="done"?C.ok+"15":"#fff",color:filter==="done"?C.ok:C.hi,borderRadius:99,padding:"5px 14px",fontSize:11,cursor:"pointer",fontWeight:filter==="done"?600:400}}>
                {filter==="done"?`▲ Hide ${counts.done} completed`:`▼ Show ${counts.done} completed`}
              </button>
            </div>}
          </>}

          {view==="sprint"&&<>
            <h1 style={{margin:"0 0 14px",fontSize:mob?16:18,fontWeight:700,color:C.tx}}>Sprint Board</h1>
            <SprintView tasks={activeTasks} categories={categories} customTags={customTags} onEdit={openEdit} onChangeStatus={changeStatus}/>
          </>}

          {view==="calendar"&&<>
            <h1 style={{margin:"0 0 14px",fontSize:mob?16:18,fontWeight:700,color:C.tx}}>Calendar</h1>
            <CalendarView tasks={activeTasks} categories={categories} customTags={customTags} onEdit={openEdit}/>
          </>}

          {view==="gantt"&&<>
            <h1 style={{margin:"0 0 14px",fontSize:mob?16:18,fontWeight:700,color:C.tx}}>Gantt Timeline</h1>
            <GanttView tasks={activeTasks} categories={categories} onEdit={openEdit}/>
          </>}

          {view==="admin"&&<AdminView abandonedTasks={abandonedTasks} allTasks={myTasks} categories={categories} customTags={customTags} onEdit={openEdit} onChangeStatus={changeStatus}/>}
        </div>
      </div>

      {mob&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:C.sidebar,display:"flex",zIndex:100,borderTop:"1px solid rgba(255,255,255,.08)"}}>
        {VIEWS.map(([v,ic,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"8px 0 11px",border:"none",background:view===v?"rgba(255,255,255,.12)":"transparent",color:view===v?"#fff":"rgba(255,255,255,.4)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
            <span style={{fontSize:17}}>{ic}</span>
            <span style={{fontSize:8,fontWeight:view===v?600:400,textTransform:"uppercase",letterSpacing:.3}}>{l}</span>
          </button>
        ))}
        <button onClick={()=>openEdit(null)} style={{flex:1,padding:"8px 0 11px",border:"none",background:"transparent",color:C.p,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
          <span style={{fontSize:20,fontWeight:700,lineHeight:1}}>＋</span>
          <span style={{fontSize:8,fontWeight:600,textTransform:"uppercase",letterSpacing:.3}}>New</span>
        </button>
      </div>}
    </div>
  );
}