import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY;

const PRIORITIES = {
  high:   {label:"High",   color:"#ef4444", bg:"#fef2f2"},
  medium: {label:"Medium", color:"#f59e0b", bg:"#fffbeb"},
  low:    {label:"Low",    color:"#6366f1", bg:"#eef2ff"},
};
const CAT_COLORS = ["#6366f1","#ec4899","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#06b6d4","#84cc16","#f97316"];
const TAG_PAL = ["#6366f1","#ec4899","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];
const tagColor = t => { let h=0; for(let c of t) h=(h*31+c.charCodeAt(0))%TAG_PAL.length; return TAG_PAL[h]; };
const fmtDt   = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "";
const fmtDay  = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}) : "";
const isOD    = (dt,done) => !done&&dt&&new Date(dt)<new Date();
const sameDay = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS    = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const PO      = {high:0,medium:1,low:2};

const fromDB = (r,assignees=[]) => ({
  id:r.id, title:r.title, desc:r.description||"", descHtml:r.description_html||"",
  cat:r.category||"work", priority:r.priority||"medium",
  due:r.due_date||"", startDate:r.start_date||"",
  done:r.done||false, tags:r.tags||[], parentId:r.parent_id||null,
  createdAt:r.created_at, assignees, deps:[],
  customCategoryId:r.custom_category_id||null, taskCode:r.task_code||null,
});

const S = {
  inp: {width:"100%",border:"1px solid #e5e5e5",borderRadius:8,padding:"10px 12px",fontSize:14,marginBottom:10,boxSizing:"border-box",outline:"none",fontFamily:"inherit"},
  lbl: {fontSize:12,color:"#888",display:"block",marginBottom:4},
  sel: {width:"100%",border:"1px solid #e5e5e5",borderRadius:8,padding:"9px 10px",fontSize:14,fontFamily:"inherit",background:"#fff",boxSizing:"border-box"},
  nav: {border:"1px solid #ebebeb",background:"#fff",borderRadius:8,width:34,height:34,fontSize:18,cursor:"pointer",color:"#444",display:"flex",alignItems:"center",justifyContent:"center"},
};

// ── Responsive hook ───────────────────────────────────────────
function useIsMobile() {
  const [m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{ const h=()=>setM(window.innerWidth<768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);
  return m;
}

// ── Rich Editor ───────────────────────────────────────────────
function RichEditor({content,onChange}) {
  const ed=useEditor({extensions:[StarterKit],content,onUpdate:({editor})=>onChange(editor.getHTML())});
  if(!ed) return null;
  const tb=(fn,l,a)=><button type="button" onClick={fn} style={{border:"1px solid "+(a?"#6366f1":"#e5e5e5"),borderRadius:6,background:a?"#eef2ff":"#fff",color:a?"#6366f1":"#555",padding:"4px 8px",fontSize:12,cursor:"pointer",fontWeight:600}}>{l}</button>;
  return (
    <div style={{border:"1px solid #e5e5e5",borderRadius:8,overflow:"hidden",marginBottom:10}}>
      <div style={{display:"flex",gap:4,padding:"6px 8px",borderBottom:"1px solid #f0f0f0",flexWrap:"wrap",background:"#fafafa"}}>
        {tb(()=>ed.chain().focus().toggleBold().run(),"B",ed.isActive("bold"))}
        {tb(()=>ed.chain().focus().toggleItalic().run(),"I",ed.isActive("italic"))}
        {tb(()=>ed.chain().focus().toggleStrike().run(),"S̶",ed.isActive("strike"))}
        {tb(()=>ed.chain().focus().toggleHeading({level:2}).run(),"H2",ed.isActive("heading",{level:2}))}
        {tb(()=>ed.chain().focus().toggleBulletList().run(),"• List",ed.isActive("bulletList"))}
        {tb(()=>ed.chain().focus().toggleOrderedList().run(),"1. List",ed.isActive("orderedList"))}
        {tb(()=>ed.chain().focus().toggleCode().run(),"</>",ed.isActive("code"))}
      </div>
      <EditorContent editor={ed} style={{padding:"10px 12px",minHeight:80,fontSize:14,lineHeight:1.6}}/>
    </div>
  );
}

// ── Category Modal ────────────────────────────────────────────
function CategoryModal({categories,onSave,onDelete,onClose}) {
  const [name,setName]=useState(""); const [code,setCode]=useState(""); const [color,setColor]=useState("#6366f1");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:460,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h2 style={{margin:0,fontSize:17,fontWeight:700}}>📁 Categories</h2>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:"#888"}}>×</button>
        </div>
        <div style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:"#4338ca"}}>
          Format: <strong style={{fontFamily:"monospace"}}>[CODE]-001</strong> &nbsp;·&nbsp; e.g. DEV-001 · MKT-042 · HR-003
        </div>
        {categories.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#fafafa",borderRadius:8,marginBottom:6}}>
            <div style={{width:5,height:28,borderRadius:3,background:c.color,flexShrink:0}}/>
            <span style={{fontSize:12,fontWeight:700,color:c.color,minWidth:55,fontFamily:"monospace"}}>{c.code}</span>
            <span style={{fontSize:13,flex:1}}>{c.name}</span>
            <button onClick={()=>onDelete(c.id)} style={{border:"none",background:"none",color:"#ccc",cursor:"pointer",fontSize:16}}>×</button>
          </div>
        ))}
        {!categories.length&&<p style={{fontSize:13,color:"#bbb",textAlign:"center",padding:"10px 0"}}>No categories yet</p>}
        <div style={{borderTop:"1px solid #ebebeb",paddingTop:14,marginTop:10}}>
          <p style={{fontSize:12,fontWeight:600,color:"#555",margin:"0 0 10px"}}>New category</p>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name (e.g. Development)" style={{...S.inp,margin:0,flex:1}}/>
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,5))} placeholder="CODE" style={{...S.inp,margin:0,width:85,fontFamily:"monospace",fontWeight:700,textAlign:"center"}}/>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
            {CAT_COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:22,height:22,borderRadius:"50%",background:c,border:color===c?"3px solid #111":"2px solid transparent",cursor:"pointer"}}/>)}
          </div>
          <button onClick={async()=>{ if(!name.trim()||!code.trim())return; await onSave({name:name.trim(),code,color}); setName("");setCode(""); }}
            style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:14,fontWeight:600,cursor:"pointer"}}>+ Add</button>
        </div>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────
