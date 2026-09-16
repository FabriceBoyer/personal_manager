import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, Command, Database, Globe2, HelpCircle, LayoutDashboard, Link2, ListTodo, MapPin, MoonStar, Plus, Search, ShieldCheck, Sparkles, Sun, WandSparkles, X, Zap} from 'lucide-react';
import {supabase} from './supabase';
import {createRecord, importRecords, listRecords, resetRecords, updateRecord} from './records';
import {sampleRecords} from './sampleData';
import './styles.css';
import './theme.css';
import './auth.css';
import './mobile.css';

const kindMeta = {
  action: {label:'Action', icon:ListTodo, color:'coral'},
  event: {label:'Rendez-vous', icon:CalendarDays, color:'blue'},
  journal: {label:'Journal', icon:CheckCircle2, color:'green'},
  fact: {label:'Connaissance', icon:BookOpen, color:'purple'}
};
const nav = [['overview','today',LayoutDashboard],['actions','actions',ListTodo],['calendar','calendar',CalendarDays],['journal','journal',CheckCircle2],['knowledge','knowledge',BookOpen],['help','help',HelpCircle]];
const messages={
 fr:{today:"Aujourd’hui",actions:'Actions',calendar:'Calendrier',journal:'Journal',knowledge:'Connaissances',help:'Aide',search:'Rechercher partout…',add:'Ajouter',workspace:'ESPACE PERSONNEL',sync:'Synchronisé',now:"À l’instant",personal:'Espace personnel',
 overviewSub:'Une vue claire de ce qui compte maintenant.',actionsSub:'Planifiez, priorisez, accomplissez.',calendarSub:'Tout ce qui est daté, au même endroit.',journalSub:'La mémoire de ce que vous avez réalisé.',knowledgeSub:'Personnes, lieux, activités et faits reliés.',helpSub:'Tout ce qu’il faut pour prendre en main votre mémoire.',
 openActions:'actions ouvertes',todayNote:"pour aujourd’hui",todayEvents:"événements aujourd’hui",tomorrow:'demain',facts:'faits enregistrés',linked:'base reliée',upcoming:'À venir',recent:'Activité récente',connected:'Votre mémoire connectée',viewCalendar:'Voir le calendrier',openJournal:'Ouvrir le journal',autoTheme:'Thème automatique'},
 en:{today:'Today',actions:'Actions',calendar:'Calendar',journal:'Journal',knowledge:'Knowledge',help:'Help',search:'Search everything…',add:'Add',workspace:'PERSONAL SPACE',sync:'Synced',now:'Just now',personal:'Personal space',
 overviewSub:'A clear view of what matters now.',actionsSub:'Plan, prioritize, accomplish.',calendarSub:'Everything dated, in one place.',journalSub:'A memory of everything you achieved.',knowledgeSub:'Connected people, places, activities and facts.',helpSub:'Everything you need to master your personal memory.',
 openActions:'open actions',todayNote:'due today',todayEvents:'events today',tomorrow:'tomorrow',facts:'saved facts',linked:'connected base',upcoming:'Coming up',recent:'Recent activity',connected:'Your connected memory',viewCalendar:'View calendar',openJournal:'Open journal',autoTheme:'Automatic theme'}
};
const tr=(locale,key)=>messages[locale][key]||key;
const pad=n=>String(n).padStart(2,'0');
const localISO=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDate=value=>value ? new Date(value) : null;
const dateLabel=(value,locale='fr')=>parseDate(value)?.toLocaleDateString(locale==='fr'?'fr-FR':'en-GB',{weekday:'short',day:'numeric',month:'short'}) || (locale==='fr'?'Non daté':'Undated');
const timeLabel=value=>parseDate(value)?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) || '';

