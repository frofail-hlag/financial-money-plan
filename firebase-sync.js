import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, setDoc, deleteDoc, getDoc, getDocs, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig, FIREBASE_CONFIGURED } from "./firebase-config.js";

const DEVICE_KEY="money-plan-device-id", META_KEY="money-plan-v31-sync-meta", CONFLICT_KEY="money-plan-v31-conflicts";
const deviceId=localStorage.getItem(DEVICE_KEY)||crypto.randomUUID(); localStorage.setItem(DEVICE_KEY,deviceId);
const stateKey="money-plan-v3";
const collections=["cycles","expenses","recurring","savingsHistory"];
let auth=null,db=null,user=null,unsub=[]; let meta={}; let started=false;
try{meta=JSON.parse(localStorage.getItem(META_KEY)||"{}")}catch{}
const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
const readState=()=>{try{return JSON.parse(localStorage.getItem(stateKey)||"null")}catch{return null}};
const writeState=s=>localStorage.setItem(stateKey,JSON.stringify(s));
const MIGRATION_KEY="money-plan-v31-migration";
const migrationMarkerKey=uid=>`${MIGRATION_KEY}:${uid}`;
let migrationPending=null;
function getMigrationMarker(uid=user?.uid){if(!uid)return null;try{return JSON.parse(localStorage.getItem(migrationMarkerKey(uid))||"null")}catch{return null}}
function markMigrationComplete(choice="sync"){if(!user)return;try{localStorage.setItem(migrationMarkerKey(user.uid),JSON.stringify({version:1,uid:user.uid,deviceId,choice,completedAt:new Date().toISOString()}));}catch{}}
function clearMigrationMarker(uid=user?.uid){if(!uid)return;localStorage.removeItem(migrationMarkerKey(uid));}
const hasMeaningfulLocalData=s=>{
  if(!s)return false;
  return Object.keys(s.cycles||{}).length>0 || (s.expenses||[]).length>0 || (s.recurring||[]).length>0 || (s.savingsHistory&&Object.keys(s.savingsHistory).length>0) || Number(s.savings?.balance||0)>0;
};
const stateSummary=s=>({cycles:Object.keys(s?.cycles||{}).length,expenses:(s?.expenses||[]).length,recurring:(s?.recurring||[]).length,savingsHistory:Object.keys(s?.savingsHistory||{}).length,savingsBalance:Number(s?.savings?.balance||0)});
function saveMigrationBackup(local,remote){try{localStorage.setItem(MIGRATION_KEY,JSON.stringify({createdAt:new Date().toISOString(),local,remote}));}catch(e){}}
function emitMigration(local,remote){migrationPending={local,remote};saveMigrationBackup(local,remote);emit("moneyplan:migration-needed",{local:stateSummary(local),remote:stateSummary(remote)});}
function clearMigration(){migrationPending=null;localStorage.removeItem(MIGRATION_KEY);}
const conflicts=()=>{try{return JSON.parse(localStorage.getItem(CONFLICT_KEY)||"[]")}catch{return[]}};
const addConflict=c=>{const a=conflicts();a.unshift({...c,id:crypto.randomUUID(),at:new Date().toISOString(),deviceId});localStorage.setItem(CONFLICT_KEY,JSON.stringify(a.slice(0,50)));emit("moneyplan:conflict",c)};
const key=(kind,id)=>`${kind}/${id}`;
const markMeta=(k,v)=>{meta[k]=v;localStorage.setItem(META_KEY,JSON.stringify(meta))};

