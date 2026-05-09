function renderAll(){
  updateMonthDisplay();
  renderWeekTabs();
  renderSchedTable();
  renderStats();
  renderWarnings();
  if(document.getElementById('panel-avail').classList.contains('active')) renderAvail();
  if(document.getElementById('panel-members').classList.contains('active')) renderMembers();
  if(document.getElementById('panel-survey').classList.contains('active')) renderSurvey();
}

function updateMonthDisplay(){document.getElementById('month-disp').textContent=`${year}-${pad(month)}`;}

function renderWeekTabs(){
  const weeks=getWeeks(year,month);
  document.getElementById('week-tabs').innerHTML=weeks.map((w,i)=>{
    let weekUnfilled=0;
    SERVICES.forEach(svc=>{
      svc.positions.forEach(posId=>{
        const k=`${i}-${svc.id}-${posId}`;
        if(!assignments[k]&&!dashSet.has(k)) weekUnfilled++;
      });
    });
    const badge=weekUnfilled>0?`<span style="background:var(--red);color:white;border-radius:4px;font-size:10px;padding:1px 5px;margin-left:4px">${weekUnfilled}</span>`:'';
    const isConf=confirmedWeeks.has(i);
    return `<div class="wtab${i===currentWi?' active':''}${isConf?' confirmed':''}" onclick="selectWeek(${i})">
      第${['一','二','三','四','五'][i]}週
      <span style="font-size:11px;${isConf?'':'color:var(--muted);'}margin-left:4px">${mmdd(w.thu)}</span>
      ${isConf?'<span class="confirmed-badge">✓ 已確認</span>':badge}
    </div>`;
  }).join('');
}

function selectWeek(i){currentWi=i;renderWeekTabs();renderSchedTable();}

function renderSchedTable(){
  const weeks=getWeeks(year,month);
  if(!weeks.length){document.getElementById('sched-body').innerHTML='<div style="padding:40px;text-align:center;color:var(--muted)">此月無週四</div>';return;}
  const week=weeks[currentWi]; if(!week) return;

  const hdrCells=SERVICES.map(svc=>{
    const date=getSvcDate(week,svc);
    const isSun=svc.id==='sun';
    return `<th style="border-top:3px solid ${svc.color}${isSun?';background:rgba(227,179,65,.04)':''}">
      <span class="svc-hdr" style="color:${svc.color}">${svc.name}</span>
      <span class="svc-date">${mmdd(date)}（${dayName(date)}）</span>
      <span class="svc-date">${svc.time}</span>
    </th>`;
  }).join('');

  const rows=POS_ORDER.map(posId=>{
    const cells=SERVICES.map(svc=>{
      if(!svc.positions.includes(posId)) return `<td><span class="cell-na">—</span></td>`;
      const key=`${currentWi}-${svc.id}-${posId}`;
      const memId=assignments[key];
      const mem=memId?getMem(memId):null;
      const oc=`openModal(${currentWi},'${svc.id}','${posId}')`;
      const isDash=dashSet.has(key);
      if(mem) return `<td><span class="cell-filled" onclick="${oc}">${mem.name}</span></td>`;
      if(isDash) return `<td><span class="cell-dash" onclick="${oc}" title="點擊修改">—</span></td>`;
      return `<td><span class="cell-warn" onclick="${oc}">— 未排</span></td>`;
    }).join('');
    const isSunOpt=SUN_OPTIONAL.has(posId)&&false; // label handled per-cell
    return `<tr><td class="pos-col">${POS_LABEL[posId]}${SUN_OPTIONAL.has(posId)?'<span style="font-size:10px;color:var(--muted);margin-left:4px">選填</span>':''}</td>${cells}</tr>`;
  }).join('');

  const isConfirmedWk=confirmedWeeks.has(currentWi);
  const wkLabel=['一','二','三','四','五'][currentWi];
  document.getElementById('sched-body').innerHTML=`
    <table class="sched-tbl">
      <thead><tr><th class="pos-col" style="font-size:13px;text-align:left;padding-left:14px">崗位</th>${hdrCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding:14px 16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface)">
      ${!isConfirmedWk
        ? '<button class=\"confirm-btn\" onclick=\"confirmWeek('+currentWi+')\">✅ 確認第'+wkLabel+'週，自動更新後續週次</button><span style=\"font-size:12px;color:var(--muted)\">確認後此週鎖定，後面週次空缺依此結果補算（已有安排的不動）</span>'
        : '<span class=\"confirm-btn confirmed\">✓ 第'+wkLabel+'週已確認</span><button class=\"unconfirm-btn\" onclick=\"unconfirmWeek('+currentWi+')\">解除確認</button><span style=\"font-size:12px;color:var(--muted)\">解除後可重新編輯此週</span>'
      }
    </div>`;
}