function App(){
  const [records,setRecords]=useState([]), [view,setView]=useState('overview'), [query,setQuery]=useState(''), [modal,setModal]=useState(false), [selected,setSelected]=useState(null), [loading,setLoading]=useState(true);
  const [session,setSession]=useState(undefined), [error,setError]=useState('');
  const [locale,setLocale]=useState(()=>navigator.language?.toLowerCase().startsWith('fr')?'fr':'en');
  const [theme,setTheme]=useState(()=>localStorage.getItem('memoire-theme')||'auto');
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('memoire-theme',theme)},[theme]);
  const load=async({silent=false}={})=>{if(!silent)setLoading(true);try{setRecords(await listRecords());setError('')}catch(e){setError(e.message)}finally{if(!silent)setLoading(false)}};
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{if(session){load()}else{setRecords([]);setLoading(false)}},[session?.user.id]);
  const filtered=useMemo(()=>records.filter(r=>(r.title+' '+r.description+' '+r.tags?.join(' ')+' '+r.id).toLowerCase().includes(query.toLowerCase())),[records,query]);
  const title={overview:tr(locale,'today'),actions:locale==='fr'?'Toutes les actions':'All actions',calendar:tr(locale,'calendar'),journal:locale==='fr'?'Journal des actions':'Action journal',knowledge:locale==='fr'?'Base de connaissances':'Knowledge base',help:tr(locale,'help')}[view];
  const subtitle={overview:tr(locale,'overviewSub'),actions:tr(locale,'actionsSub'),calendar:tr(locale,'calendarSub'),journal:tr(locale,'journalSub'),knowledge:tr(locale,'knowledgeSub'),help:tr(locale,'helpSub')}[view];
  const markDone=async r=>{try{await updateRecord(r.id,{status:r.status==='done'?'active':'done'});await load()}catch(e){setError(e.message)}};
  if(session===undefined) return <Loading/>;
  if(!session) return <AuthScreen locale={locale} setLocale={setLocale}/>;
  return <div className="app">
    <aside>
      <div className="brand"><div className="brandMark"><Sparkles size={19}/></div><div><b>Mémoire</b><span>personal OS</span></div></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} aria-label={tr(locale,label)} className={view===id?'active':''} onClick={()=>setView(id)}><Icon size={19}/><span>{tr(locale,label)}</span>{id==='actions'&&<em>{records.filter(r=>r.kind==='action'&&r.status!=='done').length}</em>}</button>)}</nav>
      <div className="sideFoot"><div className="sync"><i></i><span><b>{error?(locale==='fr'?'Erreur de synchronisation':'Sync error'):tr(locale,'sync')}</b><small>{error||tr(locale,'now')}</small></span></div><button className="profile" onClick={()=>supabase.auth.signOut()} title={locale==='fr'?'Se déconnecter':'Sign out'}><span>{session.user.email?.slice(0,2).toUpperCase()}</span><div><b>{session.user.email}</b><small>{locale==='fr'?'Se déconnecter':'Sign out'}</small></div></button></div>
    </aside>
    <main>
      <header><div className="search"><Search size={18}/><input aria-label={tr(locale,'search')} placeholder={tr(locale,'search')} value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><div className="headerActions"><button className="roundAction" aria-label={tr(locale,'autoTheme')} title={tr(locale,'autoTheme')} onClick={()=>setTheme(theme==='auto'?'light':theme==='light'?'dark':'auto')}>{theme==='light'?<Sun/>:theme==='dark'?<MoonStar/>:<WandSparkles/>}</button><button className="roundAction language" aria-label={locale==='fr'?'Switch to English':'Passer en français'} onClick={()=>setLocale(locale==='fr'?'en':'fr')}><Globe2/><span>{locale.toUpperCase()}</span></button><button className="add" onClick={()=>setModal(true)}><Plus size={18}/>{tr(locale,'add')}</button></div></header>
      <section className="content">
        <div className="pageTitle"><div><span className="eyebrow">{tr(locale,'workspace')}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="datePill"><CalendarDays size={17}/>{new Date().toLocaleDateString(locale==='fr'?'fr-FR':'en-GB',{weekday:'long',day:'numeric',month:'long'})}</div></div>
        {error&&<div className="error" role="alert">{error} <button onClick={load}>{locale==='fr'?'Réessayer':'Retry'}</button></div>}
        {loading?<Loading/>:view==='overview'?<Overview records={filtered} markDone={markDone} locale={locale} onOpen={setSelected} setView={setView}/>:view==='calendar'?<CalendarView records={filtered} locale={locale} onOpen={setSelected}/>:view==='help'?<HelpView locale={locale} setView={setView} reload={()=>load({silent:true})} onReset={async()=>{await resetRecords();setSelected(null);setRecords([]);await load({silent:true})}}/>:<RecordList view={view} records={filtered} markDone={markDone} locale={locale} onOpen={setSelected}/>}
      </section>
    </main>
    {modal&&<CreateModal records={records} locale={locale} close={()=>setModal(false)} created={()=>{setModal(false);load()}}/>}
    {selected&&<DetailModal record={selected} records={records} locale={locale} close={()=>setSelected(null)}/>}
  </div>
}

