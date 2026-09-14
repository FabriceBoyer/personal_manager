import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, Command, LayoutDashboard, Link2, ListTodo, MapPin, Plus, Search, Sparkles, X} from 'lucide-react';
import './styles.css';

const kindMeta = {
  action: {label:'Action', icon:ListTodo, color:'coral'},
  event: {label:'Rendez-vous', icon:CalendarDays, color:'blue'},
  journal: {label:'Journal', icon:CheckCircle2, color:'green'},
  fact: {label:'Connaissance', icon:BookOpen, color:'purple'}
};
const nav = [
  ['overview','Aujourd’hui',LayoutDashboard], ['actions','Actions',ListTodo], ['calendar','Calendrier',CalendarDays], ['journal','Journal',CheckCircle2], ['knowledge','Connaissances',BookOpen]
];
const pad=n=>String(n).padStart(2,'0');
const localISO=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDate=value=>value ? new Date(value) : null;
const dateLabel=value=>parseDate(value)?.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) || 'Non daté';
const timeLabel=value=>parseDate(value)?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) || '';

function App(){
  const [records,setRecords]=useState([]), [view,setView]=useState('overview'), [query,setQuery]=useState(''), [modal,setModal]=useState(false), [loading,setLoading]=useState(true);
  const load=()=>fetch('/api/records').then(r=>r.json()).then(setRecords).finally(()=>setLoading(false));
  useEffect(load,[]);
  const filtered=useMemo(()=>records.filter(r=>(r.title+' '+r.description+' '+r.tags?.join(' ')+' '+r.id).toLowerCase().includes(query.toLowerCase())),[records,query]);
  const title={overview:'Aujourd’hui',actions:'Toutes les actions',calendar:'Calendrier',journal:'Journal des actions',knowledge:'Base de connaissances'}[view];
  const subtitle={overview:'Une vue claire de ce qui compte maintenant.',actions:'Planifiez, priorisez, accomplissez.',calendar:'Tout ce qui est daté, au même endroit.',journal:'La mémoire de ce que vous avez réalisé.',knowledge:'Personnes, lieux, activités et faits reliés.'}[view];
  const markDone=async r=>{await fetch('/api/records/'+r.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:r.status==='done'?'active':'done'})}); load()};
  return <div className="app">
    <aside>
      <div className="brand"><div className="brandMark"><Sparkles size={19}/></div><div><b>Mémoire</b><span>personal OS</span></div></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)}><Icon size={19}/><span>{label}</span>{id==='actions'&&<em>{records.filter(r=>r.kind==='action'&&r.status!=='done').length}</em>}</button>)}</nav>
      <div className="sideFoot"><div className="sync"><i></i><span><b>Synchronisé</b><small>À l’instant</small></span></div><button className="profile"><span>FB</span><div><b>Fabrice</b><small>Espace personnel</small></div></button></div>
    </aside>
    <main>
      <header><div className="search"><Search size={18}/><input placeholder="Rechercher partout…" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="add" onClick={()=>setModal(true)}><Plus size={18}/>Ajouter</button></header>
      <section className="content">
        <div className="pageTitle"><div><span className="eyebrow">ESPACE PERSONNEL</span><h1>{title}</h1><p>{subtitle}</p></div><div className="datePill"><CalendarDays size={17}/>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</div></div>
        {loading?<Loading/>:view==='overview'?<Overview records={filtered} markDone={markDone}/>:view==='calendar'?<CalendarView records={filtered}/>:<RecordList view={view} records={filtered} markDone={markDone}/>} 
      </section>
    </main>
    {modal&&<CreateModal records={records} close={()=>setModal(false)} created={()=>{setModal(false);load()}}/>}
  </div>
}