function configured(){return FIREBASE_CONFIGURED;}
function items(state,kind){
  if(kind==="cycles")return Object.entries(state?.cycles||{}).map(([id,data])=>({id,data}));
  if(kind==="savingsHistory")return Object.entries(state?.savingsHistory||{}).map(([id,data])=>({id,data}));
  return (state?.[kind]||[]).map(data=>({id:String(data.id),data}));
}
function localValue(state,kind,id){
  if(kind==="cycles")return state?.cycles?.[id];
  if(kind==="savingsHistory")return state?.savingsHistory?.[id];
  return (state?.[kind]||[]).find(x=>String(x.id)===String(id));
}
function applyRemote(kind,id,data){
  const state=readState();if(!state)return;
  const k=key(kind,id), previous=meta[k]; const clean={...data}; delete clean._sync;
  const local=localValue(state,kind,id);
  if(meta.globalDirtyAt && JSON.stringify(local)!==JSON.stringify(clean)){
    addConflict({kind,id,message:"Remote data differs from a local change.",local,remote:clean});
    emit("moneyplan:sync-status",{status:"conflict"}); return;
  }
  if(kind==="cycles")state.cycles[id]=clean;
  else if(kind==="savingsHistory")state.savingsHistory[id]=clean;
  else {state[kind]=(state[kind]||[]).filter(x=>String(x.id)!==String(id));state[kind].push(clean);}
  writeState({...state,version:3});
  markMeta(k,{dirty:false,remoteUpdatedAt:data?._sync?.serverUpdatedAt||data?._sync?.clientUpdatedAt||new Date().toISOString(),remoteData:clean});
  emit("moneyplan:remote-applied");
}
function applyRemoteDelete(kind,id){
  const state=readState();if(!state)return;const local=localValue(state,kind,id);const previous=meta[key(kind,id)];
  if(meta.globalDirtyAt && local){addConflict({kind,id,message:"A record was deleted remotely while it had local changes.",local,remote:null});return;}
  if(kind==="cycles")delete state.cycles[id]; else if(kind==="savingsHistory")delete state.savingsHistory[id]; else state[kind]=(state[kind]||[]).filter(x=>String(x.id)!==String(id));
  writeState({...state,version:3}); markMeta(key(kind,id),{dirty:false}); emit("moneyplan:remote-applied");
}

async function writeEntity(kind,id,data){
  if(!user||!db)return;
  const k=key(kind,id), previous=meta[k];
  if(previous?.remoteUpdatedAt && previous?.dirty && previous.remoteData && JSON.stringify(previous.remoteData)!==JSON.stringify(data)){
    // A local edit after a previously observed remote change is fine; mark dirty and let Firestore sync it.
  }
  const clientUpdatedAt=new Date().toISOString();
  await setDoc(doc(db,"users",user.uid,kind,id),{...data,_sync:{deviceId,clientUpdatedAt,serverUpdatedAt:serverTimestamp()}},{merge:false});
  markMeta(k,{dirty:false,remoteUpdatedAt:clientUpdatedAt,remoteData:data});
}

async function pushState(state){
  if(!user||!db||!state)return;
  emit("moneyplan:sync-status",{status:"syncing"});
  for(const kind of collections){for(const {id,data} of items(state,kind))await writeEntity(kind,id,data);}
  await setDoc(doc(db,"users",user.uid,"meta","savings"),{...state.savings,_sync:{deviceId,clientUpdatedAt:new Date().toISOString(),serverUpdatedAt:serverTimestamp()}},{merge:false});
  markMeta("meta/savings",{dirty:false}); delete meta.globalDirtyAt; localStorage.setItem(META_KEY,JSON.stringify(meta)); emit("moneyplan:sync-status",{status:"synced",email:user.email});
}

