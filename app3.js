
function copyReminder(){
  const surveyUrl=window._surveyLink||'(連結待提供)';
  const txt=`📢 提醒！您的服事調查表尚未填寫，請盡快完成喔！方便後續安排，感謝🙏\n連結如下：${surveyUrl}`;
  navigator.clipboard.writeText(txt).then(()=>alert('✅ 已複製提醒文字'));
}

// ══════════════════════════════════════════
// MEMBERS PANEL
// ══════════════════════════════════════════
const groupLabel={FT:'全職',Y:'青年',A:'成人'};
const groupColor={FT:'var(--accent)',Y:'var(--accent2)',A:'var(--gold)'};
const POS_ALL=['PD1','PD2','ADTD','CAM1','CAM2','CAM3','CAM4','CAM5'];

function renderMembers(){
  const sesLim=getSessionLimit();
  // Sort: active first by group, then inactive at bottom
  const sorted=[...members].sort((a,b)=>{
    if(a.active!==b.active) return a.active?-1:1;
    const go={FT:0,Y:1,A:2};
    return (go[a.group]||0)-(go[b.group]||0);
  });
  document.getElementById('mem-grid').innerHTML=sorted.map(mem=>{
    const cnt=sessionCount(mem.id);
    const isOver=mem.active&&mem.group!=='FT'&&cnt>sesLim;
    const isZero=mem.active&&cnt===0;
    const cntClass=isOver?'count-over':isZero?'count-zero':'';
    const cardClass=`mem-card${!mem.active?' inactive':''}${isOver?' over-limit':''}`;
    const abChips=POS_ALL.map(p=>`<span class="ab-toggle${mem.can[p]?' on':''}" onclick="toggleCan(${mem.id},'${p}')">${POS_LABEL[p]}</span>`).join('');
    return `
      <div class="${cardClass}">
        <div class="flex jb ac mb10">
          <span class="mem-name">${mem.name}${!surveyFilled.has(mem.id)&&mem.active?'<span class="tag tg-o" style="font-size:10px;margin-left:4px">未填</span>':''}</span>
          <div class="flex ac gap6">
            <span class="count-badge ${cntClass}">${cnt}場${isOver?'🔴':''}${isZero&&mem.active?'🔵':''}</span>
            <span class="tag" style="background:rgba(0,0,0,.3);color:${groupColor[mem.group]};font-size:11px">${groupLabel[mem.group]}</span>
            ${!mem.active?'<span class="tag tg-r">暫停</span>':''}
          </div>
        </div>
        <div class="ab-grid">${abChips}</div>
        <textarea class="note-edit" rows="2" placeholder="備注（可直接編輯）" onchange="updateNote(${mem.id},this.value)">${escHtml(mem.note||'')}</textarea>
        <div class="flex gap6 mt6">
          <button class="btn btn-o btn-sm" onclick="toggleActive(${mem.id})">${mem.active?'暫停':'恢復'}</button>
        </div>
      </div>`;
  }).join('');
}

function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toggleCan(id,pos){const m=getMem(id);if(!m)return;if(m.can[pos])delete m.can[pos];else m.can[pos]=1;saveMembers();renderMembers();}
function updateNote(id,val){const m=getMem(id);if(m){m.note=val;saveMembers();}}
function toggleActive(id){const m=getMem(id);if(m){m.active=!m.active;saveMembers();renderMembers();}}
function openAddMember(){document.getElementById('add-modal').classList.add('open');}
function closeAddModal(){document.getElementById('add-modal').classList.remove('open');}
function saveNewMember(){
  const name=document.getElementById('new-mem-name').value.trim();
  if(!name){alert('請輸入姓名');return;}
  const newId=Math.max(...members.map(m=>m.id))+1;
  members.push({id:newId,name,group:document.getElementById('new-mem-group').value,
    active:document.getElementById('new-mem-active').value==='1',can:{},
    note:document.getElementById('new-mem-note').value});
  saveMembers();
  closeAddModal();renderMembers();
}