function LoginScreen() {
  const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const login=async()=>{ setErr("");setLoading(true); const{error}=await supabase.auth.signInWithPassword({email,password:pw}); setLoading(false); if(error)setErr("Incorrect email or password."); };
  return (
    <div style={{minHeight:"100vh",background:"#f8f8f7",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:32,width:"100%",maxWidth:380,boxShadow:"0 4px 32px rgba(0,0,0,.08)"}}>
        <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:36,marginBottom:8}}>📋</div><h1 style={{margin:0,fontSize:22,fontWeight:700}}>My Tasks</h1><p style={{margin:"6px 0 0",fontSize:14,color:"#888"}}>Sign in to continue</p></div>
        <label style={S.lbl}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&login()} style={S.inp} autoFocus/>
        <label style={S.lbl}>Password</label>
        <input value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()} style={{...S.inp,marginBottom:0}}/>
        {err&&<p style={{color:"#ef4444",fontSize:13,margin:"8px 0 0"}}>{err}</p>}
        <button onClick={login} disabled={loading} style={{marginTop:18,background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:11,fontSize:14,fontWeight:600,cursor:"pointer",width:"100%",opacity:loading?.7:1}}>{loading?"Signing in…":"Sign in →"}</button>
      </div>
    </div>
  );
}

// ── Task Form ─────────────────────────────────────────────────
function TaskForm({task,tasks,profiles,categories,onSave,onClose}) {
  const mob=useIsMobile(), isEdit=!!task;
  const [form,setForm]=useState({
    title:task?.title||"", descHtml:task?.descHtml||"",
    cat:task?.cat||"work", priority:task?.priority||"medium",
    due:task?.due||"", startDate:task?.startDate||"",
    tagInput:"", tags:task?.tags||[],
    assignees:task?.assignees?.map(a=>a.id)||[],
    parentId:task?.parentId?String(task.parentId):"",
    deps:task?.deps?.map(d=>d.id)||[],
    customCategoryId:task?.customCategoryId?String(task.customCategoryId):"",
  });
  const [saving,setSaving]=useState(false);
  const addTag=()=>{ const t=form.tagInput.trim().toLowerCase().replace(/\s+/g,"-"); if(t&&!form.tags.includes(t))setForm(f=>({...f,tags:[...f.tags,t],tagInput:""})); else setForm(f=>({...f,tagInput:""})); };
  const toggle=(field,id)=>setForm(f=>({...f,[field]:f[field].includes(id)?f[field].filter(x=>x!==id):[...f[field],id]}));
  const avail=tasks.filter(t=>t.id!==task?.id);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",padding:mob?0:20}}>
      <div style={{background:"#fff",borderRadius:mob?"16px 16px 0 0":16,padding:mob?"20px 16px 32px":28,width:"100%",maxWidth:mob?"100%":660,maxHeight:mob?"92vh":"88vh",overflowY:"auto"}}>
        {mob&&<div style={{width:40,height:4,background:"#e5e5e5",borderRadius:99,margin:"0 auto 16px"}}/>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <h2 style={{margin:0,fontSize:17,fontWeight:700}}>{isEdit?"Edit Task":"New Task"}</h2>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:"#888"}}>×</button>
        </div>
        <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Title *" style={S.inp}/>
        <label style={S.lbl}>Description</label>
        <RichEditor content={form.descHtml} onChange={html=>setForm(f=>({...f,descHtml:html}))}/>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <div style={{flex:2,minWidth:120}}>
            <label style={S.lbl}>📁 Category</label>
            <select value={form.customCategoryId} onChange={e=>setForm(f=>({...f,customCategoryId:e.target.value}))} style={S.sel}>
              <option value="">— None —</option>
              {categories.map(c=><option key={c.id} value={c.id}>[{c.code}] {c.name}</option>)}
            </select>
          </div>
          <div style={{flex:1,minWidth:100}}>
            <label style={S.lbl}>Priority</label>
            <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={S.sel}>
              <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🔵 Low</option>
            </select>
          </div>
          <div style={{flex:1,minWidth:100}}>
            <label style={S.lbl}>Type</label>
            <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={S.sel}>
              <option value="work">💼 Work</option><option value="personal">🏠 Personal</option>
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:140}}>
            <label style={S.lbl}>Start date</label>
            <input type="datetime-local" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{...S.sel,fontSize:13}}/>
          </div>
          <div style={{flex:1,minWidth:140}}>
            <label style={S.lbl}>Due date</label>
            <input type="datetime-local" value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))} style={{...S.sel,fontSize:13}}/>
          </div>
        </div>
        <label style={S.lbl}>Assignees</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {profiles.map(p=>{const a=form.assignees.includes(p.id);return(
            <button key={p.id} type="button" onClick={()=>toggle("assignees",p.id)} style={{border:`1px solid ${a?"#6366f1":"#e5e5e5"}`,background:a?"#eef2ff":"#fff",color:a?"#6366f1":"#666",borderRadius:99,padding:"5px 12px",fontSize:12,fontWeight:a?600:400,cursor:"pointer"}}>{a?"✓ ":""}{p.full_name||p.email}</button>
          );})}
          {!profiles.length&&<span style={{fontSize:12,color:"#aaa"}}>No users</span>}
        </div>
        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Parent task</label>
          <select value={form.parentId} onChange={e=>setForm(f=>({...f,parentId:e.target.value}))} style={S.sel}>
            <option value="">— None —</option>
            {avail.map(t=><option key={t.id} value={t.id}>{t.taskCode?`[${t.taskCode}] `:""}{t.title.slice(0,35)}</option>)}
          </select>
        </div>
        <label style={S.lbl}>Blocked by (dependencies)</label>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
          {avail.map(t=>{const a=form.deps.includes(t.id);return(
            <button key={t.id} type="button" onClick={()=>toggle("deps",t.id)} style={{border:`1px solid ${a?"#ef4444":"#e5e5e5"}`,background:a?"#fef2f2":"#fff",color:a?"#ef4444":"#666",borderRadius:99,padding:"4px 10px",fontSize:11,fontWeight:a?600:400,cursor:"pointer"}}>
              {a?"🔒 ":""}{t.taskCode?`[${t.taskCode}] `:""}{t.title.slice(0,24)}
            </button>
          );})}
          {!avail.length&&<span style={{fontSize:12,color:"#aaa"}}>No other tasks</span>}
        </div>
        <label style={S.lbl}>Tags</label>
        {form.tags.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{form.tags.map(tag=>{const c=tagColor(tag);return(<span key={tag} style={{display:"inline-flex",alignItems:"center",gap:4,background:c+"18",color:c,border:`1px solid ${c}44`,borderRadius:99,padding:"3px 10px",fontSize:12,fontWeight:600}}>#{tag}<span onClick={()=>setForm(f=>({...f,tags:f.tags.filter(t=>t!==tag)}))} style={{cursor:"pointer",opacity:.6,fontSize:14}}>×</span></span>);})}</div>}
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          <input value={form.tagInput} onChange={e=>setForm(f=>({...f,tagInput:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addTag();}}} placeholder="Tag then Enter…" style={{...S.inp,margin:0,flex:1}}/>
          <button type="button" onClick={addTag} style={{border:"1px solid #e5e5e5",background:"#f9f9f9",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>+</button>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{border:"1px solid #ebebeb",background:"#fff",borderRadius:8,padding:"9px 16px",fontSize:14,cursor:"pointer",color:"#666"}}>Cancel</button>
          <button onClick={async()=>{if(!form.title.trim())return;setSaving(true);await onSave(form,task?.id);setSaving(false);}} disabled={saving}
            style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:14,fontWeight:600,cursor:"pointer",opacity:saving?.7:1}}>
            {saving?"Saving…":isEdit?"Save changes":"Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gantt View ─────────────────────────────────────────────────
function GanttView({tasks,categories,onEdit}) {
  const mob=useIsMobile();
  const ref=useRef(null);
  const LABEL_W=mob?130:190, ROW_H=42;
  const [chartW,setChartW]=useState(500);
  const [zoom,setZoom]=useState(60);
  const [vs,setVs]=useState(()=>{ const d=new Date(); d.setDate(d.getDate()-7); d.setHours(0,0,0,0); return d; });

  useEffect(()=>{
    if(!ref.current) return;
    const obs=new ResizeObserver(e=>setChartW(Math.max(300,e[0].contentRect.width-LABEL_W)));
    obs.observe(ref.current); return()=>obs.disconnect();
  },[LABEL_W]);

  const today=new Date(); today.setHours(0,0,0,0);
  const dayW=chartW/zoom;
  const ve=new Date(vs.getTime()+zoom*86400000);
  const diff=(a,b)=>(new Date(b)-new Date(a))/86400000;
  const todayX=Math.max(0,diff(vs,today)*dayW);

  const getBar=t=>{
    const s=new Date(t.startDate||t.createdAt); s.setHours(0,0,0,0);
    const e=t.due?new Date(t.due):null; if(e) e.setHours(0,0,0,0);
    if(s>ve||(e&&e<vs)) return null;
    const sx=Math.max(0,diff(vs,s))*dayW;
    const ex=e?Math.min(zoom,diff(vs,e))*dayW:sx+dayW*2;
    return {left:sx,width:Math.max(12,ex-sx)};
  };

  const step=zoom<=14?1:zoom<=30?3:zoom<=60?7:14;
  const ticks=[];
  for(let i=0;i<=zoom;i+=step){ const d=new Date(vs.getTime()+i*86400000); ticks.push({x:i*dayW,label:fmtDay(d)}); }

  // Group tasks by category → sub-group linked vs standalone
  const groups=[];
  const allCats=[{id:"none",name:"General",code:"GEN",color:"#94a3b8"},...categories];
  allCats.forEach(cat=>{
    const items=tasks.filter(t=>String(t.customCategoryId||"none")===String(cat.id));
    if(!items.length) return;
    const linked=items.filter(t=>(t.deps&&t.deps.length>0)||t.parentId);
    const standalone=items.filter(t=>(!t.deps||!t.deps.length)&&!t.parentId);
    groups.push({cat,linked,standalone,total:items.length});
  });

  const navigate=dir=>setVs(d=>new Date(d.getTime()+dir*Math.floor(zoom/2)*86400000));
  const goToday=()=>{ const d=new Date(); d.setDate(d.getDate()-7); d.setHours(0,0,0,0); setVs(d); };

  const renderBar=(task,cat)=>{
    const bar=getBar(task);
    const blocked=(task.deps||[]).some(d=>!d.done);
    const p=PRIORITIES[task.priority]||PRIORITIES.medium;
    const bc=task.done?"#d1d5db":blocked?"#fde68a":p.color;
    const hasLink=(task.deps&&task.deps.length>0)||task.parentId;
    return (
      <div key={task.id} style={{display:"flex",height:ROW_H,alignItems:"center",borderBottom:"1px solid #f5f5f5",cursor:"default"}}
        onMouseEnter={e=>e.currentTarget.style.background="#f9f9f9"}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <div style={{width:LABEL_W,flexShrink:0,padding:"0 8px",borderRight:"1px solid #ebebeb",display:"flex",alignItems:"center",gap:5,overflow:"hidden"}}>
          {task.taskCode&&<span style={{fontSize:9,fontWeight:700,color:cat.color,fontFamily:"monospace",background:cat.color+"18",borderRadius:4,padding:"1px 5px",whiteSpace:"nowrap",flexShrink:0}}>{task.taskCode}</span>}
          <span style={{fontSize:11,color:task.done?"#aaa":"#333",textDecoration:task.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={task.title}>{task.title}</span>
        </div>
        <div style={{flex:1,position:"relative",height:"100%",minWidth:0}}>
          {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:1,background:"#6366f1",opacity:.2,pointerEvents:"none"}}/>}
          {bar&&(
            <div onClick={()=>onEdit(task)} style={{position:"absolute",left:bar.left,width:bar.width,top:8,height:26,borderRadius:6,background:bc,opacity:task.done?.7:1,cursor:"pointer",display:"flex",alignItems:"center",paddingLeft:6,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.12)",transition:"opacity .15s"}}
              title={`${task.title}${task.startDate?" · Start: "+fmtDay(task.startDate):""}${task.due?" · Due: "+fmtDay(task.due):""}`}>
              <span style={{fontSize:10,color:task.done?"#555":"#fff",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {blocked?"🔒":hasLink?"🔗":""} {task.title}
              </span>
            </div>
          )}
          {!bar&&<div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#ccc"}}>no date</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Controls */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:3}}>
          {[[14,"2W"],[30,"1M"],[60,"2M"],[90,"3M"]].map(([d,l])=>(
            <button key={d} onClick={()=>setZoom(d)} style={{border:"1px solid "+(zoom===d?"#6366f1":"#ebebeb"),background:zoom===d?"#eef2ff":"#fff",color:zoom===d?"#6366f1":"#666",borderRadius:6,padding:"5px 9px",fontSize:12,cursor:"pointer",fontWeight:zoom===d?600:400}}>{l}</button>
          ))}
        </div>
        <button onClick={()=>navigate(-1)} style={{border:"1px solid #ebebeb",background:"#fff",borderRadius:6,padding:"5px 9px",fontSize:12,cursor:"pointer"}}>← Prev</button>
        <button onClick={goToday} style={{border:"1px solid #6366f1",background:"#eef2ff",color:"#6366f1",borderRadius:6,padding:"5px 9px",fontSize:12,cursor:"pointer",fontWeight:600}}>Today</button>
        <button onClick={()=>navigate(1)} style={{border:"1px solid #ebebeb",background:"#fff",borderRadius:6,padding:"5px 9px",fontSize:12,cursor:"pointer"}}>Next →</button>
        <span style={{fontSize:11,color:"#aaa"}}>{fmtDay(vs)} → {fmtDay(ve)}</span>
      </div>

      <div ref={ref} style={{border:"1px solid #ebebeb",borderRadius:12,background:"#fff",overflowX:"auto"}}>
        {/* Time header */}
        <div style={{display:"flex",borderBottom:"1px solid #ebebeb",position:"sticky",top:0,background:"#fff",zIndex:5}}>
          <div style={{width:LABEL_W,flexShrink:0,padding:"8px 10px",fontSize:11,fontWeight:600,color:"#aaa",borderRight:"1px solid #ebebeb"}}>Task</div>
          <div style={{width:chartW,flexShrink:0,position:"relative",height:32}}>
            {ticks.map(({x,label},i)=>(
              <div key={i} style={{position:"absolute",left:x,fontSize:10,color:"#bbb",top:8,transform:"translateX(-50%)",whiteSpace:"nowrap",pointerEvents:"none"}}>{label}</div>
            ))}
            {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:2,background:"#6366f1",opacity:.5}}/>}
          </div>
        </div>

        {/* Groups */}
        {groups.length===0&&<div style={{padding:40,textAlign:"center",color:"#aaa",fontSize:14}}>No tasks to display on the timeline</div>}
        {groups.map(({cat,linked,standalone,total})=>(
          <div key={cat.id}>
            {/* Category row */}
            <div style={{display:"flex",background:cat.color+"12",borderBottom:"1px solid "+cat.color+"20"}}>
              <div style={{width:LABEL_W,flexShrink:0,padding:"7px 10px",borderRight:"1px solid #ebebeb",display:"flex",alignItems:"center",gap:6}}>
                <span style={{background:cat.color,color:"#fff",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:700,fontFamily:"monospace"}}>{cat.code}</span>
                <span style={{fontSize:12,fontWeight:600,color:"#333"}}>{cat.name}</span>
                <span style={{fontSize:11,color:"#aaa"}}>({total})</span>
              </div>
              <div style={{width:chartW,flexShrink:0,position:"relative",height:32}}>
                {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:1,background:cat.color,opacity:.3}}/>}
              </div>
            </div>
            {/* 🔗 Linked tasks */}
            {linked.length>0&&<>
              <div style={{display:"flex",background:"#fafafa",borderBottom:"1px solid #f0f0f0"}}>
                <div style={{width:LABEL_W,flexShrink:0,padding:"3px 10px 3px 14px",fontSize:10,color:"#aaa",borderRight:"1px solid #ebebeb"}}>🔗 Linked ({linked.length})</div>
                <div style={{width:chartW,flexShrink:0}}/>
              </div>
              {linked.map(t=>renderBar(t,cat))}
            </>}
            {/* — Standalone tasks */}
            {standalone.length>0&&<>
              {linked.length>0&&<div style={{display:"flex",background:"#fafafa",borderBottom:"1px solid #f0f0f0"}}>
                <div style={{width:LABEL_W,flexShrink:0,padding:"3px 10px 3px 14px",fontSize:10,color:"#aaa",borderRight:"1px solid #ebebeb"}}>— Standalone ({standalone.length})</div>
                <div style={{width:chartW,flexShrink:0}}/>
              </div>}
              {standalone.map(t=>renderBar(t,cat))}
            </>}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap",justifyContent:"center"}}>
        {Object.entries(PRIORITIES).map(([k,v])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#888"}}><div style={{width:14,height:8,borderRadius:3,background:v.color}}/>{v.label}</div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#888"}}><div style={{width:14,height:8,borderRadius:3,background:"#fde68a"}}/>Blocked</div>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#888"}}><div style={{width:14,height:8,borderRadius:3,background:"#d1d5db"}}/>Done</div>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#888"}}><div style={{width:2,height:14,background:"#6366f1"}}/>Today</div>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#888"}}>🔗 Has dep/parent</div>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────
function TaskCard({t,tasks,categories,onToggle,onDelete,onEdit,onTagClick,activeTag}) {
  const mob=useIsMobile();
  const p=PRIORITIES[t.priority]||PRIORITIES.medium, late=isOD(t.due,t.done);
  const parent=t.parentId?tasks.find(x=>x.id==t.parentId):null;
  const children=tasks.filter(x=>x.parentId==t.id);
  const blocked=(t.deps||[]).some(d=>!d.done);
  const cat=categories.find(c=>c.id==t.customCategoryId);
  return (
    <div style={{background:t.done?"#fafafa":blocked?"#fffbf0":"#fff",border:"1px solid "+(late?"#fecaca":blocked?"#fde68a":"#ebebeb"),borderRadius:12,padding:mob?"11px 12px":"14px 16px",display:"flex",alignItems:"flex-start",gap:10,opacity:t.done?.6:1,transition:"all .2s"}}>
      <button onClick={()=>!blocked&&onToggle()} style={{width:22,height:22,borderRadius:"50%",border:"2px solid "+(t.done?"#6366f1":blocked?"#fbbf24":"#d5d5d5"),background:t.done?"#6366f1":"transparent",cursor:blocked?"not-allowed":"pointer",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {t.done?<svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>:blocked&&<span style={{fontSize:10}}>🔒</span>}
      </button>
      <div style={{flex:1,minWidth:0}}>
        {parent&&<div style={{fontSize:10,color:"#aaa",marginBottom:2}}>↑ {parent.taskCode?`[${parent.taskCode}] `:""}{parent.title}</div>}
        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:4}}>
          {t.taskCode&&cat&&<span style={{fontSize:10,fontWeight:700,color:cat.color,fontFamily:"monospace",background:cat.color+"18",borderRadius:4,padding:"1px 6px",flexShrink:0}}>{t.taskCode}</span>}
          <span style={{fontSize:mob?13:14,fontWeight:600,color:t.done?"#aaa":"#111",textDecoration:t.done?"line-through":"none"}}>{t.title}</span>
          <span style={{fontSize:10,padding:"2px 6px",borderRadius:99,background:p.bg,color:p.color,fontWeight:600}}>{p.label}</span>
          {!mob&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:99,background:"#f4f4f4",color:"#666"}}>{t.cat==="work"?"💼":"🏠"}</span>}
          {children.length>0&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:99,background:"#f0fdf4",color:"#10b981"}}>↓{children.length}</span>}
        </div>
        {t.descHtml&&t.descHtml!=="<p></p>"&&!mob&&<div dangerouslySetInnerHTML={{__html:t.descHtml}} style={{fontSize:13,color:"#555",marginBottom:6,lineHeight:1.6}}/>}
        {blocked&&<div style={{fontSize:11,color:"#92400e",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"3px 8px",marginBottom:5}}>🔒 Blocked by: {(t.deps||[]).filter(d=>!d.done).map(d=>d.title).join(", ")}</div>}
        {(t.assignees||[]).length>0&&<div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:5}}>{(t.assignees||[]).map(a=><span key={a.id} style={{fontSize:10,background:"#f4f4f4",color:"#555",borderRadius:99,padding:"2px 7px"}}>👤 {(a.full_name||a.email).split("@")[0]}</span>)}</div>}
        {(t.tags||[]).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:t.due?4:0}}>{(t.tags||[]).map(tag=>{const c=tagColor(tag),active=activeTag===tag;return(<span key={tag} onClick={()=>onTagClick(tag)} style={{display:"inline-block",background:active?c:c+"18",color:c,border:`1px solid ${c}44`,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"pointer",userSelect:"none"}}>#{tag}</span>);})}</div>}
        {t.due&&<div style={{fontSize:11,color:late?"#ef4444":"#aaa",marginTop:2}}>{late?"⚠️ Overdue — ":"🕐 "}{fmtDt(t.due)}</div>}
      </div>
      <div style={{display:"flex",gap:3,flexShrink:0}}>
        <button onClick={onEdit} style={{border:"1px solid #ebebeb",background:"#fff",borderRadius:7,padding:"4px 7px",cursor:"pointer",fontSize:12}}>✏️</button>
        <button onClick={onDelete} style={{border:"none",background:"none",cursor:"pointer",color:"#ccc",fontSize:18,padding:"0 2px",lineHeight:1}}>×</button>
      </div>
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
  const [loading,setLoading]=useState(false);
  const [editTask,setEditTask]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [showCatModal,setShowCatModal]=useState(false);
  const [view,setView]=useState("list");
  const [filter,setFilter]=useState("all");
  const [catFilter,setCatFilter]=useState("all");
  const [customCatFilter,setCustomCatFilter]=useState("all");
  const [tagFilter,setTagFilter]=useState(null);
  const [sortBy,setSortBy]=useState("priority");
  const [notifPerm,setNotifPerm]=useState("default");
  const [digest,setDigest]=useState({show:false,time:"08:00"});
  const [calDate,setCalDate]=useState(new Date());
  const [selDay,setSelDay]=useState(null);
  const [toast,setToast]=useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));
    if("Notification" in window) setNotifPerm(Notification.permission);
    return()=>subscription.unsubscribe();
  },[]);

  const loadData=async()=>{
    setLoading(true);
    const [tr,ar,dr,pr,cr]=await Promise.all([
      supabase.from("tasks").select("*").order("created_at",{ascending:true}),
      supabase.from("task_assignees").select("*, profiles(id,email,full_name)"),
      supabase.from("task_dependencies").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("custom_categories").select("*").order("name"),
    ]);
    setProfiles(pr.data||[]); setCategories(cr.data||[]);
    const aMap={}, dMap={};
    (ar.data||[]).forEach(a=>{ if(!aMap[a.task_id])aMap[a.task_id]=[]; if(a.profiles)aMap[a.task_id].push(a.profiles); });
    (dr.data||[]).forEach(d=>{ if(!dMap[d.task_id])dMap[d.task_id]=[]; dMap[d.task_id].push(d.depends_on); });
    const map={};
    (tr.data||[]).forEach(r=>{ map[r.id]=fromDB(r,aMap[r.id]||[]); });
    Object.values(map).forEach(t=>{ t.deps=(dMap[t.id]||[]).map(id=>map[id]).filter(Boolean); });
    setTasks(Object.values(map));
    setLoading(false);
  };

  useEffect(()=>{ if(session) loadData(); },[session]);

  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const requestNotif=async()=>{ const p=await Notification.requestPermission(); setNotifPerm(p); };

  const saveCategory=async data=>{ await supabase.from("custom_categories").insert(data); await loadData(); };
  const deleteCategory=async id=>{ await supabase.from("custom_categories").delete().eq("id",id); await loadData(); };

  const generateCode=async catId=>{
    if(!catId) return null;
    const cat=categories.find(c=>c.id===parseInt(catId));
    if(!cat) return null;
    const {count}=await supabase.from("tasks").select("*",{count:"exact",head:true}).eq("custom_category_id",catId);
    return `${cat.code}-${String((count||0)+1).padStart(3,"0")}`;
  };

  const saveTask=async(form,existingId)=>{
    const existing=tasks.find(t=>t.id===existingId);
    const task_code=existingId?(existing?.taskCode||null):await generateCode(form.customCategoryId);
    const db={title:form.title.trim(),description:"",description_html:form.descHtml,category:form.cat,priority:form.priority,due_date:form.due||null,start_date:form.startDate||null,tags:form.tags,parent_id:form.parentId?parseInt(form.parentId):null,custom_category_id:form.customCategoryId?parseInt(form.customCategoryId):null,task_code};
    let taskId=existingId;
    if(existingId){ const{error}=await supabase.from("tasks").update(db).eq("id",existingId); if(error){showToast("Error: "+error.message,"error");return;} }
    else { const{data,error}=await supabase.from("tasks").insert({...db,done:false}).select().single(); if(error){showToast("Error: "+error.message,"error");return;} taskId=data.id; }
    await supabase.from("task_assignees").delete().eq("task_id",taskId);
    if(form.assignees.length) await supabase.from("task_assignees").insert(form.assignees.map(uid=>({task_id:taskId,user_id:uid})));
    await supabase.from("task_dependencies").delete().eq("task_id",taskId);
    if(form.deps.length) await supabase.from("task_dependencies").insert(form.deps.map(did=>({task_id:taskId,depends_on:did})));
    await loadData(); setShowForm(false); setEditTask(null);
    showToast(existingId?"Task updated ✓":"Task added ✓");
  };

  const toggleDone=async(id,done)=>{ setTasks(p=>p.map(t=>t.id===id?{...t,done:!done}:t)); await supabase.from("tasks").update({done:!done}).eq("id",id); };
  const deleteTask=async id=>{ setTasks(p=>p.filter(t=>t.id!==id)); await supabase.from("tasks").delete().eq("id",id); };

  if(session===undefined) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#aaa",fontSize:14}}>Loading…</div>;
  if(!session) return <LoginScreen/>;

  const allTags=[...new Set(tasks.flatMap(t=>t.tags||[]))];
  const sortFn=(a,b)=>{ if(a.done!==b.done)return a.done?1:-1; if(sortBy==="priority")return PO[a.priority]-PO[b.priority]; if(sortBy==="added_desc")return new Date(b.createdAt)-new Date(a.createdAt); if(sortBy==="added_asc")return new Date(a.createdAt)-new Date(b.createdAt); if(sortBy==="due_asc"){if(!a.due&&!b.due)return 0;if(!a.due)return 1;if(!b.due)return -1;return new Date(a.due)-new Date(b.due);} if(sortBy==="alpha")return a.title.localeCompare(b.title); return 0; };
  const visible=tasks.filter(t=>{ if(filter==="active"&&t.done)return false; if(filter==="done"&&!t.done)return false; if(catFilter!=="all"&&t.cat!==catFilter)return false; if(customCatFilter!=="all"&&String(t.customCategoryId||"none")!==customCatFilter)return false; if(tagFilter&&!(t.tags||[]).includes(tagFilter))return false; return true; }).sort(sortFn);
  const counts={total:tasks.length,done:tasks.filter(t=>t.done).length,high:tasks.filter(t=>t.priority==="high"&&!t.done).length};
  const yr=calDate.getFullYear(),mo=calDate.getMonth();
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const firstDay=(d=>d===0?6:d-1)(new Date(yr,mo,1).getDay());
  const dayTasks=day=>tasks.filter(t=>t.due&&sameDay(new Date(t.due),new Date(yr,mo,day)));
  const VIEWS=[["list","📋","List"],["calendar","📅","Cal."],["gantt","📊","Gantt"]];

  return (
    <div style={{minHeight:"100vh",background:"#f8f8f7",fontFamily:"'Inter',system-ui,sans-serif",paddingBottom:mob?80:0}}>
      {toast&&<div style={{position:"fixed",bottom:mob?88:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="success"?"#10b981":"#ef4444",color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:500,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,.15)",whiteSpace:"nowrap"}}>{toast.msg}</div>}
      {(showForm||editTask)&&<TaskForm task={editTask} tasks={tasks} profiles={profiles} categories={categories} onSave={saveTask} onClose={()=>{setShowForm(false);setEditTask(null);}}/>}
      {showCatModal&&<CategoryModal categories={categories} onSave={saveCategory} onDelete={deleteCategory} onClose={()=>setShowCatModal(false)}/>}

      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid #ebebeb",padding:mob?"12px 16px 0":"20px 24px 0",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:720,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:mob?10:14}}>
            <div>
              <h1 style={{margin:0,fontSize:mob?17:22,fontWeight:700,color:"#111",letterSpacing:"-0.5px"}}>My Tasks</h1>
              {!mob&&<p style={{margin:"2px 0 0",fontSize:13,color:"#888"}}>{counts.done}/{counts.total} completed{counts.high>0?` · ${counts.high} urgent`:""}<span style={{marginLeft:8,color:"#c7d2fe",fontSize:11}}>● {session.user.email}</span></p>}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setShowCatModal(true)} title="Categories" style={{border:"1px solid #ebebeb",borderRadius:8,background:"#fff",padding:"7px 9px",cursor:"pointer",fontSize:15}}>📁</button>
              {notifPerm!=="granted"
                ?<button onClick={requestNotif} style={{border:"1px solid #ebebeb",borderRadius:8,background:"#fff",padding:"7px 9px",cursor:"pointer",fontSize:15}}>🔔</button>
                :<button onClick={()=>setDigest(d=>({...d,show:!d.show}))} style={{border:"1px solid "+(digest.show?"#6366f1":"#ebebeb"),borderRadius:8,background:digest.show?"#eef2ff":"#fff",padding:"7px 9px",cursor:"pointer",fontSize:15}}>📬</button>
              }
              {!mob&&<button onClick={()=>{setEditTask(null);setShowForm(true);}} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:14,fontWeight:600,cursor:"pointer"}}>+ New Task</button>}
              <button onClick={()=>supabase.auth.signOut()} style={{border:"1px solid #ebebeb",borderRadius:8,background:"#fff",padding:"7px 9px",cursor:"pointer",fontSize:15}}>🚪</button>
            </div>
          </div>
          <div style={{height:3,background:"#ebebeb",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${counts.total?(counts.done/counts.total)*100:0}%`,background:"#6366f1",borderRadius:99,transition:"width .4s"}}/></div>
          {!mob&&<div style={{display:"flex",alignItems:"center",gap:2,marginTop:14,flexWrap:"wrap"}}>
            {VIEWS.map(([v,ic,l])=><button key={v} onClick={()=>setView(v)} style={{border:"none",background:"none",padding:"8px 14px",fontSize:13,fontWeight:view===v?600:400,color:view===v?"#6366f1":"#888",borderBottom:view===v?"2px solid #6366f1":"2px solid transparent",cursor:"pointer"}}>{ic} {l}</button>)}
            {view==="list"&&<><div style={{width:1,background:"#ebebeb",height:18,margin:"0 6px"}}/>
              {[["all","All"],["active","Active"],["done","Done"]].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} style={{border:"none",background:"none",padding:"8px 12px",fontSize:13,fontWeight:filter===v?600:400,color:filter===v?"#6366f1":"#888",borderBottom:filter===v?"2px solid #6366f1":"2px solid transparent",cursor:"pointer"}}>{l}</button>)}</>}
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>
              {[["all","All"],["work","💼"],["personal","🏠"]].map(([v,l])=><button key={v} onClick={()=>setCatFilter(v)} style={{border:"1px solid "+(catFilter===v?"#6366f1":"#ebebeb"),background:catFilter===v?"#eef2ff":"#fff",color:catFilter===v?"#6366f1":"#666",padding:"5px 9px",borderRadius:20,fontSize:12,fontWeight:catFilter===v?600:400,cursor:"pointer"}}>{l}</button>)}
            </div>
          </div>}
          {mob&&<div style={{height:12}}/>}
        </div>
      </div>

      <div style={{maxWidth:720,margin:"0 auto",padding:mob?"12px":"20px 24px"}}>
        {/* Sort (desktop list) */}
        {view==="list"&&!mob&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#aaa",fontWeight:500}}>Sort</span>
          {[["priority","🔴 Priority"],["added_desc","🕐 Newest"],["added_asc","🕐 Oldest"],["due_asc","📅 Due"],["alpha","🔤 A→Z"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSortBy(v)} style={{border:"1px solid "+(sortBy===v?"#6366f1":"#ebebeb"),background:sortBy===v?"#eef2ff":"#fff",color:sortBy===v?"#6366f1":"#777",borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:sortBy===v?600:400,cursor:"pointer"}}>{l}</button>
          ))}
        </div>}

        {/* Mobile filter chips */}
        {mob&&view==="list"&&<div style={{display:"flex",gap:4,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
          {[["all","All"],["active","Active"],["done","Done"]].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} style={{border:"1px solid "+(filter===v?"#6366f1":"#ebebeb"),background:filter===v?"#eef2ff":"#fff",color:filter===v?"#6366f1":"#666",borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:filter===v?600:400,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{l}</button>)}
          <div style={{width:1,background:"#ebebeb",margin:"0 2px",flexShrink:0}}/>
          {[["priority","Priority"],["due_asc","Due"],["added_desc","New"]].map(([v,l])=><button key={v} onClick={()=>setSortBy(v)} style={{border:"1px solid "+(sortBy===v?"#6366f1":"#ebebeb"),background:sortBy===v?"#eef2ff":"#fff",color:sortBy===v?"#6366f1":"#666",borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:sortBy===v?600:400,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{l}</button>)}
        </div>}

        {/* Digest */}
        {digest.show&&<div style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:12,padding:"12px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:13,color:"#4338ca",fontWeight:500}}>📬 Daily at</span>
          <input type="time" value={digest.time} onChange={e=>setDigest(d=>({...d,time:e.target.value}))} style={{border:"1px solid #c7d2fe",borderRadius:7,padding:"5px 9px",fontSize:13,color:"#4338ca",fontWeight:600,background:"#fff"}}/>
          <span style={{fontSize:12,color:"#818cf8",flex:1}}>Notif + email to all assignees.</span>
          <button style={{border:"1px solid #c7d2fe",background:"#fff",borderRadius:7,padding:"5px 10px",fontSize:12,color:"#6366f1",cursor:"pointer",fontWeight:500}}>Test →</button>
        </div>}

        {/* Category + Tag filters */}
        {(categories.length>0||allTags.length>0)&&(
          <div style={{background:"#fff",border:"1px solid #ebebeb",borderRadius:12,padding:"10px 14px",marginBottom:14}}>
            {/* Custom category filter */}
            {categories.length>0&&<div style={{marginBottom:allTags.length>0?10:0}}>
              <div style={{fontSize:11,fontWeight:600,color:"#aaa",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>📁 Category</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <button onClick={()=>setCustomCatFilter("all")} style={{border:"1px solid "+(customCatFilter==="all"?"#6366f1":"#ebebeb"),background:customCatFilter==="all"?"#eef2ff":"#fff",color:customCatFilter==="all"?"#6366f1":"#666",borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:customCatFilter==="all"?600:400,cursor:"pointer"}}>All</button>
                <button onClick={()=>setCustomCatFilter("none")} style={{border:"1px solid "+(customCatFilter==="none"?"#6366f1":"#ebebeb"),background:customCatFilter==="none"?"#eef2ff":"#fff",color:customCatFilter==="none"?"#6366f1":"#666",borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:customCatFilter==="none"?600:400,cursor:"pointer"}}>— None</button>
                {categories.map(c=>{const active=customCatFilter===String(c.id);return(
                  <button key={c.id} onClick={()=>setCustomCatFilter(active?"all":String(c.id))} style={{border:`1px solid ${active?c.color:"#ebebeb"}`,background:active?c.color+"22":"#fff",color:active?c.color:"#666",borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:active?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontFamily:"monospace",fontSize:11}}>{c.code}</span>
                    <span>{c.name}</span>
                  </button>
                );})}
              </div>
            </div>}
            {/* Tag filter */}
            {allTags.length>0&&<div>
              <div style={{fontSize:11,fontWeight:600,color:"#aaa",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>🏷️ Tags</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {allTags.map(tag=>{const c=tagColor(tag),active=tagFilter===tag;return(
                  <button key={tag} onClick={()=>setTagFilter(active?null:tag)} style={{border:`1px solid ${active?c:"#e5e5e5"}`,background:active?c+"22":"#fff",color:active?c:"#777",borderRadius:99,padding:"4px 10px",fontSize:12,fontWeight:active?600:400,cursor:"pointer"}}>#{tag}</button>
                );})}
                {tagFilter&&<button onClick={()=>setTagFilter(null)} style={{border:"1px solid #ebebeb",background:"none",color:"#aaa",borderRadius:99,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>× clear</button>}
              </div>
            </div>}
          </div>
        )}

        {/* LIST */}
        {view==="list"&&(loading
          ?<div style={{textAlign:"center",padding:"60px 0",color:"#aaa"}}>Loading…</div>
          :visible.length===0
            ?<div style={{textAlign:"center",padding:"60px 0",color:"#aaa"}}><div style={{fontSize:36,marginBottom:8}}>✅</div><p style={{margin:0}}>No tasks here</p></div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
               {visible.map(t=><TaskCard key={t.id} t={t} tasks={tasks} categories={categories} onToggle={()=>toggleDone(t.id,t.done)} onDelete={()=>deleteTask(t.id)} onEdit={()=>setEditTask(t)} onTagClick={tag=>setTagFilter(tagFilter===tag?null:tag)} activeTag={tagFilter}/>)}
             </div>
        )}

        {/* CALENDAR */}
        {view==="calendar"&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <button onClick={()=>setCalDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={S.nav}>‹</button>
            <span style={{fontSize:15,fontWeight:700}}>{MONTHS[mo]} {yr}</span>
            <button onClick={()=>setCalDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={S.nav}>›</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:"#bbb",padding:"4px 0"}}>{mob?d[0]:d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:mob?3:4}}>
            {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
            {Array.from({length:daysInMo}).map((_,i)=>{
              const day=i+1,dt=dayTasks(day),isT=sameDay(new Date(yr,mo,day),new Date()),isSel=selDay===day;
              return(<div key={day} onClick={()=>setSelDay(isSel?null:day)} style={{minHeight:mob?46:58,borderRadius:10,border:"1px solid "+(isSel?"#6366f1":isT?"#c7d2fe":"#ebebeb"),background:isSel?"#eef2ff":isT?"#f5f3ff":"#fff",cursor:"pointer",padding:mob?"4px":"6px 8px"}}>
                <div style={{fontSize:mob?11:13,fontWeight:isT?700:500,color:isT?"#6366f1":"#333",marginBottom:2,textAlign:mob?"center":"left"}}>{day}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:2,justifyContent:mob?"center":"flex-start"}}>
                  {dt.slice(0,3).map(t=><div key={t.id} style={{width:7,height:7,borderRadius:"50%",background:PRIORITIES[t.priority]?.color}}/>)}
                  {dt.length>3&&<span style={{fontSize:8,color:"#aaa"}}>+{dt.length-3}</span>}
                </div>
              </div>);
            })}
          </div>
          {selDay&&<div style={{marginTop:14,background:"#fff",border:"1px solid #ebebeb",borderRadius:12,padding:14}}>
            <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:600}}>{MONTHS[mo]} {selDay} <span style={{fontWeight:400,color:"#aaa",fontSize:12}}>({dayTasks(selDay).length} task(s))</span></h3>
            {dayTasks(selDay).length===0?<p style={{color:"#aaa",fontSize:13,margin:0}}>No tasks.</p>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {dayTasks(selDay).map(t=><TaskCard key={t.id} t={t} tasks={tasks} categories={categories} onToggle={()=>toggleDone(t.id,t.done)} onDelete={()=>deleteTask(t.id)} onEdit={()=>setEditTask(t)} onTagClick={setTagFilter} activeTag={tagFilter}/>)}
            </div>}
          </div>}
        </div>}

        {/* GANTT */}
        {view==="gantt"&&<GanttView tasks={tasks} categories={categories} onEdit={t=>setEditTask(t)}/>}

        {counts.done>0&&view==="list"&&filter!=="done"&&(
          <button onClick={async()=>{const ids=tasks.filter(t=>t.done).map(t=>t.id);setTasks(p=>p.filter(t=>!t.done));await supabase.from("tasks").delete().in("id",ids);}}
            style={{marginTop:14,border:"none",background:"none",color:"#ccc",fontSize:12,cursor:"pointer",display:"block",width:"100%",textAlign:"center",padding:8}}>
            Remove {counts.done} completed task{counts.done>1?"s":""}
          </button>
        )}
      </div>

      {/* Mobile bottom nav */}
      {mob&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #ebebeb",display:"flex",zIndex:100}}>
        {VIEWS.map(([v,ic,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"10px 0 12px",border:"none",background:view===v?"#eef2ff":"transparent",color:view===v?"#6366f1":"#888",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:20}}>{ic}</span>
            <span style={{fontSize:10,fontWeight:view===v?600:400}}>{l}</span>
          </button>
        ))}
        <button onClick={()=>{setEditTask(null);setShowForm(true);}} style={{flex:1,padding:"10px 0 12px",border:"none",background:"transparent",color:"#6366f1",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:22,fontWeight:700}}>＋</span>
          <span style={{fontSize:10,fontWeight:600}}>New</span>
        </button>
      </div>}
    </div>
  );
}