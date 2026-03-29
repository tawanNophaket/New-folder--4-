const STORAGE_KEYS = { EVENTS: 'ul_events', TASKS: 'ul_tasks', HABITS: 'ul_habits', FINANCE: 'ul_finance', JOURNAL: 'ul_journal' };
const EVENT_COLORS = [
    { id: 'brand', raw: '#8B5CF6' }, { id: 'cyan', raw: '#06B6D4' },
    { id: 'rose', raw: '#F43F5E' }, { id: 'amber', raw: '#F59E0B' },
    { id: 'emerald', raw: '#10B981' }, { id: 'indigo', raw: '#6366F1' }
];
const PIXELS_PER_MINUTE = 1;

let state = {
    events: JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS)) || [],
    tasks: JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [], // {id, title, status: 'todo'|'doing'|'done'}
    habits: JSON.parse(localStorage.getItem(STORAGE_KEYS.HABITS)) || [],
    transactions: JSON.parse(localStorage.getItem(STORAGE_KEYS.FINANCE)) || [], // {id, amount, desc, type, date}
    journal: JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL)) || [], // {id, date, stars, text}
    selectedColor: EVENT_COLORS[0].id,
    activeTab: 'view-timeline',
    notificationsEnabled: Notification.permission === 'granted'
};

// Data Migrations
state.tasks.forEach(t => { if(t.completed !== undefined) { t.status = t.completed ? 'done' : 'todo'; delete t.completed; } });

// ================= HAPTIC AUDIO ================= 
let audioCtx;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playHaptic(type = 'tick') {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'tick') {
        osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.05);
        gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'pop') {
        osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.type = 'sine'; osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'chime') {
        osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(400, now + 0.5);
        gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.type = 'triangle'; osc.start(now); osc.stop(now + 0.5);
    }
}

// ================= DOM ================= 
const grid = document.getElementById('timelineGrid');
const eventsContainer = document.getElementById('eventsContainer');
const timeLine = document.getElementById('currentTimeLine');

// Modals
const addEventSheet = document.getElementById('addEventSheet');
const addTaskSheet = document.getElementById('addTaskSheet');
const addHabitSheet = document.getElementById('addHabitSheet');
const addFinanceSheet = document.getElementById('addFinanceSheet');

const fabBtn = document.getElementById('fabBtn');

document.getElementById('btnNotifications').addEventListener('click', () => {
    initAudio();
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
            state.notificationsEnabled = (p === 'granted');
            renderNotificationsIcon();
        });
    } else if (Notification.permission === 'granted') {
        playHaptic('chime'); alert("Alerts active. You will be notified 5 mins before blocks start.");
    }
});
function renderNotificationsIcon() {
    const icon = document.getElementById('iconAlert');
    icon.textContent = state.notificationsEnabled ? 'notifications_active' : 'notifications_off';
    if(state.notificationsEnabled) icon.classList.add('text-success'); else icon.classList.remove('text-success');
}

