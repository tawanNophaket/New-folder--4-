// === Core State ===
let state = {
    currentTab: 'view-timeline', // view-timeline, view-tasks, view-focus
    selectedDate: new Date(),
    events: [], // { id, title, start, end, color, date }
    tasks: []   // { id, title, completed }
};

const PIXELS_PER_MINUTE = 1;

// === Colors Palette ===
const colors = [
    { id: 'brand', bg: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', raw: '#8B5CF6' },
    { id: 'work', bg: 'linear-gradient(135deg, #4F46E5, #818CF8)', raw: '#4F46E5' },
    { id: 'personal', bg: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', raw: '#0EA5E9' },
    { id: 'health', bg: 'linear-gradient(135deg, #10B981, #34D399)', raw: '#10B981' },
    { id: 'study', bg: 'linear-gradient(135deg, #F59E0B, #FBBF24)', raw: '#F59E0B' },
    { id: 'alert', bg: 'linear-gradient(135deg, #EF4444, #F87171)', raw: '#EF4444' }
];

// === Audio Context (Haptic Feedback) ===
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playHaptic(type = 'tick') {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'pop') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
}

// Ensure audio context starts on first interaction
document.body.addEventListener('touchstart', initAudio, { once: true });
document.body.addEventListener('click', initAudio, { once: true });

// Attach basic haptics
document.querySelectorAll('.haptic').forEach(el => {
    el.addEventListener('click', () => playHaptic('tick'));
});

// === DOM Elements ===
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view-section');
const headerTitle = document.getElementById('headerTitle');
const headerSubtitle = document.getElementById('headerSubtitle');
const timelineHeaderExt = document.getElementById('timelineHeaderExt');
const fabBtn = document.getElementById('fabBtn');
const fabIcon = fabBtn.querySelector('.material-icons-round');

// Timeline Elements
const weekSlider = document.getElementById('weekSlider');
const timelineGrid = document.getElementById('timelineGrid');
const eventsContainer = document.getElementById('eventsContainer');
const currentTimeLine = document.getElementById('currentTimeLine');
const timelineContainer = document.getElementById('timelineContainer');
const btnToday = document.getElementById('btnToday');

// Event Modal
const addEventSheet = document.getElementById('addEventSheet');
const eventForm = document.getElementById('eventForm');
const colorPicker = document.querySelector('.color-picker');

// Task Elements
const taskList = document.getElementById('taskList');
const taskProgressBar = document.getElementById('taskProgressBar');
const taskProgressText = document.getElementById('taskProgressText');
const addTaskSheet = document.getElementById('addTaskSheet');
const taskForm = document.getElementById('taskForm');

// Focus Elements
const greetingMsg = document.getElementById('greetingMsg');
const insightTodoCount = document.getElementById('insightTodoCount');
const statTimeBlocked = document.getElementById('statTimeBlocked');
const statTasksDone = document.getElementById('statTasksDone');

// === Initialization ===
function init() {
    loadData();
    setupModals();
    populateColorPicker();
    
    // Timeline specific
    renderTimelineGrid();
    renderWeekCalendar();
    
    const interactiveBg = document.createElement('div');
    interactiveBg.className = 'timeline-interactive-bg';
    interactiveBg.onclick = handleTimelineClick;
    timelineGrid.appendChild(interactiveBg);

    updateCurrentTimeIndicator();
    setInterval(updateCurrentTimeIndicator, 60000);
    setTimeout(scrollToCurrentTime, 100);

    // Initial render
    renderEvents();
    renderTasks();
    updateFocusDashboard();
    
    // Setup Navigation
    setupNavigation();
}

function loadData() {
    state.events = JSON.parse(localStorage.getItem('lifeos_events')) || [];
    state.tasks = JSON.parse(localStorage.getItem('lifeos_tasks')) || [];
}

function saveData() {
    localStorage.setItem('lifeos_events', JSON.stringify(state.events));
    localStorage.setItem('lifeos_tasks', JSON.stringify(state.tasks));
    updateFocusDashboard();
}

// === Navigation & Layout System ===
function setupNavigation() {
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = btn.dataset.target;
            if (state.currentTab === target) return;
            
            // UI Update
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            views.forEach(v => v.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            
            state.currentTab = target;
            updateHeaderAndFab();
        });
    });

    fabBtn.addEventListener('click', () => {
        if (state.currentTab === 'view-timeline') openEventSheet();
        else if (state.currentTab === 'view-tasks' || state.currentTab === 'view-focus') openTaskSheet();
    });

    btnToday.addEventListener('click', () => {
        state.selectedDate = new Date();
        renderWeekCalendar();
        renderEvents();
        if(state.currentTab === 'view-timeline') scrollToCurrentTime();
    });
}

