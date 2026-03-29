const STORAGE_KEYS = { EVENTS: 'lifeos_events', TASKS: 'lifeos_tasks', HABITS: 'lifeos_habits' };
const EVENT_COLORS = [
    { id: 'brand', raw: '#8B5CF6' }, { id: 'cyan', raw: '#06B6D4' },
    { id: 'rose', raw: '#F43F5E' }, { id: 'amber', raw: '#F59E0B' },
    { id: 'emerald', raw: '#10B981' }, { id: 'indigo', raw: '#6366F1' }
];
const PIXELS_PER_MINUTE = 1;

let state = {
    events: JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS)) || [],
    tasks: JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [],
    habits: JSON.parse(localStorage.getItem(STORAGE_KEYS.HABITS)) || [
        { id: 'h1', title: 'Drink Water', completedDates: [] },
        { id: 'h2', title: 'Read 10 mins', completedDates: [] }
    ],
    selectedColor: EVENT_COLORS[0].id,
    activeTab: 'view-timeline',
    notificationsEnabled: Notification.permission === 'granted'
};

// ================= HAPTIC AUDIO ================= 
let audioCtx;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playHaptic(type = 'tick') {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'tick') {
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.05);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'pop') {
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.type = 'sine';
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'chime') {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.5);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.type = 'triangle';
        osc.start(now); osc.stop(now + 0.5);
    }
}

// ================= DOM ELEMENTS ================= 
const grid = document.getElementById('timelineGrid');
const eventsContainer = document.getElementById('eventsContainer');
const timeLine = document.getElementById('currentTimeLine');
const addEventSheet = document.getElementById('addEventSheet');
const addTaskSheet = document.getElementById('addTaskSheet');
const eventForm = document.getElementById('eventForm');
const taskForm = document.getElementById('taskForm');
const colorPicker = document.querySelector('.color-picker');
const fabBtn = document.getElementById('fabBtn');
const headerTitle = document.getElementById('headerTitle');
const headerSubtitle = document.getElementById('headerSubtitle');

// ================= NOTIFICATIONS ================= 
document.getElementById('btnNotifications').addEventListener('click', () => {
    initAudio();
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
            state.notificationsEnabled = (p === 'granted');
            renderNotificationsIcon();
        });
    } else if (Notification.permission === 'granted') {
        playHaptic('chime');
        alert("Alerts are active. You will be notified 5 mins before blocks start.");
    }
});
function renderNotificationsIcon() {
    const icon = document.getElementById('iconAlert');
    icon.textContent = state.notificationsEnabled ? 'notifications_active' : 'notifications_off';
    if(state.notificationsEnabled) icon.classList.add('text-success');
    else icon.classList.remove('text-success');
}

