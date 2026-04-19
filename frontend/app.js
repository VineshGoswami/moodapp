window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;background:red;color:white;z-index:999999;padding:20px;font-family:monospace;border-radius:10px;box-shadow:0 0 20px black;';
    errDiv.textContent = `JS CRASH: ${msg} | Line: ${lineNo}`;
    document.body.appendChild(errDiv);
};

// On localhost → hit the local backend. On Vercel → same domain, use relative /api
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const REAL_API_URL = isLocal ? 'http://localhost:5000' : '';
const API_BASE = `${REAL_API_URL}/api`;

let token = localStorage.getItem('moodpulse_token');
let userId = localStorage.getItem('moodpulse_userId');
let username = localStorage.getItem('moodpulse_username');
let userRole = localStorage.getItem('moodpulse_role');

const authOverlay = document.getElementById('authOverlay');
const appContainer = document.getElementById('app');

// Socket.io — only connects locally, skipped on Vercel serverless
let socket;
try {
    const socketUrl = isLocal ? 'http://localhost:5000' : null;
    if (socketUrl) {
        socket = io(socketUrl, { timeout: 5000, reconnectionAttempts: 2 });
    } else {
        throw new Error('serverless');
    }
} catch(e) {
    socket = { on: () => {}, emit: () => {} }; // no-op stub for Vercel
}

// --- Auth UI Flow ---
if (!token) {
    authOverlay.classList.remove('hidden');
    appContainer.classList.add('hidden');
} else {
    authOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    // Defer initApp so all const/let variables below are initialized first!
    setTimeout(initApp, 0);
}

document.getElementById('showRegisterLink').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('registerView').classList.remove('hidden');
});

document.getElementById('showLoginLink').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
});

const authMessage = document.getElementById('authMessage');
function showAuthMessage(msg, isError = true) {
    authMessage.textContent = msg;
    authMessage.className = `message ${isError ? 'error' : 'success'}`;
    authMessage.classList.remove('hidden');
    setTimeout(() => authMessage.classList.add('hidden'), 3000);
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('moodpulse_token', data.token);
            localStorage.setItem('moodpulse_userId', data.user.id);
            localStorage.setItem('moodpulse_username', data.user.username);
            localStorage.setItem('moodpulse_role', data.user.role);
            window.location.reload();
        } else {
            showAuthMessage(data.message || 'Login failed');
        }
    } catch (err) { showAuthMessage('Network error'); }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;
    
    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('moodpulse_token', data.token);
            localStorage.setItem('moodpulse_userId', data.user.id);
            localStorage.setItem('moodpulse_username', data.user.username);
            localStorage.setItem('moodpulse_role', data.user.role);
            window.location.reload();
        } else {
            showAuthMessage(data.message || 'Registration failed');
        }
    } catch (err) { showAuthMessage('Network error'); }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.reload();
});


// --- Realtime & Web Sockets ---
const apiStatusDot = document.getElementById('api-status-dot');
const apiStatusText = document.getElementById('api-status-text');
const offlineMessage = document.getElementById('offlineMessage');

socket.on('connect', () => {
    if(apiStatusDot) apiStatusDot.className = 'dot live';
    if(apiStatusText) apiStatusText.textContent = 'Live';
    if(offlineMessage) offlineMessage.classList.add('hidden');
});

socket.on('disconnect', () => {
    if(apiStatusDot) apiStatusDot.className = 'dot offline';
    if(apiStatusText) apiStatusText.textContent = 'Offline';
    if(offlineMessage) offlineMessage.classList.remove('hidden');
});

socket.on('user_count', (data) => {
    document.getElementById('watchersCount').textContent = data.count;
});

socket.on('mood_stats_update', () => {
    if(token) { fetchStats(); fetchHeatmap(); fetchStreak(); }
});

socket.on('new_mood', (mood) => {
    if(token && (currentFilter === 'today' || currentFilter === 'all' || currentFilter === 'week')) {
        const b = new Bubble(mood.emoji, mood.intensity, mood.label);
        b.x = canvas.width / 2;
        b.y = Math.random() > 0.5 ? 0 : canvas.height;
        bubbles.push(b);
        moodsData.push(mood);
    }
});

socket.on('vote_update', () => {
    if(token) fetchLeaderboard();
});

// --- App Initialization & Canvas ---
const canvas = document.getElementById('moodCanvas');
let ctx = null;
let bubbles = [];
let animationFrameId;
let currentFilter = 'today';
let moodsData = [];