function AuthScreen({locale,setLocale}){
  const fr=locale==='fr';
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[signUp,setSignUp]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    const {data,error:authError}=signUp?await supabase.auth.signUp({email,password,options:{emailRedirectTo:new URL(import.meta.env.BASE_URL,window.location.origin).href}}):await supabase.auth.signInWithPassword({email,password});
    setBusy(false);
    if(authError){setError(authError.message);return}
    if(signUp&&!data.session) setNotice(fr?'Vérifiez votre courriel pour confirmer le compte.':'Check your email to confirm your account.');
  };
  return <div className="authPage"><form className="authCard" onSubmit={submit}><div className="brandMark"><Sparkles size={20}/></div><h1>Mémoire</h1><p>{fr?'Connectez-vous pour retrouver vos données personnelles.':'Sign in to access your personal data.'}</p><label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>{fr?'Mot de passe':'Password'}<input type="password" autoComplete={signUp?'new-password':'current-password'} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="authNotice" role="status">{notice}</div>}<button className="primary" disabled={busy}>{busy?'…':signUp?(fr?'Créer un compte':'Create account'):(fr?'Se connecter':'Sign in')}</button><button type="button" className="authSwitch" onClick={()=>{setSignUp(!signUp);setError('');setNotice('')}}>{signUp?(fr?'Déjà un compte ? Se connecter':'Already have an account? Sign in'):(fr?'Créer un compte':'Create an account')}</button><button type="button" className="authSwitch" onClick={()=>setLocale(fr?'en':'fr')}>{fr?'English':'Français'}</button></form></div>;
}

