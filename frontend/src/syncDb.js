const DB_NAME = 'memoire-sync-v1';
const DB_VERSION = 1;

const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const database = () => new Promise((resolve, reject) => {
  const open = indexedDB.open(DB_NAME, DB_VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', {keyPath:'key'});
    if (!db.objectStoreNames.contains('outbox')) {
      const outbox = db.createObjectStore('outbox', {keyPath:'queueId', autoIncrement:true});
      outbox.createIndex('ownerId', 'ownerId');
    }
  };
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});

const transaction = async (storeName, mode, action) => {
  const db = await database();
  const tx = db.transaction(storeName, mode);
  const result = await action(tx.objectStore(storeName));
  await new Promise((resolve, reject) => {tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
  db.close();
  return result;
};

export const cacheKey = (ownerId, id) => `${ownerId}:${id}`;

export async function cachedRecords(ownerId) {
  const all = await transaction('records', 'readonly', store => request(store.getAll()));
  return all.filter(item => item.ownerId === ownerId).map(item => item.record);
}

export const putCachedRecord = (ownerId, record) => transaction('records', 'readwrite', store => request(store.put({key:cacheKey(ownerId,record.id),ownerId,record})));

export const removeCachedRecord = (ownerId, id) => transaction('records', 'readwrite', store => request(store.delete(cacheKey(ownerId,id))));

export async function replaceCachedRecords(ownerId, records) {
  const db = await database();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  const all = await request(store.getAllKeys());
  all.filter(key => String(key).startsWith(`${ownerId}:`)).forEach(key => store.delete(key));
  records.forEach(record => store.put({key:cacheKey(ownerId,record.id),ownerId,record}));
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();
}

export const queueChange = change => transaction('outbox', 'readwrite', store => request(store.add(change)));

export async function queuedChanges(ownerId) {
  return transaction('outbox', 'readonly', store => request(store.index('ownerId').getAll(ownerId)));
}

export const removeQueuedChange = queueId => transaction('outbox', 'readwrite', store => request(store.delete(queueId)));

export async function clearOwnerCache(ownerId) {
  const db = await database();
  const tx = db.transaction(['records','outbox'], 'readwrite');
  for (const name of ['records','outbox']) {
    const store = tx.objectStore(name);
    const keys = await request(store.getAllKeys());
    const values = await request(store.getAll());
    values.forEach((value,index)=>{if(value.ownerId===ownerId)store.delete(keys[index])});
  }
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();
}

const clientId = (() => {
  let id = localStorage.getItem('memoire-client-id');
  if (!id) {id=crypto.randomUUID().replaceAll('-','').slice(0,12);localStorage.setItem('memoire-client-id',id)}
  return id;
})();
let lastTick = 0;
export function observeVersions(versions={}) {
  for (const version of Object.values(versions)) {
    const tick = Number.parseInt(String(version).slice(0,13),10);
    if (Number.isFinite(tick)) lastTick=Math.max(lastTick,tick);
  }
}
export function nextVersion() {
  lastTick = Math.max(Date.now(), lastTick + 1);
  return `${String(lastTick).padStart(13,'0')}-${clientId}`;
}