function updateHeaderAndFab() {
    if (state.currentTab === 'view-timeline') {
        headerTitle.textContent = 'Timeline';
        headerSubtitle.textContent = state.selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        timelineHeaderExt.classList.remove('collapse');
        fabIcon.textContent = 'add';
        fabIcon.style.transform = 'rotate(0deg)';
        fabBtn.style.display = 'flex';
    } else if (state.currentTab === 'view-tasks') {
        headerTitle.textContent = 'Daily Goals';
        headerSubtitle.textContent = 'Organize your mind';
        timelineHeaderExt.classList.add('collapse');
        fabIcon.textContent = 'add_task';
        fabIcon.style.transform = 'rotate(90deg)';
        fabBtn.style.display = 'flex';
    } else if (state.currentTab === 'view-focus') {
        headerTitle.textContent = 'Insights';
        headerSubtitle.textContent = 'Your daily summary';
        timelineHeaderExt.classList.add('collapse');
        fabBtn.style.display = 'none'; // No FAB in focus mode typically
        updateFocusDashboard();
    }
}

// === View 1: Timeline (Advanced Overlap) ===
function renderWeekCalendar() {
    weekSlider.innerHTML = '';
    headerSubtitle.textContent = state.selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    for (let i = -3; i <= 10; i++) {
        const d = new Date(state.selectedDate);
        d.setDate(d.getDate() + i);
        
        const card = document.createElement('div');
        card.className = `day-card haptic ${d.toDateString() === state.selectedDate.toDateString() ? 'active' : ''}`;
        if (d.toDateString() === new Date().toDateString() && !card.classList.contains('active')) {
            card.style.border = '1px solid var(--text-secondary)';
        }

        card.innerHTML = `
            <span class="day-name">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            <span class="day-num">${d.getDate()}</span>
        `;
        
        card.onclick = () => {
            playHaptic('tick');
            state.selectedDate = d;
            renderWeekCalendar();
            renderEvents();
            card.scrollIntoView({ behavior: 'smooth', inline: 'center' });
            updateHeaderAndFab(); // update month text
        };
        weekSlider.appendChild(card);
    }
}

function renderTimelineGrid() {
    timelineGrid.innerHTML = '';
    for (let i = 0; i < 24; i++) {
        const row = document.createElement('div');
        row.className = 'hour-row';
        const label = document.createElement('div');
        label.className = 'time-label';
        label.textContent = i === 0 ? '' : `${i%12||12} ${i>=12?'PM':'AM'}`;
        row.appendChild(label);
        timelineGrid.appendChild(row);
    }
}

function scrollToCurrentTime() {
    if (new Date().toDateString() === state.selectedDate.toDateString()) {
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        timelineContainer.scrollTop = Math.max(0, (mins * PIXELS_PER_MINUTE) - 150);
    }
}

function updateCurrentTimeIndicator() {
    const now = new Date();
    if (now.toDateString() === state.selectedDate.toDateString()) {
        currentTimeLine.style.display = 'block';
        currentTimeLine.style.top = `${(now.getHours() * 60 + now.getMinutes()) * PIXELS_PER_MINUTE}px`;
    } else {
        currentTimeLine.style.display = 'none';
    }
}

// Algorithm to calculate overlapping blocks
function calculateOverlaps(eventsArray) {
    if (eventsArray.length === 0) return [];
    
    // Sort by start time, then duration
    let sorted = [...eventsArray].map(e => {
        const [sh, sm] = e.start.split(':').map(Number);
        const [eh, em] = e.end.split(':').map(Number);
        return { ...e, startMin: sh*60+sm, endMin: eh*60+em, duration: (eh*60+em)-(sh*60+sm) };
    }).sort((a, b) => a.startMin - b.startMin || b.duration - a.duration);
    
    let columns = [];
    let lastEventEnding = null;

    for (let i = 0; i < sorted.length; i++) {
        let ev = sorted[i];
        if (lastEventEnding !== null && ev.startMin >= lastEventEnding) {
            packEvents(columns);
            columns = [];
            lastEventEnding = null;
        }

        let placed = false;
        for (let j = 0; j < columns.length; j++) {
            let col = columns[j];
            if (col[col.length - 1].endMin <= ev.startMin) {
                col.push(ev);
                placed = true;
                break;
            }
        }
        if (!placed) columns.push([ev]);
        
        if (lastEventEnding === null || ev.endMin > lastEventEnding) lastEventEnding = ev.endMin;
    }
    if (columns.length > 0) packEvents(columns);
    
    function packEvents(cols) {
        let numCols = cols.length;
        for (let i = 0; i < numCols; i++) {
            let col = cols[i];
            for (let j = 0; j < col.length; j++) {
                let ev = col[j];
                ev.colSpan = numCols;
                ev.colIndex = i;
            }
        }
    }
    
    return sorted;
}