// ══════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════
function openModal(wi,svcId,posId){
  modalCtx={wi,svcId,posId};
  const svc=SERVICES.find(s=>s.id===svcId);
  const week=getWeeks(year,month)[wi];
  const date=getSvcDate(week,svc);
  const isSun=svc.id==='sun';
  document.getElementById('modal-title').textContent=
    `${svc.name} ${mmdd(date)}（${dayName(date)}）— ${POS_LABEL[posId]}`;
  const dateStr=fmtDate(date);
  // eligible：全職同工只看崗位能力+可用時間；其他同工同樣但標記 taken 狀態
  const allEligible=members.filter(m=>m.active&&m.can[posId]&&!unavailMap[`${m.id}-${dateStr}`]);
  // 全職同工永遠顯示在最前，且不灰掉（isTaken不適用）
  const ftMembers=allEligible.filter(m=>m.group==='FT');
  const others=allEligible.filter(m=>m.group!=='FT');
  const eligible=[...ftMembers,...others];

  // 記錄同場次已有人的崗位（用於非全職的 taken 樣式）
  const alreadyIn=new Set(svc.positions.map(p=>assignments[`${wi}-${svcId}-${p}`]).filter(Boolean));
  const cur=assignments[`${wi}-${svcId}-${posId}`];
  const isDashNow=dashSet.has(`${wi}-${svcId}-${posId}`);
  const curAssigned=assignments[`${wi}-${svcId}-${posId}`];
  const dashOpt=`<button class="opt-btn" onclick="selectPerson('DASH')"
    style="grid-column:span 2;color:var(--muted);border-style:dashed;${isDashNow?'border-color:var(--accent);color:var(--text)':''}">
    ${isDashNow?'✓ ':''} — 破折號（不安排此崗位）
  </button>`;
  const clearOpt=curAssigned?`<button class="opt-btn btn-d" onclick="selectPerson('CLEAR')"
    style="grid-column:span 2;border-color:rgba(248,81,73,.3);color:var(--red);font-size:12px">
    🗑 清除指派（回到「未排」狀態）
  </button>`:'';
  document.getElementById('modal-opts').innerHTML=dashOpt+clearOpt+eligible.map(mem=>{
    const isCur=mem.id===cur;
    const isFT=mem.group==='FT';
    // 全職同工：不灰掉，永遠可選；非全職：已在同場次其他崗位才灰掉
    const isTaken=!isFT&&alreadyIn.has(mem.id)&&!isCur;
    const inOtherPos=alreadyIn.has(mem.id)&&!isCur; // 已在同場次（含全職）
    const isNotFilled=!surveyFilled.has(mem.id)&&!isFT;
    const ftBadge=isFT?'<span style="background:rgba(88,166,255,.2);color:#58a6ff;font-size:10px;border-radius:3px;padding:1px 5px;margin-left:4px">全職</span>':'';
    const swapHint=isFT&&inOtherPos?'<span style="color:var(--gold);font-size:10px;margin-left:4px">↔ 換崗</span>':'';
    return `<button class="opt-btn${isCur?' cur':''}${isTaken?' taken':''}" onclick="selectPerson(${mem.id})"
      title="${isFT&&inOtherPos?'點擊將自動清除此人在本場次的其他崗位':''}">
      <span>${isCur?'✓ ':''} ${mem.name}${ftBadge}${swapHint}${isNotFilled?'<span style="color:var(--gold);font-size:10px;margin-left:4px">未填</span>':''}</span>
      <span class="count-badge" style="margin-left:auto;${isFT?'color:#58a6ff;border-color:rgba(88,166,255,.3)':''}">${isFT?'全':sessionCount(mem.id)}</span>
    </button>`;
  }).join('')||'<div style="color:var(--muted);padding:20px;text-align:center;grid-column:span 2">無可用人員</div>';
  document.getElementById('assign-modal').classList.add('open');
}

