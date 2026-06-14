import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY;

// ── Design tokens ─────────────────────────────────────────────
const C = {
  sidebar: "#18181b", sidebarHover: "rgba(255,255,255,.08)", sidebarActive: "rgba(255,255,255,.14)",
  primary: "#6366f1", primaryDark: "#4f46e5", primaryLight: "#eef2ff",
  success: "#10b981", warning: "#f59e0b", danger: "#ef4444", purple: "#8b5cf6",
  bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0",
  text: "#0f172a", muted: "#64748b", hint: "#94a3b8",
};

// ── Constants ─────────────────────────────────────────────────
const PRIORITIES = {
  high:   {label:"High",   color:"#ef4444", bg:"#fef2f2", light:"#fee2e2"},
  medium: {label:"Medium", color:"#f59e0b", bg:"#fffbeb", light:"#fef3c7"},
  low:    {label:"Low",    color:"#6366f1", bg:"#eef2ff", light:"#e0e7ff"},
};
const TAG_PAL = ["#6366f1","#ec4899","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];
const tagColor  = t => { let h=0; for(let c of t) h=(h*31+c.charCodeAt(0))%TAG_PAL.length; return TAG_PAL[h]; };
const fmtDt    = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "";
const fmtDay   = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}) : "";
const isOD     = (dt,done) => !done&&dt&&new Date(dt)<new Date();
const sameDay  = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const MONTHS   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS     = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const PO       = {high:0,medium:1,low:2};
const CAT_COLORS = ["#6366f1","#ec4899","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#06b6d4","#84cc16","#f97316"];

const fromDB = (r,assignees=[]) => ({
  id:r.id, title:r.title, desc:r.description||"", descHtml:r.description_html||"",
  cat:r.category||"work", priority:r.priority||"medium",
  due:r.due_date||"", startDate:r.start_date||"",
  done:r.done||false, tags:r.tags||[], parentId:r.parent_id||null,
  createdAt:r.created_at, assignees, deps:[],
  customCategoryId:r.custom_category_id||null, taskCode:r.task_code||null,
});