function renderEvents() {
    eventsContainer.innerHTML = '';
    const dateStr = formatDateStr(state.selectedDate);
    const todaysEvents = state.events.filter(e => e.date === dateStr);
    
    const processedEvents = calculateOverlaps(todaysEvents);
    
    processedEvents.forEach(e => {
        if (e.duration <= 0) return;
        
        const block = document.createElement('div');
        block.className = 'event-block haptic';
        
        // Overlap Math
        const widthPercent = 100 / e.colSpan;
        const leftPercent = widthPercent * e.colIndex;
        
        block.style.top = `${e.startMin * PIXELS_PER_MINUTE}px`;
        block.style.height = `${e.duration * PIXELS_PER_MINUTE}px`;
        block.style.width = `calc(${widthPercent}% - 4px)`;
        block.style.left = `calc(${leftPercent}% + 2px)`; // +2px for small gap
        
        const colorObj = colors.find(c => c.id === e.color) || colors[0];
        block.style.background = colorObj.bg;
        
        let content = `<div class="event-title">${e.title}</div>`;
        if (e.duration >= 30) content += `<div class="event-time">${e.start} - ${e.end}</div>`;
        block.innerHTML = content;
        
        block.onclick = (event) => {
            event.stopPropagation();
            playHaptic('tick');
            openEventSheet(e.id);
        };
        
        eventsContainer.appendChild(block);
    });
}

function handleTimelineClick(e) {
    const rect = timelineGrid.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    let h = Math.floor(clickY / HOUR_HEIGHT);
    openEventSheet(null, `${h.toString().padStart(2,'0')}:00`, `${(h+1>23?23:h+1).toString().padStart(2,'0')}:00`);
}

// === View 2: Tasks ===
function renderTasks() {
    taskList.innerHTML = '';
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.completed).length;
    
    taskProgressText.textContent = `${done}/${total} Done`;
    taskProgressBar.style.width = total === 0 ? '0%' : `${(done/total)*100}%`;
    
    if (total === 0) {
        taskList.innerHTML = `<div class="empty-state"><span class="material-icons-round">done_all</span><p>No goals yet. Clear mind, clear space.</p></div>`;
        return;
    }

    state.tasks.forEach(t => {
        const div = document.createElement('div');
        div.className = `task-item haptic ${t.completed ? 'completed' : ''}`;
        
        div.onclick = () => {
            playHaptic('pop'); // nice pop sound for completing task
            t.completed = !t.completed;
            saveData();
            renderTasks();
        };

        div.innerHTML = `
            <div class="checkbox-custom">
                <span class="material-icons-round" style="font-size: 16px;">check</span>
            </div>
            <div class="task-title">${t.title}</div>
            <div class="task-delete haptic" onclick="event.stopPropagation(); deleteTask('${t.id}')">
                <span class="material-icons-round">close</span>
            </div>
        `;
        taskList.appendChild(div);
    });
}

function deleteTask(id) {
    playHaptic('tick');
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveData();
    renderTasks();
}

// === View 3: Focus Dashboard ===
function updateFocusDashboard() {
    const hour = new Date().getHours();
    let msg = "Good Evening";
    if (hour < 12) msg = "Good Morning";
    else if (hour < 18) msg = "Good Afternoon";
    greetingMsg.textContent = `${msg},`;

    const pendingTasks = state.tasks.filter(t => !t.completed).length;
    insightTodoCount.textContent = `${pendingTasks} target${pendingTasks!==1?'s':''}`;

    // Calculate time blocked today
    const dateStr = formatDateStr(new Date()); // today real date
    const todaysEvents = state.events.filter(e => e.date === dateStr);
    let totalMins = 0;
    todaysEvents.forEach(e => {
        const [sh, sm] = e.start.split(':').map(Number);
        const [eh, em] = e.end.split(':').map(Number);
        totalMins += ((eh*60+em)-(sh*60+sm));
    });
    
    const hours = (totalMins / 60).toFixed(1);
    document.getElementById('statTimeBlocked').innerHTML = `${hours}<span class="unit">h</span>`;
    
    const doneTasks = state.tasks.filter(t => t.completed).length;
    document.getElementById('statTasksDone').textContent = doneTasks;
}

