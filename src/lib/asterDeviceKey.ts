/**
 * Aster trading-agent key vault. Venue-separated, per-user, origin-specific.
 * Stores AES-GCM ciphertext in IndexedDB. A nonextractable AES-256 key lives
 * as an IndexedDB structured clone; private key is NEVER in localStorage,
 * URL, wallet analytics or a backend request. Same-origin script compromise
 * remains a threat; browser storage is device convenience, not a hardware vault.
 */
import {getAddress,Wallet} from "ethers";

const DATABASE="hidedex-aster-agent-v1",STORE="credentials",KEY_ID="device-key-v1";
export type SavedAsterAgent={
  user:string;agent:string;privateKey:string;expiresAtMs:number;approved:boolean;
};
type Sealed={
  v:1;user:string;agent:string;expiresAtMs:number;approved:boolean;
  iv:number[];data:number[];
};
function entryId(wallet:string){return "aster-mainnet:trading:"+getAddress(wallet).toLowerCase();}
function dbOpen():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined")return reject(new Error("Encrypted device storage unavailable"));
  const req=indexedDB.open(DATABASE,1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);
  };
  req.onerror=()=>reject(req.error??new Error("Could not open encrypted key storage"));
  req.onsuccess=()=>resolve(req.result);
 });
}
function read<T>(db:IDBDatabase,key:string):Promise<T|undefined>{
 return new Promise((resolve,reject)=>{
  const req=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
  req.onsuccess=()=>resolve(req.result as T|undefined);
  req.onerror=()=>reject(req.error??new Error("Encrypted read failed"));
 });
}
function write(db:IDBDatabase,id:string,item:unknown):Promise<void>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");
  tx.objectStore(STORE).put(item,id);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??new Error("Encrypted write aborted"));
 });
}
async function aesKey(db:IDBDatabase,create:boolean):Promise<CryptoKey|null>{
 const found=await read<CryptoKey>(db,KEY_ID);
 if(found)return found;
 if(!create)return null;
 if(!globalThis.crypto?.subtle)throw new Error("Secure browser encryption unavailable");
 const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
 await write(db,KEY_ID,key);
 return key;
}
export async function rememberAsterAgent(record:SavedAsterAgent):Promise<void>{
 const user=getAddress(record.user),agent=getAddress(record.agent);
 if(user===agent||!Number.isSafeInteger(record.expiresAtMs)||
  record.expiresAtMs<=Date.now()||!/^0x[a-fA-F0-9]{64}$/.test(record.privateKey))
  throw new Error("Invalid Aster agent credential");
 if(getAddress(new Wallet(record.privateKey).address)!==agent)
  throw new Error("Aster agent does not match its signing key");
 const db=await dbOpen();
 try{
  const key=await aesKey(db,true);
  if(!key)throw new Error("No encryption key");
  const id=entryId(user),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({
   name:"AES-GCM",iv,additionalData:new TextEncoder().encode(id),
  },key,new TextEncoder().encode(record.privateKey));
  await write(db,id,{v:1,user,agent,expiresAtMs:record.expiresAtMs,
    approved:record.approved,iv:Array.from(iv),data:Array.from(new Uint8Array(ct))} satisfies Sealed);
 }finally{db.close();}
}
export async function readRememberedAsterAgent(address:string):Promise<SavedAsterAgent|null>{
 if(!/^0x[a-fA-F0-9]{40}$/.test(address))return null;
 const db=await dbOpen();
 try{
  const id=entryId(address),sealed=await read<Sealed>(db,id);
  if(!sealed)return null;
  if(sealed.v!==1||sealed.user!==getAddress(address)||
    !/^0x[a-fA-F0-9]{40}$/.test(sealed.agent)||
    !Array.isArray(sealed.iv)||sealed.iv.length!==12||
    !Array.isArray(sealed.data)||
    !Number.isSafeInteger(sealed.expiresAtMs))
    throw new Error("Invalid local Aster agent record");
  if(sealed.expiresAtMs<=Date.now())return null;
  const key=await aesKey(db,false);
  if(!key)throw new Error("Device encryption key missing");
  const plaintext=await crypto.subtle.decrypt({
   name:"AES-GCM",iv:new Uint8Array(sealed.iv),
   additionalData:new TextEncoder().encode(id),
  },key,new Uint8Array(sealed.data));
  const privateKey=new TextDecoder().decode(plaintext);
  if(new Wallet(privateKey).address!==getAddress(sealed.agent))
   throw new Error("Invalid Aster agent key identity");
  return {user:sealed.user,agent:sealed.agent,privateKey,
   expiresAtMs:sealed.expiresAtMs,approved:sealed.approved===true};
 }finally{db.close();}
}
export async function forgetRememberedAsterAgent(address:string):Promise<void>{
 if(!/^0x[a-fA-F0-9]{40}$/.test(address))return;
 const db=await dbOpen();
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(STORE,"readwrite");
   tx.objectStore(STORE).delete(entryId(address));
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
   tx.onabort=()=>reject(tx.error);
  });
 }finally{db.close();}
}