function selectPerson(id){
  if(!modalCtx)return;
  const{wi,svcId,posId}=modalCtx;
  const key=`${wi}-${svcId}-${posId}`;
  if(id==='DASH'){
    delete assignments[key];
    dashSet.add(key);
  } else if(id==='CLEAR'){
    delete assignments[key];
    dashSet.delete(key);
  } else {
    const mem=getMem(id);
    // 全職同工：若已在同場次其他崗位，自動清除舊崗位（換崗）
    if(mem&&mem.group==='FT'){
      const svc=SERVICES.find(s=>s.id===svcId);
      svc.positions.forEach(p=>{
        if(p!==posId&&assignments[`${wi}-${svcId}-${p}`]===id){
          delete assignments[`${wi}-${svcId}-${p}`];
        }
      });
    }
    assignments[key]=id;
    dashSet.delete(key);
  }
  saveAssignments();saveDashes();
  closeModal();renderSchedTable();renderStats();renderWarnings();
  if(document.getElementById('panel-members').classList.contains('active'))renderMembers();
}
function clearCell(){
  if(!modalCtx)return;const{wi,svcId,posId}=modalCtx;
  const key=`${wi}-${svcId}-${posId}`;
  delete assignments[key];dashSet.delete(key);
  closeModal();renderSchedTable();renderStats();renderWarnings();
}
function closeModal(){document.getElementById('assign-modal').classList.remove('open');modalCtx=null;}

// ══════════════════════════════════════════
// IMPORT — SurveyCake
// ══════════════════════════════════════════
let XLSX_LIB=null;
async function ensureSheetJS(){
  if(XLSX_LIB) return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=()=>{XLSX_LIB=window.XLSX;res();};s.onerror=rej;
    document.head.appendChild(s);
  });
}
let _parsedPreview=[];

function handleFileSelect(e){processFile(e.target.files[0]);}
function handleFileDrop(e){e.preventDefault();document.getElementById('drop-zone').classList.remove('drag-over');processFile(e.dataTransfer.files[0]);}