// ================= INITIALIZATION ================= 
function init() {
    document.body.addEventListener('click', initAudio, { once: true });
    document.body.addEventListener('touchstart', initAudio, { once: true });
    
    // Build Timeline grid 0-23
    grid.innerHTML = '';
    for (let i = 0; i < 24; i++) {
        const row = document.createElement('div');
        row.className = 'hour-row';
        const label = document.createElement('div');
        label.className = 'time-label';
        label.textContent = `${i.toString().padStart(2, '0')}:00`;
        row.appendChild(label);
        grid.appendChild(row);
    }

    // Interactive BG for adding an event via tap on grid
    const bgClick = document.createElement('div');
    bgClick.className = 'timeline-interactive-bg';
    eventsContainer.parentElement.appendChild(bgClick);
    bgClick.addEventListener('click', (e) => {
        const rect = bgClick.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const clickedMinutes = Math.floor(y / PIXELS_PER_MINUTE);
        let h = Math.floor(clickedMinutes / 60);
        let m = clickedMinutes % 60;
        m = Math.floor(m / 5) * 5; // snap to 5 mins
        const startStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        
        let endM = m + 60; // default 1 hour
        let endH = h + Math.floor(endM / 60);
        endM = endM % 60;
        if(endH > 23) { endH = 23; endM = 59; }
        const endStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        openEventModal({ title: '', start: startStr, end: endStr, color: EVENT_COLORS[0].id });
    });

    renderColorPicker();
    renderDayStats();
    renderEvents();
    renderTasks();
    renderHabits();
    renderNotificationsIcon();
    
    updateCurrentTimeIndicator();
    setInterval(updateCurrentTimeIndicator, 60000); // Check alarms here

    // Listeners for modsls and nav
    fabBtn.addEventListener('click', () => {
        playHaptic('tick');
        if (state.activeTab === 'view-tasks') {
            document.getElementById('taskFormMode').value = 'task';
            document.getElementById('taskModalTitle').textContent = 'New Goal';
            addTaskSheet.classList.remove('hidden');
            setTimeout(() => document.getElementById('taskInputTitle').focus(), 300);
        } else {
            openEventModal();
        }
    });

    document.querySelectorAll('.close-sheet-btn').forEach(btn => {
         btn.addEventListener('click', () => {
             playHaptic('tick');
             addEventSheet.classList.add('hidden');
             addTaskSheet.classList.add('hidden');
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
            fabBtn.style.transform = targetId === 'view-focus' ? 'scale(0)' : 'scale(1)';
            
            // Layout specific adaptations
            const ext = document.getElementById('timelineHeaderExt');
            if(targetId === 'view-timeline') ext.classList.remove('collapse');
            else ext.classList.add('collapse');
        });
    });

    eventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        playHaptic('pop');
        const id = document.getElementById('editingEventId').value;
        const newEvent = {
            id: id || Date.now().toString(),
            title: document.getElementById('eventTitle').value,
            start: document.getElementById('startTime').value,
            end: document.getElementById('endTime').value,
            color: state.selectedColor
        };
        
        if (id) {
            const idx = state.events.findIndex(ev => ev.id === id);
            if (idx > -1) state.events[idx] = newEvent;
        } else {
            state.events.push(newEvent);
        }
        
        saveData();
        renderEvents();
        addEventSheet.classList.add('hidden');
    });

    document.getElementById('btnDeleteEvent').addEventListener('click', () => {
        playHaptic('tick');
        const id = document.getElementById('editingEventId').value;
        state.events = state.events.filter(ev => ev.id !== id);
        saveData();
        renderEvents();
        addEventSheet.classList.add('hidden');
    });
}

function updateCurrentTimeIndicator() {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    timeLine.style.top = `${currentMins * PIXELS_PER_MINUTE}px`;
    timeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Web Alarms checking
    if (state.notificationsEnabled && Notification.permission === 'granted') {
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const nowStr = `${hh}:${mm}`;
        
        // Target time 5 mins from now
        const t5 = new Date(now.getTime() + 5 * 60000);
        const t5Str = `${t5.getHours().toString().padStart(2, '0')}:${t5.getMinutes().toString().padStart(2, '0')}`;

        state.events.forEach(ev => {
            if (ev.start === t5Str) {
                playHaptic('chime');
                new Notification(`Up Next in 5 mins: ${ev.title}`, { body: "Time to wrap up and prepare for focus." });
            } else if (ev.start === nowStr) {
                playHaptic('chime');
                new Notification(`Starting Now: ${ev.title}`, { body: "Let's go!" });
            }
        });
    }
}

// ================= TIMELINE OVERLAPPING ALGORITHM & RENDER ================= 
function renderColorPicker() {
    colorPicker.innerHTML = '';
    EVENT_COLORS.forEach(c => {
        const div = document.createElement('div');
        div.className = `color-option ${state.selectedColor === c.id ? 'active' : ''}`;
        div.style.backgroundColor = c.raw;
        div.style.setProperty('--color-raw', c.raw);
        div.addEventListener('click', () => {
            playHaptic('tick');
            state.selectedColor = c.id;
            renderColorPicker();
        });
        colorPicker.appendChild(div);
    });
}

