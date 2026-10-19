/** Fresh per-origin encrypted Aster V3 agent storage.
 * AES-GCM ciphertext in IndexedDB; non-extractable key also lives in IndexedDB.
 * No secrets in localStorage, URL, logs or server. Existing Aster keys NOT imported.
 */
const DB="hidedex-aster-fresh-v3",STORE="data",DEVICE="aes-gcm-device-v1";
const enc=new TextEncoder(),dec=new TextDecoder();
type Sealed={iv:number[];data:number[]};
function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined"||!crypto?.subtle){reject(Error("Encrypted device storage unavailable"));return;}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error??Error("Device storage unavailable"));
 });
}
function read<T>(db:IDBDatabase,key:string):Promise<T|undefined>{
 return new Promise((resolve,reject)=>{const t=db.transaction(STORE,"readonly"),req=t.objectStore(STORE).get(key);
  req.onsuccess=()=>resolve(req.result as T|undefined);
  req.onerror=()=>reject(req.error??Error("Cannot read encrypted device key"));
 });
}
function write(db:IDBDatabase,key:string,value:unknown):Promise<void>{
 return new Promise((resolve,reject)=>{const t=db.transaction(STORE,"readwrite");t.objectStore(STORE).put(value,key);
  t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);
 });
}
async function key(db:IDBDatabase,create:boolean):Promise<CryptoKey|null>{
 const old=await read<CryptoKey>(db,DEVICE);
 if(old)return old;
 if(!create)return null;
 const generated=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
 await write(db,DEVICE,generated);return generated;
}
export async function setAgentSecret(name:string,secret:string):Promise<void>{
 if(!/^hidedex:aster:v3:0x[0-9a-f]{40}$/.test(name)||!/^0x[0-9a-fA-F]{64}$/.test(secret))throw Error("Invalid Aster owner or signer");
 const db=await openDb();try{
  const cipherKey=await key(db,true);if(!cipherKey)throw Error("Encryption unavailable");
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},cipherKey,enc.encode(secret)));
  await write(db,name,{iv:Array.from(iv),data:Array.from(data)} satisfies Sealed);
 }finally{db.close();}
}
export async function getAgentSecret(name:string):Promise<string|null>{
 if(!/^hidedex:aster:v3:0x[0-9a-f]{40}$/.test(name))throw Error("Invalid Aster storage lookup");
 const db=await openDb();try{
  const blob=await read<Sealed>(db,name);if(!blob)return null;
  const cipherKey=await key(db,false);if(!cipherKey)throw Error("Encrypted Aster key is unavailable");
  if(!Array.isArray(blob.iv)||blob.iv.length!==12||!Array.isArray(blob.data))throw Error("Damaged Aster signer");
  const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(blob.iv)},cipherKey,new Uint8Array(blob.data));
  const out=dec.decode(plaintext);if(!/^0x[0-9a-fA-F]{64}$/.test(out))throw Error("Damaged Aster signer");
  return out;
 }finally{db.close();}
}