// ── Hooks ─────────────────────────────────────────────────────
function useIsMobile() {
  const [m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{ const h=()=>setM(window.innerWidth<768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);
  return m;
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({label,value,icon,color,sub,onClick}) {
  return (
    <div onClick={onClick} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",cursor:onClick?"pointer":"default",transition:"all .15s"}}
      onMouseEnter={e=>{if(onClick)e.currentTarget.style.borderColor=color;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{width:38,height:38,borderRadius:10,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{icon}</div>
        <span style={{fontSize:28,fontWeight:700,color}}>{value}</span>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:C.text}}>{label}</div>
      <div style={{fontSize:11,color:C.hint,marginTop:2}}>{sub}</div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
function Dashboard({tasks,categories,onEdit,onNewTask}) {
  const now=new Date(), weekEnd=new Date(now.getTime()+7*86400000);
  const active=tasks.filter(t=>!t.done);
  const stats={
    total:tasks.length, done:tasks.filter(t=>t.done).length,
    urgent:active.filter(t=>t.priority==="high").length,
    overdue:active.filter(t=>t.due&&new Date(t.due)<now).length,
    blocked:active.filter(t=>(t.deps||[]).some(d=>!d.done)).length,
  };
  const rate=stats.total?Math.round(stats.done/stats.total*100):0;
  const upcoming=active.filter(t=>t.due&&new Date(t.due)>=now&&new Date(t.due)<=weekEnd).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,6);
  const catStats=categories.map(c=>{
    const ct=tasks.filter(t=>t.customCategoryId==c.id);
    const d=ct.filter(t=>t.done).length;
    return{...c,total:ct.length,done:d,rate:ct.length?Math.round(d/ct.length*100):0};
  }).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
  const byPri={high:active.filter(t=>t.priority==="high").length,medium:active.filter(t=>t.priority==="medium").length,low:active.filter(t=>t.priority==="low").length};

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:700,color:C.text}}>Dashboard</h1>
          <p style={{margin:"3px 0 0",fontSize:13,color:C.muted}}>{now.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
        </div>
        <button onClick={onNewTask} style={{background:C.primary,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:14,fontWeight:600,cursor:"pointer"}}>+ New Task</button>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:20}}>
        <StatCard label="Total" value={stats.total} icon="📋" color={C.primary} sub={`${rate}% complete`}/>
        <StatCard label="Done" value={stats.done} icon="✅" color={C.success} sub={`${stats.total-stats.done} remaining`}/>
        <StatCard label="Urgent" value={stats.urgent} icon="🔴" color={C.danger} sub="High priority"/>
        <StatCard label="Overdue" value={stats.overdue} icon="⚠️" color={C.warning} sub="Past due date"/>
        <StatCard label="Blocked" value={stats.blocked} icon="🔒" color={C.purple} sub="Waiting on deps"/>
      </div>

      {/* Overall progress bar */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Overall completion</span>
          <span style={{fontSize:13,fontWeight:700,color:C.primary}}>{rate}%</span>
        </div>
        <div style={{height:10,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",width:rate+"%",background:`linear-gradient(90deg,${C.primary},${C.purple})`,borderRadius:99,transition:"width .6s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
          <span style={{fontSize:11,color:C.hint}}>{stats.done} done</span>
          <span style={{fontSize:11,color:C.hint}}>{stats.total-stats.done} remaining</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {/* Category progress */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px"}}>
          <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:600,color:C.text}}>Progress by category</h3>
          {catStats.length===0&&<p style={{color:C.hint,fontSize:13,margin:0}}>No categories yet — create one with 📁</p>}
          {catStats.map(c=>(
            <div key={c.id} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:c.color,background:c.color+"18",borderRadius:4,padding:"1px 6px"}}>{c.code}</span>
                  <span style={{fontSize:12,color:C.text}}>{c.name}</span>
                </div>
                <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{c.done}/{c.total}</span>
              </div>
              <div style={{height:6,background:"#f1f5f9",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",width:c.rate+"%",background:c.color,borderRadius:99,transition:"width .5s"}}/>
              </div>
            </div>
          ))}
        </div>

        {/* Upcoming */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px"}}>
          <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:600,color:C.text}}>Upcoming this week</h3>
          {upcoming.length===0&&<p style={{color:C.hint,fontSize:13,margin:0}}>No tasks due this week 🎉</p>}
          {upcoming.map(t=>{
            const p=PRIORITIES[t.priority]||PRIORITIES.medium;
            const days=Math.ceil((new Date(t.due)-now)/86400000);
            return(
              <div key={t.id} onClick={()=>onEdit(t)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.bg}`,cursor:"pointer"}}>
                <div style={{width:3,height:34,borderRadius:2,background:p.color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.taskCode?`[${t.taskCode}] `:""}{t.title}</div>
                  <div style={{fontSize:11,color:C.hint}}>{fmtDt(t.due)}</div>
                </div>
                <span style={{fontSize:11,fontWeight:700,color:days===0?C.danger:days<=2?C.warning:C.hint,whiteSpace:"nowrap",flexShrink:0}}>{days===0?"Today":days===1?"Tomor.":days+"d"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Priority breakdown */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 20px"}}>
        <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:600,color:C.text}}>Active tasks by priority</h3>
        <div style={{display:"flex",gap:12}}>
          {[["high","🔴",C.danger],["medium","🟡",C.warning],["low","🔵",C.primary]].map(([k,ic,col])=>(
            <div key={k} style={{flex:1,background:col+"0a",border:`1px solid ${col}22`,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>{ic}</div>
              <div style={{fontSize:26,fontWeight:700,color:col}}>{byPri[k]}</div>
              <div style={{fontSize:11,color:C.muted,textTransform:"capitalize",marginTop:2}}>{k}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────
function ShareModal({tasks,categories,onClose}) {
  const [copied,setCopied]=useState(false);
  const now=new Date();
  const todo=tasks.filter(t=>!t.done);
  const allCats=[{id:"none",name:"General",code:"GEN"},...categories];

  const formatText=()=>{
    const lines=[
      `📋 *Task Update — ${now.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}*`,
      `📊 *${tasks.filter(t=>t.done).length}/${tasks.length} completed*`,
      "",
    ];
    allCats.forEach(cat=>{
      const ct=todo.filter(t=>String(t.customCategoryId||"none")===String(cat.id));
      if(!ct.length) return;
      lines.push(`*[${cat.code}] ${cat.name}*`);
      ct.forEach(t=>{
        const p=t.priority==="high"?"🔴":t.priority==="medium"?"🟡":"🔵";
        const due=t.due?` _(${fmtDay(t.due)})_`:"";
        lines.push(`  ${p} ${t.taskCode?`[${t.taskCode}] `:""}${t.title}${due}`);
      });
      lines.push("");
    });
    return lines.join("\n");
  };

  const text=formatText();

  const shareWhatsApp=()=>window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank");

  const copyText=async()=>{ await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  const exportCSV=()=>{
    const headers=["Code","Title","Priority","Category","Type","Status","Start","Due","Tags","Assignees"];
    const rows=tasks.map(t=>{
      const cat=categories.find(c=>c.id==t.customCategoryId);
      return [
        t.taskCode||"", `"${t.title.replace(/"/g,'""')}"`,
        t.priority, cat?cat.name:"General", t.cat,
        t.done?"Done":"Active",
        t.startDate?new Date(t.startDate).toLocaleDateString("en-GB"):"",
        t.due?new Date(t.due).toLocaleDateString("en-GB"):"",
        `"${(t.tags||[]).join("; ")}"`,
        `"${(t.assignees||[]).map(a=>a.email).join("; ")}"`,
      ].join(",");
    });
    const csv=[headers.join(","),...rows].join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`tasks-${now.toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.card,borderRadius:16,padding:28,width:"100%",maxWidth:520,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:700,color:C.text}}>Share & Export</h2>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:C.hint}}>×</button>
        </div>
        <p style={{margin:"0 0 16px",fontSize:13,color:C.muted}}>{todo.length} active tasks · {tasks.filter(t=>t.done).length}/{tasks.length} completed</p>

        {/* Preview */}
        <div style={{background:"#f8fafc",border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:18,maxHeight:160,overflowY:"auto"}}>
          <pre style={{margin:0,fontSize:11,color:C.muted,whiteSpace:"pre-wrap",fontFamily:"monospace",lineHeight:1.6}}>{text}</pre>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button onClick={shareWhatsApp} style={{background:"#25d366",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            💬 WhatsApp
          </button>
          <button onClick={copyText} style={{background:copied?"#10b981":C.primary,color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"background .2s"}}>
            {copied?"✓ Copied!":"📋 Copy text"}
          </button>
          <button onClick={exportCSV} style={{background:"#fff",color:"#10b981",border:"2px solid #10b981",borderRadius:10,padding:"12px 16px",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            📊 Export CSV
          </button>
          <button onClick={()=>window.print()} style={{background:"#fff",color:C.muted,border:`2px solid ${C.border}`,borderRadius:10,padding:"12px 16px",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            🖨️ Print / PDF
          </button>
        </div>
        <p style={{margin:"14px 0 0",fontSize:11,color:C.hint,textAlign:"center"}}>WhatsApp opens WhatsApp Web with your tasks pre-filled</p>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({view,setView,categories,session,counts,customCatFilter,setCustomCatFilter,onNewTask,onShare,onCatModal}) {
  const NAV=[["dashboard","📊","Dashboard"],["list","📋","Tasks"],["calendar","📅","Calendar"],["gantt","🗂️","Gantt"]];
  return (
    <div style={{width:220,flexShrink:0,background:C.sidebar,minHeight:"100vh",position:"sticky",top:0,display:"flex",flexDirection:"column",overflowY:"auto"}}>
      {/* Logo */}
      <div style={{padding:"22px 20px 16px"}}>
        <div style={{fontSize:26,marginBottom:4}}>📋</div>
        <div style={{fontSize:16,fontWeight:700,color:"#fff",letterSpacing:"-0.3px"}}>My Tasks</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session?.user?.email}</div>
      </div>

      {/* New task */}
      <div style={{padding:"0 14px 16px"}}>
        <button onClick={onNewTask} style={{width:"100%",background:C.primary,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Task</button>
      </div>

      {/* Nav */}
      <div style={{padding:"0 8px",flex:1}}>
        {NAV.map(([v,ic,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",border:"none",borderRadius:8,background:view===v?C.sidebarActive:"transparent",color:view===v?"#fff":"rgba(255,255,255,.55)",cursor:"pointer",fontSize:13,fontWeight:view===v?600:400,marginBottom:2,textAlign:"left",transition:"all .15s",position:"relative"}}
            onMouseEnter={e=>{if(view!==v)e.currentTarget.style.background=C.sidebarHover;}}
            onMouseLeave={e=>{if(view!==v)e.currentTarget.style.background="transparent";}}>
            <span style={{fontSize:17}}>{ic}</span>
            <span style={{flex:1}}>{l}</span>
            {v==="list"&&counts.urgent>0&&<span style={{background:C.danger,color:"#fff",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:700}}>{counts.urgent}</span>}
          </button>
        ))}

        {/* Categories */}
        {categories.length>0&&(
          <div style={{marginTop:20}}>
            <div style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:1,padding:"0 12px",marginBottom:8}}>Categories</div>
            <button onClick={()=>setCustomCatFilter("all")} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 12px",border:"none",borderRadius:8,background:customCatFilter==="all"?"rgba(255,255,255,.1)":"transparent",color:"rgba(255,255,255,.55)",cursor:"pointer",fontSize:12,textAlign:"left",marginBottom:2}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}
              onMouseLeave={e=>e.currentTarget.style.background=customCatFilter==="all"?"rgba(255,255,255,.1)":"transparent"}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"rgba(255,255,255,.3)"}}/>All categories
            </button>
            {categories.map(c=>(
              <button key={c.id} onClick={()=>{setCustomCatFilter(String(c.id));setView("list");}}
                style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 12px",border:"none",borderRadius:8,background:customCatFilter===String(c.id)?"rgba(255,255,255,.1)":"transparent",color:"rgba(255,255,255,.55)",cursor:"pointer",fontSize:12,textAlign:"left",marginBottom:2}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}
                onMouseLeave={e=>e.currentTarget.style.background=customCatFilter===String(c.id)?"rgba(255,255,255,.1)":"transparent"}>
                <div style={{width:7,height:7,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                <span style={{fontFamily:"monospace",fontSize:10,color:c.color,fontWeight:700}}>{c.code}</span>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom */}
      <div style={{padding:"12px 8px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
        {[["🚀","Share & Export",onShare],["📁","Categories",onCatModal],["🚪","Sign out",()=>supabase.auth.signOut()]].map(([ic,l,fn])=>(
          <button key={l} onClick={fn} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 12px",border:"none",borderRadius:8,background:"transparent",color:"rgba(255,255,255,.45)",cursor:"pointer",fontSize:12,textAlign:"left",marginBottom:2}}
            onMouseEnter={e=>e.currentTarget.style.background=C.sidebarHover}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:16}}>{ic}</span>{l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Rich Editor ───────────────────────────────────────────────
function RichEditor({content,onChange}) {
  const ed=useEditor({extensions:[StarterKit],content,onUpdate:({editor})=>onChange(editor.getHTML())});
  if(!ed) return null;
  const tb=(fn,l,a)=><button type="button" onClick={fn} style={{border:`1px solid ${a?"#6366f1":"#e5e5e5"}`,borderRadius:6,background:a?"#eef2ff":"#fff",color:a?"#6366f1":"#555",padding:"4px 8px",fontSize:12,cursor:"pointer",fontWeight:600}}>{l}</button>;
  return (
    <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",marginBottom:10}}>
      <div style={{display:"flex",gap:4,padding:"6px 8px",borderBottom:`1px solid #f0f0f0`,flexWrap:"wrap",background:"#fafafa"}}>
        {tb(()=>ed.chain().focus().toggleBold().run(),"B",ed.isActive("bold"))}
        {tb(()=>ed.chain().focus().toggleItalic().run(),"I",ed.isActive("italic"))}
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
  const S={inp:{width:"100%",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,marginBottom:8,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:440,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <h2 style={{margin:0,fontSize:17,fontWeight:700,color:C.text}}>📁 Manage Categories</h2>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:C.hint}}>×</button>
        </div>
        <div style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:"#4338ca"}}>
          Format: <strong style={{fontFamily:"monospace"}}>CODE-001</strong> &nbsp;·&nbsp; e.g. DEV-001 · MKT-042
        </div>
        {categories.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:C.bg,borderRadius:8,marginBottom:6}}>
            <div style={{width:5,height:28,borderRadius:3,background:c.color,flexShrink:0}}/>
            <span style={{fontSize:12,fontWeight:700,color:c.color,minWidth:52,fontFamily:"monospace"}}>{c.code}</span>
            <span style={{fontSize:13,flex:1,color:C.text}}>{c.name}</span>
            <button onClick={()=>onDelete(c.id)} style={{border:"none",background:"none",color:C.hint,cursor:"pointer",fontSize:16}}>×</button>
          </div>
        ))}
        {!categories.length&&<p style={{fontSize:13,color:C.hint,textAlign:"center",padding:"12px 0"}}>No categories yet</p>}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14,marginTop:10}}>
          <p style={{fontSize:12,fontWeight:600,color:C.muted,margin:"0 0 10px"}}>Add category</p>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name (e.g. Development)" style={{...S.inp,flex:1,marginBottom:0}}/>
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,5))} placeholder="CODE" style={{...S.inp,width:80,fontFamily:"monospace",fontWeight:700,textAlign:"center",marginBottom:0}}/>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
            {CAT_COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:22,height:22,borderRadius:"50%",background:c,border:color===c?"3px solid #111":"2px solid transparent",cursor:"pointer"}}/>)}
          </div>
          <button onClick={async()=>{ if(!name.trim()||!code.trim())return; await onSave({name:name.trim(),code,color}); setName("");setCode(""); }}
            style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:14,fontWeight:600,cursor:"pointer"}}>+ Add</button>
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
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4f46e5 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",padding:16}}>
      <div style={{background:"rgba(255,255,255,.97)",backdropFilter:"blur(20px)",borderRadius:20,padding:36,width:"100%",maxWidth:380,boxShadow:"0 24px 64px rgba(0,0,0,.25)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,background:`linear-gradient(135deg,${C.primary},${C.purple})`,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 12px"}}>📋</div>
          <h1 style={{margin:0,fontSize:24,fontWeight:700,color:C.text}}>My Tasks</h1>
          <p style={{margin:"6px 0 0",fontSize:14,color:C.muted}}>Sign in to continue</p>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,fontWeight:600,color:C.muted,display:"block",marginBottom:5}}>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&login()}
            style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:9,padding:"11px 14px",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}} autoFocus/>
        </div>
        <div style={{marginBottom:err?8:16}}>
          <label style={{fontSize:12,fontWeight:600,color:C.muted,display:"block",marginBottom:5}}>Password</label>
          <input value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()}
            style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:9,padding:"11px 14px",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
        </div>
        {err&&<p style={{color:C.danger,fontSize:13,margin:"0 0 12px"}}>{err}</p>}
        <button onClick={login} disabled={loading} style={{width:"100%",background:`linear-gradient(135deg,${C.primary},${C.purple})`,color:"#fff",border:"none",borderRadius:10,padding:13,fontSize:15,fontWeight:600,cursor:"pointer",opacity:loading?.7:1}}>
          {loading?"Signing in…":"Sign in →"}
        </button>
      </div>
    </div>
  );
}