function timeToMins(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}
function minsToTime(mins) {
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    if(h > 23) { h=23; m=59; } // cap to end of day
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function calculateOverlaps(eventsArray) {
    const sorted = [...eventsArray].sort((a, b) => timeToMins(a.start) - timeToMins(b.start));
    let columns = [];
    
    sorted.forEach(evt => {
        const startMins = timeToMins(evt.start);
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            const lastEvt = columns[i][columns[i].length - 1];
            if (timeToMins(lastEvt.end) <= startMins) {
                columns[i].push(evt);
                evt.colIndex = i;
                placed = true;
                break;
            }
        }
        if (!placed) {
            evt.colIndex = columns.length;
            columns.push([evt]);
        }
    });

    sorted.forEach(evt => {
        const startMins = timeToMins(evt.start);
        const endMins = timeToMins(evt.end);
        let overlappingCols = 0;
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].some(e => timeToMins(e.start) < endMins && timeToMins(e.end) > startMins)) {
                overlappingCols++;
            }
        }
        evt.maxCols = Math.max(overlappingCols, 1);
    });
    
    return sorted;
}

function renderEvents() {
    eventsContainer.innerHTML = '';
    
    // Calculate total time blocked stats
    let totalMins = 0;
    const processEvents = calculateOverlaps(state.events);

    processEvents.forEach(evt => {
        const startMins = timeToMins(evt.start);
        const endMins = timeToMins(evt.end);
        const duration = endMins - startMins;
        totalMins += duration;

        const block = document.createElement('div');
        block.className = 'event-block';
        
        const widthPercent = (100 / evt.maxCols);
        const leftPercent = (evt.colIndex * widthPercent);

        block.style.top = `${startMins * PIXELS_PER_MINUTE}px`;
        block.style.height = `${duration * PIXELS_PER_MINUTE}px`;
        block.style.width = `calc(${widthPercent}% - 6px)`;
        block.style.left = `calc(${leftPercent}% + 2px)`; // Padding adjustment
        block.style.backgroundColor = EVENT_COLORS.find(c => c.id === evt.color)?.raw || EVENT_COLORS[0].raw;
        block.style.zIndex = evt.colIndex + 10;
        
        const titleEl = document.createElement('div');
        titleEl.className = 'event-title';
        titleEl.textContent = evt.title;
        
        const timeEl = document.createElement('div');
        timeEl.className = 'event-time';
        timeEl.textContent = `${evt.start} - ${evt.end}`;

        const resizer = document.createElement('div');
        resizer.className = 'resizer-handle';

        block.appendChild(titleEl);
        block.appendChild(timeEl);
        block.appendChild(resizer);
        
        // Touch Drag Events
        enableDragAndResize(block, evt);

        eventsContainer.appendChild(block);
    });

    document.getElementById('statTimeBlocked').innerHTML = `${Math.floor(totalMins/60)}<span class="unit">h</span> ${totalMins%60}<span class="unit">m</span>`;
}

// ================= DRAG & DROP / RESIZE ================= 
let isDragging = false, isResizing = false;
let startTouchY = 0, initialTop = 0, initialHeight = 0;
let dragTimer = null;