function Overview({records,markDone,locale,onOpen,setView}){
  const today=localISO(new Date()), tomorrow=localISO(new Date(Date.now()+86400000));
  const active=records.filter(r=>r.kind==='action'&&r.status!=='done');
  const upcoming=records.filter(r=>r.date&&r.date.slice(0,10)>=today&&r.status!=='done').slice(0,5);
  const recent=records.filter(r=>r.kind==='journal'||r.status==='done').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,4);
  return <>
    <div className="stats">
      <Stat icon={ListTodo} value={active.length} label={tr(locale,'openActions')} tone="coral" note={`${active.filter(r=>r.date?.startsWith(today)).length} ${tr(locale,'todayNote')}`}/>
      <Stat icon={CalendarDays} value={records.filter(r=>r.date?.startsWith(today)).length} label={tr(locale,'todayEvents')} tone="blue" note={`${records.filter(r=>r.date?.startsWith(tomorrow)).length} ${tr(locale,'tomorrow')}`}/>
      <Stat icon={BookOpen} value={records.filter(r=>r.kind==='fact').length} label={tr(locale,'facts')} tone="purple" note={tr(locale,'linked')}/>
    </div>
    <div className="grid2">
      <Card title={tr(locale,'upcoming')} icon={Clock3} action={tr(locale,'viewCalendar')} onAction={()=>setView('calendar')}>
        {upcoming.length?upcoming.map(r=><AgendaRow key={r.id} r={r} markDone={markDone} locale={locale} onOpen={onOpen}/>):<Empty text={locale==='fr'?"Rien de planifié":"Nothing planned"}/>}
      </Card>
      <Card title={tr(locale,'recent')} icon={CheckCircle2} action={tr(locale,'openJournal')} onAction={()=>setView('journal')}>
        {recent.length?recent.map(r=><RecentRow key={r.id} r={r} locale={locale} onOpen={onOpen}/>):<Empty text={locale==='fr'?"Aucune activité":"No activity"}/>}
      </Card>
    </div>
    <Card title={tr(locale,'connected')} icon={Link2}><KnowledgeStrip records={records} onOpen={onOpen}/></Card>
  </>
}
function Stat({icon:Icon,value,label,tone,note}){return <div className="stat"><div className={'iconBox '+tone}><Icon size={20}/></div><div><strong>{value}</strong><span>{label}</span><small>{note}</small></div></div>}
function Card({title,icon:Icon,action,onAction,children}){return <article className="card"><div className="cardHead"><h2><Icon size={18}/>{title}</h2>{action&&<button className="cardAction" onClick={onAction}>{action}<ChevronRight size={15}/></button>}</div>{children}</article>}
function AgendaRow({r,markDone,locale,onOpen}){const meta=kindMeta[r.kind];const label=locale==='fr'?meta.label:{action:'Action',event:'Appointment',journal:'Journal',fact:'Knowledge'}[r.kind];return <div className="agendaRow entityClick" role="button" tabIndex="0" onClick={()=>onOpen(r)} onKeyDown={e=>e.key==='Enter'&&onOpen(r)}><button className={'check '+(r.status==='done'?'checked':'')} onClick={e=>{e.stopPropagation();r.kind==='action'&&markDone(r)}}>{r.status==='done'?<CheckCircle2 size={20}/>:<Circle size={20}/>}</button><div className="agendaText"><b>{r.title}</b><small><span className={'dot '+meta.color}></span>{label} · {dateLabel(r.date,locale)} {timeLabel(r.date)}</small></div><code>{r.id}</code></div>}
function RecentRow({r,locale,onOpen}){return <div className="recentRow entityClick" role="button" tabIndex="0" onClick={()=>onOpen(r)} onKeyDown={e=>e.key==='Enter'&&onOpen(r)}><span className="timelineDot"><CheckCircle2 size={15}/></span><div><b>{r.title}</b><p>{r.description}</p><small>{dateLabel(r.date,locale)} · <code>{r.id}</code></small></div></div>}
function KnowledgeStrip({records,onOpen}){const facts=records.filter(r=>r.kind==='fact'); return <div className="knowledgeStrip">{facts.slice(0,4).map(r=><div key={r.id} className="factMini entityClick" role="button" tabIndex="0" onClick={()=>onOpen(r)} onKeyDown={e=>e.key==='Enter'&&onOpen(r)}><span className="avatar">{r.tags?.includes('lieu')?<MapPin size={19}/>:r.title.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><div><b>{r.title}</b><small>{r.predicate} · {r.value}</small></div><ChevronRight size={17}/></div>)}</div>}

function RecordList({view,records,markDone,locale,onOpen}){
 const kinds={actions:['action','event'],journal:['journal'],knowledge:['fact']}[view]; const list=records.filter(r=>kinds.includes(r.kind));
 return <div className="listPage"><div className="listTools"><span>{list.length} {locale==='fr'?`élément${list.length!==1?'s':''}`:`item${list.length!==1?'s':''}`}</span><span>{locale==='fr'?'Trier par date':'Sort by date'}</span></div><div className="recordGrid">{list.map(r=><article className="recordCard entityClick" role="button" tabIndex="0" onClick={()=>onOpen(r)} onKeyDown={e=>e.key==='Enter'&&onOpen(r)} key={r.id}><div className="recordTop"><span className={'kindBadge '+kindMeta[r.kind].color}>{locale==='fr'?kindMeta[r.kind].label:{action:'Action',event:'Appointment',journal:'Journal',fact:'Knowledge'}[r.kind]}</span><code>{r.id}</code></div><h3>{r.title}</h3><p>{r.kind==='fact'?`${r.subject} — ${r.predicate} : ${r.value}`:r.description||(locale==='fr'?'Aucune note':'No notes')}</p><div className="tagLine">{r.tags?.map(t=><span key={t}>#{t}</span>)}</div><footer>{r.date?<span><CalendarDays size={15}/>{dateLabel(r.date,locale)} {timeLabel(r.date)}</span>:<span><Link2 size={15}/>{r.relatedIds?.length||0} {locale==='fr'?'liens':'links'}</span>}{r.kind==='action'&&<button onClick={e=>{e.stopPropagation();markDone(r)}}>{r.status==='done'?(locale==='fr'?'Rouvrir':'Reopen'):(locale==='fr'?'Terminer':'Complete')}</button>}</footer></article>)}</div>{!list.length&&<Empty text={locale==='fr'?"Aucun résultat":"No results"}/>}</div>
}

function CalendarView({records,locale,onOpen}){
 const [cursor,setCursor]=useState(new Date()); const year=cursor.getFullYear(), month=cursor.getMonth();
 const first=new Date(year,month,1), start=(first.getDay()+6)%7, days=new Date(year,month+1,0).getDate();
 const cells=[...Array(start).fill(null),...Array.from({length:days},(_,i)=>i+1)]; while(cells.length%7)cells.push(null);
 const events=records.filter(r=>r.date);
 const weekdays=locale==='fr'?['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 return <article className="calendarCard"><div className="calHead"><h2>{cursor.toLocaleDateString(locale==='fr'?'fr-FR':'en-GB',{month:'long',year:'numeric'})}</h2><div><button onClick={()=>setCursor(new Date(year,month-1,1))}><ChevronLeft/></button><button onClick={()=>setCursor(new Date())}>{tr(locale,'today')}</button><button onClick={()=>setCursor(new Date(year,month+1,1))}><ChevronRight/></button></div></div><div className="weekdays">{weekdays.map(x=><b key={x}>{x}</b>)}</div><div className="monthGrid">{cells.map((day,i)=>{const ds=day?`${year}-${pad(month+1)}-${pad(day)}`:'';const dayEvents=events.filter(r=>r.date.startsWith(ds));const isToday=ds===localISO(new Date());return <div className={'day '+(!day?'blank':'')} key={i}>{day&&<><span className={isToday?'today':''}>{day}</span>{dayEvents.slice(0,3).map(r=><button className={'calEvent '+kindMeta[r.kind].color} onClick={()=>onOpen(r)} key={r.id}><b>{timeLabel(r.date)}</b> {r.title}</button>)}{dayEvents.length>3&&<small>+{dayEvents.length-3} {locale==='fr'?'autre':'more'}</small>}</>}</div>})}</div></article>
}

function HelpView({locale,setView,reload,onReset}){
 const fr=locale==='fr';
 const [importMessage,setImportMessage]=useState('');
 const [dataMessage,setDataMessage]=useState(''),[busy,setBusy]=useState(false),[confirmReset,setConfirmReset]=useState(false);
 const handleImport=async e=>{const file=e.target.files?.[0];if(!file)return;try{const count=await importRecords(JSON.parse(await file.text()));await reload();setImportMessage(fr?`${count} objet(s) importé(s).`:`${count} item(s) imported.`)}catch(error){setImportMessage(error.message)}e.target.value=''};
 const loadExamples=async()=>{setBusy(true);setDataMessage('');try{const count=await importRecords(sampleRecords());await reload();setDataMessage(fr?`${count} exemple(s) ajouté(s).`:`${count} sample item(s) added.`)}catch(error){setDataMessage(error.message)}finally{setBusy(false)}};
 const reset=async()=>{setBusy(true);setDataMessage('');try{await onReset();setDataMessage(fr?'Vos données ont été supprimées.':'Your data has been deleted.');setConfirmReset(false)}catch(error){setDataMessage(error.message);setConfirmReset(false)}finally{setBusy(false)}};
 const steps=fr?[['1','Créez un identifiant','Choisissez un identifiant stable et parlant, comme ACT-2026-001 ou PER-MARIE. Il ne pourra pas être réutilisé.'],['2','Reliez vos informations','Associez une action à une personne, un lieu ou un fait existant pour construire votre graphe personnel.'],['3','Laissez les vues travailler','Le calendrier et le journal se construisent automatiquement à partir des dates et statuts.']]:[['1','Create an identifier','Choose a stable, meaningful identifier such as ACT-2026-001 or PER-MARIE. It can never be reused.'],['2','Connect your information','Link an action to an existing person, place or fact to build your personal graph.'],['3','Let the views work','The calendar and journal are automatically generated from dates and statuses.']];
 const cards=fr?[[ListTodo,'Actions & rendez-vous','Planifiez une tâche avec une date estimée ou créez un rendez-vous avec une heure de début et de fin.'],[CheckCircle2,'Journal','Consignez ce qui a été fait, la date, le résultat et vos commentaires.'],[BookOpen,'Connaissances','Mémorisez des faits structurés sous la forme sujet — relation — valeur.'],[Link2,'Liens intelligents','Sélectionnez un ou plusieurs objets existants au moment de la saisie.']]:[[ListTodo,'Actions & appointments','Plan a task with an estimated date or create an appointment with start and end times.'],[CheckCircle2,'Journal','Record what was done, when, the outcome and your comments.'],[BookOpen,'Knowledge','Save structured facts as subject — relationship — value.'],[Link2,'Smart links','Select one or more existing objects while creating a record.']];
 return <div className="helpPage"><section className="helpHero"><div><span className="heroIcon"><Sparkles/></span><h2>{fr?'Votre mémoire, enfin organisée.':'Your memory, finally organized.'}</h2><p>{fr?'Un seul endroit pour décider, agir et vous souvenir — sans recopier la même information.':'One place to decide, act and remember — without copying the same information twice.'}</p><button onClick={()=>setView('overview')}>{fr?'Explorer mon espace':'Explore my space'}<ChevronRight/></button></div><div className="orbit" aria-hidden="true"><span><Database/></span><span><CalendarDays/></span><span><BookOpen/></span><i></i></div></section>
 <section className="helpSection"><span className="eyebrow">{fr?'DÉMARRAGE RAPIDE':'QUICK START'}</span><h2>{fr?'Trois principes simples':'Three simple principles'}</h2><div className="steps">{steps.map(([n,t,d])=><div className="step" key={n}><strong>{n}</strong><div><h3>{t}</h3><p>{d}</p></div></div>)}</div></section>
 <section className="helpSection"><span className="eyebrow">{fr?'FONCTIONNALITÉS':'FEATURES'}</span><h2>{fr?'Un système, quatre usages':'One system, four uses'}</h2><div className="helpCards">{cards.map(([Icon,t,d])=><div className="helpCard" key={t}><span><Icon/></span><h3>{t}</h3><p>{d}</p></div>)}</div></section>
 <section className="integrity"><ShieldCheck/><div><h3>{fr?'Vos données restent cohérentes':'Your data stays consistent'}</h3><p>{fr?'Supabase protège vos données par compte et refuse les identifiants dupliqués et les liens vers des objets inexistants.':'Supabase protects your data by account and rejects duplicate IDs and links to missing records.'}</p></div><Zap/></section>
 <section className="helpSection dataSection"><h2>{fr?'Données d’exemple':'Sample data'}</h2><p>{fr?'Ajoutez six objets fictifs avec des dates proches, des actions, un rendez-vous, un journal et des liens. Les exemples déjà présents sont ignorés.':'Add six fictional items with upcoming dates, actions, an appointment, a journal, and links. Existing samples are skipped.'}</p><button className="dataButton" disabled={busy} onClick={loadExamples}>{fr?'Ajouter les exemples':'Add sample data'}</button></section>
 <section className="helpSection"><h2>{fr?'Importer vos anciennes données':'Import your old data'}</h2><p>{fr?'Sélectionnez votre ancien fichier data/records.json. Les identifiants déjà présents sont ignorés.':'Select your old data/records.json file. Existing IDs are skipped.'}</p><label className="importButton">{fr?'Choisir un fichier JSON':'Choose a JSON file'}<input type="file" accept="application/json,.json" onChange={handleImport}/></label>{importMessage&&<p role="status">{importMessage}</p>}</section>
 <section className="helpSection dataSection dangerZone"><h2>{fr?'Réinitialiser mes données':'Reset my data'}</h2><p>{fr?'Supprime définitivement tous les objets de votre compte, y compris ceux que vous avez importés ou créés. Les autres comptes ne sont pas touchés.':'Permanently delete every item in your account, including imported and created items. Other accounts are unaffected.'}</p><button className="dataButton dangerButton" disabled={busy} onClick={()=>setConfirmReset(true)}>{fr?'Réinitialiser mes données':'Reset my data'}</button>{dataMessage&&<p role="status">{dataMessage}</p>}</section>
 {confirmReset&&<div className="overlay" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setConfirmReset(false)}><div className="confirmCard" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description"><h2 id="reset-title">{fr?'Confirmer la réinitialisation':'Confirm reset'}</h2><p id="reset-description">{fr?'Tous les objets de votre compte seront supprimés définitivement. Cette action est irréversible.':'Every item in your account will be permanently deleted. This cannot be undone.'}</p><div className="modalActions"><button disabled={busy} onClick={()=>setConfirmReset(false)}>{fr?'Annuler':'Cancel'}</button><button className="dangerButton" disabled={busy} onClick={reset}>{busy?'…':(fr?'Supprimer mes données':'Delete my data')}</button></div></div></div>}
 </div>
}

function CreateModal({records,close,created,locale}){
 const fr=locale==='fr';
 const [kind,setKind]=useState('action'),[form,setForm]=useState({title:'',description:'',date:'',subject:'',predicate:'',value:'',tags:'',relatedIds:[]}),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const change=e=>setForm({...form,[e.target.name]:e.target.value});
 const submit=async e=>{e.preventDefault();setSaving(true);setError('');const payload={...form,kind,status:kind==='journal'?'done':kind==='event'?'scheduled':kind==='fact'?'known':'active',tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean),relatedIds:form.relatedIds||[]};try{await createRecord(payload);created()}catch(error){setError(error.message)}finally{setSaving(false)}};
 return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><form className="modal" onSubmit={submit}><div className="modalHead"><div><span className="eyebrow">{fr?'NOUVEL OBJET':'NEW OBJECT'}</span><h2>{fr?'Ajouter à votre mémoire':'Add to your memory'}</h2></div><button aria-label={fr?'Fermer':'Close'} type="button" onClick={close}><X/></button></div><div className="kindPicker">{Object.entries(kindMeta).map(([id,m])=>{const Icon=m.icon;const name=fr?m.label:{action:'Action',event:'Appointment',journal:'Journal',fact:'Knowledge'}[id];return <button type="button" className={kind===id?'selected '+m.color:''} key={id} onClick={()=>setKind(id)}><Icon size={18}/>{name}</button>})}</div><div className="autoId"><ShieldCheck/><span><b>{fr?'Identifiant géré automatiquement':'Identifier managed automatically'}</b><small>{fr?'Un identifiant unique sera attribué à la création.':'A unique identifier will be assigned when created.'}</small></span></div><label>{fr?'Titre':'Title'}<input name="title" placeholder={fr?'Un titre court et précis':'A short, precise title'} value={form.title} onChange={change} required/></label>{kind==='fact'?<div className="factFields"><label>{fr?'Sujet':'Subject'}<input name="subject" placeholder="Jane Doe" value={form.subject} onChange={change}/></label><label>{fr?'Relation':'Relationship'}<input name="predicate" placeholder={fr?'habite à':'lives in'} value={form.predicate} onChange={change}/></label><label>{fr?'Valeur':'Value'}<input name="value" placeholder="Lyon" value={form.value} onChange={change}/></label></div>:<><label>Notes<textarea name="description" placeholder={fr?'Contexte, commentaire, résultat…':'Context, comment, outcome…'} value={form.description} onChange={change}/></label><label>{fr?'Date et heure':'Date and time'}<input type="datetime-local" name="date" value={form.date} onChange={change}/></label></>}<label>Tags <small>{fr?'séparés par des virgules':'comma separated'}</small><input name="tags" placeholder={fr?'famille, santé, projet':'family, health, project'} value={form.tags} onChange={change}/></label><label>{fr?'Relier à un objet':'Link to an object'}<select multiple value={form.relatedIds} onChange={e=>setForm({...form,relatedIds:[...e.target.selectedOptions].map(o=>o.value)})}>{records.map(r=><option value={r.id} key={r.id}>{r.id} — {r.title}</option>)}</select></label>{error&&<div className="error">{error}</div>}<div className="modalActions"><button type="button" onClick={close}>{fr?'Annuler':'Cancel'}</button><button className="primary" disabled={saving}>{saving?(fr?'Enregistrement…':'Saving…'):(fr?'Créer l’objet':'Create object')}</button></div></form></div>
}
function DetailModal({record,records,close,locale}){const fr=locale==='fr';const meta=kindMeta[record.kind];const Icon=meta.icon;const related=(record.relatedIds||[]).map(id=>records.find(r=>r.id===id)).filter(Boolean);return <div className="overlay detailOverlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><article className="detailModal"><div className="detailHead"><span className={'detailIcon '+meta.color}><Icon/></span><div><span className="eyebrow">{fr?meta.label:{action:'ACTION',event:'APPOINTMENT',journal:'JOURNAL',fact:'KNOWLEDGE'}[record.kind]}</span><h2>{record.title}</h2><code>{record.id}</code></div><button aria-label={fr?'Fermer':'Close'} onClick={close}><X/></button></div><div className="detailBody">{record.description&&<section><small>{fr?'NOTES':'NOTES'}</small><p>{record.description}</p></section>}{record.kind==='fact'&&<section className="factStatement"><span>{record.subject}</span><b>{record.predicate}</b><span>{record.value}</span></section>}<div className="detailGrid"><section><small>{fr?'STATUT':'STATUS'}</small><strong>{record.status}</strong></section>{record.date&&<section><small>{fr?'DATE':'DATE'}</small><strong>{dateLabel(record.date,locale)} · {timeLabel(record.date)}</strong></section>}<section><small>{fr?'CRÉÉ LE':'CREATED'}</small><strong>{dateLabel(record.createdAt,locale)}</strong></section></div>{record.tags?.length>0&&<section><small>TAGS</small><div className="detailTags">{record.tags.map(tag=><span key={tag}>#{tag}</span>)}</div></section>}{related.length>0&&<section><small>{fr?'OBJETS LIÉS':'RELATED OBJECTS'}</small><div className="relatedList">{related.map(item=><div key={item.id}><b>{item.title}</b><code>{item.id}</code></div>)}</div></section>}</div></article></div>}
function Empty({text}){return <div className="empty"><Command size={22}/><span>{text}</span></div>}; function Loading(){return <div className="loading"><i></i><span>Chargement de votre espace…</span></div>}
createRoot(document.getElementById('root')).render(<App/>);
