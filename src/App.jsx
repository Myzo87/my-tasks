import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const PRIORITIES = {
  high:   { label:"High",   color:"#ef4444", bg:"#fef2f2" },
  medium: { label:"Medium", color:"#f59e0b", bg:"#fffbeb" },
  low:    { label:"Low",    color:"#6366f1", bg:"#eef2ff" },
};
const TAG_PALETTE = ["#6366f1","#ec4899","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];
const tagColor  = tag => { let h=0; for(let c of tag) h=(h*31+c.charCodeAt(0))%TAG_PALETTE.length; return TAG_PALETTE[h]; };
const formatDt  = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "";
const isOverdue = (dt,done) => !done && dt && new Date(dt)<new Date();
const sameDay   = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS      = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const PO        = { high:0, medium:1, low:2 };

const fromDB = r => ({ id:r.id, title:r.title, desc:r.description||"", cat:r.category||"work", priority:r.priority||"medium", due:r.due_date||"", done:r.done||false, tags:r.tags||[], createdAt:r.created_at });
const toDB   = t => ({ title:t.title, description:t.desc, category:t.cat, priority:t.priority, due_date:t.due||null, done:t.done, tags:t.tags });

const S = {
  inp: { width:"100%", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:14, marginBottom:10, boxSizing:"border-box", outline:"none", fontFamily:"inherit" },
  lbl: { fontSize:12, color:"#888", display:"block", marginBottom:4 },
  sel: { width:"100%", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 10px", fontSize:14, fontFamily:"inherit", background:"#fff", boxSizing:"border-box" },
  nav: { border:"1px solid #ebebeb", background:"#fff", borderRadius:8, width:34, height:34, fontSize:18, cursor:"pointer", color:"#444", display:"flex", alignItems:"center", justifyContent:"center" },
};

// ── Login ───────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const login = async () => {
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Incorrect email or password.");
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f8f8f7", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:32, width:"100%", maxWidth:380, boxShadow:"0 4px 32px rgba(0,0,0,.08)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>📋</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#111" }}>My Tasks</h1>
          <p style={{ margin:"6px 0 0", fontSize:14, color:"#888" }}>Sign in to access your tasks</p>
        </div>
        <label style={S.lbl}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com"
          onKeyDown={e=>e.key==="Enter"&&login()} style={S.inp} autoFocus />
        <label style={S.lbl}>Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••"
          onKeyDown={e=>e.key==="Enter"&&login()} style={{...S.inp,marginBottom:0}} />
        {error && <p style={{ color:"#ef4444", fontSize:13, margin:"8px 0 0" }}>{error}</p>}
        <button onClick={login} disabled={loading}
          style={{ marginTop:20, background:"#6366f1", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", opacity:loading?.7:1 }}>
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────
export default function App() {
  const [session,    setSession]    = useState(undefined);
  const [tasks,      setTasks]      = useState([]);
  const [loadingDB,  setLoadingDB]  = useState(false);
  const [form,       setForm]       = useState({ title:"", desc:"", cat:"work", priority:"medium", due:"", tagInput:"", tags:[] });
  const [showForm,   setShowForm]   = useState(false);
  const [view,       setView]       = useState("list");
  const [filter,     setFilter]     = useState("all");
  const [catFilter,  setCatFilter]  = useState("all");
  const [tagFilter,  setTagFilter]  = useState(null);
  const [sortBy,     setSortBy]     = useState("priority");
  const [notifPerm,  setNotifPerm]  = useState("default");
  const [digestTime, setDigestTime] = useState("08:00");
  const [showDigest, setShowDigest] = useState(false);
  const [calDate,    setCalDate]    = useState(new Date());
  const [selDay,     setSelDay]     = useState(null);
  const [toast,      setToast]      = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const { data:{subscription} } = supabase.auth.onAuthStateChange((_,s)=>setSession(s));
    if ("Notification" in window) setNotifPerm(Notification.permission);
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoadingDB(true);
    supabase.from("tasks").select("*").order("created_at",{ascending:true})
      .then(({data,error}) => {
        if (!error) setTasks((data||[]).map(fromDB));
        setLoadingDB(false);
      });
  }, [session]);

  const showToast = (msg, type="error") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 3000);
  };

  // ── CRUD avec mise à jour optimiste ───────────────────────
  const addTask = async () => {
    if (!form.title.trim()) return;
    const tempId = `temp_${Date.now()}`;
    const newTask = { id:tempId, title:form.title.trim(), desc:form.desc.trim(), cat:form.cat, priority:form.priority, due:form.due, done:false, tags:form.tags, createdAt:new Date().toISOString() };

    // 1. Affiche immédiatement dans l'UI
    setTasks(prev=>[...prev, newTask]);
    setForm({title:"",desc:"",cat:"work",priority:"medium",due:"",tagInput:"",tags:[]});
    setShowForm(false);

    // 2. Sauvegarde en base
    const {data, error} = await supabase.from("tasks").insert(toDB(newTask)).select().single();
    if (error) {
      // Rollback si erreur
      setTasks(prev=>prev.filter(t=>t.id!==tempId));
      showToast("Error saving task: "+error.message);
    } else {
      // Remplace l'id temporaire par le vrai id
      setTasks(prev=>prev.map(t=>t.id===tempId ? fromDB(data) : t));
      showToast("Task added ✓","success");
    }
  };

  const toggleDone = async (id, done) => {
    setTasks(prev=>prev.map(t=>t.id===id?{...t,done:!done}:t));
    const {error} = await supabase.from("tasks").update({done:!done}).eq("id",id);
    if (error) setTasks(prev=>prev.map(t=>t.id===id?{...t,done}:t));
  };

  const deleteTask = async id => {
    const backup = tasks.find(t=>t.id===id);
    setTasks(prev=>prev.filter(t=>t.id!==id));
    const {error} = await supabase.from("tasks").delete().eq("id",id);
    if (error) { setTasks(prev=>[...prev,backup]); showToast("Delete failed"); }
  };

  const addFormTag = () => {
    const t=form.tagInput.trim().toLowerCase().replace(/\s+/g,"-");
    if (t&&!form.tags.includes(t)) setForm(f=>({...f,tags:[...f.tags,t],tagInput:""}));
    else setForm(f=>({...f,tagInput:""}));
  };

  const requestNotif = async () => { const p=await Notification.requestPermission(); setNotifPerm(p); };

  if (session===undefined) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#aaa",fontSize:14,fontFamily:"system-ui"}}>Loading…</div>;
  if (!session) return <LoginScreen />;

  // ── Filtrage + tri ────────────────────────────────────────
  const allTags = [...new Set(tasks.flatMap(t=>t.tags||[]))];

  const sortFn = (a,b) => {
    if (a.done!==b.done) return a.done?1:-1;
    if (sortBy==="priority")   return PO[a.priority]-PO[b.priority];
    if (sortBy==="added_desc") return new Date(b.createdAt)-new Date(a.createdAt);
    if (sortBy==="added_asc")  return new Date(a.createdAt)-new Date(b.createdAt);
    if (sortBy==="due_asc") {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due)-new Date(b.due);
    }
    if (sortBy==="alpha") return a.title.localeCompare(b.title);
    return 0;
  };

  const visible = tasks.filter(t=>{
    if (filter==="active"&&t.done) return false;
    if (filter==="done"&&!t.done) return false;
    if (catFilter!=="all"&&t.cat!==catFilter) return false;
    if (tagFilter&&!(t.tags||[]).includes(tagFilter)) return false;
    return true;
  }).sort(sortFn);

  const counts = { total:tasks.length, done:tasks.filter(t=>t.done).length, high:tasks.filter(t=>t.priority==="high"&&!t.done).length };

  // ── Calendrier ────────────────────────────────────────────
  const yr=calDate.getFullYear(), mo=calDate.getMonth();
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const firstDay=(d=>d===0?6:d-1)(new Date(yr,mo,1).getDay());
  const dayTasks=day=>tasks.filter(t=>t.due&&sameDay(new Date(t.due),new Date(yr,mo,day)));

  return (
    <div style={{minHeight:"100vh",background:"#f8f8f7",fontFamily:"'Inter',system-ui,sans-serif"}}>

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="success"?"#10b981":"#ef4444",color:"#fff",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:500,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,.15)"}}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid #ebebeb",padding:"20px 24px 0"}}>
        <div style={{maxWidth:720,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <h1 style={{margin:0,fontSize:22,fontWeight:700,color:"#111",letterSpacing:"-0.5px"}}>My Tasks</h1>
              <p style={{margin:"2px 0 0",fontSize:13,color:"#888"}}>
                {counts.done}/{counts.total} completed{counts.high>0?` · ${counts.high} urgent`:""}
                <span style={{marginLeft:8,color:"#c7d2fe",fontSize:11}}>● {session.user.email}</span>
              </p>
            </div>
            <div style={{display:"flex",gap:8}}>
              {notifPerm!=="granted"
                ?<button onClick={requestNotif} title="Enable reminders" style={{border:"1px solid #ebebeb",borderRadius:8,background:"#fff",padding:"7px 10px",cursor:"pointer",fontSize:16}}>🔔</button>
                :<button onClick={()=>setShowDigest(s=>!s)} style={{border:"1px solid "+(showDigest?"#6366f1":"#ebebeb"),borderRadius:8,background:showDigest?"#eef2ff":"#fff",padding:"7px 10px",cursor:"pointer",fontSize:16}}>📬</button>
              }
              <button onClick={()=>{setShowForm(s=>!s);setView("list");}} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                {showForm?"× Close":"+ New Task"}
              </button>
              <button onClick={()=>supabase.auth.signOut()} title="Sign out" style={{border:"1px solid #ebebeb",borderRadius:8,background:"#fff",padding:"7px 10px",cursor:"pointer",fontSize:15}}>🚪</button>
            </div>
          </div>

          <div style={{height:3,background:"#ebebeb",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${counts.total?(counts.done/counts.total)*100:0}%`,background:"#6366f1",borderRadius:99,transition:"width .4s"}}/>
          </div>

          {/* Tabs + filters */}
          <div style={{display:"flex",alignItems:"center",gap:2,marginTop:14,flexWrap:"wrap"}}>
            {[["list","📋 List"],["calendar","📅 Calendar"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{border:"none",background:"none",padding:"8px 14px",fontSize:13,fontWeight:view===v?600:400,color:view===v?"#6366f1":"#888",borderBottom:view===v?"2px solid #6366f1":"2px solid transparent",cursor:"pointer"}}>{l}</button>
            ))}
            {view==="list"&&<>
              <div style={{width:1,background:"#ebebeb",height:18,margin:"0 6px"}}/>
              {[["all","All"],["active","Active"],["done","Done"]].map(([v,l])=>(
                <button key={v} onClick={()=>setFilter(v)} style={{border:"none",background:"none",padding:"8px 12px",fontSize:13,fontWeight:filter===v?600:400,color:filter===v?"#6366f1":"#888",borderBottom:filter===v?"2px solid #6366f1":"2px solid transparent",cursor:"pointer"}}>{l}</button>
              ))}
            </>}
            <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center"}}>
              {[["all","All"],["work","💼"],["personal","🏠"]].map(([v,l])=>(
                <button key={v} onClick={()=>setCatFilter(v)} style={{border:"1px solid "+(catFilter===v?"#6366f1":"#ebebeb"),background:catFilter===v?"#eef2ff":"#fff",color:catFilter===v?"#6366f1":"#666",padding:"5px 9px",borderRadius:20,fontSize:12,fontWeight:catFilter===v?600:400,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:720,margin:"0 auto",padding:"20px 24px"}}>

        {/* Sort bar */}
        {view==="list"&&(
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:"#aaa",fontWeight:500}}>Sort by</span>
            {[
              ["priority","🔴 Priority"],
              ["added_desc","🕐 Newest"],
              ["added_asc","🕐 Oldest"],
              ["due_asc","📅 Due date"],
              ["alpha","🔤 A → Z"],
            ].map(([v,l])=>(
              <button key={v} onClick={()=>setSortBy(v)} style={{border:"1px solid "+(sortBy===v?"#6366f1":"#ebebeb"),background:sortBy===v?"#eef2ff":"#fff",color:sortBy===v?"#6366f1":"#777",borderRadius:20,padding:"4px 11px",fontSize:12,fontWeight:sortBy===v?600:400,cursor:"pointer"}}>
                {l}
              </button>
            ))}
          </div>
        )}

        {/* Digest */}
        {showDigest&&(
          <div style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:12,padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:14,color:"#4338ca",fontWeight:500}}>📬 Daily digest at</span>
            <input type="time" value={digestTime} onChange={e=>setDigestTime(e.target.value)} style={{border:"1px solid #c7d2fe",borderRadius:7,padding:"6px 10px",fontSize:14,color:"#4338ca",fontWeight:600,background:"#fff"}}/>
            <span style={{fontSize:13,color:"#818cf8",flex:1}}>Daily notification summarising your tasks.</span>
            <button onClick={()=>{
              if(Notification.permission==="granted"){
                const todo=tasks.filter(t=>!t.done),late=todo.filter(t=>t.due&&new Date(t.due)<new Date()),urg=todo.filter(t=>t.priority==="high");
                new Notification("📋 Daily digest",{body:`${todo.length} task(s) · ${urg.length} urgent · ${late.length} overdue`});
              }
            }} style={{border:"1px solid #c7d2fe",background:"#fff",borderRadius:7,padding:"6px 12px",fontSize:13,color:"#6366f1",cursor:"pointer",fontWeight:500}}>Test now →</button>
          </div>
        )}

        {/* Tag filters */}
        {allTags.length>0&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {allTags.map(tag=>{const c=tagColor(tag),active=tagFilter===tag;return(
              <button key={tag} onClick={()=>setTagFilter(active?null:tag)} style={{border:`1px solid ${active?c:"#e5e5e5"}`,background:active?c+"22":"#fff",color:active?c:"#888",borderRadius:99,padding:"4px 10px",fontSize:12,fontWeight:active?600:400,cursor:"pointer"}}>#{tag}</button>
            );})}
            {tagFilter&&<button onClick={()=>setTagFilter(null)} style={{border:"1px solid #ebebeb",background:"none",color:"#aaa",borderRadius:99,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>× clear</button>}
          </div>
        )}

        {/* Add form */}
        {showForm&&(
          <div style={{background:"#fff",border:"1px solid #ebebeb",borderRadius:14,padding:20,marginBottom:20,boxShadow:"0 4px 24px rgba(0,0,0,.06)"}}>
            <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:600}}>New Task</h3>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Title *" style={S.inp}/>
            <input value={form.desc}  onChange={e=>setForm(f=>({...f,desc:e.target.value}))}  placeholder="Description (optional)" style={S.inp}/>
            <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:110}}>
                <label style={S.lbl}>Category</label>
                <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={S.sel}>
                  <option value="work">💼 Work</option><option value="personal">🏠 Personal</option>
                </select>
              </div>
              <div style={{flex:1,minWidth:110}}>
                <label style={S.lbl}>Priority</label>
                <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={S.sel}>
                  <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🔵 Low</option>
                </select>
              </div>
              <div style={{flex:2,minWidth:150}}>
                <label style={S.lbl}>Due date</label>
                <input type="datetime-local" value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))} style={{...S.sel,fontSize:13}}/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={S.lbl}>Tags</label>
              {form.tags.length>0&&(
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {form.tags.map(tag=>{const c=tagColor(tag);return(
                    <span key={tag} style={{display:"inline-flex",alignItems:"center",gap:4,background:c+"18",color:c,border:`1px solid ${c}44`,borderRadius:99,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                      #{tag}<span onClick={()=>setForm(f=>({...f,tags:f.tags.filter(t=>t!==tag)}))} style={{cursor:"pointer",opacity:.6,fontSize:14}}>×</span>
                    </span>
                  );})}
                </div>
              )}
              <div style={{display:"flex",gap:6}}>
                <input value={form.tagInput} onChange={e=>setForm(f=>({...f,tagInput:e.target.value}))}
                  onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addFormTag();}}}
                  placeholder="Type a tag then Enter…" style={{...S.inp,margin:0,flex:1}}/>
                <button onClick={addFormTag} style={{border:"1px solid #e5e5e5",background:"#f9f9f9",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:16,color:"#555"}}>+</button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowForm(false)} style={{border:"1px solid #ebebeb",background:"#fff",borderRadius:8,padding:"8px 16px",fontSize:14,cursor:"pointer",color:"#666"}}>Cancel</button>
              <button onClick={addTask} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Add Task</button>
            </div>
          </div>
        )}

        {/* List view */}
        {view==="list"&&(
          loadingDB
            ?<div style={{textAlign:"center",padding:"60px 20px",color:"#aaa"}}>Loading tasks…</div>
            :visible.length===0
              ?<div style={{textAlign:"center",padding:"60px 20px",color:"#aaa"}}><div style={{fontSize:40,marginBottom:10}}>✅</div><p style={{margin:0,fontSize:15}}>No tasks here</p></div>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                 {visible.map(t=><TaskCard key={t.id} t={t} onToggle={()=>toggleDone(t.id,t.done)} onDelete={()=>deleteTask(t.id)} onTagClick={tag=>setTagFilter(tagFilter===tag?null:tag)} activeTag={tagFilter}/>)}
               </div>
        )}

        {/* Calendar view */}
        {view==="calendar"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <button onClick={()=>setCalDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={S.nav}>‹</button>
              <span style={{fontSize:16,fontWeight:700,color:"#111"}}>{MONTHS[mo]} {yr}</span>
              <button onClick={()=>setCalDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={S.nav}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
              {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,color:"#bbb",padding:"4px 0"}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
              {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
              {Array.from({length:daysInMo}).map((_,i)=>{
                const day=i+1,dt=dayTasks(day),isToday=sameDay(new Date(yr,mo,day),new Date()),isSel=selDay===day;
                return(
                  <div key={day} onClick={()=>setSelDay(isSel?null:day)} style={{minHeight:60,borderRadius:10,border:"1px solid "+(isSel?"#6366f1":isToday?"#c7d2fe":"#ebebeb"),background:isSel?"#eef2ff":isToday?"#f5f3ff":"#fff",cursor:"pointer",padding:"6px 8px"}}>
                    <div style={{fontSize:13,fontWeight:isToday?700:500,color:isToday?"#6366f1":"#333",marginBottom:4}}>{day}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                      {dt.slice(0,3).map(t=><div key={t.id} style={{width:8,height:8,borderRadius:"50%",background:PRIORITIES[t.priority].color}} title={t.title}/>)}
                      {dt.length>3&&<span style={{fontSize:9,color:"#aaa"}}>+{dt.length-3}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:12,marginTop:12,justifyContent:"center"}}>
              {Object.entries(PRIORITIES).map(([k,v])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#888"}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:v.color}}/>{v.label}
                </div>
              ))}
            </div>
            {selDay&&(
              <div style={{marginTop:20,background:"#fff",border:"1px solid #ebebeb",borderRadius:14,padding:16}}>
                <h3 style={{margin:"0 0 12px",fontSize:15,fontWeight:600,color:"#111"}}>
                  {MONTHS[mo]} {selDay}, {yr}
                  <span style={{fontSize:13,fontWeight:400,color:"#888",marginLeft:8}}>{dayTasks(selDay).length} task(s)</span>
                </h3>
                {dayTasks(selDay).length===0
                  ?<p style={{color:"#aaa",fontSize:14,margin:0}}>No tasks on this day.</p>
                  :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                     {dayTasks(selDay).map(t=><TaskCard key={t.id} t={t} onToggle={()=>toggleDone(t.id,t.done)} onDelete={()=>deleteTask(t.id)} onTagClick={tag=>setTagFilter(tag)} activeTag={tagFilter}/>)}
                   </div>
                }
              </div>
            )}
          </div>
        )}

        {counts.done>0&&view==="list"&&filter!=="done"&&(
          <button onClick={async()=>{
            const ids=tasks.filter(t=>t.done).map(t=>t.id);
            setTasks(prev=>prev.filter(t=>!t.done));
            await supabase.from("tasks").delete().in("id",ids);
          }} style={{marginTop:16,border:"none",background:"none",color:"#ccc",fontSize:13,cursor:"pointer",display:"block",width:"100%",textAlign:"center",padding:8}}>
            Remove {counts.done} completed task{counts.done>1?"s":""}
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({t,onToggle,onDelete,onTagClick,activeTag}){
  const p=PRIORITIES[t.priority]||PRIORITIES.medium, late=isOverdue(t.due,t.done);
  return(
    <div style={{background:t.done?"#fafafa":"#fff",border:"1px solid "+(late?"#fecaca":"#ebebeb"),borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:12,opacity:t.done?.6:1,transition:"all .2s"}}>
      <button onClick={onToggle} style={{width:22,height:22,borderRadius:"50%",border:"2px solid "+(t.done?"#6366f1":"#d5d5d5"),background:t.done?"#6366f1":"transparent",cursor:"pointer",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
        {t.done&&<svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
          <span style={{fontSize:14,fontWeight:600,color:t.done?"#aaa":"#111",textDecoration:t.done?"line-through":"none"}}>{t.title}</span>
          <span style={{fontSize:11,padding:"2px 7px",borderRadius:99,background:p.bg,color:p.color,fontWeight:600}}>{p.label}</span>
          <span style={{fontSize:11,padding:"2px 7px",borderRadius:99,background:"#f4f4f4",color:"#666"}}>{t.cat==="work"?"💼 Work":"🏠 Personal"}</span>
        </div>
        {t.desc&&<p style={{margin:"0 0 6px",fontSize:13,color:"#888"}}>{t.desc}</p>}
        {(t.tags||[]).length>0&&(
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:t.due?6:0}}>
            {(t.tags||[]).map(tag=>{const c=tagColor(tag),active=activeTag===tag;return(
              <span key={tag} onClick={()=>onTagClick(tag)} style={{display:"inline-block",background:active?c:c+"18",color:c,border:`1px solid ${c}44`,borderRadius:99,padding:"2px 9px",fontSize:11,fontWeight:600,cursor:"pointer",userSelect:"none"}}>#{tag}</span>
            );})}
          </div>
        )}
        {t.due&&<div style={{fontSize:12,color:late?"#ef4444":"#aaa",display:"flex",alignItems:"center",gap:4}}>{late?"⚠️ Overdue — ":"🕐 "}{formatDt(t.due)}</div>}
      </div>
      <button onClick={onDelete} style={{border:"none",background:"none",cursor:"pointer",color:"#ccc",fontSize:20,padding:"0 2px",lineHeight:1,flexShrink:0,marginTop:-2}}>×</button>
    </div>
  );
}