async function processFile(file){
  if(!file) return;
  document.getElementById('import-result').innerHTML='<div class="alert alert-y">⏳ 讀取中...</div>';
  document.getElementById('import-preview').style.display='none';
  try{
    await ensureSheetJS();
    const data=await file.arrayBuffer();
    const wb=XLSX_LIB.read(data,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX_LIB.utils.sheet_to_json(ws,{header:1,defval:''});
    parseSurveyCakeRows(rows);
  }catch(err){
    const reader=new FileReader();
    reader.onload=function(e){
      const lines=e.target.result.split('\n');
      parseSurveyCakeRows(lines.map(l=>l.split(',').map(c=>c.replace(/^"|"$/g,'').trim())));
    };
    reader.readAsText(file,'UTF-8');
  }
}

function detectColumns(header){
  const h=header.map(c=>String(c));
  const find=(kws)=>h.findIndex(c=>kws.some(k=>c.includes(k)));
  return{
    nameCol:find(['姓名','name']),prayerCol:find(['禱告會']),
    theOneCol:find(['THE ONE','青年聚會','青年']),
    sundayCol:find(['主日','美河堂','Sunday']),noteCol:find(['備註','備注','其他','other']),
  };
}

function parseDateCell(val){
  const s=String(val||'').trim();
  if(!s||s==='時間都可以') return '__ALL_AVAIL';
  if(s==='時間都不行') return '__ALL_UNAVAIL';
  const lines=s.split(/[\n\r,、]+/).map(l=>l.trim()).filter(Boolean);
  const result=[];
  for(const token of lines){
    const m1=token.match(/^(\d{1,2})\/(\d{1,2})$/);
    const m2=token.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(m1) result.push(`${year}-${pad(parseInt(m1[1]))}-${pad(parseInt(m1[2]))}`);
    else if(m2) result.push(`${m2[1]}-${pad(parseInt(m2[2]))}-${pad(parseInt(m2[3]))}`);
  }
  return result.length?result:'__ALL_AVAIL';
}

function getSvcDatesForType(svcType){
  const weeks=getWeeks(year,month);
  const ids=svcType==='prayer'?['prayer']:svcType==='theone'?['theone']:['sun'];
  const dates=new Set();
  weeks.forEach(w=>ids.forEach(id=>{const svc=SERVICES.find(s=>s.id===id);if(svc)dates.add(fmtDate(getSvcDate(w,svc)));}));
  return [...dates].sort();
}

function matchMember(rawName){
  const n=rawName.trim();
  return members.find(x=>x.name===n)||members.find(x=>x.name.includes(n)||n.includes(x.name));
}

function parseSurveyCakeRows(rows){
  if(!rows.length){document.getElementById('import-result').innerHTML='<div class="alert alert-r">❌ 無法讀取</div>';return;}
  const header=rows[0];const cols=detectColumns(header);
  if(cols.nameCol<0){document.getElementById('import-result').innerHTML='<div class="alert alert-r">❌ 找不到「姓名」欄位</div>';return;}
  const allP=getSvcDatesForType('prayer'),allT=getSvcDatesForType('theone'),allS=getSvcDatesForType('sunday');
  _parsedPreview=[];
  for(let i=1;i<rows.length;i++){
    const row=rows[i];const rawName=String(row[cols.nameCol]||'').trim();if(!rawName)continue;
    const mem=matchMember(rawName);
    const pA=cols.prayerCol>=0?parseDateCell(row[cols.prayerCol]):'__ALL_AVAIL';
    const tA=cols.theOneCol>=0?parseDateCell(row[cols.theOneCol]):'__ALL_AVAIL';
    const sA=cols.sundayCol>=0?parseDateCell(row[cols.sundayCol]):'__ALL_AVAIL';
    const noteVal=cols.noteCol>=0?String(row[cols.noteCol]||'').trim():'';
    const unavailDates=[];
    function applyAvail(avail,allDates){
      if(avail==='__ALL_AVAIL') return;
      if(avail==='__ALL_UNAVAIL'){unavailDates.push(...allDates);return;}
      unavailDates.push(...avail); // listed dates = unavailable
    }
    applyAvail(pA,allP);applyAvail(tA,allT);applyAvail(sA,allS);
    _parsedPreview.push({rawName,mem,unavailDates,noteVal,
      prayerCell:String(row[cols.prayerCol]||''),theOneCell:String(row[cols.theOneCol]||''),
      sundayCell:String(row[cols.sundayCol]||'')});
  }
  if(!_parsedPreview.length){document.getElementById('import-result').innerHTML='<div class="alert alert-r">❌ 無資料列</div>';return;}
  renderImportPreview();
}

function renderImportPreview(){
  const matched=_parsedPreview.filter(r=>r.mem),notFound=_parsedPreview.filter(r=>!r.mem);
  let html=`<thead><tr>
    <th style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border)">姓名</th>
    <th style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border)">比對</th>
    <th style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border)">禱告會</th>
    <th style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border)">THE ONE</th>
    <th style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border)">主日</th>
    <th style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border)">封鎖天</th>
  </tr></thead><tbody>`;
  _parsedPreview.forEach(r=>{
    const status=r.mem?(r.mem.name===r.rawName?`<span class="tag tg-g">✓ ${r.mem.name}</span>`:`<span class="tag tg-o">⚠ ${r.mem.name}</span>`):
      `<span class="tag tg-r">✗ 未找到</span>`;
    html+=`<tr style="${!r.mem?'opacity:.5':''}">
      <td style="padding:6px 10px;border:1px solid var(--border);font-weight:600">${r.rawName}</td>
      <td style="padding:6px 10px;border:1px solid var(--border)">${status}</td>
      <td style="padding:6px 10px;border:1px solid var(--border);font-size:12px;color:var(--muted)">${r.prayerCell||'—'}</td>
      <td style="padding:6px 10px;border:1px solid var(--border);font-size:12px;color:var(--muted)">${r.theOneCell||'—'}</td>
      <td style="padding:6px 10px;border:1px solid var(--border);font-size:12px;color:var(--muted)">${r.sundayCell||'—'}</td>
      <td style="padding:6px 10px;border:1px solid var(--border);text-align:center">
        ${r.mem?`<span class="count-badge" style="color:${r.unavailDates.length>0?'var(--red)':'var(--green)'}">${r.unavailDates.length}</span>`:'—'}</td>
    </tr>`;
  });
  html+='</tbody>';
  document.getElementById('preview-tbl').innerHTML=html;
  document.getElementById('import-preview').style.display='block';
  document.getElementById('import-result').innerHTML=`<div class="alert alert-g">📊 解析：${matched.length} 人成功，${notFound.length} 人未找到${notFound.length?'（'+notFound.map(r=>r.rawName).join('、')+'）':''}</div>`;
}

function confirmImport(){
  let updated=0;
  const allDates=[...getSvcDatesForType('prayer'),...getSvcDatesForType('theone'),...getSvcDatesForType('sunday')];
  _parsedPreview.forEach(r=>{
    if(!r.mem) return;
    allDates.forEach(ds=>delete unavailMap[`${r.mem.id}-${ds}`]);
    r.unavailDates.forEach(ds=>{unavailMap[`${r.mem.id}-${ds}`]=true;});
    if(r.noteVal) r.mem.note=(r.mem.note?r.mem.note+'\n':'')+`[問卷] ${r.noteVal}`;
    surveyFilled.add(r.mem.id);
    updated++;
  });
  document.getElementById('import-preview').style.display='none';
  saveUnavail();saveSurvey();saveMembers();
  document.getElementById('import-result').innerHTML=`<div class="alert alert-g">✅ 已匯入 ${updated} 位同工，資料已同步到雲端！</div>`;
  renderAvail();renderSurvey();
  if(document.getElementById('panel-members').classList.contains('active')) renderMembers();
}
function cancelImport(){_parsedPreview=[];document.getElementById('import-preview').style.display='none';document.getElementById('import-result').innerHTML='';}

// ══════════════════════════════════════════
// EXPORT — 圖片版
// ══════════════════════════════════════════
function buildExportHTML(){
  const weeks=getWeeks(year,month);
  const svcColors={prayer:'#58a6ff',theone:'#bc8cff',sun:'#e3b341'};
  let html=`<div style="background:#0d1117;padding:28px;min-width:720px;font-family:system-ui,sans-serif;color:#c9d1d9">
    <div style="margin-bottom:20px">
      <div style="font-size:22px;font-weight:700;color:#e2e8f0">Top Church 影視部</div>
      <div style="font-size:15px;color:#8b949e;margin-top:4px">📅 ${year}年${month}月 媒體服事表</div>
    </div>`;
  weeks.forEach((week,wi)=>{
    const wkLabel=['一','二','三','四','五'][wi];
    const isConf=confirmedWeeks.has(wi);
    html+=`<div style="margin-bottom:20px">
      <div style="font-size:14px;font-weight:700;color:${isConf?'#3fb950':'#58a6ff'};margin-bottom:10px">
        ◆ 第${wkLabel}週${isConf?' ✓':''}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">`;
    SERVICES.forEach(svc=>{
      const date=getSvcDate(week,svc);
      const col=svcColors[svc.id];
      html+=`<div style="background:#161b22;border:1px solid #30363d;border-top:3px solid ${col};border-radius:8px;padding:12px 14px;min-width:160px;flex:1">
        <div style="color:${col};font-weight:700;font-size:13px">${svc.name}</div>
        <div style="font-size:11px;color:#8b949e;margin-top:2px">${mmdd(date)}（${dayName(date)}） ${svc.time}</div>
        <div style="font-size:12px;font-weight:700;color:#e3b341;margin-top:3px;margin-bottom:8px">🕐 集合 ${svc.gather}</div>`;
      POS_ORDER.forEach(posId=>{
        if(!svc.positions.includes(posId)) return;
        const key=`${wi}-${svc.id}-${posId}`;
        const memId=assignments[key];
        const isDash=dashSet.has(key);
        const mem=memId?getMem(memId):null;
        const nameText=mem?mem.name:isDash?'—':'（未排）';
        const nameColor=mem?'#e2e8f0':isDash?'#555':'#f85149';
        const bold=mem?'600':'400';
        html+=`<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #21262d">
          <span style="font-size:12px;color:#8b949e;min-width:50px">${POS_LABEL[posId]}</span>
          <span style="font-size:13px;color:${nameColor};font-weight:${bold}">${nameText}</span>
        </div>`;
      });
      html+=`</div>`;
    });
    html+=`</div></div>`;
  });
  html+=`<div style="margin-top:12px;font-size:11px;color:#444;text-align:right">產製：${new Date().toLocaleString('zh-TW')}</div></div>`;
  return html;
}

async function generateImage(mode){
  const status=document.getElementById('export-status');
  status.textContent='⏳ 載入工具中…';
  if(!window.html2canvas){
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload=res;s.onerror=rej;
      document.head.appendChild(s);
    });
  }
  status.textContent='🎨 繪製排班表中…';
  const container=document.createElement('div');
  container.style.cssText='position:fixed;left:-9999px;top:0;z-index:-1;';
  container.innerHTML=buildExportHTML();
  document.body.appendChild(container);
  try{
    const canvas=await html2canvas(container,{backgroundColor:'#0d1117',scale:2,useCORS:true,logging:false});
    document.body.removeChild(container);
    if(mode==='download'){
      const a=document.createElement('a');
      a.download=`TopChurch_${year}${pad(month)}_服事表.png`;
      a.href=canvas.toDataURL('image/png');a.click();
      status.textContent='✅ 圖片已下載！';
    } else {
      const img=document.getElementById('export-preview-img');
      img.src=canvas.toDataURL('image/png');
      document.getElementById('export-preview-wrap').style.display='block';
      status.textContent='✅ 預覽如下。長按圖片可儲存或分享到 LINE。';
    }
  }catch(e){
    if(document.body.contains(container)) document.body.removeChild(container);
    status.textContent='❌ 產生失敗：'+e.message;
  }
}