function enableDragAndResize(block, evtObj) {
    const resizer = block.querySelector('.resizer-handle');
    
    // Tap to Edit / Long Press to Drag
    block.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('resizer-handle')) return; // handled separately
        e.stopPropagation(); // don't click map
        
        startTouchY = e.touches[0].clientY;
        initialTop = parseFloat(block.style.top);
        
        dragTimer = setTimeout(() => {
            isDragging = true;
            block.classList.add('dragging');
            playHaptic('tick');
        }, 300); // 300ms long press avoids immediate drag while scrolling
    }, {passive: false});

    block.addEventListener('touchmove', (e) => {
        if (!isDragging) {
            clearTimeout(dragTimer); // Move meant scrolling, cancel long press
            return;
        }
        e.preventDefault(); // stop scrolling
        const delta = e.touches[0].clientY - startTouchY;
        let newTop = initialTop + delta;
        newTop = Math.max(0, newTop); // Don't drag above 00:00
        block.style.top = `${newTop}px`;
    }, {passive: false});

    block.addEventListener('touchend', (e) => {
        clearTimeout(dragTimer);
        if (!isDragging) {
            // Was just a normal click to open edit
            openEventModal(evtObj);
        } else {
            // Finish drag
            isDragging = false;
            block.classList.remove('dragging');
            playHaptic('tick');
            
            // Re-calculate times based on position. Snap to 5 mins (5px = 5 mins)
            let newTop = parseFloat(block.style.top);
            let snapTop = Math.round(newTop / 5) * 5; 
            const durationMins = timeToMins(evtObj.end) - timeToMins(evtObj.start);
            
            evtObj.start = minsToTime(snapTop);
            evtObj.end = minsToTime(snapTop + durationMins);
            
            saveData();
            renderEvents();
        }
    });

    // Resize functionality
    resizer.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        isResizing = true;
        startTouchY = e.touches[0].clientY;
        initialHeight = parseFloat(block.style.height);
        block.classList.add('dragging');
    }, {passive: false});

    resizer.addEventListener('touchmove', (e) => {
        if (!isResizing) return;
        e.preventDefault();
        const delta = e.touches[0].clientY - startTouchY;
        let newHeight = initialHeight + delta;
        newHeight = Math.max(15, newHeight); // min length 15 mins
        block.style.height = `${newHeight}px`;
    }, {passive: false});

    resizer.addEventListener('touchend', (e) => {
        if (!isResizing) return;
        isResizing = false;
        block.classList.remove('dragging');
        playHaptic('tick');
        
        let newHeight = parseFloat(block.style.height);
        let snapHeight = Math.round(newHeight / 5) * 5;
        const newDuration = snapHeight;
        
        evtObj.end = minsToTime(timeToMins(evtObj.start) + newDuration);
        
        saveData();
        renderEvents();
    });
}

