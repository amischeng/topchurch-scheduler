const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBESRqa_nKU0UaESlkxuxCPlnM0y61yZZ0",
  authDomain:        "topchurch-scheduler.firebaseapp.com",
  databaseURL:       "https://topchurch-scheduler-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "topchurch-scheduler",
  storageBucket:     "topchurch-scheduler.firebasestorage.app",
  messagingSenderId: "130468282879",
  appId:             "1:130468282879:web:000879583cb9333300e7ca"
};

firebase.initializeApp(FIREBASE_CONFIG);
var _auth=firebase.auth();var _db=firebase.database();
window._fbAuth=_auth;window._fbDb=_db;
window._fbRef=function(a,b){return _db.ref(b!==undefined?b:a);};
window._fbSet=function(r,d){return r.set(d);};
window._fbGet=function(r){return r.get();};
window._fbOnValue=function(r,cb){return r.on("value",cb);};
window._fbUpdate=function(r,d){return r.update(d);};
window._fbSignIn=function(e,p){return _auth.signInWithEmailAndPassword(e,p);};
window._fbSignOut=function(){return _auth.signOut();};

function handleLogin(){
  var email=document.getElementById("login-email").value.trim();
  var pass=document.getElementById("login-pass").value;
  var errEl=document.getElementById("login-error");
  var btn=document.getElementById("login-btn");
  errEl.textContent="";btn.disabled=true;btn.textContent="登入中…";
  _auth.signInWithEmailAndPassword(email,pass).catch(function(e){
    var msgs={"auth/invalid-credential":"帳號或密碼錯誤","auth/user-not-found":"找不到此帳號",
      "auth/wrong-password":"密碼錯誤","auth/too-many-requests":"嘗試次數過多，請稍後再試",
      "auth/invalid-email":"Email格式不正確","auth/network-request-failed":"網路錯誤"};
    errEl.textContent=msgs[e.code]||("登入失敗："+e.code);
    btn.disabled=false;btn.textContent="登入";
  });
}
function handleLogout(){if(confirm("確定登出？"))_auth.signOut();}
document.getElementById("login-pass").addEventListener("keydown",function(e){if(e.key==="Enter")handleLogin();});
document.getElementById("login-email").addEventListener("keydown",function(e){if(e.key==="Enter")handleLogin();});
_auth.onAuthStateChanged(function(user){
  if(user){
    document.getElementById("login-screen").style.display="none";
    document.getElementById("app-screen").style.display="block";
    var el=document.getElementById("user-email");if(el)el.textContent=user.email;
    window._currentUser=user;if(window.initApp)window.initApp();
  }else{
    document.getElementById("login-screen").style.display="flex";
    document.getElementById("app-screen").style.display="none";
    window._currentUser=null;
  }
});

const DB_PATHS = {
  members:     'members',
  assignments: month => `schedules/${year}-${pad(month)}/assignments`,
  dashes:      month => `schedules/${year}-${pad(month)}/dashes`,
  unavail:     month => `schedules/${year}-${pad(month)}/unavail`,
  survey:      month => `schedules/${year}-${pad(month)}/survey`,
  surveyLink:  'config/surveyLink',
};

let _saveDebounce = {};
function dbSave(path, data, debounceMs=800) {
  if (_saveDebounce[path]) clearTimeout(_saveDebounce[path]);
  _saveDebounce[path] = setTimeout(async () => {
    try {
      showSync(true);
      const dbRef = window._fbRef(window._fbDb, path);
      await window._fbSet(dbRef, data);
      showSync(false);
    } catch(e) {
      console.error('DB save error:', path, e);
      showSync(false, true);
    }
  }, debounceMs);
}

async function dbLoad(path) {
  try {
    const snap = await window._fbGet(window._fbRef(window._fbDb, path));
    return snap.exists() ? snap.val() : null;
  } catch(e) {
    console.error('DB load error:', path, e);
    return null;
  }
}