// ── 複製公開表單連結 ──
function copyFormLink(){
  const base = window.location.origin + window.location.pathname.replace('index.html','');
  const url = `${base}form.html?m=${year}-${pad(month)}`;
  navigator.clipboard.writeText(url).then(()=>{
    const el = document.getElementById('form-link-notice');
    if(el){ el.textContent=`✓ 已複製！${url}`; el.style.display='block';
      setTimeout(()=>{ el.style.display='none'; },5000); }
  }).catch(()=>{ alert('表單連結：
'+url); });
}

// ══════════════════════════════════════════
// MONTH / TAB
// ══════════════════════════════════════════

// ══ 強制立即存檔目前月份（切換月份前必須呼叫）══
async function forceFlushMonth(){
  // 取消所有 debounce 中的存檔
  const paths=[
    DB_PATHS.assignments(month),
    DB_PATHS.dashes(month),
    DB_PATHS.unavail(month),
    DB_PATHS.survey(month),
  ];
  paths.forEach(p=>{ if(_saveDebounce[p]){clearTimeout(_saveDebounce[p]);delete _saveDebounce[p];} });
  // 立即寫入 Firebase
  const dashObj={};dashSet.forEach(k=>{dashObj[k]=true;});
  const surveyObj={};surveyFilled.forEach(id=>{surveyObj[id]=true;});
  try{
    await Promise.all([
      window._fbSet(window._fbRef(DB_PATHS.assignments(month)), assignments),
      window._fbSet(window._fbRef(DB_PATHS.dashes(month)),     dashObj),
      window._fbSet(window._fbRef(DB_PATHS.unavail(month)),    unavailMap),
      window._fbSet(window._fbRef(DB_PATHS.survey(month)),     surveyObj),
    ]);
  }catch(e){console.error('forceFlushMonth error:',e);}
}

async function changeMonth(dir){
  showSync(true);
  await forceFlushMonth();
  month+=dir;if(month>12){month=1;year++;}if(month<1){month=12;year--;}
  currentWi=0;
  // 清除匯入UI殘留（避免上個月的「已匯入XX位」顯示到新月份）
  const ir=document.getElementById('import-result');
  const ip=document.getElementById('import-preview');
  if(ir) ir.innerHTML='';
  if(ip) ip.style.display='none';
  _parsedPreview=[];
  await loadMonthData();
  renderAll();
  showSync(false);
}
function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  const names=['schedule','members','avail','survey','import','export'];
  document.querySelectorAll('.tab')[names.indexOf(name)].classList.add('active');
  document.getElementById('panel-'+name).classList.add('active');
  if(name==='members') renderMembers();
  if(name==='avail') renderAvail();
  if(name==='survey') renderSurvey();
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
document.getElementById('assign-modal').addEventListener('click',e=>{if(e.target===document.getElementById('assign-modal'))closeModal();});
document.getElementById('add-modal').addEventListener('click',e=>{if(e.target===document.getElementById('add-modal'))closeAddModal();});
renderAll();