import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from './api.js';

const AGENT_COLOR = {
  planner:'#8b5cf6', researcher:'#16d9ff', architect:'#6478ff', backend:'#38bdf8',
  frontend:'#ffb454', qa:'#f472b6', security:'#f87171', devops:'#2dd4bf', system:'#8a8a94',
  scheduler:'#2dd4bf', orchestrator:'#ff5a1f', verifier:'#4ade80', 'model-router':'#a78bfa', operator:'#fbbf24'
};
const STATUS_COLOR = {
  QUEUED:'#52525b', PLANNING:'#8b5cf6', RUNNING:'#38bdf8', WAITING_APPROVAL:'#a78bfa', PAUSED:'#fbbf24',
  VERIFYING:'#2dd4bf', COMPLETED:'#4ade80', FAILED:'#f87171', CANCELLED:'#71717a', BLOCKED:'#f87171',
  READY:'#38bdf8', LEASED:'#22d3ee', SUCCEEDED:'#4ade80', RETRY_WAIT:'#fbbf24', DEAD_LETTER:'#ef4444'
};
const MODES = ['INSTANT','THINK','AGENT','SWARM','AUTO'];
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour12:false }) : '—';
const duration = (start, end) => start ? Math.max(0, Math.floor((new Date(end || Date.now()) - new Date(start))/1000)) : 0;
const fmtDuration = (s) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

function Logo(){ return <span className="logoMark"><i/><i/><i/><i/></span>; }
function Chip({children, color='#8a8a94'}){ return <span className="chip" style={{color,borderColor:`${color}55`,background:`${color}14`}}>{children}</span>; }