function renderStats(){
  const weeks=getWeeks(year,month);
  const total=Object.keys(assignments).length;
  const needed=weeks.reduce((s,_,wi)=>s+SERVICES.reduce((a,svc)=>a+svc.positions.length,0),0);
  const filled=Object.keys(assignments).length;
  const dashedMandatory=[...dashSet].length;
  const unfilledMandatory=Math.max(0,needed-filled-dashedMandatory);
  const pct=needed?Math.round(filled/needed*100):0;
  const color=pct===100?'var(--green)':pct>80?'var(--gold)':'var(--red)';
  const posDesc=SERVICES.map(svc=>{
    const mandatory=svc.positions.filter(p=>!(p==='PD2'&&svc.id==='sun')&&!(p==='CAM2'&&svc.id==='sun'));
    return `${svc.name}：${mandatory.map(p=>POS_LABEL[p]).join('+')}`;
  }).join('\n');
  const tooltip=`必要崗位說明（禱告會無PD2/CAM2；主日PD2/CAM2有餘力才排；破折號不計入空缺）：\n${posDesc}`;
  document.getElementById('schedule-stats').innerHTML=`
    <div class="stat"><div class="stat-n">${weeks.length}</div><div class="stat-l">週次</div></div>
    <div class="stat"><div class="stat-n" style="color:var(--green)">${filled}</div><div class="stat-l">已排</div></div>
    <div class="stat" title="${tooltip}" style="cursor:help">
      <div class="stat-n" style="color:var(--muted)">${needed}</div>
      <div class="stat-l">必要崗位 <span style="font-size:10px;color:var(--accent)">(?)</span></div>
    </div>
    <div class="stat" title="必要崗位中尚未排人的空缺數">
      <div class="stat-n" style="color:${unfilledMandatory>0?'var(--red)':'var(--green)'}">${unfilledMandatory}</div>
      <div class="stat-l">未排空缺</div>
    </div>
    <div class="stat"><div class="stat-n" style="color:${color}">${pct}%</div><div class="stat-l">完成率</div></div>`;
}

function renderWarnings(){
  const weeks=getWeeks(year,month);
  const sesLim=getSessionLimit();
  const warns=[];

  weeks.forEach((week,wi)=>{
    const wn=['一','二','三','四','五'][wi];
    {
      const wsPD=['PD1','PD2'].some(p=>assignments[`${wi}-sun-${p}`]===17);
      const wsCAM=['CAM1','CAM3','CAM4','CAM5'].some(p=>assignments[`${wi}-sun-${p}`]===17);
      if(wsPD||wsCAM){
        const jbPD=['PD1','PD2'].some(p=>assignments[`${wi}-sun-${p}`]===18);
        const jbCAM=['CAM1','CAM3','CAM4','CAM5'].some(p=>assignments[`${wi}-sun-${p}`]===18);
        if(!jbPD&&!jbCAM) warns.push({t:'r',m:`第${wn}週 美河主日：黃宛蘇有排，但王建華未排入同場`});
        else if(wsPD&&!jbPD) warns.push({t:'r',m:`第${wn}週 美河主日：黃宛蘇為導播，王建華非導播（需同崗位類型）`});
        else if(wsCAM&&!jbCAM) warns.push({t:'r',m:`第${wn}週 美河主日：黃宛蘇為攝影，王建華非攝影（需同崗位類型）`});
      }
    }
    SERVICES.forEach(svc=>{
      const seen={};
      svc.positions.forEach(posId=>{
        const memId=assignments[`${wi}-${svc.id}-${posId}`];
        if(!memId) return;
        if(seen[memId]){
          const name=getMem(memId)?.name||memId;
          warns.push({t:'r',m:`第${wn}週 ${svc.name}：${name} 被排在兩個崗位（${POS_LABEL[seen[memId]]} 和 ${POS_LABEL[posId]}），需排錯！`});
        } else seen[memId]=posId;
      });
    });
    SERVICES.forEach(svc=>{
      const xPD=['PD1','PD2'].some(p=>assignments[`${wi}-${svc.id}-${p}`]===3);
      const hCAM=svc.positions.filter(p=>p.startsWith('CAM')).some(cp=>assignments[`${wi}-${svc.id}-${cp}`]===33);
      if(xPD&&hCAM) warns.push({t:'r',m:`第${wn}週 ${svc.name}：陳旭亮導播 + 洪吉松攝影（互斥規則）`});
    });
    if(wi>=2){
      getActive().filter(m=>m.group!=='FT').forEach(mem=>{
        SERVICES.forEach(svc=>{
          const inW=w=>svc.positions.some(p=>assignments[`${w}-${svc.id}-${p}`]===mem.id);
          if(inW(wi)&&inW(wi-1)&&inW(wi-2)){
            warns.push({t:'y',m:`${mem.name} 連排3週「${svc.name}」（第${['一','二','三','四','五'][wi-2]}~${wn}週），請確認`});
          }
        });
      });
    }
  });

  const sesLimWarn=getActive().filter(m=>m.group!=='FT'&&sessionCount(m.id)>sesLim);
  sesLimWarn.forEach(m=>warns.push({t:'y',m:`${m.name} 本月服事 ${sessionCount(m.id)} 場，超出上限 ${sesLim} 場，請確認或手動調整`}));

  const notFilled=getActive().filter(m=>m.group!=='FT'&&!surveyFilled.has(m.id)&&rawCount(m.id)>0);
  notFilled.forEach(m=>warns.push({t:'b',m:`${m.name} 尚未填寫問卷，但已被排入 ${rawCount(m.id)} 場（手動排班）`}));

  document.getElementById('schedule-warnings').innerHTML=warns.map(w=>`
    <div class="alert alert-${w.t}">${w.t==='r'?'🔴':w.t==='b'?'🔵':'⚠️'} ${w.m}</div>`).join('');
}

