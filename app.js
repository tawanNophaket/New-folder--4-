// ===== STORAGE & STATE =====
const SK = { E:'ul_ev',T:'ul_tk',H:'ul_hb',F:'ul_fi',J:'ul_jo',N:'ul_nt',G:'ul_gm',R:'ul_rw',S:'ul_sb',FM:'ul_fm',A:'ul_ar',LR:'ul_lastRun' };
const EVT_COLORS = [{id:'brand',raw:'#7C3AED'},{id:'cyan',raw:'#06B6D4'},{id:'rose',raw:'#F43F5E'},{id:'amber',raw:'#F59E0B'},{id:'emerald',raw:'#10B981'},{id:'indigo',raw:'#6366F1'}];
const CAT_ICONS = {food:'🍜',transport:'🚌',shopping:'🛍️',health:'❤️',entertainment:'🎮',bills:'💡',salary:'💼',other:'📦'};

// ===== TOAST SYSTEM =====
function showToast(msg, type='success', emoji='✅') {
  let container = document.querySelector('.toast-container');
  if(!container) { container = document.createElement('div'); container.className='toast-container'; document.body.appendChild(container); }
  const t = document.createElement('div'); t.className=`toast ${type}`;
  t.innerHTML = `<span style="font-size:1.1rem">${emoji}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.animation='toastOut 0.3s var(--ease-in-out) forwards'; setTimeout(()=>t.remove(), 300); }, 2800);
}
const THEMES = [{id:'default',name:'Midnight',cost:0,color:'#8B5CF6'},{id:'cyberpunk',name:'Cyberpunk 2077',cost:500,color:'#EAB308'},{id:'sakura',name:'Sakura Zen',cost:500,color:'#F472B6'},{id:'bloodmoon',name:'Blood Moon',cost:1000,color:'#DC2626'}];

const g = id => document.getElementById(id);
const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

let state = {
  events: load(SK.E)||[], tasks: load(SK.T)||[], habits: load(SK.H)||[],
  transactions: load(SK.F)||[], journal: load(SK.J)||[], notes: load(SK.N)||[],
  gamify: load(SK.G)||{xp:0,level:1,coins:0,activeTheme:'default',unlockedThemes:['default']},
  rewards: load(SK.R)||[{id:'r1',name:'Play Game 1hr 🎮',cost:150},{id:'r2',name:'Buy a Treat 🍰',cost:300}],
  subscriptions: load(SK.S)||[], financeMeta: load(SK.FM)||{budget:15000},
  archivedTasks: load(SK.A)||[], selectedColor: EVT_COLORS[0].id,
  activeTab:'view-timeline', finFilter:'all', notificationsEnabled: Notification.permission==='granted'
};
state.tasks.forEach(t=>{if(!t.priority)t.priority='med';if(!t.recur)t.recur='none';});

function saveData() {
  localStorage.setItem(SK.E,JSON.stringify(state.events)); localStorage.setItem(SK.T,JSON.stringify(state.tasks));
  localStorage.setItem(SK.H,JSON.stringify(state.habits)); localStorage.setItem(SK.F,JSON.stringify(state.transactions));
  localStorage.setItem(SK.J,JSON.stringify(state.journal)); localStorage.setItem(SK.N,JSON.stringify(state.notes));
  localStorage.setItem(SK.G,JSON.stringify(state.gamify)); localStorage.setItem(SK.R,JSON.stringify(state.rewards));
  localStorage.setItem(SK.S,JSON.stringify(state.subscriptions)); localStorage.setItem(SK.FM,JSON.stringify(state.financeMeta));
  localStorage.setItem(SK.A,JSON.stringify(state.archivedTasks));
}

// ===== AUDIO & HAPTICS =====
let audioCtx;
function initAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();}
function playHaptic(type='tick'){
  if(!audioCtx||audioCtx.state==='suspended')return;
  const o=audioCtx.createOscillator(),gn=audioCtx.createGain();
  o.connect(gn);gn.connect(audioCtx.destination);const now=audioCtx.currentTime;
  if(type==='tick'){o.frequency.setValueAtTime(150,now);o.frequency.exponentialRampToValueAtTime(0.01,now+.05);gn.gain.setValueAtTime(.5,now);gn.gain.exponentialRampToValueAtTime(.01,now+.05);o.start(now);o.stop(now+.05);}
  else if(type==='pop'){o.frequency.setValueAtTime(400,now);o.frequency.exponentialRampToValueAtTime(800,now+.1);gn.gain.setValueAtTime(.8,now);gn.gain.exponentialRampToValueAtTime(.01,now+.1);o.type='sine';o.start(now);o.stop(now+.1);}
  else if(type==='chime'){o.frequency.setValueAtTime(800,now);o.frequency.exponentialRampToValueAtTime(400,now+.5);gn.gain.setValueAtTime(.6,now);gn.gain.exponentialRampToValueAtTime(.01,now+.5);o.type='triangle';o.start(now);o.stop(now+.5);}
  else if(type==='levelup'){o.frequency.setValueAtTime(400,now);o.frequency.linearRampToValueAtTime(1000,now+.5);gn.gain.setValueAtTime(.5,now);gn.gain.linearRampToValueAtTime(0,now+.6);o.type='square';o.start(now);o.stop(now+.6);}
}

// ===== GAMIFICATION =====
function spawnFloatingText(text,x,y,color='#F59E0B'){
  const el=document.createElement('div');el.className='floating-xp';el.textContent=text;
  el.style.cssText=`left:${x-40}px;top:${y-20}px;color:${color}`;
  document.body.appendChild(el);setTimeout(()=>el.remove(),1200);
}
function addXP(amt,coinAmt=null,x=null,y=null){
  state.gamify.xp+=amt;
  const c=coinAmt!==null?coinAmt:amt;
  if(!state.gamify.coins)state.gamify.coins=0;state.gamify.coins+=c;
  if(x&&y)spawnFloatingText(`+${amt} XP`,x,y);
  renderGamification();saveData();
}
function renderGamification(){
  const lim=state.gamify.level*100;
  while(state.gamify.xp>=lim){state.gamify.xp-=lim;state.gamify.level++;triggerConfetti();playHaptic('levelup');}
  const realLim=state.gamify.level*100;
  g('levelText').textContent=state.gamify.level;
  g('xpText').textContent=`(${state.gamify.xp}/${realLim} XP)`;
  g('expFill').style.width=`${(state.gamify.xp/realLim)*100}%`;
  g('coinText').textContent=state.gamify.coins||0;
  if(g('shopCoinText'))g('shopCoinText').textContent=state.gamify.coins||0;
}
function triggerConfetti(){
  const ov=g('confettiOverlay');ov.classList.remove('hidden');ov.innerHTML='';
  const cols=['#7C3AED','#06B6D4','#F43F5E','#F59E0B','#10B981','#EC4899'];
  for(let i=0;i<70;i++){
    let p=document.createElement('div');p.className='confetti-piece';
    const dx=(Math.random()-0.5)*200;
    p.style.cssText=`left:${Math.random()*100}vw;background:${cols[Math.floor(Math.random()*cols.length)]};animation-duration:${Math.random()*2.5+2}s;animation-delay:${Math.random()*.6}s;--dx:${dx}px;transform:rotate(${Math.random()*360}deg);border-radius:${Math.random()>.5?'50%':'3px'};`;
    ov.appendChild(p);
  }
  setTimeout(()=>ov.classList.add('hidden'),5000);
  showToast('Level Up! 🎊', 'success', '⬆️');
}

// ===== DAILY MAINTENANCE =====
function processDailyMaintenance(){
  const today=new Date().toDateString();
  if(localStorage.getItem(SK.LR)===today)return;
  // Auto-archive done tasks older than 3 days
  const cutoff=Date.now()-3*86400000;
  const keeping=[];
  state.tasks.forEach(t=>{
    if(t.status==='done'&&t.completedAt&&new Date(t.completedAt).getTime()<cutoff){
      if(t.recur==='daily'){t.status='todo';t.completedAt=null;keeping.push(t);}
      else if(t.recur==='weekly'){const now=new Date();if(now.getDay()===1){t.status='todo';t.completedAt=null;}keeping.push(t);}
      else state.archivedTasks.push(t);
    } else keeping.push(t);
  });
  state.tasks=keeping;
  // Strict mode: penalise missed habits from yesterday
  let yd=new Date();yd.setDate(yd.getDate()-1);const ydStr=yd.toDateString();let missed=0;
  state.habits.forEach(h=>{if(!h.completedDates.includes(ydStr))missed++;});
  if(missed>0){const pen=missed*30;state.gamify.xp=Math.max(0,state.gamify.xp-pen);setTimeout(()=>spawnFloatingText(`-${pen} XP Penalty`,window.innerWidth/2,80,'#EF4444'),2000);}
  localStorage.setItem(SK.LR,today);saveData();
}

// ===== TIMELINE =====
const grid=g('timelineGrid'),evCon=g('eventsContainer'),timeLine=g('currentTimeLine');
const t2m=ts=>{const[h,m]=ts.split(':').map(Number);return h*60+m;};
const m2t=m=>{let h=Math.floor(m/60),mn=m%60;if(h>23){h=23;mn=59;}return`${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;};

function calcOverlaps(arr){
  const s=[...arr].sort((a,b)=>t2m(a.start)-t2m(b.start));let cols=[];
  s.forEach(ev=>{const st=t2m(ev.start);let pl=false;for(let i=0;i<cols.length;i++){if(t2m(cols[i][cols[i].length-1].end)<=st){cols[i].push(ev);ev.colIndex=i;pl=true;break;}}if(!pl){ev.colIndex=cols.length;cols.push([ev]);}});
  s.forEach(ev=>{const st=t2m(ev.start),en=t2m(ev.end);let ov=0;cols.forEach(c=>{if(c.some(e=>t2m(e.start)<en&&t2m(e.end)>st))ov++;});ev.maxCols=Math.max(ov,1);});return s;
}
function renderEvents(){
  evCon.innerHTML='';
  calcOverlaps(state.events).forEach(ev=>{
    const st=t2m(ev.start),en=t2m(ev.end),dur=en-st;
    const b=document.createElement('div');b.className='event-block';
    const wp=100/ev.maxCols;
    b.style.cssText=`top:${st}px;height:${dur}px;width:calc(${wp}% - 6px);left:calc(${ev.colIndex*wp}% + 2px);background-color:${EVT_COLORS.find(c=>c.id===ev.color)?.raw||EVT_COLORS[0].raw};z-index:${ev.colIndex+10}`;
    b.innerHTML=`<div class="event-title">${ev.title}</div><div class="event-time">${ev.start}–${ev.end}</div><div class="resizer-handle"></div>`;
    enableDrag(b,ev);evCon.appendChild(b);
  });
}
let bDrag=false,bRes=false,sTY=0,iT=0,iH=0,dTimer;
function enableDrag(b,ev){
  const rs=b.querySelector('.resizer-handle');
  b.addEventListener('touchstart',e=>{if(e.target.classList.contains('resizer-handle'))return;e.stopPropagation();sTY=e.touches[0].clientY;iT=parseFloat(b.style.top);dTimer=setTimeout(()=>{bDrag=true;b.classList.add('dragging');playHaptic('tick');},300);},{passive:false});
  b.addEventListener('touchmove',e=>{if(!bDrag){clearTimeout(dTimer);return;}e.preventDefault();b.style.top=`${Math.max(0,iT+(e.touches[0].clientY-sTY))}px`;},{passive:false});
  b.addEventListener('touchend',e=>{clearTimeout(dTimer);if(!bDrag)openEventModal(ev);else{bDrag=false;b.classList.remove('dragging');playHaptic('pop');const snap=Math.round(parseFloat(b.style.top)/5)*5,dur=t2m(ev.end)-t2m(ev.start);ev.start=m2t(snap);ev.end=m2t(snap+dur);saveData();renderEvents();}});
  rs.addEventListener('touchstart',e=>{e.stopPropagation();bRes=true;sTY=e.touches[0].clientY;iH=parseFloat(b.style.height);b.classList.add('dragging');},{passive:false});
  rs.addEventListener('touchmove',e=>{if(!bRes)return;e.preventDefault();b.style.height=`${Math.max(15,iH+(e.touches[0].clientY-sTY))}px`;},{passive:false});
  rs.addEventListener('touchend',()=>{if(!bRes)return;bRes=false;b.classList.remove('dragging');playHaptic('tick');ev.end=m2t(t2m(ev.start)+Math.round(parseFloat(b.style.height)/5)*5);saveData();renderEvents();});
}
function renderColorPicker(){
  const cp=document.querySelector('.color-picker');if(!cp)return;cp.innerHTML='';
  EVT_COLORS.forEach(c=>{const d=document.createElement('div');d.className=`color-option${state.selectedColor===c.id?' active':''}`;d.style.cssText=`background:${c.raw};--color-raw:${c.raw}`;d.onclick=()=>{playHaptic('tick');state.selectedColor=c.id;renderColorPicker();};cp.appendChild(d);});
}
function openEventModal(ev=null){
  if(ev&&ev.id){g('editingEventId').value=ev.id;g('eventTitle').value=ev.title;g('startTime').value=ev.start;g('endTime').value=ev.end;state.selectedColor=ev.color;g('btnDeleteEvent').classList.remove('hidden');g('btnFocusEvent').classList.remove('hidden');}
  else{const d=new Date(),st=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;g('editingEventId').value='';g('eventTitle').value=ev?.title||'';g('startTime').value=ev?.start||st;g('endTime').value=ev?.end||st;g('btnDeleteEvent').classList.add('hidden');g('btnFocusEvent').classList.add('hidden');}
  renderColorPicker();g('addEventSheet').classList.remove('hidden');
}
g('eventForm').addEventListener('submit',e=>{e.preventDefault();playHaptic('pop');const id=g('editingEventId').value,ev={id:id||Date.now().toString(),title:g('eventTitle').value,start:g('startTime').value,end:g('endTime').value,color:state.selectedColor};if(id){const ix=state.events.findIndex(x=>x.id===id);if(ix>-1)state.events[ix]=ev;}else state.events.push(ev);saveData();renderEvents();g('addEventSheet').classList.add('hidden');});
g('btnDeleteEvent').addEventListener('click',()=>{state.events=state.events.filter(x=>x.id!==g('editingEventId').value);saveData();renderEvents();g('addEventSheet').classList.add('hidden');playHaptic('tick');});

// ===== TASKS =====
function openTaskModal(tk=null){
  if(tk){g('taskModalTitle').textContent='Edit Task';g('editingTaskId').value=tk.id;g('taskInputTitle').value=tk.title;g('taskInputStatus').value=tk.status;g('taskInputPriority').value=tk.priority;g('taskInputRecur').value=tk.recur||'none';g('btnDeleteTask').classList.remove('hidden');g('btnFocusTask').classList.remove('hidden');}
  else{g('taskModalTitle').textContent='New Task';g('editingTaskId').value='';g('taskInputTitle').value='';g('taskInputStatus').value='todo';g('taskInputPriority').value='med';g('taskInputRecur').value='none';g('btnDeleteTask').classList.add('hidden');g('btnFocusTask').classList.add('hidden');}
  g('addTaskSheet').classList.remove('hidden');
}
g('taskForm').addEventListener('submit',e=>{e.preventDefault();playHaptic('pop');const id=g('editingTaskId').value,title=g('taskInputTitle').value.trim(),status=g('taskInputStatus').value,priority=g('taskInputPriority').value,recur=g('taskInputRecur').value;
  if(id){let t=state.tasks.find(x=>x.id===id);if(t){t.title=title;t.status=status;t.priority=priority;t.recur=recur;}}
  else state.tasks.push({id:Date.now().toString(),title,status,priority,recur,completedAt:null});
  saveData();renderTasks();g('addTaskSheet').classList.add('hidden');});
g('btnDeleteTask').addEventListener('click',()=>{state.tasks=state.tasks.filter(x=>x.id!==g('editingTaskId').value);saveData();renderTasks();g('addTaskSheet').classList.add('hidden');playHaptic('tick');});
function renderTasks(){
  ['todo','doing','done'].forEach(st=>g(`list-${st}`).innerHTML='');
  let stats={todo:0,doing:0,done:0};
  const pw={'high':3,'med':2,'low':1};
  [...state.tasks].sort((a,b)=>pw[b.priority]-pw[a.priority]).forEach(t=>{
    stats[t.status]++;
    const card=document.createElement('div');card.className=`k-card haptic prio-${t.priority}`;
    const icon=t.priority==='high'?'🔥':t.priority==='med'?'⭐':'☕';
    const recurTag=t.recur&&t.recur!=='none'?`<div class="k-recur">${t.recur==='daily'?'🔁 Daily':'📅 Weekly'}</div>`:'';
    let nextBtn='';
    if(t.status==='todo')nextBtn=`<button class="k-move-btn haptic" onclick="moveTask('${t.id}','doing',event)">Start <span class="material-icons-round" style="font-size:13px">arrow_forward</span></button>`;
    else if(t.status==='doing')nextBtn=`<button class="k-move-btn finish haptic" onclick="moveTask('${t.id}','done',event)">Finish <span class="material-icons-round" style="font-size:13px">check</span></button>`;
    card.innerHTML=`<div class="k-title">${t.title}</div>${recurTag}<div class="prio-badge">${icon}</div><div class="k-actions">${nextBtn}</div>`;
    card.addEventListener('click',e=>{if(!e.target.closest('.k-move-btn'))openTaskModal(t);});
    g(`list-${t.status}`).appendChild(card);
  });
  ['todo','doing','done'].forEach(st=>g(`badge-${st}`).textContent=stats[st]);
  const tot=state.tasks.length;g('taskProgressText').textContent=tot===0?'0% Done':`${Math.round((stats.done/tot)*100)}% Done`;
}
window.moveTask=function(id,st,e){if(e)e.stopPropagation();let t=state.tasks.find(x=>x.id===id);if(t){const ev=e;t.status=st;playHaptic(st==='done'?'pop':'tick');if(st==='done'){t.completedAt=new Date().toISOString();addXP(20,20,ev?.clientX||window.innerWidth/2,ev?.clientY||200);}saveData();renderTasks();}};

// ===== HABITS =====
let habitPressTimer;
function isSameDay(d1,d2){return d1.toDateString()===d2.toDateString();}
function calcStreak(dates){
  if(!dates||!dates.length)return 0;
  const ds=dates.map(d=>new Date(d)).sort((a,b)=>b-a);let str=0,curr=new Date();
  if(!isSameDay(ds[0],curr)){let y=new Date();y.setDate(y.getDate()-1);if(isSameDay(ds[0],y))curr=y;else return 0;}
  for(let i=0;i<ds.length;i++){if(isSameDay(ds[i],curr)){str++;curr.setDate(curr.getDate()-1);}else break;}return str;
}
g('btnAddHabit').addEventListener('click',()=>{g('habitModalTitle').textContent='New Habit';g('habitInputTitle').value='';g('habitInputEmoji').value='';g('editingHabitId').value='';g('btnDeleteHabit').classList.add('hidden');g('addHabitSheet').classList.remove('hidden');});
g('habitForm').addEventListener('submit',e=>{e.preventDefault();playHaptic('pop');const title=g('habitInputTitle').value.trim(),emoji=g('habitInputEmoji').value.trim()||'✅',id=g('editingHabitId').value;
  if(id){let h=state.habits.find(x=>x.id===id);if(h){h.title=title;h.emoji=emoji;}}else state.habits.push({id:Date.now().toString(),title,emoji,completedDates:[]});
  saveData();renderHabits();g('addHabitSheet').classList.add('hidden');});
g('btnDeleteHabit').addEventListener('click',()=>{state.habits=state.habits.filter(x=>x.id!==g('editingHabitId').value);saveData();renderHabits();g('addHabitSheet').classList.add('hidden');playHaptic('tick');});
function renderHabits(){
  const box=g('habitsContainer');box.innerHTML='';
  const today=new Date().toDateString();
  state.habits.forEach(h=>{
    const streak=calcStreak(h.completedDates),done=h.completedDates.includes(today);
    const el=document.createElement('div');el.className=`habit-item${done?' done':''}`;
    el.innerHTML=`<div class="habit-icon">${done?'✓':h.emoji||'⭐'}</div><span class="habit-name">${h.title}</span>${streak>0?`<div class="streak-badge">🔥${streak}</div>`:''}`;
    el.addEventListener('touchstart',()=>{habitPressTimer=setTimeout(()=>{playHaptic('tick');el.classList.add('edit-mode');setTimeout(()=>{g('habitInputTitle').value=h.title;g('habitInputEmoji').value=h.emoji||'';g('editingHabitId').value=h.id;g('btnDeleteHabit').classList.remove('hidden');g('addHabitSheet').classList.remove('hidden');el.classList.remove('edit-mode');},400);},500);},{passive:true});
    el.addEventListener('touchend',()=>clearTimeout(habitPressTimer));el.addEventListener('touchmove',()=>clearTimeout(habitPressTimer));
    el.addEventListener('click',ev=>{if(el.classList.contains('edit-mode'))return;if(done){h.completedDates=h.completedDates.filter(d=>d!==today);playHaptic('pop');}else{h.completedDates.push(today);addXP(15,15,ev.clientX,ev.clientY);playHaptic('tick');}saveData();renderHabits();renderHeatmap();renderInsightStats();});
    box.appendChild(el);
  });
}
function renderHeatmap(){
  const box=g('heatmapGrid');if(!box)return;box.innerHTML='';
  let counts={};const dStr=d=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  state.tasks.forEach(t=>{if(t.completedAt){let k=dStr(new Date(t.completedAt));counts[k]=(counts[k]||0)+1;}});
  state.archivedTasks.forEach(t=>{if(t.completedAt){let k=dStr(new Date(t.completedAt));counts[k]=(counts[k]||0)+1;}});
  state.habits.forEach(h=>h.completedDates.forEach(d=>{let k=dStr(new Date(d));counts[k]=(counts[k]||0)+1;}));
  const today=new Date();
  for(let w=12;w>=0;w--){
    const col=document.createElement('div');col.className='heatmap-col';
    for(let j=0;j<7;j++){
      const td=new Date();td.setDate(today.getDate()-(w*7+(6-j)));
      const k=dStr(td),c=counts[k]||0;
      const lv=c===0?0:c<=2?1:c<=4?2:c<=6?3:4;
      const cell=document.createElement('div');cell.className=`heatmap-cell${lv>0?' l'+lv:''}`;cell.title=`${td.toLocaleDateString()}: ${c} activities`;col.appendChild(cell);
    }
    box.appendChild(col);
  }
}

// ===== NOTES =====
function openNoteModal(n=null){
  if(n){g('noteModalTitle').textContent='Edit Note';g('editingNoteId').value=n.id;g('noteInputTitle').value=n.title;g('noteInputContent').value=n.content;g('noteInputTags').value=(n.tags||[]).join(', ');g('btnDeleteNote').classList.remove('hidden');}
  else{g('noteModalTitle').textContent='New Brain Dump';g('editingNoteId').value='';g('noteInputTitle').value='';g('noteInputContent').value='';g('noteInputTags').value='';g('btnDeleteNote').classList.add('hidden');}
  g('addNoteSheet').classList.remove('hidden');
}
g('noteForm').addEventListener('submit',e=>{e.preventDefault();playHaptic('pop');const id=g('editingNoteId').value,tags=g('noteInputTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const n={id:id||Date.now().toString(),title:g('noteInputTitle').value.trim(),content:g('noteInputContent').value,tags,updated:new Date().toISOString()};
  if(id){const ix=state.notes.findIndex(x=>x.id===id);if(ix>-1)state.notes[ix]=n;}else state.notes.push(n);
  saveData();renderNotes();g('addNoteSheet').classList.add('hidden');});
g('btnDeleteNote').addEventListener('click',()=>{state.notes=state.notes.filter(x=>x.id!==g('editingNoteId').value);saveData();renderNotes();g('addNoteSheet').classList.add('hidden');playHaptic('tick');});
if(g('notesSearch'))g('notesSearch').addEventListener('input',renderNotes);
function renderNotes(){
  const box=g('notesGrid');box.innerHTML='';const q=(g('notesSearch')?.value||'').toLowerCase();
  const filtered=[...state.notes].sort((a,b)=>new Date(b.updated)-new Date(a.updated)).filter(n=>!q||n.title.toLowerCase().includes(q)||n.content.toLowerCase().includes(q));
  if(!filtered.length){box.innerHTML=`<div class="empty-state"><span class="emoji">🧠</span><p>${q?'No notes match your search':'Start capturing ideas. Your second brain awaits!'}</p></div>`;return;}
  filtered.forEach(n=>{
    const el=document.createElement('div');el.className='note-card haptic';
    const tagsHtml=(n.tags||[]).map(t=>`<span class="note-tag">#${t}</span>`).join('');
    const relTime=getRelativeTime(n.updated);
    el.innerHTML=`<div class="note-title">${n.title}</div><div class="note-preview">${n.content}</div>${tagsHtml?`<div class="note-tags">${tagsHtml}</div>`:''}<div class="note-date">${relTime}</div>`;
    el.addEventListener('click',()=>openNoteModal(n));box.appendChild(el);
  });
}

// ===== FINANCE =====
window.setFinFilter=function(f){state.finFilter=f;['All','Exp','Inc'].forEach(x=>{const b=g('filter'+x);if(b)b.classList.toggle('active',f===x.toLowerCase()||f==='all'&&x==='All');});renderFinance();};
function openFinanceModal(tx=null){
  if(tx){g('editingFinId').value=tx.id;g('finAmount').value=tx.amount;g('finDesc').value=tx.desc;g('finType').value=tx.type;g('finCategory').value=tx.category||'other';document.querySelectorAll('.ft-btn[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===tx.type));g('btnDeleteFin').classList.remove('hidden');}
  else{g('editingFinId').value='';g('finAmount').value='';g('finDesc').value='';g('btnDeleteFin').classList.add('hidden');g('finType').value='EXPENSE';document.querySelectorAll('.ft-btn[data-type]').forEach((b,i)=>b.classList.toggle('active',i===0));}
  g('addFinanceSheet').classList.remove('hidden');
}
g('financeForm').addEventListener('submit',e=>{e.preventDefault();playHaptic('pop');const id=g('editingFinId').value;
  const tx={id:id||Date.now().toString(),amount:parseFloat(g('finAmount').value),desc:g('finDesc').value,type:g('finType').value,category:g('finCategory').value,date:new Date().toISOString()};
  if(id){const ix=state.transactions.findIndex(x=>x.id===id);if(ix>-1)state.transactions[ix]=tx;}else state.transactions.push(tx);
  saveData();renderFinance();g('addFinanceSheet').classList.add('hidden');});
g('btnDeleteFin').addEventListener('click',()=>{state.transactions=state.transactions.filter(x=>x.id!==g('editingFinId').value);saveData();renderFinance();g('addFinanceSheet').classList.add('hidden');playHaptic('tick');});
document.querySelectorAll('.ft-btn[data-type]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.ft-btn[data-type]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');g('finType').value=btn.dataset.type;playHaptic('tick');}));

function renderFinance(){
  const fmt=new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'});
  let inc=0,exp=0;const ls=g('transactionList');ls.innerHTML='';
  const now=new Date(),thisMonth=`${now.getFullYear()}-${now.getMonth()}`;
  let monthExp=0;
  [...state.transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(tx=>{
    if(tx.type==='INCOME')inc+=tx.amount;else exp+=tx.amount;
    const txDate=new Date(tx.date);if(`${txDate.getFullYear()}-${txDate.getMonth()}`===thisMonth&&tx.type==='EXPENSE')monthExp+=tx.amount;
    if(state.finFilter==='exp'&&tx.type!=='EXPENSE')return;if(state.finFilter==='inc'&&tx.type!=='INCOME')return;
    const el=document.createElement('div');el.className=`txn-item ${tx.type}`;
    const icon=CAT_ICONS[tx.category]||'📦';
    el.innerHTML=`<div class="txn-cat-icon">${icon}</div><div class="txn-info"><div class="txn-desc">${tx.desc}</div><div class="txn-meta">${txDate.toLocaleDateString('th-TH')} · ${tx.category||'other'}</div></div><div class="txn-amount">${tx.type==='INCOME'?'+':'-'}${fmt.format(tx.amount)}</div>`;
    el.addEventListener('click',()=>openFinanceModal(tx));ls.appendChild(el);
  });
  g('totalIncome').textContent=fmt.format(inc);g('totalExpense').textContent=fmt.format(exp);g('totalBalance').textContent=fmt.format(inc-exp);
  // Budget bar
  const budget=state.financeMeta?.budget||15000;const pct=Math.min(100,(monthExp/budget)*100);
  const fill=g('budgetFill');if(fill){fill.style.width=pct+'%';fill.classList.toggle('danger',pct>=85);}
  if(g('budgetSpent'))g('budgetSpent').textContent=fmt.format(monthExp);
  if(g('budgetTotal'))g('budgetTotal').textContent=`/ ${fmt.format(budget)}`;
  if(g('budgetWarningIcon'))g('budgetWarningIcon').textContent=pct>=85?'🚨':'';
  renderDailySpendingChart();renderSubscriptions();
}

function renderDailySpendingChart(){
  const chart=g('dailyChart'),labels=g('dailyLabels');if(!chart||!labels)return;
  chart.innerHTML='';labels.innerHTML='';
  const days=7;const today=new Date();const dayData=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date();d.setDate(today.getDate()-i);const dStr=d.toDateString();
    const total=state.transactions.filter(tx=>new Date(tx.date).toDateString()===dStr&&tx.type==='EXPENSE').reduce((s,tx)=>s+tx.amount,0);
    dayData.push({d,total,isToday:i===0});
  }
  const maxAmt=Math.max(...dayData.map(x=>x.total),100);
  const fmtShort=n=>n>=1000?`${(n/1000).toFixed(1)}k`:String(Math.round(n));
  const dayNames=['Su','Mo','Tu','We','Th','Fr','Sa'];
  dayData.forEach(({d,total,isToday})=>{
    const wrap=document.createElement('div');wrap.className='chart-bar-wrap';
    const pct=total>0?(total/maxAmt)*100:3;
    wrap.innerHTML=`<div class="chart-bar-val">${total>0?fmtShort(total):''}</div><div class="chart-bar${isToday?' today':''}" style="height:${pct}%;background:${isToday?'':'linear-gradient(180deg,rgba(139,92,246,0.7),rgba(6,182,212,0.5))'}"></div>`;
    chart.appendChild(wrap);
    const lbl=document.createElement('div');lbl.className=`chart-day-lbl${isToday?' ':''}`;lbl.style.fontWeight=isToday?'800':'400';lbl.style.color=isToday?'var(--warning)':'var(--text-secondary)';lbl.textContent=dayNames[d.getDay()];labels.appendChild(lbl);
  });
  // Today vs yesterday
  const todayAmt=dayData[6].total,yestAmt=dayData[5].total;
  if(g('todaySpending')){const fmt2=new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'});g('todaySpending').textContent=fmt2.format(todayAmt);}
  if(g('todayVsYesterday')){
    if(yestAmt===0)g('todayVsYesterday').textContent='—';
    else{const diff=((todayAmt-yestAmt)/yestAmt*100).toFixed(0);g('todayVsYesterday').textContent=(diff>0?'+':'')+diff+'% from yday';g('todayVsYesterday').style.color=diff>0?'var(--danger)':'var(--success)';}
  }
  if(g('dailyAvgText')){const avg=dayData.reduce((s,x)=>s+x.total,0)/days;const fmt3=new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'});g('dailyAvgText').textContent=fmt3.format(avg)+' avg/day';}
}

// ===== SUBSCRIPTIONS =====
g('btnAddSub').addEventListener('click',()=>{g('subInputName').value='';g('subInputAmount').value='';g('subInputDay').value='';g('editingSubId').value='';g('btnDeleteSub').classList.add('hidden');g('addSubSheet').classList.remove('hidden');});
g('subForm').addEventListener('submit',e=>{e.preventDefault();playHaptic('pop');const id=g('editingSubId').value;
  const sub={id:id||Date.now().toString(),name:g('subInputName').value.trim(),amount:parseFloat(g('subInputAmount').value),day:parseInt(g('subInputDay').value)};
  if(id){const ix=state.subscriptions.findIndex(x=>x.id===id);if(ix>-1)state.subscriptions[ix]=sub;}else state.subscriptions.push(sub);
  saveData();renderSubscriptions();g('addSubSheet').classList.add('hidden');});
g('btnDeleteSub').addEventListener('click',()=>{state.subscriptions=state.subscriptions.filter(x=>x.id!==g('editingSubId').value);saveData();renderSubscriptions();g('addSubSheet').classList.add('hidden');playHaptic('tick');});
function renderSubscriptions(){
  const box=g('subList');if(!box)return;box.innerHTML='';const fmt=new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'});
  const today=new Date().getDate();
  [...state.subscriptions].sort((a,b)=>{const da=(a.day-today+31)%31,db=(b.day-today+31)%31;return da-db;}).forEach(sub=>{
    const daysLeft=(sub.day-today+31)%31;const isToday=daysLeft===0||sub.day===today;
    const el=document.createElement('div');el.className='sub-item';
    el.innerHTML=`<div><div style="font-weight:700">${sub.name}</div><div style="font-size:0.75rem;color:var(--text-secondary)">Every month, day ${sub.day}</div></div><div style="display:flex;align-items:center;gap:10px"><span style="font-weight:700;color:var(--danger)">${fmt.format(sub.amount)}</span><span class="sub-countdown ${isToday||daysLeft<=3?'soon':'ok'}">${isToday?'Today!':'In '+daysLeft+'d'}</span></div>`;
    el.addEventListener('click',()=>{g('subInputName').value=sub.name;g('subInputAmount').value=sub.amount;g('subInputDay').value=sub.day;g('editingSubId').value=sub.id;g('btnDeleteSub').classList.remove('hidden');g('addSubSheet').classList.remove('hidden');});
    box.appendChild(el);
  });
}

// Budget Modal
g('btnEditBudget').addEventListener('click',()=>{g('budgetInputAmount').value=state.financeMeta?.budget||15000;g('budgetSheet').classList.remove('hidden');});
g('budgetForm').addEventListener('submit',e=>{e.preventDefault();state.financeMeta={budget:parseFloat(g('budgetInputAmount').value)||15000};saveData();renderFinance();g('budgetSheet').classList.add('hidden');playHaptic('pop');});

// ===== JOURNAL =====
let selStars=0;
document.querySelectorAll('.star').forEach(st=>st.addEventListener('click',e=>{playHaptic('tick');selStars=parseInt(e.target.dataset.val);document.querySelectorAll('.star').forEach(s=>{s.textContent=parseInt(s.dataset.val)<=selStars?'star':'star_outline';s.classList.toggle('active',parseInt(s.dataset.val)<=selStars);});}));
g('btnSaveJournal').addEventListener('click',()=>{if(!selStars)return alert('Please rate your day first.');playHaptic('pop');addXP(10);
  state.journal.push({id:Date.now().toString(),date:new Date().toISOString(),stars:selStars,text:g('gratitudeInput').value.trim()});
  saveData();renderJournal();g('gratitudeInput').value='';g('journalFeedback').style.display='block';setTimeout(()=>g('journalFeedback').style.display='none',3000);});
function renderJournal(){
  const box=g('journalHistoryContainer');box.innerHTML='';
  [...state.journal].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20).forEach(j=>{
    const el=document.createElement('div');el.className='journal-item';
    el.innerHTML=`<div class="journal-head"><span>${new Date(j.date).toLocaleDateString('th-TH')}</span><span class="journal-stars">${'★'.repeat(j.stars)}</span></div>${j.text?`<div class="journal-text">"${j.text}"</div>`:''}`; box.appendChild(el);
  });
}

// ===== INSIGHT STATS =====
function renderInsightStats(){
  const today=new Date().toDateString();const doneTasks=state.tasks.filter(t=>t.status==='done').length;
  const habitsDone=state.habits.filter(h=>h.completedDates.includes(today)).length;
  const habitPct=state.habits.length>0?Math.round((habitsDone/state.habits.length)*100):0;
  const bestStreak=Math.max(0,...state.habits.map(h=>calcStreak(h.completedDates)));
  if(g('statTasks'))g('statTasks').textContent=doneTasks;
  if(g('statHabits'))g('statHabits').textContent=habitPct+'%';
  if(g('statStreak'))g('statStreak').textContent=bestStreak;
}

// ===== SHOP & THEMES =====
document.getElementById('tabShopRewards').addEventListener('click',()=>{g('tabShopRewards').classList.add('active');g('tabShopThemes').classList.remove('active');g('shopContentRewards').classList.remove('hidden');g('shopContentThemes').classList.add('hidden');});
document.getElementById('tabShopThemes').addEventListener('click',()=>{g('tabShopThemes').classList.add('active');g('tabShopRewards').classList.remove('active');g('shopContentThemes').classList.remove('hidden');g('shopContentRewards').classList.add('hidden');});
g('btnShop').addEventListener('click',()=>{playHaptic('tick');g('shopSheet').classList.remove('hidden');renderShop();});
g('rewardForm').addEventListener('submit',e=>{e.preventDefault();playHaptic('pop');state.rewards.push({id:Date.now().toString(),name:g('rewardInputName').value.trim(),cost:parseInt(g('rewardInputCost').value)});g('rewardInputName').value='';g('rewardInputCost').value='';saveData();renderShop();});
function renderShop(){
  const box=g('rewardGrid'),tBox=g('themeGrid');box.innerHTML='';if(tBox)tBox.innerHTML='';
  if(!state.gamify.coins)state.gamify.coins=0;g('shopCoinText').textContent=state.gamify.coins;
  state.rewards.forEach(r=>{const el=document.createElement('div');el.className='shop-item';const dis=state.gamify.coins<r.cost?'disabled':'';el.innerHTML=`<div class="shop-item-info"><div class="shop-item-name">${r.name}</div><span class="shop-item-cost">🪙 ${r.cost}</span></div><button class="shop-delete-btn" onclick="deleteReward('${r.id}')"><span class="material-icons-round">delete</span></button><button class="shop-buy-btn haptic" ${dis} onclick="buyReward('${r.id}')">Buy</button>`;box.appendChild(el);});
  if(tBox)THEMES.forEach(th=>{
    const el=document.createElement('div');el.className='shop-item';
    const unlocked=state.gamify.unlockedThemes?.includes(th.id),isActive=state.gamify.activeTheme===th.id,dis=state.gamify.coins<th.cost?'disabled':'';
    let btn=isActive?`<button class="shop-buy-btn active-theme" disabled>Active</button>`:unlocked?`<button class="shop-buy-btn haptic" onclick="applyTheme('${th.id}')">Use</button>`:`<button class="shop-buy-btn haptic" ${dis} onclick="buyTheme('${th.id}')">Buy</button>`;
    el.innerHTML=`<div class="theme-swatch" style="background:${th.color}"></div><div class="shop-item-info"><div class="shop-item-name">${th.name}</div><span class="shop-item-cost">🪙 ${th.cost}</span></div>${btn}`;tBox.appendChild(el);
  });
}
window.deleteReward=id=>{playHaptic('tick');state.rewards=state.rewards.filter(x=>x.id!==id);saveData();renderShop();};
window.buyReward=id=>{const r=state.rewards.find(x=>x.id===id);if(r&&state.gamify.coins>=r.cost){state.gamify.coins-=r.cost;playHaptic('chime');saveData();renderShop();renderGamification();showToast(`Purchased: ${r.name}!`,'success','🎉');}
else showToast('Not enough coins!','danger','🪙');};
window.buyTheme=id=>{const th=THEMES.find(x=>x.id===id);if(th&&state.gamify.coins>=th.cost){state.gamify.coins-=th.cost;if(!state.gamify.unlockedThemes)state.gamify.unlockedThemes=[];state.gamify.unlockedThemes.push(id);playHaptic('levelup');applyTheme(id);showToast(`${th.name} theme unlocked!`,'success','🎨');}
else showToast('Not enough coins!','danger','🪙');};
window.applyTheme=id=>{state.gamify.activeTheme=id;document.body.setAttribute('data-theme',id);saveData();renderShop();showToast('Theme applied!','success','✨');};

// ===== HELPER: RELATIVE TIME =====
function getRelativeTime(iso){
  const diff=Date.now()-new Date(iso).getTime();
  if(diff<60000)return'just now';
  if(diff<3600000)return`${Math.floor(diff/60000)}m ago`;
  if(diff<86400000)return`${Math.floor(diff/3600000)}h ago`;
  return`${Math.floor(diff/86400000)}d ago`;
}

// ===== AMBIENT & POMODORO =====
const AMBIENT={rain:new Audio('https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg'),forest:new Audio('https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg'),cafe:new Audio('https://actions.google.com/sounds/v1/crowds/battle_crowd_2.ogg')};
Object.values(AMBIENT).forEach(a=>{a.loop=true;a.volume=0.5;});let activeAmbient=null;
document.querySelectorAll('.ambient-btn').forEach(btn=>btn.addEventListener('click',()=>{const type=btn.dataset.sound;playHaptic('tick');Object.values(AMBIENT).forEach(a=>a.pause());document.querySelectorAll('.ambient-btn').forEach(b=>b.classList.remove('active'));if(activeAmbient===type)activeAmbient=null;else{activeAmbient=type;btn.classList.add('active');if(!pomPaused&&!g('focusOverlay').classList.contains('hidden'))AMBIENT[type].play();}}));

const focusOverlay=g('focusOverlay');let pomIntervalId,pomEndTime,pomTotal,pomPaused=false,pomLeftPaused=0;
function startFocus(title,mins){
  playHaptic('pop');document.querySelectorAll('.bottom-sheet-overlay').forEach(el=>el.classList.add('hidden'));
  g('focusTaskName').textContent=title;pomTotal=mins*60;pomEndTime=Date.now()+pomTotal*1000;pomPaused=false;
  if(activeAmbient)AMBIENT[activeAmbient].play();updatePomDisplay(pomTotal);focusOverlay.classList.remove('hidden');clearInterval(pomIntervalId);
  // Show strict mode warning after 3 seconds
  const warn=g('strictPenaltyWarning');if(warn){warn.style.display='block';warn.style.animation='blink 2s infinite';}
  if(Notification.permission!=='granted'&&state.notificationsEnabled)Notification.requestPermission();
  pomIntervalId=setInterval(()=>{
    if(!pomPaused){let left=Math.max(0,Math.ceil((pomEndTime-Date.now())/1000));updatePomDisplay(left);
      if(left===0){playHaptic('chime');clearInterval(pomIntervalId);addXP(50,50,window.innerWidth/2,window.innerHeight/2);if(activeAmbient)AMBIENT[activeAmbient].pause();if(warn)warn.style.display='none';if(Notification.permission==='granted')new Notification('Focus Complete! 🎯',{body:`Done: ${title}. +50 XP earned!`,icon:'icon.svg'});}}
  },1000);
}
g('btnFocusEvent').addEventListener('click',()=>{const ev=state.events.find(e=>e.id===g('editingEventId').value);if(ev)startFocus(ev.title,t2m(ev.end)-t2m(ev.start));});
g('btnFocusTask').addEventListener('click',()=>{const tk=state.tasks.find(e=>e.id===g('editingTaskId').value);if(tk)startFocus(tk.title,25);});
function updatePomDisplay(left){const m=Math.floor(left/60),s=left%60;g('pomodoroTimeText').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;g('pomodoroProgress').style.strokeDashoffset=565.48-(565.48*(left/pomTotal));}
g('btnToggleFocus').addEventListener('click',e=>{playHaptic('tick');pomPaused=!pomPaused;const icon=g('focusPlayIcon'),btn=e.currentTarget;if(pomPaused){icon.textContent='play_arrow';btn.classList.replace('pause','play');g('focusPhaseText').textContent='paused';pomLeftPaused=Math.max(0,Math.ceil((pomEndTime-Date.now())/1000));if(activeAmbient)AMBIENT[activeAmbient].pause();}else{icon.textContent='pause';btn.classList.replace('play','pause');g('focusPhaseText').textContent='time to focus';pomEndTime=Date.now()+pomLeftPaused*1000;if(activeAmbient)AMBIENT[activeAmbient].play();}});
g('btnExitFocus').addEventListener('click',()=>{
  playHaptic('tick');clearInterval(pomIntervalId);
  const warn=g('strictPenaltyWarning');if(warn)warn.style.display='none';
  if(pomTotal>0&&pomEndTime&&Math.ceil((pomEndTime-Date.now())/1000)>30){
    state.gamify.xp=Math.max(0,state.gamify.xp-50);state.gamify.coins=Math.max(0,(state.gamify.coins||0)-50);
    saveData();renderGamification();
    spawnFloatingText('-50 XP',window.innerWidth/2,200,'#EF4444');
    showToast('Strict Mode: -50 XP for quitting early!','danger','🔥');
  }
  pomTotal=0;focusOverlay.classList.add('hidden');if(activeAmbient)AMBIENT[activeAmbient].pause();
});

// ===== NOTIFICATIONS & TIME =====
g('btnNotifications').addEventListener('click',()=>{initAudio();if(Notification.permission==='default')Notification.requestPermission().then(p=>{state.notificationsEnabled=(p==='granted');renderNotificationsIcon();showToast(p==='granted'?'Notifications enabled!':'Notifications blocked by browser',p==='granted'?'success':'danger',p==='granted'?'🔔':'🔕');});else if(Notification.permission==='granted'){playHaptic('chime');showToast('Already active — alerts 5 mins before events','success','🔔');}});
function renderNotificationsIcon(){const ic=g('iconAlert');ic.textContent=state.notificationsEnabled?'notifications_active':'notifications_off';ic.classList.toggle('text-success',state.notificationsEnabled);}
function updateCurrentTime(){
  const now=new Date(),mins=now.getHours()*60+now.getMinutes();timeLine.style.top=`${mins}px`;
  if(state.activeTab==='view-timeline')timeLine.scrollIntoView({behavior:'smooth',block:'center'});
  if(state.notificationsEnabled&&Notification.permission==='granted'){
    const ns=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const t5=new Date(now.getTime()+300000);const t5s=`${String(t5.getHours()).padStart(2,'0')}:${String(t5.getMinutes()).padStart(2,'0')}`;
    state.events.forEach(ev=>{if(ev.start===t5s)new Notification(`Up Next: ${ev.title}`,{body:'Starts in 5 mins.'});else if(ev.start===ns)new Notification(`Starting Now: ${ev.title}`);});
  }
}

// ===== BACKUP =====
g('btnExport').addEventListener('click',()=>{
  playHaptic('tick');
  const d='data:text/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(state));
  const a=document.createElement('a');a.href=d;a.download=`lifeos_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();a.remove();
  showToast('Backup exported!','success','💾');
});
g('btnImport').addEventListener('click',()=>{playHaptic('tick');g('importFileInput').click();});
g('importFileInput').addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{try{
    const p=JSON.parse(ev.target.result);
    if(p.events||p.tasks){state.events=p.events||[];state.tasks=p.tasks||[];state.habits=p.habits||[];state.transactions=p.transactions||[];state.journal=p.journal||[];state.notes=p.notes||[];if(p.gamify)state.gamify=p.gamify;saveData();renderAll();showToast('Data restored!','success','✅');}
    else showToast('Invalid backup file','danger','❌');
  }catch{showToast('Could not read file','danger','❌');}};
  r.readAsText(file);e.target.value='';
});

// ===== RENDER HEADER =====
function renderDayStats(){
  const d=new Date();const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  g('headerSubtitle').textContent=`${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  const h=d.getHours();g('greetingMsg').textContent=h<12?'Good Morning,':h<18?'Good Afternoon,':'Good Evening,';
  const w=g('weekSlider');w.innerHTML='';
  for(let i=-2;i<=4;i++){const l=new Date();l.setDate(d.getDate()+i);const hasEv=state.events.some(ev=>new Date().toDateString()===l.toDateString());w.innerHTML+=`<div class="day-card haptic${i===0?' active':''}${hasEv?' has-event':''}"><div class="day-name">${days[l.getDay()].substr(0,3)}</div><div class="day-num">${l.getDate()}</div></div>`;}
}

// ===== INIT =====
function renderAll(){renderGamification();renderEvents();renderTasks();renderHabits();renderHeatmap();renderFinance();renderJournal();renderNotes();renderInsightStats();}

// SVG gradient for pomodoro ring
function injectSVGDefs(){
  const svg=document.querySelector('.pomodoro-svg');
  if(!svg)return;
  const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
  defs.innerHTML=`<linearGradient id="pomGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#7C3AED"/><stop offset="100%" stop-color="#06B6D4"/></linearGradient>`;
  svg.prepend(defs);
}

function init(){
  processDailyMaintenance();
  if(!state.gamify.activeTheme)state.gamify.activeTheme='default';
  if(!state.gamify.unlockedThemes)state.gamify.unlockedThemes=['default'];
  document.body.setAttribute('data-theme',state.gamify.activeTheme);
  document.body.addEventListener('click',initAudio,{once:true});document.body.addEventListener('touchstart',initAudio,{once:true});
  grid.innerHTML='';for(let i=0;i<24;i++){const row=document.createElement('div');row.className='hour-row';row.innerHTML=`<div class="time-label">${String(i).padStart(2,'0')}:00</div>`;grid.appendChild(row);}
  const bgClick=document.createElement('div');bgClick.className='timeline-interactive-bg';evCon.parentElement.appendChild(bgClick);
  bgClick.addEventListener('click',e=>{const y=e.clientY-bgClick.getBoundingClientRect().top,mins=Math.floor(y),h=Math.floor(mins/60),m=Math.floor((mins%60)/5)*5;const st=m2t(h*60+m),en=m2t(h*60+m+60);openEventModal({title:'',start:st,end:en,color:EVT_COLORS[0].id});});
  renderColorPicker();renderDayStats();renderAll();renderNotificationsIcon();injectSVGDefs();
  updateCurrentTime();setInterval(updateCurrentTime,60000);
  g('fabBtn').addEventListener('click',()=>{playHaptic('tick');if(state.activeTab==='view-timeline')openEventModal();else if(state.activeTab==='view-projects')openTaskModal();else if(state.activeTab==='view-finance')openFinanceModal();else if(state.activeTab==='view-notes')openNoteModal();});
  document.querySelectorAll('.close-sheet-btn').forEach(btn=>btn.addEventListener('click',()=>{playHaptic('tick');document.querySelectorAll('.bottom-sheet-overlay').forEach(el=>el.classList.add('hidden'));}));
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{playHaptic('tick');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const t=btn.dataset.target;document.querySelectorAll('.view-section').forEach(s=>s.classList.remove('active'));g(t).classList.add('active');state.activeTab=t;g('fabBtn').style.transform=t==='view-insight'?'scale(0)':'scale(1)';g('timelineHeaderExt').classList.toggle('collapse',t!=='view-timeline');if(t==='view-insight')renderInsightStats();if(t==='view-finance')renderFinance();}));
}
document.addEventListener('DOMContentLoaded',init);
