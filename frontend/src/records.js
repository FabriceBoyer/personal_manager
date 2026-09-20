import {supabase} from './supabase';
import {cachedRecords, clearOwnerCache, nextVersion, observeVersions, putCachedRecord, queueChange, queuedChanges, removeQueuedChange, replaceCachedRecords} from './syncDb';

const fields = ['kind','title','description','status','date','endDate','subject','predicate','value','tags','relatedIds'];
const columns = {kind:'kind',title:'title',description:'description',status:'status',date:'date',endDate:'end_date',subject:'subject',predicate:'predicate',value:'value',tags:'tags',relatedIds:'related_ids'};

const fromRow = row => {
  observeVersions(row.sync_meta);
  return ({
  id: row.id, kind: row.kind, title: row.title, description: row.description,
  status: row.status, date: row.date, endDate: row.end_date,
  subject: row.subject, predicate: row.predicate, value: row.value,
  tags: row.tags, relatedIds: row.related_ids,
  createdAt: row.created_at, updatedAt: row.updated_at,
  syncMeta: row.sync_meta || {}
  });
};

const normalize = (key, value) => value ?? (['tags','relatedIds'].includes(key) ? [] : ['date','endDate'].includes(key) ? null : '');
const toRow = record => Object.fromEntries([
  ['id', record.id],
  ...fields.filter(key => record[key] !== undefined).map(key => [columns[key], normalize(key, record[key])])
].filter(([,value]) => value !== undefined));
const sortRecords = records => records.sort((a,b) => !a.date ? 1 : !b.date ? -1 : a.date.localeCompare(b.date) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
const notify = detail => window.dispatchEvent(new CustomEvent('memoire-sync', {detail}));

async function currentUser() {
  const {data:{session}, error} = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.user) throw new Error('Session expirée. Reconnectez-vous.');
  return session.user;
}

const offlineId = kind => {
  const prefix = {action:'ACT',event:'EVT',journal:'JRN',fact:'KNW'}[kind] || 'OBJ';
  return `${prefix}-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}`;
};

async function enqueue(ownerId, id, patch) {
  const versions = Object.fromEntries(Object.keys(patch).map(key => [columns[key], nextVersion()]));
  await queueChange({ownerId,id,patch,versions,createdAt:Date.now()});
  return versions;
}

export async function syncPendingRecords() {
  const user = await currentUser();
  if (!navigator.onLine) {
    const count = (await queuedChanges(user.id)).length;
    notify({status:'offline',pending:count});
    return;
  }
  const pending = await queuedChanges(user.id);
  notify({status:'syncing',pending:pending.length});
  for (let index=0; index<pending.length; index++) {
    const change = pending[index];
    const {data,error} = await supabase.rpc('merge_record', {p_record:toRow({id:change.id,...change.patch}),p_versions:change.versions});
    if (error) {
      notify({status:'error',pending:pending.length-index,message:error.message});
      throw error;
    }
    await removeQueuedChange(change.queueId);
    const hasLaterChange = pending.slice(index+1).some(item => item.id === change.id);
    if (!hasLaterChange && data) await putCachedRecord(user.id, fromRow(data));
  }
  notify({status:'synced',pending:0});
}

export async function listRecords() {
  const user = await currentUser();
  try {
    await syncPendingRecords();
    const records=[];
    for(let offset=0;;offset+=1000){
      const {data,error}=await supabase.from('records').select('*').order('id').range(offset,offset+999);
      if(error)throw error;
      records.push(...data.map(fromRow));
      if(data.length<1000)break;
    }
    await replaceCachedRecords(user.id,records);
    notify({status:'synced',pending:0});
    return sortRecords(records);
  } catch (error) {
    const local=await cachedRecords(user.id);
    const pending=(await queuedChanges(user.id)).length;
    notify({status:navigator.onLine?'error':'offline',pending,message:error.message});
    if(!navigator.onLine || local.length || pending) return sortRecords(local);
    throw error;
  }
}

export async function createRecord(record) {
  const user=await currentUser();
  const now=new Date().toISOString();
  const local={...record,id:(record.id||offlineId(record.kind)).toUpperCase(),createdAt:now,updatedAt:now,syncMeta:{}};
  await putCachedRecord(user.id,local);
  const base={...record,relatedIds:[]};
  await enqueue(user.id,local.id,base);
  if(record.relatedIds?.length)await enqueue(user.id,local.id,{relatedIds:record.relatedIds});
  try{await syncPendingRecords()}catch{/* La file locale sera rejouée à la reconnexion. */}
  return local;
}

export async function updateRecord(id, changes) {
  const user=await currentUser();
  const local=(await cachedRecords(user.id)).find(item=>item.id===id);
  if(!local)throw new Error('Objet introuvable dans le cache local.');
  const updated={...local,...changes,updatedAt:new Date().toISOString()};
  await putCachedRecord(user.id,updated);
  await enqueue(user.id,id,changes);
  try{await syncPendingRecords()}catch{/* La file locale sera rejouée à la reconnexion. */}
  return updated;
}

export async function resetRecords() {
  const user=await currentUser();
  if(!navigator.onLine)throw new Error('Reconnectez-vous à Internet avant de réinitialiser les données.');
  await syncPendingRecords();
  const {error}=await supabase.from('records').delete().eq('owner_id',user.id);
  if(error)throw error;
  await clearOwnerCache(user.id);
}

export async function importRecords(items) {
  if(!Array.isArray(items)||items.some(item=>!item.id||!item.kind||!item.title))throw new Error('Le fichier doit contenir un tableau d’objets Mémoire valides.');
  const existing=new Set((await listRecords()).map(item=>item.id));
  let count=0;
  for(const item of items){if(existing.has(item.id))continue;await createRecord(item);existing.add(item.id);count++}
  return count;
}

export function subscribeToRecordChanges(ownerId,onChange,onStatus=()=>{}) {
  const channel=supabase.channel(`records:${ownerId}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'records',filter:`owner_id=eq.${ownerId}`},onChange)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'records',filter:`owner_id=eq.${ownerId}`},onChange)
    .subscribe(status=>onStatus(status));
  return ()=>supabase.removeChannel(channel);
}
