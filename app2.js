      }
    }
  });

  // ── 第二輪：所有必要崗位都排完後，才嘗試填 optional（sun PD2/CAM2） ──
  // 這樣不會搶走後面週次需要的人力
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
        // 只有在不超過上限的情況下才排
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


// ══════════════════════════════════════════
// CONFIRM WEEK
// ══════════════════════════════════════════
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
  // 只補填空缺，不清除已有的安排（手動調整的保留）
  // Re-fill empty slots only
  for(let wi=startWi;wi<weeks.length;wi++){
    if(confirmedWeeks.has(wi)) continue;
    const week=weeks[wi];
    SERVICES.forEach(svc=>{
      const dateStr=fmtDate(getSvcDate(week,svc));
      // Mandatory positions
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
      // 黃宛蘇 & 王建華
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
      // 禱告會 CAM2：純手動，確認後補算也不自動排入
      if(svc.id==='prayer'){
        const cam2Key=`${wi}-prayer-CAM2`;
        if(!assignments[cam2Key]&&!dashSet.has(cam2Key)){
          dashSet.add(cam2Key);
        }
      }
      // 主日 PD2/CAM2 optional
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

// ══════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════
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
    // 計算此週未排必要崗位數
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

  // Group POS_ORDER into non-sunday and sunday groups for merged display
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
  // count mandatory (exclude optional PD2 in sunday)
  // All positions mandatory — dashes are intentional blanks
  const needed=weeks.reduce((s,_,wi)=>s+SERVICES.reduce((a,svc)=>a+svc.positions.length,0),0);
  const filled=Object.keys(assignments).length;
  const dashedMandatory=[...dashSet].length;
  const unfilledMandatory=Math.max(0,needed-filled-dashedMandatory);
  const pct=needed?Math.round(filled/needed*100):0;
  const color=pct===100?'var(--green)':pct>80?'var(--gold)':'var(--red)';
  // 必要崗位說明
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
    // 黃宛蘇 & 王建華
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
    // 同一場次重複出現檢查（一人只能一個崗位）
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
    // 陳旭亮 & 洪吉松
    SERVICES.forEach(svc=>{
      const xPD=['PD1','PD2'].some(p=>assignments[`${wi}-${svc.id}-${p}`]===3);
      const hCAM=svc.positions.filter(p=>p.startsWith('CAM')).some(cp=>assignments[`${wi}-${svc.id}-${cp}`]===33);
      if(xPD&&hCAM) warns.push({t:'r',m:`第${wn}週 ${svc.name}：陳旭亮導播 + 洪吉松攝影（互斥規則）`});
    });
    // CAM1換手
    // (CAM1換手提示移除，主日已合併為單欄)
    // 連排超過2週
    // 連排警告：同一種場次連續三週才算
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

  // 超出場次上限
  const sesLimWarn=getActive().filter(m=>m.group!=='FT'&&sessionCount(m.id)>sesLim);
  sesLimWarn.forEach(m=>warns.push({t:'y',m:`${m.name} 本月服事 ${sessionCount(m.id)} 場，超出上限 ${sesLim} 場，請確認或手動調整`}));

  // 未填問卷但被排入
  const notFilled=getActive().filter(m=>m.group!=='FT'&&!surveyFilled.has(m.id)&&rawCount(m.id)>0);
  notFilled.forEach(m=>warns.push({t:'b',m:`${m.name} 尚未填寫問卷，但已被排入 ${rawCount(m.id)} 場（手動排班）`}));

  document.getElementById('schedule-warnings').innerHTML=warns.map(w=>`
    <div class="alert alert-${w.t}">${w.t==='r'?'🔴':w.t==='b'?'🔵':'⚠️'} ${w.m}</div>`).join('');
}

// ══════════════════════════════════════════
// AVAIL TABLE
// ══════════════════════════════════════════
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

// ══════════════════════════════════════════
// SURVEY TRACKING
// ══════════════════════════════════════════
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