async function fetchRemoteState(){
  const remote={version:3,cycles:{},expenses:[],recurring:[],savings:{balance:0,goal:72000,targetDate:"2028-09-30",wifeDefault:1500},savingsHistory:{}};
  let found=false;
  for(const kind of collections){
    const snap=await getDocs(collection(db,"users",user.uid,kind));
    if(!snap.empty)found=true;
    snap.forEach(d=>{const data=d.data();delete data._sync;if(kind==="cycles")remote.cycles[d.id]=data;else if(kind==="savingsHistory")remote.savingsHistory[d.id]=data;else remote[kind].push(data);});
  }
  const savingsSnap=await getDoc(doc(db,"users",user.uid,"meta","savings"));
  if(savingsSnap.exists()){found=true;const d=savingsSnap.data();delete d._sync;remote.savings={...remote.savings,...d};}
  return {found,remote};
}
async function replaceCloudWithLocal(state){
  for(const kind of collections){
    const snap=await getDocs(collection(db,"users",user.uid,kind));
    const localIds=new Set(items(state,kind).map(x=>String(x.id)));
    for(const d of snap.docs)if(!localIds.has(String(d.id)))await deleteDoc(d.ref);
  }
  await pushState(state);
}
async function applyCloudState(remote){
  writeState({...remote,version:3});
  meta={};localStorage.setItem(META_KEY,JSON.stringify(meta));
  emit("moneyplan:remote-applied");
}
async function bootstrap(){
  const local=readState()||{};
  const {found,remote}=await fetchRemoteState();
  const marker=getMigrationMarker();
  if(found && hasMeaningfulLocalData(local) && !marker){
    emitMigration(local,remote);
    emit("moneyplan:sync-status",{status:"migration",email:user.email});
    return false;
  }
  if(found){
    await applyCloudState(remote);
    markMigrationComplete("cloud");
    emit("moneyplan:sync-status",{status:"synced",email:user.email});
  }
  else {
    await pushState(local);
    markMigrationComplete("initial-upload");
  }
  return true;
}
async function resolveMigration(choice){
  if(!user||!migrationPending)return;
  const {local,remote}=migrationPending;
  try{
    emit("moneyplan:sync-status",{status:"syncing",email:user.email});
    if(choice==="local"){await replaceCloudWithLocal(local);await applyCloudState(local);markMigrationComplete("local");}
    else if(choice==="cloud"){await applyCloudState(remote);markMigrationComplete("cloud");}
    else {return;}
    clearMigration();
    emit("moneyplan:sync-status",{status:"synced",email:user.email});
    for(const kind of collections)unsub.push(listen(kind));
    unsub.push(listenSavings());
  }catch(e){emit("moneyplan:sync-status",{status:"error",message:e.message});}
}

function listen(kind){return onSnapshot(collection(db,"users",user.uid,kind),snap=>snap.docChanges().forEach(ch=>ch.type==="removed"?applyRemoteDelete(kind,ch.doc.id):applyRemote(kind,ch.doc.id,ch.doc.data())),err=>emit("moneyplan:sync-status",{status:"error",message:err.message}));}
function listenSavings(){return onSnapshot(doc(db,"users",user.uid,"meta","savings"),snap=>{if(!snap.exists())return;const d=snap.data();delete d._sync;const s=readState();if(!s)return;s.savings={...s.savings,...d};writeState({...s,version:3});emit("moneyplan:remote-applied");});}
async function userChanged(u){user=u;unsub.forEach(f=>f&&f());unsub=[];if(!user){migrationPending=null;emit("moneyplan:sync-status",{status:"ready"});return;}emit("moneyplan:sync-status",{status:"syncing",email:user.email});try{const ready=await bootstrap();if(ready){for(const kind of collections)unsub.push(listen(kind));unsub.push(listenSavings());}}catch(e){emit("moneyplan:sync-status",{status:"error",message:e.message});}}
async function init(){if(started)return;started=true;if(!configured()){emit("moneyplan:sync-status",{status:"unconfigured"});return;}const app=initializeApp(firebaseConfig);auth=getAuth(app);db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});onAuthStateChanged(auth,userChanged);emit("moneyplan:sync-status",{status:"ready"});}

window.MoneyPlanSync={
 init,configured,
 signIn:(email,password)=>signInWithEmailAndPassword(auth,email,password),
 signUp:(email,password)=>createUserWithEmailAndPassword(auth,email,password),
 signOut:()=>signOut(auth),
 resetPassword:email=>sendPasswordResetEmail(auth,email),
 getUser:()=>user,
 push:()=>pushState(readState()||{}),
 getConflicts:conflicts,
 getMigration:()=>migrationPending?{local:stateSummary(migrationPending.local),remote:stateSummary(migrationPending.remote)}:null,
 resolveMigration,
 clearConflicts:()=>{localStorage.removeItem(CONFLICT_KEY);emit("moneyplan:conflict-cleared");},
 markLocalDirty:()=>{meta.lastLocalChange=new Date().toISOString();meta.globalDirtyAt=meta.lastLocalChange;localStorage.setItem(META_KEY,JSON.stringify(meta));}
};
init();
