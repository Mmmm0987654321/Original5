/** An opt-in per-origin device cache for the Lighter API signing key.
 * Only AES-GCM ciphertext is saved. The AES key is nonextractable and kept by
 * browser IndexedDB structured clone, never localStorage or a server.
 * This is device convenience, not protection against compromised same-origin JS.
 * Lose browser site data => reconnect with the user's separately backed-up key.
 */
type SavedSigner = {accountIndex:number;apiKeyIndex:number;apiPrivateKey:string};
type CipherRecord = {accountIndex:number;apiKeyIndex:number;iv:number[];data:number[]};
const DATABASE="hidedex-lighter-signer-v1";
const STORE="encrypted";
const deviceKeyId="device-aes-gcm-key";
const walletId=(address:string)=>"wallet:"+address.toLowerCase();

function openStore():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined")return reject(new Error("Local encrypted storage unavailable."));
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error("Encrypted storage unavailable."));
  });
}
function get<T>(db:IDBDatabase,key:string):Promise<T|undefined>{
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const req=tx.objectStore(STORE).get(key);
    req.onsuccess=()=>resolve(req.result as T|undefined);
    req.onerror=()=>reject(req.error);
  });
}
function put(db:IDBDatabase,key:string,value:unknown):Promise<void>{
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(value,key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
}
async function aesKey(db:IDBDatabase,create:boolean):Promise<CryptoKey|null>{
  const existing=await get<CryptoKey>(db,deviceKeyId);
  if(existing)return existing;
  if(!create)return null;
  const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  await put(db,deviceKeyId,key);
  return key;
}
export async function rememberLighterSigner(address:string,signer:SavedSigner):Promise<void>{
  if(!/^0x[a-fA-F0-9]{40}$/.test(address))throw new Error("Invalid wallet for encrypted signer storage.");
  const db=await openStore();
  try{
    const key=await aesKey(db,true);
    if(!key)throw new Error("Could not create the local device key.");
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const aad=new TextEncoder().encode(walletId(address));
    const data=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:aad},key,
      new TextEncoder().encode(signer.apiPrivateKey));
    await put(db,walletId(address),{
      accountIndex:signer.accountIndex,apiKeyIndex:signer.apiKeyIndex,
      iv:Array.from(iv),data:Array.from(new Uint8Array(data)),
    } satisfies CipherRecord);
  }finally{db.close();}
}
export async function readRememberedLighterSigner(address:string):Promise<SavedSigner|null>{
  if(!/^0x[a-fA-F0-9]{40}$/.test(address))return null;
  const db=await openStore();
  try{
    const encrypted=await get<CipherRecord>(db,walletId(address));
    if(!encrypted)return null;
    const key=await aesKey(db,false);
    if(!key)throw new Error("Device encryption key is missing.");
    if(!Number.isSafeInteger(encrypted.accountIndex)||!Number.isSafeInteger(encrypted.apiKeyIndex)||
      !Array.isArray(encrypted.iv)||encrypted.iv.length!==12||!Array.isArray(encrypted.data))
      throw new Error("Invalid local signer record.");
    const raw=await crypto.subtle.decrypt({
      name:"AES-GCM",iv:new Uint8Array(encrypted.iv),
      additionalData:new TextEncoder().encode(walletId(address)),
    },key,new Uint8Array(encrypted.data));
    return {accountIndex:encrypted.accountIndex,apiKeyIndex:encrypted.apiKeyIndex,
      apiPrivateKey:new TextDecoder().decode(raw)};
  }finally{db.close();}
}
export async function forgetRememberedLighterSigner(address:string):Promise<void>{
  const db=await openStore();
  try{
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).delete(walletId(address));
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  }finally{db.close();}
}