function renderAvail(){
  const weeks=getWeeks(year,month);
  if(!weeks.length){document.getElementById('avail-tbl').innerHTML='';return;}
  const allCols=[];
  weeks.forEach((week,wi)=>{
    SERVICES.forEach(svc=>{
      const date=getSvcDate(week,svc);const ds=fmtDate(date);
      if(!allCols.find(c=>c.ds===ds&&c.svcId===svc.id))
        allCols.push({ds,label:`${mmdd(date)}(${dayName(date)})`,svcName:svc.name,color:svc.color,wi,svcId:svc.id});
    });
  });
  const activeMems=getActive();
  const ths=allCols.map((c,i)=>{
    const isNew=i>0&&allCols[i-1].wi!==c.wi;
    const isSun=c.svcId==='sun';
    return `<th style="font-size:11px;border:1px solid var(--border);padding:5px 8px;${isNew?'border-left:3px solid var(--accent);':''}" title="${c.svcName} ${c.ds}">
      <div style="color:${c.color};font-weight:700">${isSun?'美河主日':c.svcName}</div>
      <div style="color:var(--muted);font-size:10px">${c.label}</div>
    </th>`;
  }).join('');
  const trows=activeMems.map(mem=>{
    const tds=allCols.map((c,i)=>{
      const isUnavail=unavailMap[`${mem.id}-${c.ds}`];
      const isFilled=surveyFilled.has(mem.id);
      const isNew=i>0&&allCols[i-1].wi!==c.wi;
      const dotClass=isUnavail?'off':(!isFilled?'pending':'');
      return `<td style="text-align:center;border:1px solid var(--border);${isNew?'border-left:3px solid var(--accent);':''}padding:4px 6px"
        title="${mem.name} · ${c.svcName} ${c.label}${!isFilled?' (尚未填問卷)':''}"
        onclick="toggleUnavail(${mem.id},'${c.ds}')">
        <div class="dot${dotClass?' '+dotClass:''}"></div>
      </td>`;
    }).join('');
    return `<tr><td class="name-col">${mem.name}${!surveyFilled.has(mem.id)?'<span class="tag tg-o" style="font-size:10px;margin-left:4px">未填</span>':''}</td>${tds}</tr>`;
  }).join('');
  document.getElementById('avail-tbl').innerHTML=`
    <table class="avail-tbl">
      <thead><tr><th class="sticky" style="text-align:left;padding:6px 12px;border:1px solid var(--border)">同工</th>${ths}</tr></thead>
      <tbody>${trows}</tbody>
    </table>
    <div style="font-size:13px;color:var(--muted);margin-top:10px">🔴=不可服事 ｜ 🟡=尚未填問卷（點擊可手動設定，設定後從未填清單移除）</div>`;
}

