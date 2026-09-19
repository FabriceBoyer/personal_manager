import {supabase} from './supabase';

const fromRow = row => ({
  id: row.id, kind: row.kind, title: row.title, description: row.description,
  status: row.status, date: row.date, endDate: row.end_date,
  subject: row.subject, predicate: row.predicate, value: row.value,
  tags: row.tags, relatedIds: row.related_ids,
  createdAt: row.created_at, updatedAt: row.updated_at
});

const toRow = record => ({
  ...(record.id ? {id: record.id} : {}),
  kind: record.kind, title: record.title, description: record.description || '',
  status: record.status || 'active', date: record.date || null,
  end_date: record.endDate || null, subject: record.subject || '',
  predicate: record.predicate || '', value: record.value || '',
  tags: record.tags || [], related_ids: record.relatedIds || []
});

export async function listRecords() {
  const records = [];
  for (let offset = 0; ; offset += 1000) {
    const {data, error} = await supabase.from('records').select('*').order('id').range(offset, offset + 999);
    if (error) throw error;
    records.push(...data.map(fromRow));
    if (data.length < 1000) break;
  }
  return records.sort((a, b) => !a.date ? 1 : !b.date ? -1 : a.date.localeCompare(b.date) || b.updatedAt.localeCompare(a.updatedAt));
}

export async function createRecord(record) {
  const {data, error} = await supabase.from('records').insert(toRow(record)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateRecord(id, changes) {
  const columns = {kind:'kind',title:'title',description:'description',status:'status',date:'date',endDate:'end_date',subject:'subject',predicate:'predicate',value:'value',tags:'tags',relatedIds:'related_ids'};
  const patch = Object.fromEntries(Object.entries(columns).filter(([key])=>changes[key]!==undefined).map(([key,column])=>[column,changes[key]||(['tags','relatedIds'].includes(key)?[]:['date','endDate'].includes(key)?null:'')]));
  const {data, error} = await supabase.from('records').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function resetRecords() {
  const {data: {user}, error: authError} = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Session expirée. Reconnectez-vous.');
  const {error} = await supabase.from('records').delete().eq('owner_id', user.id);
  if (error) throw error;
  const remaining = await listRecords();
  if (remaining.length) throw new Error('La réinitialisation est incomplète. Réessayez.');
}

// Import older records after signing in. Links are applied after all records exist.
export async function importRecords(items) {
  if (!Array.isArray(items) || items.some(item => !item.id || !item.kind || !item.title)) {
    throw new Error('Le fichier doit contenir un tableau d’objets Mémoire valides.');
  }
  const existing = new Set((await listRecords()).map(item => item.id));
  const added = [];
  for (const item of items) {
    if (existing.has(item.id)) continue;
    await createRecord({...item, relatedIds: []});
    added.push(item);
  }
  for (const item of added) {
    if (item.relatedIds?.length) {
      const {error} = await supabase.from('records').update({related_ids: item.relatedIds}).eq('id', item.id);
      if (error) throw error;
    }
  }
  return added.length;
}