function Overview({records,markDone}){
  const today=localISO(new Date()), tomorrow=localISO(new Date(Date.now()+86400000));
  const active=records.filter(r=>r.kind==='action'&&r.status!=='done');
  const upcoming=records.filter(r=>r.date&&r.date.slice(0,10)>=today&&r.status!=='done').slice(0,5);
  const recent=records.filter(r=>r.kind==='journal'||r.status==='done').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,4);
  return <>
    <div className="stats">
      <Stat icon={ListTodo} value={active.length} label="actions ouvertes" tone="coral" note={`${active.filter(r=>r.date?.startsWith(today)).length} pour aujourd’hui`}/>
      <Stat icon={CalendarDays} value={records.filter(r=>r.date?.startsWith(today)).length} label="événements aujourd’hui" tone="blue" note={`${records.filter(r=>r.date?.startsWith(tomorrow)).length} demain`}/>
      <Stat icon={BookOpen} value={records.filter(r=>r.kind==='fact').length} label="faits enregistrés" tone="purple" note="base reliée"/>
    </div>
    <div className="grid2">
      <Card title="À venir" icon={Clock3} action="Voir le calendrier">
        {upcoming.length?upcoming.map(r=><AgendaRow key={r.id} r={r} markDone={markDone}/>):<Empty text="Rien de planifié"/>}
      </Card>
      <Card title="Activité récente" icon={CheckCircle2} action="Ouvrir le journal">
        {recent.length?recent.map(r=><RecentRow key={r.id} r={r}/>):<Empty text="Aucune activité"/>}
      </Card>
    </div>
    <Card title="Votre mémoire connectée" icon={Link2}><KnowledgeStrip records={records}/></Card>
  </>
}
function Stat({icon:Icon,value,label,tone,note}){return <div className="stat"><div className={'iconBox '+tone}><Icon size={20}/></div><div><strong>{value}</strong><span>{label}</span><small>{note}</small></div></div>}
function Card({title,icon:Icon,action,children}){return <article className="card"><div className="cardHead"><h2><Icon size={18}/>{title}</h2>{action&&<span>{action}<ChevronRight size={15}/></span>}</div>{children}</article>}
function AgendaRow({r,markDone}){const meta=kindMeta[r.kind];return <div className="agendaRow"><button className={'check '+(r.status==='done'?'checked':'')} onClick={()=>r.kind==='action'&&markDone(r)}>{r.status==='done'?<CheckCircle2 size={20}/>:<Circle size={20}/>}</button><div className="agendaText"><b>{r.title}</b><small><span className={'dot '+meta.color}></span>{meta.label} · {dateLabel(r.date)} {timeLabel(r.date)}</small></div><code>{r.id}</code></div>}
function RecentRow({r}){return <div className="recentRow"><span className="timelineDot"><CheckCircle2 size={15}/></span><div><b>{r.title}</b><p>{r.description}</p><small>{dateLabel(r.date)} · <code>{r.id}</code></small></div></div>}
function KnowledgeStrip({records}){const facts=records.filter(r=>r.kind==='fact'); return <div className="knowledgeStrip">{facts.slice(0,4).map(r=><div key={r.id} className="factMini"><span className="avatar">{r.tags?.includes('lieu')?<MapPin size={19}/>:r.title.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><div><b>{r.title}</b><small>{r.predicate} · {r.value}</small></div><ChevronRight size={17}/></div>)}</div>}

function RecordList({view,records,markDone}){
 const kinds={actions:['action','event'],journal:['journal'],knowledge:['fact']}[view]; const list=records.filter(r=>kinds.includes(r.kind));
 return <div className="listPage"><div className="listTools"><span>{list.length} élément{list.length!==1?'s':''}</span><span>Trier par date</span></div><div className="recordGrid">{list.map(r=><article className="recordCard" key={r.id}><div className="recordTop"><span className={'kindBadge '+kindMeta[r.kind].color}>{kindMeta[r.kind].label}</span><code>{r.id}</code></div><h3>{r.title}</h3><p>{r.kind==='fact'?`${r.subject} — ${r.predicate} : ${r.value}`:r.description||'Aucune note'}</p><div className="tagLine">{r.tags?.map(t=><span key={t}>#{t}</span>)}</div><footer>{r.date?<span><CalendarDays size={15}/>{dateLabel(r.date)} {timeLabel(r.date)}</span>:<span><Link2 size={15}/>{r.relatedIds?.length||0} liens</span>}{r.kind==='action'&&<button onClick={()=>markDone(r)}>{r.status==='done'?'Rouvrir':'Terminer'}</button>}</footer></article>)}</div>{!list.length&&<Empty text="Aucun résultat"/>}</div>
}

function CalendarView({records}){
 const [cursor,setCursor]=useState(new Date()); const year=cursor.getFullYear(), month=cursor.getMonth();
 const first=new Date(year,month,1), start=(first.getDay()+6)%7, days=new Date(year,month+1,0).getDate();
 const cells=[...Array(start).fill(null),...Array.from({length:days},(_,i)=>i+1)]; while(cells.length%7)cells.push(null);
 const events=records.filter(r=>r.date);
 return <article className="calendarCard"><div className="calHead"><h2>{cursor.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</h2><div><button onClick={()=>setCursor(new Date(year,month-1,1))}><ChevronLeft/></button><button onClick={()=>setCursor(new Date())}>Aujourd’hui</button><button onClick={()=>setCursor(new Date(year,month+1,1))}><ChevronRight/></button></div></div><div className="weekdays">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(x=><b key={x}>{x}</b>)}</div><div className="monthGrid">{cells.map((day,i)=>{const ds=day?`${year}-${pad(month+1)}-${pad(day)}`:'';const dayEvents=events.filter(r=>r.date.startsWith(ds));const isToday=ds===localISO(new Date());return <div className={'day '+(!day?'blank':'')} key={i}>{day&&<><span className={isToday?'today':''}>{day}</span>{dayEvents.slice(0,3).map(r=><div className={'calEvent '+kindMeta[r.kind].color} key={r.id}><b>{timeLabel(r.date)}</b> {r.title}</div>)}{dayEvents.length>3&&<small>+{dayEvents.length-3} autre</small>}</>}</div>})}</div></article>
}

function CreateModal({records,close,created}){
 const [kind,setKind]=useState('action'),[form,setForm]=useState({id:'',title:'',description:'',date:'',subject:'',predicate:'',value:'',tags:'',relatedIds:[]}),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const change=e=>setForm({...form,[e.target.name]:e.target.value});
 const submit=async e=>{e.preventDefault();setSaving(true);setError('');const payload={...form,kind,status:kind==='journal'?'done':kind==='event'?'scheduled':kind==='fact'?'known':'active',tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean),relatedIds:form.relatedIds||[]};const res=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();setSaving(false);if(!res.ok){setError(data.error);return}created()};
 return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><form className="modal" onSubmit={submit}><div className="modalHead"><div><span className="eyebrow">NOUVEL OBJET UNIQUE</span><h2>Ajouter à votre mémoire</h2></div><button type="button" onClick={close}><X/></button></div><div className="kindPicker">{Object.entries(kindMeta).map(([id,m])=>{const Icon=m.icon;return <button type="button" className={kind===id?'selected '+m.color:''} key={id} onClick={()=>setKind(id)}><Icon size={18}/>{m.label}</button>})}</div><label>Identifiant unique <small>obligatoire, non modifiable</small><input name="id" placeholder={kind==='fact'?'PER-JEAN-DUPONT':'ACT-2026-002'} value={form.id} onChange={change} required pattern="[A-Za-z][A-Za-z0-9]{1,7}(-[A-Za-z0-9]{2,12}){1,3}"/><em>Format : TYPE-IDENTIFIANT</em></label><label>Titre<input name="title" placeholder="Un titre court et précis" value={form.title} onChange={change} required/></label>{kind==='fact'?<div className="factFields"><label>Sujet<input name="subject" placeholder="Marie Dupont" value={form.subject} onChange={change}/></label><label>Relation<input name="predicate" placeholder="habite à" value={form.predicate} onChange={change}/></label><label>Valeur<input name="value" placeholder="Lyon" value={form.value} onChange={change}/></label></div>:<><label>Notes<textarea name="description" placeholder="Contexte, commentaire, résultat…" value={form.description} onChange={change}/></label><label>Date et heure<input type="datetime-local" name="date" value={form.date} onChange={change}/></label></>}<label>Tags <small>séparés par des virgules</small><input name="tags" placeholder="famille, santé, projet" value={form.tags} onChange={change}/></label><label>Relier à un objet<select multiple value={form.relatedIds} onChange={e=>setForm({...form,relatedIds:[...e.target.selectedOptions].map(o=>o.value)})}>{records.map(r=><option value={r.id} key={r.id}>{r.id} — {r.title}</option>)}</select></label>{error&&<div className="error">{error}</div>}<div className="modalActions"><button type="button" onClick={close}>Annuler</button><button className="primary" disabled={saving}>{saving?'Enregistrement…':'Créer l’objet'}</button></div></form></div>
}
function Empty({text}){return <div className="empty"><Command size={22}/><span>{text}</span></div>}; function Loading(){return <div className="loading"><i></i><span>Chargement de votre espace…</span></div>}
createRoot(document.getElementById('root')).render(<App/>);