function toggleUnavail(memId,ds){
  const k=`${memId}-${ds}`;
  if(unavailMap[k]) delete unavailMap[k]; else unavailMap[k]=true;
  surveyFilled.add(memId);
  saveUnavail();saveSurvey();
  renderAvail();
  if(document.getElementById('panel-survey').classList.contains('active')) renderSurvey();
}

function renderSurvey(){
  const notFilled=getActive().filter(m=>m.group!=='FT'&&!surveyFilled.has(m.id));
  const el=document.getElementById('not-filled-list');
  if(!notFilled.length){
    el.innerHTML='<div class="alert alert-g">✅ 所有服事中的同工都已填寫問卷！</div>';return;
  }
  el.innerHTML=notFilled.map(m=>`
    <div class="not-filled-card">
      <div class="flex jb ac">
        <span class="not-filled-name">${m.name}</span>
        <div class="flex gap6">
          <span class="tag tg-muted">${{FT:'全職',Y:'青年',A:'成人'}[m.group]}</span>
          <button class="btn btn-sm btn-o" onclick="markFilled(${m.id})">✓ 標記已填寫</button>
        </div>
      </div>
    </div>`).join('');
}

function markFilled(id){
  surveyFilled.add(id);
  saveSurvey();
  renderSurvey();
  renderAvail();
}

function copyReminder(){
  const surveyUrl=window._surveyLink||'(連結待提供)';
  const txt=`📢 提醒！您的服事調查表尚未填寫，請盡快完成喔！方便後續安排，感謝🙏\n連結如下：${surveyUrl}`;
  navigator.clipboard.writeText(txt).then(()=>alert('✅ 已複製提醒文字'));
}

const groupLabel={FT:'全職',Y:'青年',A:'成人'};
const groupColor={FT:'var(--accent)',Y:'var(--accent2)',A:'var(--gold)'};
const POS_ALL=['PD1','PD2','ADTD','CAM1','CAM2','CAM3','CAM4','CAM5'];

function renderMembers(){
  const sesLim=getSessionLimit();
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

function openModal(wi,svcId,posId){
  modalCtx={wi,svcId,posId};
  const svc=SERVICES.find(s=>s.id===svcId);
  const week=getWeeks(year,month)[wi];
  const date=getSvcDate(week,svc);
  const isSun=svc.id==='sun';
  document.getElementById('modal-title').textContent=
    `${svc.name} ${mmdd(date)}（${dayName(date)}）— ${POS_LABEL[posId]}`;
  const dateStr=fmtDate(date);
  const allEligible=members.filter(m=>m.active&&m.can[posId]&&!unavailMap[`${m.id}-${dateStr}`]);
  const ftMembers=allEligible.filter(m=>m.group==='FT');
  const others=allEligible.filter(m=>m.group!=='FT');
  const eligible=[...ftMembers,...others];

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

async function forceFlushMonth(){
  const paths=[
    DB_PATHS.assignments(month),
    DB_PATHS.dashes(month),
    DB_PATHS.unavail(month),
    DB_PATHS.survey(month),
  ];
  paths.forEach(p=>{ if(_saveDebounce[p]){clearTimeout(_saveDebounce[p]);delete _saveDebounce[p];} });
  const dashObj={};dashSet.forEach(k=>{dashObj[k]=true;});
  const surveyObj={};surveyFilled.forEach(id=>{surveyObj[id]=true;});
  try{
    await Promise.all([
      window._fbSet(window._fbRef(window._fbDb,DB_PATHS.assignments(month)), assignments),
      window._fbSet(window._fbRef(window._fbDb,DB_PATHS.dashes(month)),     dashObj),
      window._fbSet(window._fbRef(window._fbDb,DB_PATHS.unavail(month)),    unavailMap),
      window._fbSet(window._fbRef(window._fbDb,DB_PATHS.survey(month)),     surveyObj),
    ]);
  }catch(e){console.error('forceFlushMonth error:',e);}
}

async function changeMonth(dir){
  showSync(true);
  await forceFlushMonth();
  month+=dir;if(month>12){month=1;year++;}if(month<1){month=12;year--;}
  currentWi=0;
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

document.getElementById('assign-modal').addEventListener('click',e=>{if(e.target===document.getElementById('assign-modal'))closeModal();});
document.getElementById('add-modal').addEventListener('click',e=>{if(e.target===document.getElementById('add-modal'))closeAddModal();});
renderAll();