function showSync(loading, err=false) {
  const s = document.getElementById('save-indicator');
  const l = document.getElementById('sync-indicator');
  if (!s||!l) return;
  if (loading) { l.style.display='inline'; s.style.display='none'; }
  else {
    l.style.display='none';
    s.textContent = err ? '❌ 同步失敗' : '✓ 已同步';
    s.style.color  = err ? '#f85149' : '#3fb950';
    s.style.display='inline';
    setTimeout(()=>{ s.style.display='none'; }, 2000);
  }
}

function setSurveyLink(){
  const current = window._surveyLink || '';
  const link = prompt('請輸入問卷連結網址：', current);
  if(link === null) return;
  window._surveyLink = link;
  dbSave(DB_PATHS.surveyLink, link, 0);
  const el = document.getElementById('survey-link-display');
  if(el) el.textContent = link || '（尚未設定）';
}

async function loadSurveyLink(){
  const link = await dbLoad(DB_PATHS.surveyLink);
  window._surveyLink = link || '';
  const el = document.getElementById('survey-link-display');
  if(el) el.textContent = link || '（尚未設定）';
}

function getAllMonthDates(){
  const weeks=getWeeks(year,month);
  const dates=new Set();
  weeks.forEach(w=>SERVICES.forEach(svc=>dates.add(fmtDate(getSvcDate(w,svc)))));
  return [...dates];
}

async function loadFromPublicForm(){
  showSync(true);
  try{
    const path=`memberAvailability/${year}-${pad(month)}`;
    const snap=await dbLoad(path);
    if(!snap){
      alert('尚未有同工透過公開表單填寫。');
      showSync(false,true);return;
    }
    const allDates=getAllMonthDates();
    let updated=0;
    Object.entries(snap).forEach(([safeName,data])=>{
      if(!data||!data.dates) return;
      const mem=members.find(m=>{
        const sk=m.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,'_');
        return sk===safeName||m.name===safeName;
      });
      if(!mem) return;
      allDates.forEach(ds=>delete unavailMap[`${mem.id}-${ds}`]);
      (data.dates||[]).forEach(ds=>{ if(allDates.includes(ds)) unavailMap[`${mem.id}-${ds}`]=true; });
      surveyFilled.add(mem.id);
      updated++;
    });
    await forceFlushMonth();
    renderAll();renderAvail();
    alert(`✅ 已從公開表單載入 ${updated} 位同工的可用時間！`);
  }catch(e){
    alert('載入失敗：'+e.message);
  }
  showSync(false);
}

async function initApp() {
  const savedMembers = await dbLoad(DB_PATHS.members);
  if (savedMembers) {
    members = Array.isArray(savedMembers) ? savedMembers : Object.values(savedMembers);
  }
  await loadMonthData();
  await loadSurveyLink();
  renderAll();
  renderMembers();
}
window.initApp = initApp;

async function loadMonthData() {
  assignments={};dashSet=new Set();unavailMap={};surveyFilled=new Set();confirmedWeeks=new Set();

  const [savedAssign, savedDashes, savedUnavail, savedSurvey] = await Promise.all([
    dbLoad(DB_PATHS.assignments(month)),
    dbLoad(DB_PATHS.dashes(month)),
    dbLoad(DB_PATHS.unavail(month)),
    dbLoad(DB_PATHS.survey(month)),
  ]);
  assignments  = savedAssign  ? savedAssign  : {};
  dashSet      = new Set(savedDashes  ? Object.keys(savedDashes)  : []);
  unavailMap   = savedUnavail ? savedUnavail : {};
  surveyFilled = new Set(savedSurvey  ? Object.keys(savedSurvey)  : []);
}

function saveAssignments() {
  dbSave(DB_PATHS.assignments(month), assignments);
}
function saveDashes() {
  const obj = {};
  dashSet.forEach(k => { obj[k] = true; });
  dbSave(DB_PATHS.dashes(month), obj);
}
function saveUnavail() {
  dbSave(DB_PATHS.unavail(month), unavailMap);
}
function saveSurvey() {
  const obj = {};
  surveyFilled.forEach(id => { obj[id] = true; });
  dbSave(DB_PATHS.survey(month), obj);
}
function saveMembers() {
  dbSave(DB_PATHS.members, members, 1500);
  const activeNames = members.filter(m=>m.active).map(m=>m.name);
  dbSave('public/memberNames', activeNames, 2000);
}