// ================= INIT ================= 
function init() {
    document.body.addEventListener('click', initAudio, { once: true });
    document.body.addEventListener('touchstart', initAudio, { once: true });
    
    grid.innerHTML = '';
    for (let i = 0; i < 24; i++) {
        const row = document.createElement('div');
        row.className = 'hour-row';
        row.innerHTML = `<div class="time-label">${i.toString().padStart(2, '0')}:00</div>`;
        grid.appendChild(row);
    }

    const bgClick = document.createElement('div');
    bgClick.className = 'timeline-interactive-bg';
    eventsContainer.parentElement.appendChild(bgClick);
    bgClick.addEventListener('click', (e) => {
        const y = e.clientY - bgClick.getBoundingClientRect().top;
        const clickedMinutes = Math.floor(y / PIXELS_PER_MINUTE);
        let h = Math.floor(clickedMinutes / 60);
        let m = Math.floor((clickedMinutes % 60) / 5) * 5;
        const startStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        let endM = m + 60; let endH = h + Math.floor(endM / 60); endM = endM % 60;
        if(endH > 23) { endH = 23; endM = 59; }
        const endStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
        openEventModal({ title: '', start: startStr, end: endStr, color: EVENT_COLORS[0].id });
    });

    renderDayStats();
    renderColorPicker();
    renderEvents();
    renderTasks();
    renderHabits();
    renderFinance();
    renderJournal();
    renderNotificationsIcon();
    
    updateCurrentTimeIndicator();
    setInterval(updateCurrentTimeIndicator, 60000);

    // Navigation and FAB
    fabBtn.addEventListener('click', () => {
        playHaptic('tick');
        if (state.activeTab === 'view-timeline') openEventModal();
        else if (state.activeTab === 'view-projects') openTaskModal();
        else if (state.activeTab === 'view-finance') openFinanceModal();
    });

    document.querySelectorAll('.close-sheet-btn').forEach(btn => {
         btn.addEventListener('click', () => {
             playHaptic('tick');
             document.querySelectorAll('.bottom-sheet-overlay').forEach(el => el.classList.add('hidden'));
         });
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            playHaptic('tick');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            state.activeTab = targetId;
            fabBtn.style.transform = targetId === 'view-insight' ? 'scale(0)' : 'scale(1)';
            
            const ext = document.getElementById('timelineHeaderExt');
            ext.classList.toggle('collapse', targetId !== 'view-timeline');
        });
    });

    // Forms
    document.getElementById('eventForm').addEventListener('submit', (e) => {
        e.preventDefault(); playHaptic('pop');
        const id = document.getElementById('editingEventId').value;
        const evt = {
            id: id || Date.now().toString(),
            title: document.getElementById('eventTitle').value,
            start: document.getElementById('startTime').value,
            end: document.getElementById('endTime').value,
            color: state.selectedColor
        };
        if (id) { const idx = state.events.findIndex(x => x.id === id); if (idx > -1) state.events[idx] = evt; } 
        else state.events.push(evt);
        saveData(); renderEvents(); addEventSheet.classList.add('hidden');
    });
    
    document.getElementById('btnDeleteEvent').addEventListener('click', () => {
        state.events = state.events.filter(x => x.id !== document.getElementById('editingEventId').value);
        saveData(); renderEvents(); addEventSheet.classList.add('hidden'); playHaptic('tick');
    });
}

function updateCurrentTimeIndicator() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    timeLine.style.top = `${mins * PIXELS_PER_MINUTE}px`;
    if(state.activeTab === 'view-timeline') timeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (state.notificationsEnabled && Notification.permission === 'granted') {
        const nowStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const t5 = new Date(now.getTime() + 5 * 60000);
        const t5Str = `${t5.getHours().toString().padStart(2, '0')}:${t5.getMinutes().toString().padStart(2, '0')}`;

        state.events.forEach(ev => {
            if (ev.start === t5Str) { playHaptic('chime'); new Notification(`Up Next: ${ev.title}`, { body: "Starts in 5 mins." }); } 
            else if (ev.start === nowStr) { playHaptic('chime'); new Notification(`Starting Now: ${ev.title}`); }
        });
    }
}