function openEventModal(eventObj = null) {
    if (eventObj && typeof eventObj === 'object') {
        document.getElementById('editingEventId').value = eventObj.id || '';
        document.getElementById('eventTitle').value = eventObj.title;
        document.getElementById('startTime').value = eventObj.start;
        document.getElementById('endTime').value = eventObj.end;
        state.selectedColor = eventObj.color;
        
        if (eventObj.id) {
            document.getElementById('btnDeleteEvent').classList.remove('hidden');
            document.getElementById('btnFocusEvent').classList.remove('hidden');
        } else {
            document.getElementById('btnDeleteEvent').classList.add('hidden');
            document.getElementById('btnFocusEvent').classList.add('hidden');
        }
    } else {
        const d = new Date();
        const start = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        const end = `${(d.getHours()+1).toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        
        document.getElementById('editingEventId').value = '';
        document.getElementById('eventTitle').value = '';
        document.getElementById('startTime').value = start;
        document.getElementById('endTime').value = end;
        
        document.getElementById('btnDeleteEvent').classList.add('hidden');
        document.getElementById('btnFocusEvent').classList.add('hidden');
    }
    
    renderColorPicker();
    addEventSheet.classList.remove('hidden');
    setTimeout(() => document.getElementById('eventTitle').focus(), 300);
}

// ================= HABITS & STREAKS ================= 
function isSameDay(d1, d2) { return d1.toDateString() === d2.toDateString(); }

function calculateStreak(datesArr) {
    if(!datesArr || datesArr.length === 0) return 0;
    const dates = datesArr.map(d => new Date(d)).sort((a,b) => b-a);
    let streak = 0;
    let currTarget = new Date();
    
    // Check if missed today, then maybe target yesterday
    if (!isSameDay(dates[0], currTarget)) {
        let yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        if (isSameDay(dates[0], yesterday)) currTarget = yesterday;
        else return 0; // Missed yesterday = streak 0
    }
    
    for(let i=0; i<dates.length; i++) {
        if (isSameDay(dates[i], currTarget)) {
            streak++;
            currTarget.setDate(currTarget.getDate() - 1);
        } else break;
    }
    return streak;
}

document.getElementById('btnAddHabit').addEventListener('click', () => {
    playHaptic('tick');
    document.getElementById('taskFormMode').value = 'habit';
    document.getElementById('taskModalTitle').textContent = 'New Daily Habit';
    addTaskSheet.classList.remove('hidden');
    setTimeout(() => document.getElementById('taskInputTitle').focus(), 300);
});

function renderHabits() {
    const box = document.getElementById('habitsContainer');
    box.innerHTML = '';
    const todayStr = new Date().toDateString();
    let maxStreak = 0;

    state.habits.forEach(h => {
        const streak = calculateStreak(h.completedDates);
        if (streak > maxStreak) maxStreak = streak;
        const doneToday = h.completedDates.indexOf(todayStr) !== -1;

        const el = document.createElement('div');
        el.className = `habit-item ${doneToday ? 'done' : ''}`;
        
        // Use initial letter as icon
        const iconLetter = h.title.charAt(0).toUpperCase();

        el.innerHTML = `
            <div class="habit-icon haptic">
                <span style="font-size: 1.2rem; font-weight: bold;">${doneToday ? '✓' : iconLetter}</span>
            </div>
            <span class="habit-name">${h.title}</span>
            ${streak > 0 ? `<div class="streak-badge">🔥 ${streak}</div>` : ''}
        `;
        
        el.addEventListener('click', () => {
             if (doneToday) {
                 h.completedDates = h.completedDates.filter(d => d !== todayStr);
                 playHaptic('tick');
             } else {
                 h.completedDates.push(todayStr);
                 playHaptic('pop'); // Big dopamine for hitting habit
             }
             saveData(); renderHabits();
        });

        box.appendChild(el);
    });

    document.getElementById('statHighestStreak').textContent = maxStreak;
}


// ================= TASKS LIST ================= 
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    playHaptic('pop');
    const input = document.getElementById('taskInputTitle');
    const title = input.value.trim();
    if (!title) return;

    const mode = document.getElementById('taskFormMode').value;
    if (mode === 'task') {
        state.tasks.push({ id: Date.now().toString(), title, completed: false });
        renderTasks();
    } else {
        state.habits.push({ id: Date.now().toString(), title, completedDates: [] });
        renderHabits();
    }
    
    input.value = '';
    saveData();
    addTaskSheet.classList.add('hidden');
});

function renderTasks() {
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    
    if (state.tasks.length === 0) {
         list.innerHTML = `<div class="empty-state">No goals for today. Add one above!</div>`;
    }

    state.tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = `task-item haptic ${task.completed ? 'completed' : ''}`;
        
        div.innerHTML = `
            <div class="checkbox-custom">
                <span class="material-icons-round">check</span>
            </div>
            <div class="task-title">${task.title}</div>
            <div class="task-delete">
                <span class="material-icons-round">close</span>
            </div>
        `;
        
        div.addEventListener('click', (e) => {
            if (e.target.closest('.task-delete')) {
                state.tasks = state.tasks.filter(t => t.id !== task.id);
                playHaptic('tick');
            } else {
                task.completed = !task.completed;
                playHaptic(task.completed ? 'pop' : 'tick');
            }
            saveData();
            renderTasks();
        });
        
        list.appendChild(div);
    });
    
    // Update Focus View text
    const pending = state.tasks.filter(t => !t.completed).length;
    document.getElementById('insightTodoCount').textContent = pending === 0 ? "0 items" : 
        pending === 1 ? "1 item" : `${pending} items`;

    // Progress Bar
    const total = state.tasks.length;
    const completedCount = total - pending;
    document.getElementById('taskProgressText').textContent = `${completedCount}/${total}`;
    document.getElementById('taskProgressBar').style.width = total === 0 ? '0%' : `${(completedCount/total)*100}%`;
}


// ================= FOCUS POMODORO MODE ================= 
const focusOverlay = document.getElementById('focusOverlay');
const pomTimerTxt = document.getElementById('pomodoroTimeText');
const pomProgress = document.getElementById('pomodoroProgress');
let pomInterval = null;
let pomSecondsLeft = 0;
let pomTotalSeconds = 0;
let pomIsPaused = false;

document.getElementById('btnFocusEvent').addEventListener('click', () => {
    // Open focus mode
    playHaptic('pop');
    addEventSheet.classList.add('hidden');
    
    const id = document.getElementById('editingEventId').value;
    const ev = state.events.find(e => e.id === id);
    if(!ev) return;

    document.getElementById('focusTaskName').textContent = ev.title;
    
    // Init timer (Get duration in minutes)
    const durMins = timeToMins(ev.end) - timeToMins(ev.start);
    pomTotalSeconds = durMins * 60;
    pomSecondsLeft = pomTotalSeconds;
    pomIsPaused = false;
    
    updatePomodoroDisplay();

    focusOverlay.classList.remove('hidden');
    
    clearInterval(pomInterval);
    pomInterval = setInterval(() => {
        if(!pomIsPaused && pomSecondsLeft > 0) {
            pomSecondsLeft--;
            updatePomodoroDisplay();
            if(pomSecondsLeft === 0) {
                playHaptic('chime');
                clearInterval(pomInterval);
            }
        }
    }, 1000);
});

function updatePomodoroDisplay() {
    let m = Math.floor(pomSecondsLeft / 60);
    let s = pomSecondsLeft % 60;
    pomTimerTxt.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    
    // Dasharray is 565.48 max. Inverse dash offset for progress.
    const maxDash = 565.48;
    const percent = pomSecondsLeft / pomTotalSeconds;
    pomProgress.style.strokeDashoffset = maxDash - (maxDash * percent);
}

document.getElementById('btnToggleFocus').addEventListener('click', (e) => {
    playHaptic('tick');
    pomIsPaused = !pomIsPaused;
    const icon = document.getElementById('focusPlayIcon');
    const btn = e.currentTarget;
    if(pomIsPaused) {
        icon.textContent = "play_arrow";
        btn.classList.remove('pause'); btn.classList.add('play');
        document.getElementById('focusPhaseText').textContent = 'paused';
    } else {
        icon.textContent = "pause";
        btn.classList.add('pause'); btn.classList.remove('play');
        document.getElementById('focusPhaseText').textContent = 'time to focus';
    }
});

document.getElementById('btnExitFocus').addEventListener('click', () => {
    playHaptic('tick');
    clearInterval(pomInterval);
    focusOverlay.classList.add('hidden');
});

// ================= UTILITIES ================= 
function renderDayStats() {
    const d = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    headerTitle.textContent = "Timeline";
    headerSubtitle.textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
    
    const h = d.getHours();
    let msg = "Good Evening,";
    if(h < 12) msg = "Good Morning,";
    else if(h < 18) msg = "Good Afternoon,";
    document.getElementById('greetingMsg').textContent = msg;

    // Build top week slider (Dummy visual slider showing current week around today)
    const weekWrap = document.getElementById('weekSlider');
    weekWrap.innerHTML = '';
    for(let i=-2; i<=4; i++) {
        let loopDate = new Date();
        loopDate.setDate(d.getDate() + i);
        
        let card = document.createElement('div');
        card.className = `day-card haptic ${i===0 ? 'active' : ''}`;
        card.innerHTML = `<div class="day-name">${days[loopDate.getDay()].substr(0,3)}</div><div class="day-num">${loopDate.getDate()}</div>`;
        weekWrap.appendChild(card);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
}

document.addEventListener('DOMContentLoaded', init);