export default function App(){
  const [me,setMe]=useState(undefined); // undefined = checking session, null = signed out, object = signed in
  const [projectId,setProjectId]=useState(null);
  const [health,setHealth]=useState(null);
  const [missions,setMissions]=useState([]);
  const [data,setData]=useState(null);
  const [goal,setGoal]=useState('');
  const [mode,setMode]=useState('SWARM');
  const [tab,setTab]=useState('overview');
  const [inspector,setInspector]=useState('agents');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [now,setNow]=useState(Date.now());
  const eventSourceRef=useRef(null);

  useEffect(()=>{ api.me().then(setMe).catch(()=>setMe(null)); },[]);
  useEffect(()=>{ if(me && me.projects?.length && !projectId) setProjectId(me.projects[0].id); },[me]);

  const refreshHealth=useCallback(async()=>{ try{ setHealth(await api.health()); }catch{ setHealth({status:'ERROR',database:'ERROR',qwen:'UNKNOWN'}); } },[]);
  const refreshList=useCallback(async()=>{ if(!projectId)return; try{ setMissions(await api.missions(projectId)); }catch{} },[projectId]);
  const refreshMission=useCallback(async(id)=>{ if(!id)return; try{ setData(await api.mission(id)); setError(''); }catch(e){ setError(e.message); } },[]);

  useEffect(()=>{ refreshHealth(); const i=setInterval(()=>setNow(Date.now()),1000); return()=>clearInterval(i); },[refreshHealth]);
  useEffect(()=>{ if(me && projectId) refreshList(); },[me,projectId,refreshList]);

  useEffect(()=>{
    const id=data?.mission?.id;
    eventSourceRef.current?.close();
    if(!id)return;
    const last=data?.events?.at(-1)?.id || 0;
    const es=new EventSource(api.streamUrl(id,last), { withCredentials: true });
    eventSourceRef.current=es;
    es.addEventListener('runtime',()=>{ refreshMission(id); refreshList(); refreshHealth(); });
    es.onerror=()=>{};
    return()=>es.close();
  },[data?.mission?.id]);

  async function createMission(text){
    const g=(text||goal).trim(); if(g.length<3||!projectId)return;
    setBusy(true); setError('');
    try{ const created=await api.createMission({goal:g,mode,projectId}); setData(created); setGoal(''); setTab('overview'); refreshList(); }
    catch(e){ setError(e.message); } finally{ setBusy(false); }
  }
  async function action(fn){ if(!data?.mission?.id)return; setBusy(true); try{ setData(await fn(data.mission.id)); }catch(e){setError(e.message);}finally{setBusy(false);} }
  async function approval(fn,id){ setBusy(true); try{ setData(await fn(id)); }catch(e){setError(e.message);}finally{setBusy(false);} }
  async function logout(){ try{ await api.logout(); }catch{} setMe(null); setData(null); setMissions([]); setProjectId(null); }

  if(me===undefined) return <div className="app"><div className="entry"><p>Checking session…</p></div></div>;
  if(me===null) return <AuthScreen onAuthed={setMe}/>;

  const mission=data?.mission;
  const pending=data?.approvals?.filter(a=>a.status==='PENDING') || [];
  const active=data?.tasks?.filter(t=>['READY','LEASED','RUNNING','WAITING_APPROVAL'].includes(t.status)) || [];
  const elapsed=mission?duration(mission.started_at,mission.completed_at):0;
  const lastEvent=data?.events?.at(-1)?.id || 0;
  const runtimeLive=health?.status==='LIVE' && health?.database==='LIVE';

  return <div className="app">
    <header className="topbar">
      <div className="brand"><Logo/><span>Agent<b>Swarm</b></span></div>
      <div className="project">Project
        {me.projects?.length>1
          ? <select value={projectId||''} onChange={e=>{setProjectId(e.target.value);setData(null);}} className="projectSelect">
              {me.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          : <b>{me.projects?.[0]?.name || 'AgentSwarm.in'}</b>}
      </div>
      <div className="topSpacer"/>
      <Chip color={runtimeLive?'#4ade80':'#f87171'}>● API {health?.status||'CHECKING'}</Chip>
      <Chip color={health?.qwen==='CONFIGURED'?'#4ade80':'#fbbf24'}>QWEN {health?.qwen||'UNKNOWN'}</Chip>
      <button className={`approvalTop ${pending.length?'hot':''}`} onClick={()=>setInspector('approvals')}>Approvals {pending.length}</button>
      <span className="userChip">{me.user.email}</span>
      <button className="logoutBtn" onClick={logout}>Sign out</button>
    </header>

    <div className="shell">
      <aside className="nav">
        <div className="navSection">COMMAND</div>
        {missions.slice(0,12).map(m=><button key={m.id} className={`missionNav ${m.id===mission?.id?'on':''}`} onClick={()=>refreshMission(m.id)}>
          <span className="statusDot" style={{background:STATUS_COLOR[m.status]||'#71717a'}}/>
          <span><b>{m.goal.slice(0,28)}</b><small>{m.status} · {m.progress}%</small></span>
        </button>)}
        {!missions.length&&<div className="navEmpty">No missions yet.</div>}
        <div className="navSection">SYSTEM</div>
        <div className="systemRow"><span>Postgres</span><Chip color={health?.database==='LIVE'?'#4ade80':'#f87171'}>{health?.database||'UNKNOWN'}</Chip></div>
        <div className="systemRow"><span>Model Router</span><Chip color={health?.qwen==='CONFIGURED'?'#4ade80':'#fbbf24'}>{health?.qwen||'UNKNOWN'}</Chip></div>
      </aside>

      <main className="center">
        {!mission ? <Entry goal={goal} setGoal={setGoal} mode={mode} setMode={setMode} busy={busy} createMission={createMission} health={health}/> : <>
          <section className="missionHead">
            <div><div className="eyebrow">MISSION · {mission.id.slice(0,8)}</div><h1>{mission.goal}</h1><div className="missionMeta">started {fmtTime(mission.started_at)} · provider {mission.provider_status}</div></div>
            <Chip color={STATUS_COLOR[mission.status]||'#8a8a94'}>{mission.status}</Chip>
          </section>
          <section className="stats">
            <Stat label="ELAPSED" value={fmtDuration(elapsed)}/><Stat label="PROGRESS" value={`${mission.progress}%`} bar={mission.progress}/><Stat label="ACTIVE" value={String(active.length)}/><Stat label="TASKS" value={`${data.tasks.filter(t=>t.status==='SUCCEEDED').length}/${data.tasks.length}`}/><Stat label="EVENT" value={`#${lastEvent}`}/>
          </section>
          <div className="actions">
            {['RUNNING','WAITING_APPROVAL','PLANNING','QUEUED'].includes(mission.status)&&<button onClick={()=>action(api.pause)} disabled={busy}>Pause</button>}
            {mission.status==='PAUSED'&&<button onClick={()=>action(api.resume)} disabled={busy}>Resume</button>}
            {!['COMPLETED','FAILED','CANCELLED'].includes(mission.status)&&<button className="danger" onClick={()=>action(api.cancel)} disabled={busy}>Cancel</button>}
            <button onClick={()=>{setData(null);setGoal('');}}>New Mission</button>
          </div>
          <div className="tabs">{['overview','tasks','activity','artifacts','verification'].map(t=><button key={t} className={tab===t?'on':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
          <div className="tabBody">
            {tab==='overview'&&<TaskGraph tasks={data.tasks}/>}
            {tab==='tasks'&&<TaskTable tasks={data.tasks}/>}
            {tab==='activity'&&<Trace events={data.events}/>}
            {tab==='artifacts'&&<Artifacts artifacts={data.artifacts}/>}
            {tab==='verification'&&<Verification rows={data.verification}/>}
          </div>
        </>}
        {error&&<div className="errorBar">{error}</div>}
      </main>

      <aside className="inspector">
        <div className="insTabs">{['agents','trace','approvals','usage'].map(t=><button key={t} className={inspector===t?'on':''} onClick={()=>setInspector(t)}>{t}{t==='approvals'&&pending.length>0?<b>{pending.length}</b>:null}</button>)}</div>
        {!data?<div className="empty">Start or select a mission.</div>:<>
          {inspector==='agents'&&<Agents tasks={data.tasks}/>}
          {inspector==='trace'&&<Trace events={data.events.slice(-80)}/>}
          {inspector==='approvals'&&<Approvals rows={data.approvals} onApprove={id=>approval(api.approve,id)} onReject={id=>approval(api.reject,id)} busy={busy}/>}
          {inspector==='usage'&&<Usage usage={data.usage}/>}
        </>}
      </aside>
    </div>
    <footer className="runtimeBar"><span className="statusDot" style={{background:runtimeLive?'#4ade80':'#f87171'}}/> LIVE DATA API · no simulated mission progress · SSE event stream · PostgreSQL durable state</footer>
  </div>
}

function AuthScreen({onAuthed}){
  const [mode,setMode]=useState('login');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [name,setName]=useState('');
  const [orgName,setOrgName]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function submit(e){
    e.preventDefault(); setBusy(true); setError('');
    try{
      const result = mode==='login'
        ? await api.login({email,password})
        : await api.signup({email,password,name:name||undefined,organizationName:orgName||undefined});
      onAuthed(result);
    }catch(err){ setError(err.message); } finally{ setBusy(false); }
  }

  return <div className="app"><div className="entry">
    <div className="entryKicker">AGENTSWARM CONTROL PLANE</div>
    <h1>{mode==='login'?'Sign in':'Create your workspace'}</h1>
    <p>One goal. A governed swarm. Verified work.</p>
    <form className="composer authForm" onSubmit={submit}>
      <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Email" required autoComplete="username"/>
      <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password (min 8 characters)" required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'}/>
      {mode==='signup' && <>
        <input value={name} onChange={e=>setName(e.target.value)} type="text" placeholder="Name (optional)"/>
        <input value={orgName} onChange={e=>setOrgName(e.target.value)} type="text" placeholder="Organization name (optional)"/>
      </>}
      <div className="composerFoot"><button className="start" type="submit" disabled={busy}>{mode==='login'?'Sign in':'Create account'} →</button></div>
    </form>
    {error&&<div className="errorBar authErrorBar">{error}</div>}
    <div className="quick">
      <button type="button" onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');}}>{mode==='login'?'Need an account? Sign up':'Already have an account? Sign in'}</button>
    </div>
  </div></div>;
}

function Entry({goal,setGoal,mode,setMode,busy,createMission,health}){
  return <div className="entry"><div className="entryKicker">AGENTSWARM CONTROL PLANE</div><h1>What shall we build today?</h1><p>One goal. A governed swarm. Verified work.</p>
    <div className="composer"><textarea value={goal} onChange={e=>setGoal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();createMission();}}} placeholder="Describe a mission…"/><div className="composerFoot"><div className="modes">{MODES.map(m=><button className={mode===m?'on':''} key={m} onClick={()=>setMode(m)}>{m}</button>)}</div><button className="start" onClick={()=>createMission()} disabled={busy||goal.trim().length<3}>Start Mission →</button></div></div>
    <div className="quick">{['Research the AgentSwarm repository and produce an architecture report','Design a production API for multi-agent mission orchestration','Create a security review checklist for an AI worker runtime'].map(q=><button key={q} onClick={()=>createMission(q)}>{q}</button>)}</div>
    <div className="truth"><Chip color={health?.status==='LIVE'?'#4ade80':'#f87171'}>API {health?.status||'UNKNOWN'}</Chip><Chip color={health?.qwen==='CONFIGURED'?'#4ade80':'#fbbf24'}>MODEL {health?.qwen||'UNKNOWN'}</Chip><span>Mission execution starts only when a real model provider is configured.</span></div>
  </div>
}
function Stat({label,value,bar}){return <div className="stat"><span>{label}</span><b>{value}</b>{bar!==undefined&&<div className="bar"><i style={{width:`${bar}%`}}/></div>}</div>}
function TaskGraph({tasks}){ if(!tasks.length)return <div className="empty">Planning has not produced tasks yet.</div>; return <div className="graph">{tasks.map((t,i)=><React.Fragment key={t.id}><div className="taskNode" style={{borderColor:`${STATUS_COLOR[t.status]||'#71717a'}88`}}><div><span className="statusDot" style={{background:STATUS_COLOR[t.status]||'#71717a'}}/><b>{t.title}</b></div><small>{t.agent} · {t.task_key}</small><div className="bar"><i style={{width:`${t.progress}%`,background:STATUS_COLOR[t.status]||'#71717a'}}/></div><div className="nodeFoot"><Chip color={STATUS_COLOR[t.status]||'#71717a'}>{t.status}</Chip><span>{Array.isArray(t.dependencies)?t.dependencies.length:0} deps</span></div></div>{i<tasks.length-1&&<div className="arrow">→</div>}</React.Fragment>)}</div>}
function TaskTable({tasks}){return <div className="table">{tasks.map(t=><div className="row" key={t.id}><span className="statusDot" style={{background:STATUS_COLOR[t.status]||'#71717a'}}/><div><b>{t.title}</b><small>{t.task_key} · {t.agent} · attempts {t.attempt_count}</small></div><span>{t.model||'model unknown'}</span><Chip color={STATUS_COLOR[t.status]||'#71717a'}>{t.status}</Chip></div>)}</div>}
function Trace({events}){return <div className="trace">{[...events].reverse().map(e=><div className="traceRow" key={e.id}><code>#{e.id}</code><time>{fmtTime(e.created_at)}</time><span style={{color:AGENT_COLOR[e.actor]||'#a1a1aa'}}>{e.actor}</span><b>{e.type}</b><Chip color="#4ade80">LIVE</Chip></div>)}</div>}
function Artifacts({artifacts}){if(!artifacts.length)return <div className="empty">No artifacts yet.</div>;return <div className="artifacts">{artifacts.map(a=><details key={a.id}><summary><b>{a.name}</b><span>{a.kind}</span><time>{fmtTime(a.created_at)}</time></summary><pre>{a.content}</pre></details>)}</div>}
function Verification({rows}){if(!rows.length)return <div className="empty">Verification has not run yet.</div>;return <div className="verification">{rows.map(v=><div className="verifyCard" key={v.id}><Chip color={v.status==='PASSED'?'#4ade80':'#f87171'}>{v.status}</Chip><b>{v.summary}</b><small>{fmtTime(v.created_at)}</small></div>)}</div>}
function Agents({tasks}){const groups=useMemo(()=>{const m=new Map();for(const t of tasks){if(!m.has(t.agent))m.set(t.agent,[]);m.get(t.agent).push(t);}return [...m.entries()]},[tasks]); if(!groups.length)return <div className="empty">Agents appear after planning.</div>; return <div className="agents">{groups.map(([agent,rows])=>{const current=rows.find(r=>['READY','LEASED','RUNNING','WAITING_APPROVAL'].includes(r.status))||rows.at(-1);return <div className="agentCard" key={agent}><span className="agentIcon" style={{borderColor:AGENT_COLOR[agent],color:AGENT_COLOR[agent]}}>⬡</span><div><b>{agent}</b><small>{current?.title}</small><code>{current?.model||'provider pending'}</code></div><Chip color={STATUS_COLOR[current?.status]||'#71717a'}>{current?.status||'IDLE'}</Chip></div>})}</div>}
function Approvals({rows,onApprove,onReject,busy}){if(!rows.length)return <div className="empty">No approval requests. Consequential tasks block here before execution.</div>;return <div className="approvals">{rows.map(a=><div className="approvalCard" key={a.id}><div><Chip color={a.risk==='HIGH'||a.risk==='CRITICAL'?'#f87171':'#fbbf24'}>{a.risk}</Chip><Chip color={a.status==='APPROVED'?'#4ade80':a.status==='REJECTED'?'#f87171':'#a78bfa'}>{a.status}</Chip></div><h3>{a.title}</h3><p>{a.description}</p>{a.status==='PENDING'&&<div className="approveBtns"><button onClick={()=>onReject(a.id)} disabled={busy}>Reject</button><button className="yes" onClick={()=>onApprove(a.id)} disabled={busy}>Approve</button></div>}</div>)}</div>}
function Usage({usage}){return <div className="usage"><h3>Provider usage</h3><div><span>Input tokens</span><b>{usage.inputUnknown?'PARTIAL / UNKNOWN':usage.inputTokens.toLocaleString()}</b></div><div><span>Output tokens</span><b>{usage.outputUnknown?'PARTIAL / UNKNOWN':usage.outputTokens.toLocaleString()}</b></div><div><span>Actual cost</span><b>UNKNOWN</b></div><p>Token counts are shown only when returned by the live provider. Cost is not guessed.</p></div>}