// ================= TIMELINE OVERLAPPING & EVENTS ================= 
function renderColorPicker() {
    const cp = document.querySelector('.color-picker');
    cp.innerHTML = '';
    EVENT_COLORS.forEach(c => {
        const div = document.createElement('div');
        div.className = `color-option ${state.selectedColor === c.id ? 'active' : ''}`;
        div.style.backgroundColor = c.raw; div.style.setProperty('--color-raw', c.raw);
        div.addEventListener('click', () => { playHaptic('tick'); state.selectedColor = c.id; renderColorPicker(); });
        cp.appendChild(div);
    });
}
function t2m(ts) { const [h, m] = ts.split(':').map(Number); return h * 60 + m; }
function m2t(m) { let h = Math.floor(m / 60); let min = m % 60; if(h>23){h=23;min=59;} return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`; }

function calculateOverlaps(arr) {
    const sorted = [...arr].sort((a, b) => t2m(a.start) - t2m(b.start));
    let cols = [];
    sorted.forEach(evt => {
        const start = t2m(evt.start);
        let placed = false;
        for (let i = 0; i < cols.length; i++) {
            if (t2m(cols[i][cols[i].length - 1].end) <= start) { cols[i].push(evt); evt.colIndex = i; placed = true; break; }
        }
        if (!placed) { evt.colIndex = cols.length; cols.push([evt]); }
    });
    sorted.forEach(evt => {
        const st = t2m(evt.start); const en = t2m(evt.end);
        let ovCols = 0;
        for (let i = 0; i < cols.length; i++) if (cols[i].some(e => t2m(e.start) < en && t2m(e.end) > st)) ovCols++;
        evt.maxCols = Math.max(ovCols, 1);
    });
    return sorted;
}

function renderEvents() {
    eventsContainer.innerHTML = '';
    const processEvents = calculateOverlaps(state.events);
    processEvents.forEach(evt => {
        const st = t2m(evt.start); const en = t2m(evt.end); const dur = en - st;
        const block = document.createElement('div');
        block.className = 'event-block';
        const wPct = (100 / evt.maxCols);
        block.style.top = `${st * PIXELS_PER_MINUTE}px`;
        block.style.height = `${dur * PIXELS_PER_MINUTE}px`;
        block.style.width = `calc(${wPct}% - 6px)`;
        block.style.left = `calc(${evt.colIndex * wPct}% + 2px)`;
        block.style.backgroundColor = EVENT_COLORS.find(c => c.id === evt.color)?.raw || EVENT_COLORS[0].raw;
        block.style.zIndex = evt.colIndex + 10;
        block.innerHTML = `<div class="event-title">${evt.title}</div><div class="event-time">${evt.start} - ${evt.end}</div><div class="resizer-handle"></div>`;
        enableDrag(block, evt);
        eventsContainer.appendChild(block);
    });
}
let bDrag = false, bRes = false, sTY = 0, iT = 0, iH = 0, dTimer;
function enableDrag(block, evtObj) {
    const res = block.querySelector('.resizer-handle');
    block.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('resizer-handle')) return;
        e.stopPropagation(); sTY = e.touches[0].clientY; iT = parseFloat(block.style.top);
        dTimer = setTimeout(() => { bDrag = true; block.classList.add('dragging'); playHaptic('tick'); }, 300);
    }, {passive: false});
    block.addEventListener('touchmove', (e) => {
        if (!bDrag) { clearTimeout(dTimer); return; } e.preventDefault();
        block.style.top = `${Math.max(0, iT + (e.touches[0].clientY - sTY))}px`;
    }, {passive: false});
    block.addEventListener('touchend', (e) => {
        clearTimeout(dTimer);
        if (!bDrag) openEventModal(evtObj);
        else {
            bDrag = false; block.classList.remove('dragging'); playHaptic('pop');
            const snapTop = Math.round(parseFloat(block.style.top) / 5) * 5;
            const dur = t2m(evtObj.end) - t2m(evtObj.start);
            evtObj.start = m2t(snapTop); evtObj.end = m2t(snapTop + dur);
            saveData(); renderEvents();
        }
    });
    res.addEventListener('touchstart', (e) => { e.stopPropagation(); bRes = true; sTY = e.touches[0].clientY; iH = parseFloat(block.style.height); block.classList.add('dragging'); }, {passive: false});
    res.addEventListener('touchmove', (e) => { if(!bRes)return; e.preventDefault(); block.style.height = `${Math.max(15, iH + (e.touches[0].clientY - sTY))}px`; }, {passive: false});
    res.addEventListener('touchend', (e) => {
        if(!bRes)return; bRes = false; block.classList.remove('dragging'); playHaptic('tick');
        evtObj.end = m2t(t2m(evtObj.start) + Math.round(parseFloat(block.style.height) / 5) * 5);
        saveData(); renderEvents();
    });
}
function openEventModal(evt = null) {
    if (evt && evt.id) {
        document.getElementById('editingEventId').value = evt.id; document.getElementById('eventTitle').value = evt.title;
        document.getElementById('startTime').value = evt.start; document.getElementById('endTime').value = evt.end;
        state.selectedColor = evt.color;
        document.getElementById('btnDeleteEvent').classList.remove('hidden'); document.getElementById('btnFocusEvent').classList.remove('hidden');
    } else {
        const d = new Date(); const st = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        document.getElementById('editingEventId').value = ''; document.getElementById('eventTitle').value = evt?.title || '';
        document.getElementById('startTime').value = evt?.start || st; document.getElementById('endTime').value = evt?.end || st;
        document.getElementById('btnDeleteEvent').classList.add('hidden'); document.getElementById('btnFocusEvent').classList.add('hidden');
    }
    renderColorPicker(); addEventSheet.classList.remove('hidden');
}

// ================= HABITS (WITH EDIT AND STREAKS) ================= 
function isSameDay(d1, d2) { return d1.toDateString() === d2.toDateString(); }
function calculateStreak(datesArr) {
    if(!datesArr || datesArr.length === 0) return 0;
    const dates = datesArr.map(d => new Date(d)).sort((a,b) => b-a);
    let streak = 0; let curr = new Date();
    if (!isSameDay(dates[0], curr)) {
        let yes = new Date(); yes.setDate(yes.getDate() - 1);
        if (isSameDay(dates[0], yes)) curr = yes; else return 0;
    }
    for(let i=0; i<dates.length; i++) { if (isSameDay(dates[i], curr)) { streak++; curr.setDate(curr.getDate() - 1); } else break; }
    return streak;
}

document.getElementById('btnAddHabit').addEventListener('click', () => {
    document.getElementById('habitModalTitle').textContent = 'New Habit';
    document.getElementById('habitInputTitle').value = ''; document.getElementById('editingHabitId').value = '';
    document.getElementById('btnDeleteHabit').classList.add('hidden');
    addHabitSheet.classList.remove('hidden');
});

document.getElementById('habitForm').addEventListener('submit', (e) => {
    e.preventDefault(); playHaptic('pop');
    const title = document.getElementById('habitInputTitle').value.trim();
    const id = document.getElementById('editingHabitId').value;
    if(id) {
        let h = state.habits.find(x => x.id === id); if(h) h.title = title;
    } else {
        state.habits.push({ id: Date.now().toString(), title, completedDates: [] });
    }
    saveData(); renderHabits(); addHabitSheet.classList.add('hidden');
});

document.getElementById('btnDeleteHabit').addEventListener('click', () => {
    state.habits = state.habits.filter(x => x.id !== document.getElementById('editingHabitId').value);
    saveData(); renderHabits(); addHabitSheet.classList.add('hidden'); playHaptic('tick');
});

let habitPressTimer;
function renderHabits() {
    const box = document.getElementById('habitsContainer'); box.innerHTML = '';
    const today = new Date().toDateString();
    
    state.habits.forEach(h => {
        const streak = calculateStreak(h.completedDates);
        const done = h.completedDates.indexOf(today) !== -1;
        const el = document.createElement('div');
        el.className = `habit-item ${done ? 'done' : ''}`;
        el.innerHTML = `
            <div class="habit-icon haptic"><span style="font-size: 1.2rem; font-weight: bold;">${done ? '✓' : h.title.charAt(0).toUpperCase()}</span></div>
            <span class="habit-name">${h.title}</span>
            ${streak > 0 ? `<div class="streak-badge">🔥 ${streak}</div>` : ''}
        `;
        
        // Long Press to Edit Logic
        el.addEventListener('touchstart', () => {
            habitPressTimer = setTimeout(() => {
                playHaptic('tick'); el.classList.add('edit-mode');
                // Open edit modal directly
                setTimeout(() => {
                    document.getElementById('habitModalTitle').textContent = 'Edit Habit';
                    document.getElementById('habitInputTitle').value = h.title; 
                    document.getElementById('editingHabitId').value = h.id;
                    document.getElementById('btnDeleteHabit').classList.remove('hidden');
                    addHabitSheet.classList.remove('hidden');
                    el.classList.remove('edit-mode');
                }, 400);
            }, 500);
        }, {passive:true});
        el.addEventListener('touchend', () => clearTimeout(habitPressTimer));
        el.addEventListener('touchmove', () => clearTimeout(habitPressTimer));
        
        // Normal Click to toggle
        el.addEventListener('click', (e) => {
            if(el.classList.contains('edit-mode')) return; // handled by long press
            if (done) h.completedDates = h.completedDates.filter(d => d !== today);
            else h.completedDates.push(today);
            playHaptic(done ? 'tick' : 'pop'); saveData(); renderHabits();
        });

        box.appendChild(el);
    });
}

// ================= PROJECTS / KANBAN ================= 
document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault(); playHaptic('pop');
    const id = document.getElementById('editingTaskId').value;
    const title = document.getElementById('taskInputTitle').value.trim();
    const status = document.getElementById('taskInputStatus').value;
    
    if(id) {
        let t = state.tasks.find(x => x.id === id); 
        if(t){ t.title = title; t.status = status; }
    } else {
        state.tasks.push({ id: Date.now().toString(), title, status });
    }
    saveData(); renderTasks(); addTaskSheet.classList.add('hidden');
});

document.getElementById('btnDeleteTask').addEventListener('click', () => {
    state.tasks = state.tasks.filter(x => x.id !== document.getElementById('editingTaskId').value);
    saveData(); renderTasks(); addTaskSheet.classList.add('hidden'); playHaptic('tick');
});

function openTaskModal(tk = null) {
    if(tk) {
        document.getElementById('taskModalTitle').textContent = 'Edit Task';
        document.getElementById('editingTaskId').value = tk.id;
        document.getElementById('taskInputTitle').value = tk.title;
        document.getElementById('taskInputStatus').value = tk.status;
        document.getElementById('btnDeleteTask').classList.remove('hidden');
    } else {
        document.getElementById('taskModalTitle').textContent = 'New Task';
        document.getElementById('editingTaskId').value = '';
        document.getElementById('taskInputTitle').value = '';
        document.getElementById('taskInputStatus').value = 'todo';
        document.getElementById('btnDeleteTask').classList.add('hidden');
    }
    addTaskSheet.classList.remove('hidden');
}

function renderTasks() {
    ['todo','doing','done'].forEach(st => document.getElementById(`list-${st}`).innerHTML = '');
    
    let stats = { todo: 0, doing: 0, done: 0 };
    state.tasks.forEach(t => {
        stats[t.status]++;
        const card = document.createElement('div');
        card.className = 'k-card haptic';
        
        let nextBtn = '';
        if(t.status === 'todo') nextBtn = `<button class="k-move-btn haptic" onclick="moveTask('${t.id}', 'doing', event)">Start <span class="material-icons-round" style="font-size:14px;">arrow_forward</span></button>`;
        else if(t.status === 'doing') nextBtn = `<button class="k-move-btn haptic" style="color:var(--success);" onclick="moveTask('${t.id}', 'done', event)">Finish <span class="material-icons-round" style="font-size:14px;">check</span></button>`;
        
        card.innerHTML = `
            <div class="k-title">${t.title}</div>
            <div class="k-actions">
                <span style="font-size:0.75rem; color:var(--text-secondary);">&nbsp;</span>
                ${nextBtn}
            </div>
        `;
        card.addEventListener('click', (e) => {
            if(!e.target.closest('.k-move-btn')) openTaskModal(t);
        });
        document.getElementById(`list-${t.status}`).appendChild(card);
    });

    ['todo','doing','done'].forEach(st => document.getElementById(`badge-${st}`).textContent = stats[st]);
    
    const total = state.tasks.length;
    document.getElementById('taskProgressText').textContent = total === 0 ? "0% Done" : `${Math.round((stats.done / total)*100)}% Done`;
}
window.moveTask = function(id, st, e) {
    if(e) e.stopPropagation();
    let t = state.tasks.find(x => x.id === id);
    if(t) { t.status = st; playHaptic(st==='done'?'pop':'tick'); saveData(); renderTasks(); }
}

// ================= FINANCE ================= 
document.querySelectorAll('.ft-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.ft-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); document.getElementById('finType').value = btn.getAttribute('data-type');
        playHaptic('tick');
    });
});
function openFinanceModal(tx = null) {
    if(tx) {
        document.getElementById('editingFinId').value = tx.id;
        document.getElementById('finAmount').value = tx.amount;
        document.getElementById('finDesc').value = tx.desc;
        document.getElementById('finType').value = tx.type;
        document.querySelectorAll('.ft-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-type')===tx.type));
        document.getElementById('btnDeleteFin').classList.remove('hidden');
    } else {
        document.getElementById('editingFinId').value = ''; document.getElementById('finAmount').value = ''; document.getElementById('finDesc').value = '';
        document.getElementById('btnDeleteFin').classList.add('hidden');
    }
    addFinanceSheet.classList.remove('hidden');
}

document.getElementById('financeForm').addEventListener('submit', (e) => {
    e.preventDefault(); playHaptic('pop');
    let id = document.getElementById('editingFinId').value;
    let t = {
        id: id || Date.now().toString(),
        amount: parseFloat(document.getElementById('finAmount').value),
        desc: document.getElementById('finDesc').value,
        type: document.getElementById('finType').value,
        date: new Date().toISOString()
    };
    if(id) { let idx = state.transactions.findIndex(x=>x.id===id); if(idx>-1) state.transactions[idx]=t; }
    else state.transactions.push(t);
    saveData(); renderFinance(); addFinanceSheet.classList.add('hidden');
});
document.getElementById('btnDeleteFin').addEventListener('click', () => {
    state.transactions = state.transactions.filter(x => x.id !== document.getElementById('editingFinId').value);
    saveData(); renderFinance(); addFinanceSheet.classList.add('hidden'); playHaptic('tick');
});
function getF() {
    return new Intl.NumberFormat('th-TH', { style:'currency', currency:'THB' });
}
function renderFinance() {
    let inc = 0, exp = 0;
    const ls = document.getElementById('transactionList'); ls.innerHTML = '';
    
    [...state.transactions].sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(tx => {
        if(tx.type==='INCOME') inc += tx.amount; else exp += tx.amount;
        
        let el = document.createElement('div'); el.className = `txn-item ${tx.type}`;
        el.innerHTML = `
            <div class="txn-info">
                <div class="txn-desc">${tx.desc}</div>
                <div class="txn-date">${new Date(tx.date).toLocaleDateString()}</div>
            </div>
            <div class="txn-amount">${tx.type==='INCOME'?'+':'-'} ${getF().format(tx.amount)}</div>
        `;
        el.addEventListener('click', ()=> openFinanceModal(tx));  ls.appendChild(el);
    });

    document.getElementById('totalIncome').textContent = getF().format(inc);
    document.getElementById('totalExpense').textContent = getF().format(exp);
    document.getElementById('totalBalance').textContent = getF().format(inc - exp);
}

// ================= INSIGHT & MOOD JOURNAL ================= 
let currentSelectedStars = 0;
document.querySelectorAll('.star').forEach(st => {
    st.addEventListener('click', (e) => {
        playHaptic('tick');
        currentSelectedStars = parseInt(e.target.getAttribute('data-val'));
        document.querySelectorAll('.star').forEach(s => {
            if(parseInt(s.getAttribute('data-val')) <= currentSelectedStars) {
                s.textContent = 'star'; s.classList.add('active');
            } else {
                s.textContent = 'star_outline'; s.classList.remove('active');
            }
        });
    });
});

document.getElementById('btnSaveJournal').addEventListener('click', () => {
    if (currentSelectedStars === 0) return alert("Please select a star rating first.");
    const txt = document.getElementById('gratitudeInput').value.trim();
    playHaptic('pop');
    state.journal.push({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        stars: currentSelectedStars,
        text: txt
    });
    saveData(); renderJournal();
    document.getElementById('gratitudeInput').value = '';
    document.getElementById('journalFeedback').style.display = 'block';
    setTimeout(()=> document.getElementById('journalFeedback').style.display = 'none', 3000);
});

function renderJournal() {
    const box = document.getElementById('journalHistoryContainer'); box.innerHTML = '';
    [...state.journal].sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(j => {
        let starsStr = ''; for(let i=0;i<j.stars;i++) starsStr += '★';
        const el = document.createElement('div'); el.className = 'journal-item';
        el.innerHTML = `
            <div class="journal-head">
                <span class="journal-date">${new Date(j.date).toLocaleDateString()}</span>
                <span class="journal-stars">${starsStr}</span>
            </div>
            ${j.text ? `<div class="journal-text">"${j.text}"</div>` : ''}
        `;
        box.appendChild(el);
    });
}

// ================= FOCUS POMODORO ================= 
const focusOverlay = document.getElementById('focusOverlay');
let pomIntervalId, pomLeft, pomTotal, pomPaused;
document.getElementById('btnFocusEvent').addEventListener('click', () => {
    playHaptic('pop'); addEventSheet.classList.add('hidden');
    const ev = state.events.find(e => e.id === document.getElementById('editingEventId').value);
    if(!ev) return;
    document.getElementById('focusTaskName').textContent = ev.title;
    pomTotal = (t2m(ev.end) - t2m(ev.start)) * 60; pomLeft = pomTotal; pomPaused = false;
    updatePomDisplay(); focusOverlay.classList.remove('hidden');
    clearInterval(pomIntervalId);
    pomIntervalId = setInterval(() => {
        if(!pomPaused && pomLeft > 0) { pomLeft--; updatePomDisplay(); if(pomLeft===0){ playHaptic('chime'); clearInterval(pomIntervalId); } }
    }, 1000);
});
function updatePomDisplay() {
    let m = Math.floor(pomLeft / 60); let s = pomLeft % 60;
    document.getElementById('pomodoroTimeText').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    document.getElementById('pomodoroProgress').style.strokeDashoffset = 565.48 - (565.48 * (pomLeft/pomTotal));
}
document.getElementById('btnToggleFocus').addEventListener('click', (e) => {
    playHaptic('tick'); pomPaused = !pomPaused;
    const btn = e.currentTarget; const icon = document.getElementById('focusPlayIcon');
    if(pomPaused) { icon.textContent="play_arrow"; btn.classList.replace('pause','play'); document.getElementById('focusPhaseText').textContent='paused'; } 
    else { icon.textContent="pause"; btn.classList.replace('play','pause'); document.getElementById('focusPhaseText').textContent='time to focus'; }
});
document.getElementById('btnExitFocus').addEventListener('click', () => { playHaptic('tick'); clearInterval(pomIntervalId); focusOverlay.classList.add('hidden'); });

function renderDayStats() {
    const d = new Date(); const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    headerSubtitle.textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
    const h = d.getHours(); document.getElementById('greetingMsg').textContent = h<12?"Good Morning,":h<18?"Good Afternoon,":"Good Evening,";
    const w = document.getElementById('weekSlider'); w.innerHTML = '';
    for(let i=-2; i<=4; i++) {
        let l = new Date(); l.setDate(d.getDate() + i);
        w.innerHTML += `<div class="day-card haptic ${i===0?'active':''}"><div class="day-name">${days[l.getDay()].substr(0,3)}</div><div class="day-num">${l.getDate()}</div></div>`;
    }
}
function saveData() {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
    localStorage.setItem(STORAGE_KEYS.FINANCE, JSON.stringify(state.transactions));
    localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(state.journal));
}

document.addEventListener('DOMContentLoaded', init);
