import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const PRIORITIES = {
  high:   { label: "High",   color: "#ef4444", bg: "#fef2f2" },
  medium: { label: "Medium", color: "#f59e0b", bg: "#fffbeb" },
  low:    { label: "Low",    color: "#6366f1", bg: "#eef2ff" },
};
const TAG_PALETTE = ["#6366f1","#ec4899","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];
const tagColor = tag => { let h=0; for(let c of tag) h=(h*31+c.charCodeAt(0))%TAG_PALETTE.length; return TAG_PALETTE[h]; };
const formatDt = dt => dt ? new Date(dt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "";
const isOverdue = (dt,done) => !done && dt && new Date(dt)<new Date();
const sameDay   = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS      = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const S = {
  inp: { width:"100%", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", fontSize:14, marginBottom:10, boxSizing:"border-box", outline:"none", fontFamily:"inherit" },
  lbl: { fontSize:12, color:"#888", display:"block", marginBottom:4 },
  sel: { width:"100%", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 10px", fontSize:14, fontFamily:"inherit", background:"#fff", boxSizing:"border-box" },
  nav: { border:"1px solid #ebebeb", background:"#fff", borderRadius:8, width:34, height:34, fontSize:18, cursor:"pointer", color:"#444", display:"flex", alignItems:"center", justifyContent:"center" },
};

let notifTimers = {};
let digestTimer  = null;

// ─── Login Screen ────────────────────────────────────────────
function LoginScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [mode,     setMode]     = useState("login"); // "login" | "forgot"
  const [sent,     setSent]     = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return setError("Please fill in all fields.");
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Incorrect email or password.");
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) return setError("Enter your email address first.");
    setLoading(true); setError("");
    await supabase.auth.resetPasswordForEmail(email);
    setSent(true); setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"#f8f8f7",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",padding:24}}>
      <div style={{background:"#fff",borderRadius:16,padding:"36px 32px",width:"100%",maxWidth:380,boxShadow:"0 4px 32px rgba(0,0,0,.08)"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:8}}>📋</div>
          <h1 style={{margin:0,fontSize:22,fontWeight:700,color:"#111",letterSpacing:"-0.5px"}}>My Tasks</h1>
          <p style={{margin:"6px 0 0",fontSize:14,color:"#aaa"}}>
            {mode==="login" ? "Sign in to access your workspace" : "Reset your password"}
          </p>
        </div>

        {mode==="login" && !sent && <>
          <label style={S.lbl}>Email</label>
          <input value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
            placeholder="you@example.com" type="email" style={S.inp}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
          <label style={S.lbl}>Password</label>
          <input value={password} onChange={e=>{setPassword(e.target.value);setError("");}}
            placeholder="••••••••" type="password" style={S.inp}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
          {error && <p style={{margin:"0 0 12px",fontSize:13,color:"#ef4444",textAlign:"center"}}>{error}</p>}
          <button onClick={handleLogin} disabled={loading} style={{width:"100%",background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:15,fontWeight:600,cursor:"pointer",opacity:loading?.7:1,marginBottom:12}}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <button onClick={()=>{setMode("forgot");setError("");}} style={{width:"100%",border:"none",background:"none",color:"#aaa",fontSize:13,cursor:"pointer",padding:4}}>
            Forgot password?
          </button>
        </>}

        {mode==="forgot" && !sent && <>
          <label style={S.lbl}>Email</label>
          <input value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
            placeholder="you@example.com" type="email" style={S.inp}/>
          {error && <p style={{margin:"0 0 12px",fontSize:13,color:"#ef4444",textAlign:"center"}}>{error}</p>}
          <button onClick={handleForgot} disabled={loading} style={{width:"100%",background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:15,fontWeight:600,cursor:"pointer",opacity:loading?.7:1,marginBottom:12}}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <button onClick={()=>{setMode("login");setError("");setSent(false);}} style={{width:"100%",border:"none",background:"none",color:"#aaa",fontSize:13,cursor:"pointer",padding:4}}>
            ← Back to sign in
          </button>
        </>}

        {sent && (
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:32,marginBottom:10}}>📬</div>
            <p style={{fontSize:14,color:"#555",margin:0}}>Check your inbox! A reset link has been sent to <strong>{email}</strong>.</p>
            <button onClick={()=>{setMode("login");setSent(false);}} style={{marginTop:16,border:"none",background:"none",color:"#6366f1",fontSize:13,cursor:"pointer",fontWeight:600}}>← Back to sign in</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [session,    setSession]    = useState(undefined); // undefined = loading
  const [tasks,      setTasks]      = useState([]);
  const [loadingT,   setLoadingT]   = useState(true);
  const [form,       setForm]       = useState({ title:"", desc:"", cat:"work", priority:"medium", due:"", tagInput:"", tags:[] });
  const [showForm,   setShowForm]   = useState(false);
  const [view,       setView]       = useState("list");
  const [filter,     setFilter]     = useState("all");
  const [catFilter,  setCatFilter]  = useState("all");
  const [tagFilter,  setTagFilter]  = useState(null);
  const [notifPerm,  setNotifPerm]  = useState("default");
  const [digestTime, setDigestTime] = useState("08:00");
  const [showDigest, setShowDigest] = useState(false);
  const [calDate,    setCalDate]    = useState(new Date());
  const [selDay,     setSelDay]     = useState(null);
  const nextId = useRef(Date.now());

  // ── Auth state ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Load tasks (only when logged in) ──
  useEffect(() => {
    if (!session) return;
    loadTasks();
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, [session]);

  // ── Real-time updates ──
  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel("tasks-rt")
      .on("postgres_changes", { event:"*", schema:"public", table:"tasks" }, loadTasks)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [session]);

  async function loadTasks() {
    const { data, error } = await supabase.from("tasks").select("*").order("id");
    if (!error) setTasks(data || []);
    setLoadingT(false);
  }

  useEffect(() => {
    Object.values(notifTimers).forEach(clearTimeout); notifTimers = {};
    tasks.filter(t=>!t.done&&t.due).forEach(t=>{
      const ms=new Date(t.due)-Date.now()-5*60*1000;
      if(ms>0&&ms<86400000) notifTimers[t.id]=setTimeout(()=>{
        if(Notification.permission==="granted") new Notification("⏰ "+t.title,{body:"Due in 5 minutes!"});
      },ms);
    });
  }, [tasks]);

  useEffect(() => {
    if(digestTimer) clearTimeout(digestTimer);
    const [h,m]=digestTime.split(":").map(Number);
    const next=new Date(); next.setHours(h,m,0,0);
    if(next<=new Date()) next.setDate(next.getDate()+1);
    digestTimer=setTimeout(function fire(){
      if(Notification.permission==="granted"){
        const todo=tasks.filter(t=>!t.done),late=todo.filter(t=>t.due&&new Date(t.due)<new Date()),urg=todo.filter(t=>t.priority==="high");
        new Notification("📋 Daily digest",{body:`${todo.length} task(s) · ${urg.length} urgent · ${late.length} overdue`});
      }
      digestTimer=setTimeout(fire,86400000);
    },next-new Date());
    return()=>clearTimeout(digestTimer);
  },[digestTime,tasks]);

  const requestNotif = async () => { const p=await Notification.requestPermission(); setNotifPerm(p); };

  const addFormTag = () => {
    const t=form.tagInput.trim().toLowerCase().replace(/\s+/g,"-");
    if(t&&!form.tags.includes(t)) setForm(f=>({...f,tags:[...f.tags,t],tagInput:""}));
    else setForm(f=>({...f,tagInput:""}));
  };

  const addTask = async () => {
    if(!form.title.trim()) return;
    await supabase.from("tasks").insert({id:nextId.current++,title:form.title.trim(),description:form.desc.trim(),cat:form.cat,priority:form.priority,due:form.due,done:false,tags:form.tags});
    setForm({title:"",desc:"",cat:"work",priority:"medium",due:"",tagInput:"",tags:[]});
    setShowForm(false);
  };
  const toggleDone  = async (id,done) => await supabase.from("tasks").update({done:!done}).eq("id",id);
  const deleteTask  = async (id)      => await supabase.from("tasks").delete().eq("id",id);
  const deleteDone  = async ()        => await supabase.from("tasks").delete().eq("done",true);
  const handleLogout = async ()       => await supabase.auth.signOut();

  // ── Render states ──
  if (session === undefined) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#aaa",fontSize:14,fontFamily:"system-ui"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📋</div>Loading…</div>
    </div>
  );
  if (!session) return <LoginScreen />;

  const allTags=[...new Set(tasks.flatMap(t=>t.tags||[]))];
  const visible=tasks.filter(t=>{
    if(filter==="active"&&t.done) return false;
    if(filter==="done"&&!t.done) return false;
    if(catFilter!=="all"&&t.cat!==catFilter) return false;
    if(tagFilter&&!(t.tags||[]).includes(tagFilter)) return false;
    return true;
  }).sort((a,b)=>{
    if(a.done!==b.done) return a.done?1:-1;
    return {high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority];
  });
  const counts={total:tasks.length,done:tasks.filter(t=>t.done).length,high:tasks.filter(t=>t.priority==="high"&&!t.done).length};
  const yr=calDate.getFullYear(),mo=calDate.getMonth();
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const firstDay=(d=>d===0?6:d-1)(new Date(yr,mo,1).getDay());
  const dayTasks=day=>tasks.filter(t=>t.due&&sameDay(new Date(t.due),new Date(yr,mo,day)));

  return (
    <div style={{minHeight:"100vh",background:"#f8f8f7",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #ebebeb",padding:"20px 24px 0"}}>
        <div style={{maxWidth:720,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <h1 style={{margin:0,fontSize:22,fontWeight:700,color:"#111",letterSpacing:"-0.5px"}}>My Tasks</h1>
              <p style={{margin:"2px 0 0",fontSize:13,color:"#888"}}>
                {counts.done}/{counts.total} completed{counts.high>0?` · ${counts.high} urgent`:""}
                <span style={{marginLeft:8,color:"#ccc"}}>·</span>
                <span style={{marginLeft:8,color:"#aaa"}}>{session.user.email}</span>
              </p>
            </div>
            <div style={{display:"flex",gap:8}}>
              {notifPerm!=="granted"
                ?<button onClick={requestNotif} title="Enable reminders" style={{border:"1px solid #ebebeb",borderRadius:8,background:"#fff",padding:"7px 10px",cursor:"pointer",fontSize:16}}>🔔</button>
                :<button onClick={()=>setShowDigest(s=>!s)} style={{border:"1px solid "+(showDigest?"#6366f1":"#ebebeb"),borderRadius:8,background:showDigest?"#eef2ff":"#fff",padding:"7px 10px",cursor:"pointer",fontSize:16}}>📬</button>
              }
              <button onClick={handleLogout} title="Sign out" style={{border:"1px solid #ebebeb",borderRadius:8,background:"#fff",padding:"7px 10px",cursor:"pointer",fontSize:16}}>🚪</button>
              <button onClick={()=>{setShowForm(s=>!s);setView("list");}} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                {showForm?"× Close":"+ New Task"}
              </button>
            </div>
          </div>

          <div style={{height:3,background:"#ebebeb",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${counts.total?(counts.done/counts.total)*100:0}%`,background:"#6366f1",borderRadius:99,transition:"width .4s"}}/>
          </div>

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
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>
              {[["all","All"],["work","💼"],["personal","🏠"]].map(([v,l])=>(
                <button key={v} onClick={()=>setCatFilter(v)} style={{border:"1px solid "+(catFilter===v?"#6366f1":"#ebebeb"),background:catFilter===v?"#eef2ff":"#fff",color:catFilter===v?"#6366f1":"#666",padding:"5px 9px",borderRadius:20,fontSize:12,fontWeight:catFilter===v?600:400,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:720,margin:"0 auto",padding:"20px 24px"}}>
        {showDigest&&(
          <div style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:12,padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:14,color:"#4338ca",fontWeight:500}}>📬 Daily digest at</span>
            <input type="time" value={digestTime} onChange={e=>setDigestTime(e.target.value)} style={{border:"1px solid #c7d2fe",borderRadius:7,padding:"6px 10px",fontSize:14,color:"#4338ca",fontWeight:600,background:"#fff"}}/>
            <span style={{fontSize:13,color:"#818cf8",flex:1}}>You'll get a daily notification summarising your tasks.</span>
            <button onClick={()=>{
              if(Notification.permission==="granted"){
                const todo=tasks.filter(t=>!t.done),late=todo.filter(t=>t.due&&new Date(t.due)<new Date()),urg=todo.filter(t=>t.priority==="high");
                new Notification("📋 Daily digest",{body:`${todo.length} task(s) · ${urg.length} urgent · ${late.length} overdue`});
              }
            }} style={{border:"1px solid #c7d2fe",background:"#fff",borderRadius:7,padding:"6px 12px",fontSize:13,color:"#6366f1",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap"}}>Test now →</button>
          </div>
        )}

        {allTags.length>0&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {allTags.map(tag=>{const c=tagColor(tag),active=tagFilter===tag;return(
              <button key={tag} onClick={()=>setTagFilter(active?null:tag)} style={{border:`1px solid ${active?c:"#e5e5e5"}`,background:active?c+"22":"#fff",color:active?c:"#888",borderRadius:99,padding:"4px 10px",fontSize:12,fontWeight:active?600:400,cursor:"pointer"}}>#{tag}</button>
            );})}
            {tagFilter&&<button onClick={()=>setTagFilter(null)} style={{border:"1px solid #ebebeb",background:"none",color:"#aaa",borderRadius:99,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>× clear</button>}
          </div>
        )}

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
                <label style={S.lbl}>Due date & reminder</label>
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
                  placeholder="Type a tag then press Enter…" style={{...S.inp,margin:0,flex:1}}/>
                <button onClick={addFormTag} style={{border:"1px solid #e5e5e5",background:"#f9f9f9",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:16,color:"#555"}}>+</button>
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowForm(false)} style={{border:"1px solid #ebebeb",background:"#fff",borderRadius:8,padding:"8px 16px",fontSize:14,cursor:"pointer",color:"#666"}}>Cancel</button>
              <button onClick={addTask} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Add Task</button>
            </div>
          </div>
        )}

        {view==="list"&&(
          loadingT
            ?<div style={{textAlign:"center",padding:"60px 0",color:"#aaa"}}>Loading tasks…</div>
            :visible.length===0
              ?<div style={{textAlign:"center",padding:"60px 20px",color:"#aaa"}}><div style={{fontSize:40,marginBottom:10}}>✅</div><p style={{margin:0,fontSize:15}}>No tasks here</p></div>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                 {visible.map(t=><TaskCard key={t.id} t={t} onToggle={()=>toggleDone(t.id,t.done)} onDelete={()=>deleteTask(t.id)} onTagClick={tag=>setTagFilter(tagFilter===tag?null:tag)} activeTag={tagFilter}/>)}
               </div>
        )}

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
          <button onClick={deleteDone} style={{marginTop:16,border:"none",background:"none",color:"#ccc",fontSize:13,cursor:"pointer",display:"block",width:"100%",textAlign:"center",padding:8}}>
            Remove {counts.done} completed task{counts.done>1?"s":""}
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({t,onToggle,onDelete,onTagClick,activeTag}){
  const p=PRIORITIES[t.priority],late=isOverdue(t.due,t.done);
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
        {t.description&&<p style={{margin:"0 0 6px",fontSize:13,color:"#888"}}>{t.description}</p>}
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