// ── Task Form ─────────────────────────────────────────────────
function TaskForm({task,tasks,profiles,categories,onSave,onClose}) {
  const mob=useIsMobile(), isEdit=!!task;
  const S={
    inp:{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,marginBottom:10,boxSizing:"border-box",outline:"none",fontFamily:"inherit",color:C.text},
    lbl:{fontSize:11,fontWeight:600,color:C.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
    sel:{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"9px 10px",fontSize:14,fontFamily:"inherit",background:"#fff",boxSizing:"border-box",color:C.text},
  };
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
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",padding:mob?0:20}}>
      <div style={{background:C.card,borderRadius:mob?"18px 18px 0 0":16,padding:mob?"20px 16px 32px":28,width:"100%",maxWidth:mob?"100%":660,maxHeight:mob?"92vh":"88vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,.15)"}}>
        {mob&&<div style={{width:36,height:4,background:C.border,borderRadius:99,margin:"0 auto 16px"}}/>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{margin:0,fontSize:17,fontWeight:700,color:C.text}}>{isEdit?"Edit Task":"New Task"}</h2>
          <button onClick={onClose} style={{border:"none",background:C.bg,borderRadius:8,width:30,height:30,fontSize:18,cursor:"pointer",color:C.hint,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <label style={S.lbl}>Title *</label>
        <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Task title" style={{...S.inp,fontSize:16,fontWeight:500}}/>
        <label style={S.lbl}>Description</label>
        <RichEditor content={form.descHtml} onChange={html=>setForm(f=>({...f,descHtml:html}))}/>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <div style={{flex:2,minWidth:120}}>
            <label style={S.lbl}>Category</label>
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
            <button key={p.id} type="button" onClick={()=>toggle("assignees",p.id)} style={{border:`1.5px solid ${a?C.primary:C.border}`,background:a?C.primaryLight:"#fff",color:a?C.primary:C.muted,borderRadius:99,padding:"5px 12px",fontSize:12,fontWeight:a?600:400,cursor:"pointer"}}>{a?"✓ ":""}{p.full_name||p.email}</button>
          );})}
          {!profiles.length&&<span style={{fontSize:12,color:C.hint}}>No users</span>}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1}}>
            <label style={S.lbl}>Parent task</label>
            <select value={form.parentId} onChange={e=>setForm(f=>({...f,parentId:e.target.value}))} style={S.sel}>
              <option value="">— None —</option>
              {avail.map(t=><option key={t.id} value={t.id}>{t.taskCode?`[${t.taskCode}] `:""}{t.title.slice(0,35)}</option>)}
            </select>
          </div>
        </div>
        <label style={S.lbl}>Blocked by (dependencies)</label>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
          {avail.map(t=>{const a=form.deps.includes(t.id);return(
            <button key={t.id} type="button" onClick={()=>toggle("deps",t.id)} style={{border:`1.5px solid ${a?"#ef4444":C.border}`,background:a?"#fef2f2":"#fff",color:a?C.danger:C.muted,borderRadius:99,padding:"4px 10px",fontSize:11,fontWeight:a?600:400,cursor:"pointer"}}>
              {a?"🔒 ":""}{t.taskCode?`[${t.taskCode}] `:""}{t.title.slice(0,24)}
            </button>
          );})}
          {!avail.length&&<span style={{fontSize:12,color:C.hint}}>No other tasks</span>}
        </div>
        <label style={S.lbl}>Tags</label>
        {form.tags.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{form.tags.map(tag=>{const c=tagColor(tag);return(<span key={tag} style={{display:"inline-flex",alignItems:"center",gap:4,background:c+"18",color:c,border:`1px solid ${c}33`,borderRadius:99,padding:"3px 10px",fontSize:12,fontWeight:600}}>#{tag}<span onClick={()=>setForm(f=>({...f,tags:f.tags.filter(t=>t!==tag)}))} style={{cursor:"pointer",opacity:.5,fontSize:14}}>×</span></span>);})}</div>}
        <div style={{display:"flex",gap:6,marginBottom:18}}>
          <input value={form.tagInput} onChange={e=>setForm(f=>({...f,tagInput:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addTag();}}} placeholder="Add tag, press Enter…" style={{...S.inp,margin:0,flex:1}}/>
          <button type="button" onClick={addTag} style={{border:`1.5px solid ${C.border}`,background:"#fafafa",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16,color:C.muted}}>+</button>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{border:`1.5px solid ${C.border}`,background:"#fff",borderRadius:9,padding:"10px 18px",fontSize:14,cursor:"pointer",color:C.muted,fontWeight:500}}>Cancel</button>
          <button onClick={async()=>{if(!form.title.trim())return;setSaving(true);await onSave(form,task?.id);setSaving(false);}} disabled={saving}
            style={{background:`linear-gradient(135deg,${C.primary},${C.purple})`,color:"#fff",border:"none",borderRadius:9,padding:"10px 22px",fontSize:14,fontWeight:600,cursor:"pointer",opacity:saving?.7:1}}>
            {saving?"Saving…":isEdit?"Save changes":"Add Task"}
          </button>
        </div>
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
    <div style={{background:C.card,border:`1px solid ${late?"#fecaca":blocked?"#fde68a":C.border}`,borderRadius:12,padding:mob?"12px":"14px 16px",display:"flex",alignItems:"flex-start",gap:12,opacity:t.done?.55:1,transition:"all .2s",borderLeft:`4px solid ${t.done?"#e2e8f0":p.color}`}}
      onMouseEnter={e=>{ if(!t.done) e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,.08)"; }}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
      <button onClick={()=>!blocked&&onToggle()} style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${t.done?"#6366f1":blocked?"#fbbf24":"#cbd5e1"}`,background:t.done?"#6366f1":"transparent",cursor:blocked?"not-allowed":"pointer",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
        {t.done?<svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5l2.5 2.5L8 1" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>:blocked&&<span style={{fontSize:9}}>🔒</span>}
      </button>
      <div style={{flex:1,minWidth:0}}>
        {parent&&<div style={{fontSize:10,color:C.hint,marginBottom:2}}>↑ {parent.taskCode?`[${parent.taskCode}] `:""}{parent.title}</div>}
        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:5}}>
          {t.taskCode&&cat&&<span style={{fontSize:10,fontWeight:700,color:cat.color,fontFamily:"monospace",background:cat.color+"18",borderRadius:5,padding:"1px 6px",flexShrink:0}}>{t.taskCode}</span>}
          <span style={{fontSize:mob?13:14,fontWeight:600,color:t.done?"#94a3b8":C.text,textDecoration:t.done?"line-through":"none"}}>{t.title}</span>
          <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:p.bg,color:p.color,fontWeight:600,flexShrink:0}}>{p.label}</span>
          {!mob&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:C.bg,color:C.muted,flexShrink:0}}>{t.cat==="work"?"💼 Work":"🏠 Personal"}</span>}
          {children.length>0&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:99,background:"#f0fdf4",color:"#10b981",flexShrink:0}}>↓{children.length}</span>}
        </div>
        {t.descHtml&&t.descHtml!=="<p></p>"&&!mob&&<div dangerouslySetInnerHTML={{__html:t.descHtml}} style={{fontSize:13,color:C.muted,marginBottom:6,lineHeight:1.6}}/>}
        {blocked&&<div style={{fontSize:11,color:"#92400e",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"3px 8px",marginBottom:5}}>🔒 Blocked by: {(t.deps||[]).filter(d=>!d.done).map(d=>d.title).join(", ")}</div>}
        {(t.assignees||[]).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>{(t.assignees||[]).map(a=>(
          <span key={a.id} style={{fontSize:10,background:C.bg,color:C.muted,borderRadius:99,padding:"2px 8px",border:`1px solid ${C.border}`}}>👤 {(a.full_name||a.email).split("@")[0]}</span>
        ))}</div>}
        {(t.tags||[]).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:t.due?5:0}}>{(t.tags||[]).map(tag=>{const c=tagColor(tag),active=activeTag===tag;return(<span key={tag} onClick={()=>onTagClick(tag)} style={{display:"inline-block",background:active?c:c+"15",color:c,border:`1px solid ${c}33`,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"pointer",userSelect:"none"}}>#{tag}</span>);})}</div>}
        {t.due&&<div style={{fontSize:11,color:late?"#ef4444":"#94a3b8",display:"flex",alignItems:"center",gap:4,marginTop:2}}>{late?"⚠️ Overdue — ":"🕐 "}{fmtDt(t.due)}</div>}
      </div>
      <div style={{display:"flex",gap:3,flexShrink:0}}>
        <button onClick={onEdit} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:12,color:C.muted}} title="Edit">✏️</button>
        <button onClick={onDelete} style={{border:"none",background:"none",cursor:"pointer",color:"#cbd5e1",fontSize:18,padding:"0 3px",lineHeight:1}} title="Delete">×</button>
      </div>
    </div>
  );
}

// ── Gantt ─────────────────────────────────────────────────────
function GanttView({tasks,categories,onEdit}) {
  const mob=useIsMobile();
  const ref=useRef(null);
  const LABEL_W=mob?120:185, ROW_H=40;
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
    const sx=Math.max(0,diff(vs,s))*dayW, ex=e?Math.min(zoom,diff(vs,e))*dayW:sx+dayW*2;
    return {left:sx,width:Math.max(12,ex-sx)};
  };
  const step=zoom<=14?1:zoom<=30?3:zoom<=60?7:14;
  const ticks=[]; for(let i=0;i<=zoom;i+=step){const d=new Date(vs.getTime()+i*86400000);ticks.push({x:i*dayW,label:fmtDay(d)});}
  const grouped=[];
  [{id:"none",name:"General",code:"GEN",color:C.hint},...categories].forEach(cat=>{
    const items=tasks.filter(t=>String(t.customCategoryId||"none")===String(cat.id));
    if(!items.length) return;
    const linked=items.filter(t=>(t.deps&&t.deps.length>0)||t.parentId);
    const standalone=items.filter(t=>(!t.deps||!t.deps.length)&&!t.parentId);
    grouped.push({cat,linked,standalone});
  });
  const navigate=dir=>setVs(d=>new Date(d.getTime()+dir*Math.floor(zoom/2)*86400000));
  const renderRow=(task,cat)=>{
    const bar=getBar(task); const blocked=(task.deps||[]).some(d=>!d.done);
    const p=PRIORITIES[task.priority]||PRIORITIES.medium;
    const bc=task.done?"#d1d5db":blocked?"#fde68a":p.color;
    return (
      <div key={task.id} style={{display:"flex",height:ROW_H,alignItems:"center",borderBottom:`1px solid ${C.bg}`}}
        onMouseEnter={e=>e.currentTarget.style.background="#fafafa"}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <div style={{width:LABEL_W,flexShrink:0,padding:"0 10px",borderRight:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}>
          {task.taskCode&&<span style={{fontSize:9,fontWeight:700,color:cat.color,fontFamily:"monospace",background:cat.color+"18",borderRadius:4,padding:"1px 5px",whiteSpace:"nowrap",flexShrink:0}}>{task.taskCode}</span>}
          <span style={{fontSize:11,color:task.done?"#94a3b8":C.text,textDecoration:task.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={task.title}>{task.title}</span>
        </div>
        <div style={{flex:1,position:"relative",height:"100%",minWidth:0}}>
          {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:1,background:C.primary,opacity:.2,pointerEvents:"none"}}/>}
          {bar&&<div onClick={()=>onEdit(task)} style={{position:"absolute",left:bar.left,width:bar.width,top:7,height:26,borderRadius:6,background:bc,opacity:task.done?.7:1,cursor:"pointer",display:"flex",alignItems:"center",paddingLeft:7,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.1)"}}>
            <span style={{fontSize:10,color:task.done?"#555":"#fff",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {blocked?"🔒":(task.deps&&task.deps.length>0)||task.parentId?"🔗":""} {task.title}
            </span>
          </div>}
        </div>
      </div>
    );
  };
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {[[14,"2W"],[30,"1M"],[60,"2M"],[90,"3M"]].map(([d,l])=>(
          <button key={d} onClick={()=>setZoom(d)} style={{border:`1px solid ${zoom===d?C.primary:C.border}`,background:zoom===d?C.primaryLight:"#fff",color:zoom===d?C.primary:C.muted,borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:zoom===d?600:400}}>{l}</button>
        ))}
        <button onClick={()=>navigate(-1)} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",color:C.muted}}>← Prev</button>
        <button onClick={()=>{const d=new Date();d.setDate(d.getDate()-7);d.setHours(0,0,0,0);setVs(d);}} style={{border:`1px solid ${C.primary}`,background:C.primaryLight,color:C.primary,borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>Today</button>
        <button onClick={()=>navigate(1)} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",color:C.muted}}>Next →</button>
        <span style={{fontSize:11,color:C.hint}}>{fmtDay(vs)} → {fmtDay(ve)}</span>
      </div>
      <div ref={ref} style={{border:`1px solid ${C.border}`,borderRadius:12,background:C.card,overflowX:"auto"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:"#fff",zIndex:5}}>
          <div style={{width:LABEL_W,flexShrink:0,padding:"8px 10px",fontSize:11,fontWeight:600,color:C.hint,borderRight:`1px solid ${C.border}`}}>Task</div>
          <div style={{width:chartW,flexShrink:0,position:"relative",height:32}}>
            {ticks.map(({x,label},i)=><div key={i} style={{position:"absolute",left:x,fontSize:10,color:C.hint,top:8,transform:"translateX(-50%)",whiteSpace:"nowrap",pointerEvents:"none"}}>{label}</div>)}
            {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:2,background:C.primary,opacity:.5}}/>}
          </div>
        </div>
        {grouped.length===0&&<div style={{padding:48,textAlign:"center",color:C.hint,fontSize:14}}>No tasks on this timeline yet</div>}
        {grouped.map(({cat,linked,standalone})=>(
          <div key={cat.id}>
            <div style={{display:"flex",background:cat.color+"10",borderBottom:`1px solid ${cat.color}20`}}>
              <div style={{width:LABEL_W,flexShrink:0,padding:"7px 10px",borderRight:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6}}>
                <span style={{background:cat.color,color:"#fff",borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,fontFamily:"monospace"}}>{cat.code}</span>
                <span style={{fontSize:12,fontWeight:600,color:C.text}}>{cat.name}</span>
                <span style={{fontSize:11,color:C.hint}}>({linked.length+standalone.length})</span>
              </div>
              <div style={{width:chartW,flexShrink:0,position:"relative",height:30}}>
                {todayX>0&&todayX<=chartW&&<div style={{position:"absolute",left:todayX,top:0,bottom:0,width:1,background:cat.color,opacity:.3}}/>}
              </div>
            </div>
            {linked.length>0&&<><div style={{display:"flex",background:C.bg,borderBottom:`1px solid ${C.border}`}}>
              <div style={{width:LABEL_W,flexShrink:0,padding:"3px 12px",fontSize:10,color:C.hint,borderRight:`1px solid ${C.border}`}}>🔗 Linked ({linked.length})</div>
              <div style={{width:chartW,flexShrink:0}}/>
            </div>{linked.map(t=>renderRow(t,cat))}</>}
            {standalone.length>0&&<>{linked.length>0&&<div style={{display:"flex",background:C.bg,borderBottom:`1px solid ${C.border}`}}>
              <div style={{width:LABEL_W,flexShrink:0,padding:"3px 12px",fontSize:10,color:C.hint,borderRight:`1px solid ${C.border}`}}>— Standalone ({standalone.length})</div>
              <div style={{width:chartW,flexShrink:0}}/>
            </div>}{standalone.map(t=>renderRow(t,cat))}</>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap",justifyContent:"center"}}>
        {Object.entries(PRIORITIES).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.hint}}><div style={{width:14,height:7,borderRadius:3,background:v.color}}/>{v.label}</div>)}
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.hint}}><div style={{width:14,height:7,borderRadius:3,background:"#fde68a"}}/>Blocked</div>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.hint}}><div style={{width:2,height:12,background:C.primary}}/>Today</div>
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
  const [showShare,setShowShare]=useState(false);
  const [view,setView]=useState("dashboard");
  const [filter,setFilter]=useState("all");
  const [catFilter,setCatFilter]=useState("all");
  const [customCatFilter,setCustomCatFilter]=useState("all");
  const [tagFilter,setTagFilter]=useState(null);
  const [sortBy,setSortBy]=useState("priority");
  const [calDate,setCalDate]=useState(new Date());
  const [selDay,setSelDay]=useState(null);
  const [toast,setToast]=useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));
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
    setTasks(Object.values(map)); setLoading(false);
  };

  useEffect(()=>{ if(session) loadData(); },[session]);

  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

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
    if(existingId){const{error}=await supabase.from("tasks").update(db).eq("id",existingId);if(error){showToast("Error: "+error.message,"error");return;}}
    else{const{data,error}=await supabase.from("tasks").insert({...db,done:false}).select().single();if(error){showToast("Error: "+error.message,"error");return;}taskId=data.id;}
    await supabase.from("task_assignees").delete().eq("task_id",taskId);
    if(form.assignees.length) await supabase.from("task_assignees").insert(form.assignees.map(uid=>({task_id:taskId,user_id:uid})));
    await supabase.from("task_dependencies").delete().eq("task_id",taskId);
    if(form.deps.length) await supabase.from("task_dependencies").insert(form.deps.map(did=>({task_id:taskId,depends_on:did})));
    await loadData(); setShowForm(false); setEditTask(null);
    showToast(existingId?"Task updated ✓":"Task added ✓");
  };

  const toggleDone=async(id,done)=>{ setTasks(p=>p.map(t=>t.id===id?{...t,done:!done}:t)); await supabase.from("tasks").update({done:!done}).eq("id",id); };
  const deleteTask=async id=>{ setTasks(p=>p.filter(t=>t.id!==id)); await supabase.from("tasks").delete().eq("id",id); };

  if(session===undefined) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:C.hint,fontSize:14,fontFamily:"system-ui"}}>Loading…</div>;
  if(!session) return <LoginScreen/>;

  const allTags=[...new Set(tasks.flatMap(t=>t.tags||[]))];
  const sortFn=(a,b)=>{ if(a.done!==b.done)return a.done?1:-1; if(sortBy==="priority")return PO[a.priority]-PO[b.priority]; if(sortBy==="added_desc")return new Date(b.createdAt)-new Date(a.createdAt); if(sortBy==="added_asc")return new Date(a.createdAt)-new Date(b.createdAt); if(sortBy==="due_asc"){if(!a.due&&!b.due)return 0;if(!a.due)return 1;if(!b.due)return -1;return new Date(a.due)-new Date(b.due);} if(sortBy==="alpha")return a.title.localeCompare(b.title); return 0; };
  const visible=tasks.filter(t=>{
    if(filter==="active"&&t.done)return false; if(filter==="done"&&!t.done)return false;
    if(catFilter!=="all"&&t.cat!==catFilter)return false;
    if(customCatFilter!=="all"&&String(t.customCategoryId||"none")!==customCatFilter)return false;
    if(tagFilter&&!(t.tags||[]).includes(tagFilter))return false; return true;
  }).sort(sortFn);
  const counts={total:tasks.length,done:tasks.filter(t=>t.done).length,urgent:tasks.filter(t=>t.priority==="high"&&!t.done).length};
  const yr=calDate.getFullYear(),mo=calDate.getMonth();
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const firstDay=(d=>d===0?6:d-1)(new Date(yr,mo,1).getDay());
  const dayTasks=day=>tasks.filter(t=>t.due&&sameDay(new Date(t.due),new Date(yr,mo,day)));
  const VIEWS=[["dashboard","📊","Dashboard"],["list","📋","Tasks"],["calendar","📅","Calendar"],["gantt","🗂️","Gantt"]];

  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:"'Inter',system-ui,sans-serif"}}>
      {toast&&<div style={{position:"fixed",bottom:mob?90:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="success"?"#10b981":"#ef4444",color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:500,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,.2)",whiteSpace:"nowrap"}}>{toast.msg}</div>}
      {(showForm||editTask)&&<TaskForm task={editTask} tasks={tasks} profiles={profiles} categories={categories} onSave={saveTask} onClose={()=>{setShowForm(false);setEditTask(null);}}/>}
      {showCatModal&&<CategoryModal categories={categories} onSave={saveCategory} onDelete={deleteCategory} onClose={()=>setShowCatModal(false)}/>}
      {showShare&&<ShareModal tasks={tasks} categories={categories} onClose={()=>setShowShare(false)}/>}

      {/* Sidebar (desktop) */}
      {!mob&&<Sidebar view={view} setView={setView} categories={categories} session={session} counts={counts} customCatFilter={customCatFilter} setCustomCatFilter={setCustomCatFilter} onNewTask={()=>{setEditTask(null);setShowForm(true);}} onShare={()=>setShowShare(true)} onCatModal={()=>setShowCatModal(true)}/>}

      {/* Main */}
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",paddingBottom:mob?80:0}}>
        {/* Mobile header */}
        {mob&&<div style={{background:C.sidebar,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
          <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>📋 My Tasks</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowShare(true)} style={{border:"none",background:"rgba(255,255,255,.12)",borderRadius:7,padding:"6px 9px",cursor:"pointer",fontSize:14,color:"#fff"}}>🚀</button>
            <button onClick={()=>setShowCatModal(true)} style={{border:"none",background:"rgba(255,255,255,.12)",borderRadius:7,padding:"6px 9px",cursor:"pointer",fontSize:14,color:"#fff"}}>📁</button>
            <button onClick={()=>{setEditTask(null);setShowForm(true);}} style={{background:C.primary,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+</button>
          </div>
        </div>}

        {/* Content */}
        <div style={{flex:1,padding:mob?"14px 12px":"28px 32px",maxWidth:860,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>

          {/* DASHBOARD */}
          {view==="dashboard"&&<Dashboard tasks={tasks} categories={categories} onEdit={t=>setEditTask(t)} onNewTask={()=>{setEditTask(null);setShowForm(true);}}/>}

          {/* LIST */}
          {view==="list"&&<>
            {/* Page header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <h1 style={{margin:0,fontSize:20,fontWeight:700,color:C.text}}>Tasks</h1>
                <p style={{margin:"3px 0 0",fontSize:13,color:C.muted}}>{counts.done}/{counts.total} completed · {counts.urgent} urgent</p>
              </div>
              {!mob&&<button onClick={()=>{setEditTask(null);setShowForm(true);}} style={{background:C.primary,color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Task</button>}
            </div>

            {/* Filters */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
              {/* Status + sort */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:categories.length>0||allTags.length>0?12:0}}>
                {[["all","All"],["active","Active"],["done","Done"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setFilter(v)} style={{border:`1px solid ${filter===v?C.primary:C.border}`,background:filter===v?C.primaryLight:"#fff",color:filter===v?C.primary:C.muted,borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:filter===v?600:400,cursor:"pointer"}}>{l}</button>
                ))}
                <div style={{width:1,background:C.border,height:18,margin:"0 4px"}}/>
                {[["all","All"],["work","💼 Work"],["personal","🏠 Personal"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setCatFilter(v)} style={{border:`1px solid ${catFilter===v?C.primary:C.border}`,background:catFilter===v?C.primaryLight:"#fff",color:catFilter===v?C.primary:C.muted,borderRadius:7,padding:"5px 11px",fontSize:12,fontWeight:catFilter===v?600:400,cursor:"pointer"}}>{l}</button>
                ))}
                <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center"}}>
                  <span style={{fontSize:11,color:C.hint}}>Sort:</span>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",fontSize:12,color:C.muted,background:"#fff",cursor:"pointer"}}>
                    <option value="priority">🔴 Priority</option>
                    <option value="added_desc">🕐 Newest</option>
                    <option value="added_asc">🕐 Oldest</option>
                    <option value="due_asc">📅 Due date</option>
                    <option value="alpha">🔤 A → Z</option>
                  </select>
                </div>
              </div>

              {/* Category chips */}
              {categories.length>0&&<div style={{marginBottom:allTags.length>0?10:0}}>
                <div style={{fontSize:10,fontWeight:600,color:C.hint,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>📁 Category</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {[["all","All"],["none","— None"],...categories.map(c=>[String(c.id),c.code+" "+c.name,c.color])].map(([v,l,col])=>{
                    const active=customCatFilter===v;
                    return <button key={v} onClick={()=>setCustomCatFilter(active?"all":v)} style={{border:`1px solid ${active?(col||C.primary):C.border}`,background:active?(col||C.primary)+"20":"#fff",color:active?(col||C.primary):C.muted,borderRadius:99,padding:"4px 12px",fontSize:11,fontWeight:active?600:400,cursor:"pointer"}}>{l}</button>;
                  })}
                </div>
              </div>}

              {/* Tags */}
              {allTags.length>0&&<div>
                <div style={{fontSize:10,fontWeight:600,color:C.hint,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>🏷️ Tags</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {allTags.map(tag=>{const c=tagColor(tag),active=tagFilter===tag;return(
                    <button key={tag} onClick={()=>setTagFilter(active?null:tag)} style={{border:`1px solid ${active?c:C.border}`,background:active?c+"20":"#fff",color:active?c:C.muted,borderRadius:99,padding:"4px 10px",fontSize:11,fontWeight:active?600:400,cursor:"pointer"}}>#{tag}</button>
                  );})}
                  {tagFilter&&<button onClick={()=>setTagFilter(null)} style={{border:`1px solid ${C.border}`,background:"none",color:C.hint,borderRadius:99,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>× clear</button>}
                </div>
              </div>}
            </div>

            {loading
              ?<div style={{textAlign:"center",padding:"60px 0",color:C.hint}}>Loading…</div>
              :visible.length===0
                ?<div style={{textAlign:"center",padding:"60px 0",color:C.hint}}><div style={{fontSize:40,marginBottom:10}}>✅</div><p style={{margin:0}}>No tasks here</p></div>
                :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                   {visible.map(t=><TaskCard key={t.id} t={t} tasks={tasks} categories={categories} onToggle={()=>toggleDone(t.id,t.done)} onDelete={()=>deleteTask(t.id)} onEdit={()=>setEditTask(t)} onTagClick={tag=>setTagFilter(tagFilter===tag?null:tag)} activeTag={tagFilter}/>)}
                 </div>
            }
            {counts.done>0&&filter!=="done"&&<button onClick={async()=>{const ids=tasks.filter(t=>t.done).map(t=>t.id);setTasks(p=>p.filter(t=>!t.done));await supabase.from("tasks").delete().in("id",ids);}}
              style={{marginTop:14,border:"none",background:"none",color:C.hint,fontSize:12,cursor:"pointer",display:"block",width:"100%",textAlign:"center",padding:8}}>
              Remove {counts.done} completed task{counts.done>1?"s":""}
            </button>}
          </>}

          {/* CALENDAR */}
          {view==="calendar"&&<>
            <h1 style={{margin:"0 0 20px",fontSize:20,fontWeight:700,color:C.text}}>Calendar</h1>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <button onClick={()=>setCalDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:8,width:34,height:34,fontSize:18,cursor:"pointer",color:C.muted}}>‹</button>
                <span style={{fontSize:16,fontWeight:700,color:C.text}}>{MONTHS[mo]} {yr}</span>
                <button onClick={()=>setCalDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={{border:`1px solid ${C.border}`,background:"#fff",borderRadius:8,width:34,height:34,fontSize:18,cursor:"pointer",color:C.muted}}>›</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
                {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,color:C.hint,padding:"4px 0"}}>{mob?d[0]:d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:mob?3:4}}>
                {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
                {Array.from({length:daysInMo}).map((_,i)=>{
                  const day=i+1,dt=dayTasks(day),isT=sameDay(new Date(yr,mo,day),new Date()),isSel=selDay===day;
                  return(<div key={day} onClick={()=>setSelDay(isSel?null:day)} style={{minHeight:mob?48:60,borderRadius:10,border:`1px solid ${isSel?C.primary:isT?"#c7d2fe":C.border}`,background:isSel?C.primaryLight:isT?"#f5f3ff":C.card,cursor:"pointer",padding:mob?"4px":"6px 8px",transition:"all .15s"}}>
                    <div style={{fontSize:mob?11:13,fontWeight:isT?700:500,color:isT?C.primary:C.text,marginBottom:2,textAlign:mob?"center":"left"}}>{day}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:2,justifyContent:mob?"center":"flex-start"}}>
                      {dt.slice(0,3).map(t=><div key={t.id} style={{width:7,height:7,borderRadius:"50%",background:PRIORITIES[t.priority]?.color}}/>)}
                      {dt.length>3&&<span style={{fontSize:8,color:C.hint}}>+{dt.length-3}</span>}
                    </div>
                  </div>);
                })}
              </div>
            </div>
            {selDay&&<div style={{marginTop:16,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
              <h3 style={{margin:"0 0 12px",fontSize:14,fontWeight:600,color:C.text}}>{MONTHS[mo]} {selDay} <span style={{fontWeight:400,color:C.hint,fontSize:12}}>({dayTasks(selDay).length} task(s))</span></h3>
              {dayTasks(selDay).length===0?<p style={{color:C.hint,fontSize:13,margin:0}}>No tasks.</p>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {dayTasks(selDay).map(t=><TaskCard key={t.id} t={t} tasks={tasks} categories={categories} onToggle={()=>toggleDone(t.id,t.done)} onDelete={()=>deleteTask(t.id)} onEdit={()=>setEditTask(t)} onTagClick={setTagFilter} activeTag={tagFilter}/>)}
              </div>}
            </div>}
          </>}

          {/* GANTT */}
          {view==="gantt"&&<>
            <h1 style={{margin:"0 0 20px",fontSize:20,fontWeight:700,color:C.text}}>Gantt Timeline</h1>
            <GanttView tasks={tasks} categories={categories} onEdit={t=>setEditTask(t)}/>
          </>}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {mob&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:C.sidebar,display:"flex",zIndex:100,borderTop:"1px solid rgba(255,255,255,.1)"}}>
        {VIEWS.map(([v,ic,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"10px 0 14px",border:"none",background:view===v?"rgba(255,255,255,.12)":"transparent",color:view===v?"#fff":"rgba(255,255,255,.45)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:20}}>{ic}</span>
            <span style={{fontSize:9,fontWeight:view===v?600:400,textTransform:"uppercase",letterSpacing:.5}}>{l}</span>
          </button>
        ))}
        <button onClick={()=>{setEditTask(null);setShowForm(true);}} style={{flex:1,padding:"10px 0 14px",border:"none",background:"transparent",color:"rgba(99,102,241,.9)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:24,fontWeight:700,lineHeight:1}}>＋</span>
          <span style={{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>New</span>
        </button>
      </div>}
    </div>
  );
}