const POS_ORDER = ['PD1','PD2','ADTD','CAM1','CAM2','CAM3','CAM4','CAM5'];
const POS_LABEL = {PD1:'PD1',PD2:'PD2',ADTD:'AD/TD',CAM1:'CAM1',CAM2:'CAM2',CAM3:'CAM3',CAM4:'CAM4',CAM5:'CAM5'};

const SERVICES = [
  { id:'prayer', name:'禱告會',   color:'#58a6ff', weekday:4, time:'19:30-21:00', gather:'18:30-19:00',
    positions:['PD1','ADTD','CAM1','CAM2','CAM3','CAM4','CAM5'] },
  { id:'theone', name:'THE ONE',  color:'#bc8cff', weekday:6, time:'18:30-20:00', gather:'16:30',
    positions:['CAM1','CAM2'] },
  { id:'sun', name:'美河主日', color:'#e3b341', weekday:0, time:'9:00-10:30 / 11:00-12:30', gather:'7:30',
    positions:['PD1','PD2','ADTD','CAM1','CAM2','CAM3','CAM4','CAM5'] },
];

const SUN_OPTIONAL = new Set(['PD2','CAM2']); // sun optional
const PRAYER_CAM2 = 'prayer-CAM2';            // prayer CAM2 always defaults to dash