// === Form Modals ===
function setupModals() {
    document.querySelectorAll('.close-sheet-btn').forEach(b => b.onclick = closeModals);
    document.querySelectorAll('.close-task-btn').forEach(b => b.onclick = closeModals);
    
    eventForm.onsubmit = handleSaveEvent;
    document.getElementById('btnDeleteEvent').onclick = () => {
        const id = document.getElementById('editingEventId').value;
        if(id) {
            state.events = state.events.filter(e => e.id !== id);
            saveData(); renderEvents(); closeModals(); playHaptic('pop');
        }
    };

    taskForm.onsubmit = (e) => {
        e.preventDefault();
        const title = document.getElementById('taskInputTitle').value.trim();
        if(title) {
            state.tasks.push({ id: Date.now().toString(), title, completed: false });
            saveData(); renderTasks(); closeModals(); playHaptic('pop');
        }
    };
}

function closeModals() {
    addEventSheet.classList.add('hidden');
    addTaskSheet.classList.add('hidden');
    document.activeElement.blur();
}

function openEventSheet(editId = null, defaultStart = '', defaultEnd = '') {
    playHaptic('tick');
    addEventSheet.classList.remove('hidden');
    const titleInp = document.getElementById('eventTitle');
    const startInp = document.getElementById('startTime');
    const endInp = document.getElementById('endTime');
    const idInp = document.getElementById('editingEventId');
    const delBtn = document.getElementById('btnDeleteEvent');

    if (editId) {
        const e = state.events.find(x => x.id === editId);
        titleInp.value = e.title;
        startInp.value = e.start;
        endInp.value = e.end;
        idInp.value = editId;
        setColorPicker(e.color);
        delBtn.classList.remove('hidden');
    } else {
        titleInp.value = '';
        if(!defaultStart) {
            const now = new Date();
            defaultStart = `${now.getHours().toString().padStart(2,'0')}:00`;
            defaultEnd = `${(now.getHours()+1>23?23:now.getHours()+1).toString().padStart(2,'0')}:00`;
        }
        startInp.value = defaultStart;
        endInp.value = defaultEnd;
        idInp.value = '';
        setColorPicker(colors[0].id);
        delBtn.classList.add('hidden');
    }
    setTimeout(() => titleInp.focus(), 300); // Wait for animation
}

function openTaskSheet() {
    playHaptic('tick');
    addTaskSheet.classList.remove('hidden');
    const inp = document.getElementById('taskInputTitle');
    inp.value = '';
    setTimeout(() => inp.focus(), 300);
}

function handleSaveEvent(e) {
    e.preventDefault();
    const title = document.getElementById('eventTitle').value.trim();
    const start = document.getElementById('startTime').value;
    const end = document.getElementById('endTime').value;
    const id = document.getElementById('editingEventId').value;
    const color = document.querySelector('.color-option.active').dataset.id;
    
    if (start >= end) { alert("End time must be after Start time."); return; }
    
    const dateStr = formatDateStr(state.selectedDate);
    if (id) {
        const idx = state.events.findIndex(x => x.id === id);
        if (idx !== -1) state.events[idx] = { id, title, start, end, color, date: dateStr };
    } else {
        state.events.push({ id: Date.now().toString(), title, start, end, color, date: dateStr });
    }
    
    saveData(); renderEvents(); closeModals(); playHaptic('pop');
}

// Helpers
function formatDateStr(d) {
    const year = d.getFullYear(); let month = (d.getMonth() + 1).toString().padStart(2, '0'); let day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function populateColorPicker() {
    colorPicker.innerHTML = '';
    colors.forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = `color-option haptic ${idx === 0 ? 'active' : ''}`;
        div.dataset.id = c.id;
        div.style.background = c.bg;
        div.style.setProperty('--color-raw', c.raw);
        div.onclick = () => {
            playHaptic('tick');
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            div.classList.add('active');
        };
        colorPicker.appendChild(div);
    });
}
function setColorPicker(id) {
    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
    const el = document.querySelector(`.color-option[data-id="${id}"]`);
    if(el) el.classList.add('active');
    else document.querySelector('.color-option').classList.add('active');
}

// Fire
init();