function initApp() {
    document.getElementById('welcomeUser').textContent = `@${username}`;
    
    if (userRole === 'admin') {
        const adminBtn = document.getElementById('navAdminBtn');
        adminBtn.classList.remove('hidden');
        adminBtn.addEventListener('click', () => {
            document.getElementById('adminDrawer').classList.add('open');
        });
    }

    ctx = canvas.getContext('2d');
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    animate();

    fetchStats();
    fetchMoods();
    fetchHeatmap();
    fetchStreak();
    loadBattle();
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

class Bubble {
    constructor(emoji, intensity, label) {
        this.emoji = emoji;
        this.intensity = intensity;
        this.label = label;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = 15 + (intensity * 3);
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.alpha = 0;
        this.targetAlpha = 0.8;
    }

    draw() {
        if (this.alpha < this.targetAlpha) this.alpha += 0.02;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        let r=255, g=255, b=255;
        if(this.label === 'Happy') { r=0; g=245; b=255; }
        else if(this.label === 'Sad') { r=100; g=100; b=255; }
        else if(this.label === 'Angry') { r=255; g=50; b=50; }
        else if(this.label === 'Excited') { r=255; g=170; b=0; }
        else if(this.label === 'Tired') { r=150; g=150; b=150; }
        else if(this.label === 'Cool') { r=0; g=255; b=136; }

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${this.alpha * 0.2})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${this.alpha * 0.5})`;
        ctx.stroke();

        ctx.font = `${this.radius}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = this.alpha;
        ctx.fillText(this.emoji, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) this.vx *= -1;
        if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) this.vy *= -1;
        this.draw();
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bubbles.forEach(bubble => bubble.update());
    animationFrameId = requestAnimationFrame(animate);
}

// --- Data Fetching ---
async function fetchStats() {
    try {
        const res = await fetch(`${API_BASE}/moods/stats`);
        const data = await res.json();
        if (data.success) {
            document.getElementById('statTotal').textContent = data.data.totalCount;
            document.getElementById('statAvg').textContent = data.data.avgIntensity;
            document.getElementById('statTop').textContent = data.data.topMood;
            document.getElementById('statToday').textContent = data.data.todayCount;
        }
    } catch (e) { console.error(e); }
}

async function fetchMoods() {
    try {
        const res = await fetch(`${API_BASE}/moods?filter=${currentFilter}`);
        const data = await res.json();
        if (data.success) {
            moodsData = data.data;
            bubbles = moodsData.map(m => new Bubble(m.emoji, m.intensity, m.label));
        }
    } catch (e) { console.error(e); }
}

async function fetchHeatmap() {
    try {
        const res = await fetch(`${API_BASE}/moods/heatmap`);
        const data = await res.json();
        if (data.success) {
            const grid = document.getElementById('heatmapGrid');
            grid.innerHTML = '';
            
            data.data.forEach((day, index) => {
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell tooltip';
                cell.style.animationDelay = `${index * 0.1}s`;
                
                if (day.avgIntensity > 0 && day.avgIntensity <= 3) cell.style.background = '#00f5ff';
                else if (day.avgIntensity > 3 && day.avgIntensity <= 7) cell.style.background = '#0088ff';
                else if (day.avgIntensity > 7) cell.style.background = '#ffaa00';

                const tt = document.createElement('span');
                tt.className = 'tooltiptext';
                if(day.count === 0) tt.textContent = `${day.date} — No moods`;
                else tt.textContent = `${day.date} — ${day.count} moods, avg ${day.avgIntensity}, mostly ${day.dominantMood}`;
                
                cell.appendChild(tt);
                grid.appendChild(cell);
            });
        }
    } catch (e) { console.error(e); }
}

async function fetchStreak() {
    try {
        const res = await fetch(`${API_BASE}/moods/streak/${userId}`);
        const data = await res.json();
        if (data.success) {
            const streakCount = document.getElementById('streakCount');
            const streakContainer = document.getElementById('streakContainer');
            const streakTooltip = streakContainer.querySelector('.tooltiptext');

            const streak = data.data.currentStreak;
            streakCount.textContent = streak;

            streakContainer.classList.remove('pulse-3', 'glow-7');
            if (streak === 0) streakTooltip.textContent = "Start your streak today!";
            else {
                streakTooltip.textContent = `Current: ${streak} | Record: ${data.data.longestStreak}`;
                if (streak >= 3 && streak < 7) streakContainer.classList.add('pulse-3');
                if (streak >= 7) streakContainer.classList.add('glow-7');
            }
        }
    } catch (e) { console.error(e); }
}

// --- Form Submissions & Events ---
const formMessage = document.getElementById('formMessage');
function showMessage(msg, type) {
    formMessage.textContent = msg;
    formMessage.className = `message ${type}`;
    formMessage.classList.remove('hidden');
    setTimeout(() => formMessage.classList.add('hidden'), 3000);
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(() => toast.className = toast.className.replace('show', 'hidden'), 3000);
}