const INIT_MEMBERS = [
  {id:1, name:'游仁傑',group:'FT',active:true,
   can:{PD1:1,PD2:1,ADTD:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:'導播時若人力不足，可不排AD/TD'},
  {id:2, name:'鄭曼綺',group:'FT',active:true,
   can:{PD1:1,PD2:1,ADTD:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:3, name:'陳旭亮',group:'Y',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},
   note:'⚠️ 洪吉松攝影時不排他導播（兩人可同時攝影）'},
  {id:4, name:'何泓毅',group:'Y',active:true,
   can:{PD1:1,PD2:1,ADTD:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:5, name:'夏維謙',group:'Y',active:false,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:6, name:'盧唯甯',group:'Y',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:7, name:'張先樂',group:'Y',active:false,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:'週四暫停'},
  {id:8, name:'蘇卉昀',group:'Y',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:9, name:'林奕安',group:'Y',active:false,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:10,name:'張承盼',group:'Y',active:false,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:11,name:'林子珆',group:'Y',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:12,name:'高雅竹',group:'Y',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:13,name:'陳心家',group:'Y',active:false,
   can:{CAM1:1,CAM3:1},note:''},
  {id:14,name:'劉承恩',group:'Y',active:true,
   can:{CAM1:1,CAM3:1},note:''},
  {id:15,name:'陳品呈',group:'Y',active:false,
   can:{CAM1:1,CAM3:1},note:''},
  {id:16,name:'徐靜儀',group:'A',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:17,name:'黃宛蘇',group:'A',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM4:1,CAM5:1},
   note:'⚠️ 主日需與王建華同場同崗位（同導播或同攝影）；不排CAM3（腰傷）；聽力受損'},
  {id:18,name:'王建華',group:'A',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},
   note:'⚠️ 主日需與黃宛蘇同場同崗位'},
  {id:19,name:'方宇文',group:'A',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:20,name:'洪榮良',group:'A',active:true,
   can:{PD1:1},note:'⚠️ 只排禱告會PD1'},
  {id:21,name:'李主揚',group:'A',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:22,name:'高庭婕',group:'A',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:23,name:'宋沛縕',group:'A',active:true,
   can:{PD1:1,ADTD:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},
   note:'⚠️ 預設只排AD/TD；排攝影需與方宇文同場；特殊備注才排攝影'},
  {id:24,name:'羅耀琳',group:'A',active:true,
   can:{PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:25,name:'趙彥如',group:'A',active:true,
   can:{PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:26,name:'劉華平',group:'A',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:27,name:'張雅鈞',group:'A',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:28,name:'黃飛程',group:'A',active:true,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:29,name:'蔡慶隆',group:'A',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:30,name:'林俊鴻',group:'A',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:31,name:'黃靜妮',group:'A',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:32,name:'陳科文',group:'A',active:false,
   can:{ADTD:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:'目前場次0'},
  {id:33,name:'洪吉松',group:'A',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},
   note:'⚠️ 盡量避開CAM1；陳旭亮導播時不排他攝影；聽力受損'},
  {id:34,name:'李志芳',group:'A',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:35,name:'許瑜恆',group:'A',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:36,name:'齊湘葶',group:'A',active:true,
   can:{CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:''},
  {id:37,name:'施雅馨',group:'A',active:false,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:'休息一年'},
  {id:38,name:'王健宇',group:'A',active:false,
   can:{PD1:1,PD2:1,CAM1:1,CAM2:1,CAM3:1,CAM4:1,CAM5:1},note:'休息'},
];

let year=new Date().getFullYear(), month=new Date().getMonth()+1;
let members=JSON.parse(JSON.stringify(INIT_MEMBERS));
let assignments={}; // `${wi}-${svcId}-${posId}` → memberId
let unavailMap={};  // `${memberId}-${dateStr}` → true
let surveyFilled=new Set(); // memberIds who have filled survey (set by import or manual)
let dashSet=new Set(); // keys explicitly set to dash (—), no person assigned
let confirmedWeeks=new Set(); // week indices that are locked/confirmed
let currentWi=0, modalCtx=null;

function pad(n){return String(n).padStart(2,'0');}
function fmtDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function mmdd(d){return `${d.getMonth()+1}/${d.getDate()}`;}
function dayName(d){return['日','一','二','三','四','五','六'][d.getDay()];}

function getWeeks(y,m){
  const weeks=[];
  let d=new Date(y,m-1,1);
  while(d.getMonth()===m-1){
    if(d.getDay()===4){
      const thu=new Date(d);
      const sat=new Date(d); sat.setDate(sat.getDate()+2);
      const sun=new Date(d); sun.setDate(sun.getDate()+3);
      weeks.push({thu,sat,sun});
    }
    d.setDate(d.getDate()+1);
  }
  return weeks;
}

function getSvcDate(week,svc){
  if(svc.weekday===4) return week.thu;
  if(svc.weekday===6) return week.sat;
  return week.sun;
}

function getMem(id){return members.find(m=>m.id===id);}
function getActive(){return members.filter(m=>m.active);}

function sessionCount(memId){
  const weeks=getWeeks(year,month);
  let c=0;
  weeks.forEach((_,wi)=>{
    SERVICES.forEach(svc=>{
      if(svc.positions.some(p=>assignments[`${wi}-${svc.id}-${p}`]===memId)) c++;
    });
  });
  return c;
}

function rawCount(id){return Object.values(assignments).filter(v=>v===id).length;}

function getSessionLimit(){
  const w=getWeeks(year,month).length;
  return w>=5?4:3;
}

function canPlace(mem,posId,svcId,wi){
  if(mem.id===20) return svcId==='prayer'&&posId==='PD1'; // 洪榮良
  if(mem.id===23&&posId!=='ADTD') return false; // 宋沛縕
  if(mem.id===3&&(posId==='PD1'||posId==='PD2')){ // 陳旭亮
    const svc=SERVICES.find(s=>s.id===svcId);
    if(svc.positions.filter(p=>p.startsWith('CAM')).some(cp=>assignments[`${wi}-${svcId}-${cp}`]===33)) return false;
  }
  if(mem.id===33){
    if(posId==='CAM1') return false;
    if(posId.startsWith('CAM')){const pd1=assignments[`${wi}-${svcId}-PD1`],pd2=assignments[`${wi}-${svcId}-PD2`];if(pd1===3||pd2===3) return false;}
  }
  if(mem.id===17&&posId==='CAM3') return false;
  return true;
}

function autoSchedule(){
  assignments={};dashSet.clear();confirmedWeeks.clear();
  const weeks=getWeeks(year,month);
  const sesLim=getSessionLimit();
  const hasSurvey=id=>surveyFilled.has(id);

  function sc(id){return sessionCount(id);}
  function alreadyInThisSvc(memId,wi,svcId){
    return SERVICES.find(s=>s.id===svcId).positions.some(p=>assignments[`${wi}-${svcId}-${p}`]===memId);
  }
  function inSvc(memId,wi,svcId){return alreadyInThisSvc(memId,wi,svcId);}
  function consecForSvc(memId,newWi,svcId){
    if(newWi<2) return false;
    const inW=wi=>SERVICES.filter(s=>s.id===svcId).some(s=>s.positions.some(p=>assignments[`${wi}-${s.id}-${p}`]===memId));
    return inW(newWi-1)&&inW(newWi-2);
  }

  weeks.forEach((week,wi)=>{
    SERVICES.forEach(svc=>{
      const dateStr=fmtDate(getSvcDate(week,svc));
      svc.positions.forEach(posId=>{
        if((posId==='PD2'||posId==='CAM2')&&svc.id==='sun') return;
        if(posId==='CAM2'&&svc.id==='prayer') return;

        const key=`${wi}-${svc.id}-${posId}`;
        if(assignments[key]) return;

        let eligible=getActive().filter(mem=>{
          if(!mem.can[posId]) return false;
          if(unavailMap[`${mem.id}-${dateStr}`]) return false;
          if(!hasSurvey(mem.id)&&mem.group!=='FT') return false;
          if(mem.group!=='FT'){
            if(sc(mem.id)>=sesLim) return false;
            if(consecForSvc(mem.id,wi,svc.id)) return false;
          }
          if(alreadyInThisSvc(mem.id,wi,svc.id)) return false;
          if(!canPlace(mem,posId,svc.id,wi)) return false;
          return true;
        });
        eligible.sort((a,b)=>sc(a.id)-sc(b.id));
        if(eligible.length) assignments[key]=eligible[0].id;
      });

      if(svc.id==='prayer'){
        const k=`${wi}-prayer-CAM2`;
        if(!assignments[k]&&!dashSet.has(k)) dashSet.add(k);
      }
    });
  });

  weeks.forEach((week,wi)=>{
    const svc=SERVICES.find(s=>s.id==='sun');
    const dateStr=fmtDate(getSvcDate(week,svc));
    const wsPD=['PD1','PD2'].some(p=>assignments[`${wi}-sun-${p}`]===17);
    const wsCAM=['CAM1','CAM3','CAM4','CAM5'].some(p=>assignments[`${wi}-sun-${p}`]===17);
    const jbIn=svc.positions.some(p=>assignments[`${wi}-sun-${p}`]===18);
    if((wsPD||wsCAM)&&!jbIn){
      const targets=wsPD?['PD1','PD2']:['CAM1','CAM3','CAM4','CAM5'];
      for(const cp of targets){
        const ck=`${wi}-sun-${cp}`;const m=getMem(18);
        if(!assignments[ck]&&m?.can[cp]&&!unavailMap[`18-${dateStr}`]){assignments[ck]=18;break;}
      }
    }
  });

  weeks.forEach((week,wi)=>{
    const svc=SERVICES.find(s=>s.id==='sun');
    const dateStr=fmtDate(getSvcDate(week,svc));
    ['PD2','CAM2'].forEach(optPos=>{
      const optKey=`${wi}-sun-${optPos}`;
      if(assignments[optKey]||dashSet.has(optKey)) return;
      let eligible=getActive().filter(mem=>{
        if(!mem.can[optPos]) return false;
        if(unavailMap[`${mem.id}-${dateStr}`]) return false;
        if(!surveyFilled.has(mem.id)&&mem.group!=='FT') return false;
        if(mem.group!=='FT'&&sc(mem.id)>=sesLim) return false;
        if(inSvc(mem.id,wi,'sun')) return false;
        if(!canPlace(mem,optPos,'sun',wi)) return false;
        return true;
      });
      eligible.sort((a,b)=>sc(a.id)-sc(b.id));
      if(eligible.length) assignments[optKey]=eligible[0].id;
      else dashSet.add(optKey);
    });
  });

  renderAll();
}

async function clearSchedule(){
  if(!confirm(`確定清除 ${year}年${month}月 的所有排班？（其他月份不受影響）`))return;
  assignments={};dashSet.clear();confirmedWeeks.clear();
  await forceFlushMonth();   // 立即存回當月（空資料），不影響其他月份
  renderAll();
}

function confirmWeek(wi){
  confirmedWeeks.add(wi);
  reScheduleFrom(wi+1);
}

function unconfirmWeek(wi){
  confirmedWeeks.delete(wi);
  renderAll();
}

function reScheduleFrom(startWi){
  const weeks=getWeeks(year,month);
  if(startWi>=weeks.length){renderAll();return;}
  const sesLim=getSessionLimit(weeks.length);
  function sc2(id){return sessionCount(id);}
  function inSvc2(memId,wi,svcId){return alreadyInThisSvc(memId,wi,svcId);}
  function consec2(memId,wi,svcId){
    if(wi<2) return false;
    const inW=w=>SERVICES.filter(s=>s.id===svcId).some(s=>s.positions.some(p=>assignments[`${w}-${s.id}-${p}`]===memId));
    return inW(wi-1)&&inW(wi-2);
  }
  for(let wi=startWi;wi<weeks.length;wi++){
    if(confirmedWeeks.has(wi)) continue;
    const week=weeks[wi];
    SERVICES.forEach(svc=>{
      const dateStr=fmtDate(getSvcDate(week,svc));
      svc.positions.forEach(posId=>{
        if(SUN_OPTIONAL.has(posId)&&svc.id==='sun') return;
        if(posId==='CAM2'&&svc.id==='prayer') return;
        const key=`${wi}-${svc.id}-${posId}`;
        if(assignments[key]||dashSet.has(key)) return; // skip filled or dashed
        let eligible=getActive().filter(mem=>{
          if(!mem.can[posId]) return false;
          if(unavailMap[`${mem.id}-${dateStr}`]) return false;
          if(!surveyFilled.has(mem.id)&&mem.group!=='FT') return false;
          if(mem.group!=='FT'){
            if(sc2(mem.id)>=sesLim) return false;
            if(consec2(mem.id,wi,svc.id)) return false;
          }
          if(inSvc2(mem.id,wi,svc.id)) return false;
          if(!canPlace(mem,posId,svc.id,wi)) return false;
          return true;
        });
        eligible.sort((a,b)=>sc2(a.id)-sc2(b.id));
        if(eligible.length) assignments[key]=eligible[0].id;
      });
      if(svc.id==='sun'){
        const wsPD=['PD1','PD2'].some(p=>assignments[`${wi}-sun-${p}`]===17);
        const wsCAM=['CAM1','CAM3','CAM4','CAM5'].some(p=>assignments[`${wi}-sun-${p}`]===17);
        if(wsPD||wsCAM){
          const jbIn=svc.positions.some(p=>assignments[`${wi}-sun-${p}`]===18);
          if(!jbIn){
            const targets=wsPD?['PD1','PD2']:['CAM1','CAM3','CAM4','CAM5'];
            const m18=getMem(18);
            for(const cp of targets){
              const ck=`${wi}-sun-${cp}`;
              if(!assignments[ck]&&m18?.can[cp]&&!unavailMap[`18-${dateStr}`]){assignments[ck]=18;break;}
            }
          }
        }
      }
      if(svc.id==='prayer'){
        const cam2Key=`${wi}-prayer-CAM2`;
        if(!assignments[cam2Key]&&!dashSet.has(cam2Key)){
          dashSet.add(cam2Key);
        }
      }
      if(svc.id==='sun'){
        ['PD2','CAM2'].forEach(optPos=>{
          const optKey=`${wi}-sun-${optPos}`;
          if(assignments[optKey]||dashSet.has(optKey)) return;
          let oe=getActive().filter(mem=>{
            if(!mem.can[optPos]) return false;
            if(unavailMap[`${mem.id}-${dateStr}`]) return false;
            if(!surveyFilled.has(mem.id)&&mem.group!=='FT') return false;
            if(mem.group!=='FT'&&sc2(mem.id)>=sesLim) return false;
            if(inSvc2(mem.id,wi,'sun')) return false;
            if(!canPlace(mem,optPos,'sun',wi)) return false;
            return true;
          });
          oe.sort((a,b)=>sc2(a.id)-sc2(b.id));
          if(oe.length) assignments[optKey]=oe[0].id;
          else dashSet.add(optKey);
        });
      }
    });
  }
  renderAll();
}