const inputEmoji = document.getElementById('selectedEmoji');
const inputLabel = document.getElementById('selectedLabel');
const slideIntensity = document.getElementById('intensity');
const intensityVal = document.getElementById('intensityVal');

document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        inputEmoji.value = btn.dataset.emoji;
        inputLabel.value = btn.dataset.label;
    });
});

slideIntensity.addEventListener('input', (e) => intensityVal.textContent = e.target.value);

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        fetchMoods();
    });
});

document.getElementById('moodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!inputEmoji.value) return showMessage('Please select an emoji!', 'error');

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Pulsing...';

    const payload = {
        emoji: inputEmoji.value,
        label: inputLabel.value,
        intensity: parseInt(slideIntensity.value),
        note: document.getElementById('note').value,
        userId: userId
    };

    try {
        const res = await fetch(`${API_BASE}/moods`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
            showMessage('Mood pulsed successfully!', 'success');
            document.getElementById('moodForm').reset();
            document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
            inputEmoji.value = '';
            inputLabel.value = '';
            intensityVal.textContent = '5';
            fetchStreak();
        } else {
            showMessage(data.message || 'Error occurred', 'error');
        }
    } catch (err) {
        showMessage('Network error. Check connection.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Pulse Mood';
    }
});

// --- Mood Battle & Admin ---
async function loadBattle() {
    const battleContent = document.getElementById('battleContent');
    try {
        const res = await fetch(`${API_BASE}/battle/today`);
        const data = await res.json();
        
        if (data.success && data.data && data.data.length === 2) {
            document.getElementById('battlePanel').classList.remove('hidden');
            battleContent.innerHTML = `
                <div class="battle-emoji" data-index="0" data-label="${data.data[0]._id}">${data.data[0].emoji}</div>
                <div class="battle-vs">VS</div>
                <div class="battle-emoji" data-index="1" data-label="${data.data[1]._id}">${data.data[1].emoji}</div>
            `;

            battleContent.querySelectorAll('.battle-emoji').forEach(el => {
                el.addEventListener('click', async (e) => {
                    e.target.classList.add('explode');
                    const index = parseInt(e.target.dataset.index);
                    const winner = data.data[index]._id;
                    const loser = data.data[1-index]._id;
                    
                    fetch(`${API_BASE}/battle/vote`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ winner, loser })
                    });
                });
            });
        } else {
            battleContent.innerHTML = `<div class="loading-battle">Not enough data today for a battle.</div>`;
        }
    } catch(e) { battleContent.innerHTML = "Error loading battle"; }
    fetchLeaderboard();
}

async function fetchLeaderboard() {
    try {
        const lbNode = document.getElementById('battleLeaderboard');
        const res = await fetch(`${API_BASE}/battle/leaderboard`);
        const data = await res.json();
        if(data.success && data.data) {
            lbNode.innerHTML = '';
            const max = data.data[0]?.count || 1;
            data.data.forEach(item => {
                const percent = (item.count / max) * 100;
                const emjMap = {'Happy':'😀', 'Sad':'😢', 'Angry':'😡', 'Tired':'😴', 'Excited':'🥳', 'Cool':'😎'};
                const emj = emjMap[item._id] || '✨';
                lbNode.innerHTML += `
                    <div class="lb-row">
                        <div class="lb-emoji">${emj}</div>
                        <div class="lb-bar-container"><div class="lb-bar" style="width: ${percent}%"></div></div>
                        <div class="lb-count">${item.count}</div>
                    </div>
                `;
            });
        }
    } catch(e) {}
}

document.getElementById('hideBattleBtn').addEventListener('click', () => {
    document.getElementById('battlePanel').classList.add('hidden');
});

document.getElementById('exportBtn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'moodpulse-canvas.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast("Exported Canvas Image!");
});

document.getElementById('shareBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(`I'm feeling the vibe on MoodPulse!`);
    showToast("Copied share phrase to clipboard!");
});

document.getElementById('closeAdminBtn').addEventListener('click', () => {
    document.getElementById('adminDrawer').classList.remove('open');
});

document.getElementById('adminCleanupBtn').addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_BASE}/admin/cleanup`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const msgEl = document.getElementById('adminMessage');
        msgEl.classList.remove('hidden');
        if (data.success) {
            msgEl.textContent = `Cleaned ${data.deleted || 0} old moods!`;
            msgEl.className = "message success";
        } else {
            msgEl.textContent = data.message || "Cleanup failed.";
            msgEl.className = "message error";
        }
    } catch(e) {}
});
