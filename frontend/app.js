const API_URL = '/api'; // Uses rewrite in Vercel, or local proxy
const REAL_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000/api' 
    : 'https://moodpulse-backend.up.railway.app/api'; 
    // ^ Assuming railway endpoint, but we don't know it exactly. We'll use REAL_API_URL.

// DOM Elements
const form = document.getElementById('moodForm');
const emojiBtns = document.querySelectorAll('.emoji-btn');
const inputEmoji = document.getElementById('selectedEmoji');
const inputLabel = document.getElementById('selectedLabel');
const slideIntensity = document.getElementById('intensity');
const intensityVal = document.getElementById('intensityVal');
const inputNote = document.getElementById('note');
const submitBtn = document.getElementById('submitBtn');
const formMessage = document.getElementById('formMessage');

const statTotal = document.getElementById('statTotal');
const statAvg = document.getElementById('statAvg');
const statTop = document.getElementById('statTop');
const statToday = document.getElementById('statToday');
const filterBtns = document.querySelectorAll('.filter-btn');

const apiStatusDot = document.getElementById('api-status-dot');
const apiStatusText = document.getElementById('api-status-text');
const offlineMessage = document.getElementById('offlineMessage');

// Canvas Setup
const canvas = document.getElementById('moodCanvas');
const ctx = canvas.getContext('2d');
let bubbles = [];
let animationFrameId;

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Initial State
let currentFilter = 'today';
let moodsData = [];

// Bubble Class
class Bubble {
    constructor(emoji, intensity, label) {
        this.emoji = emoji;
        this.intensity = intensity;
        this.label = label;
        
        // Random start position within canvas
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        
        // Size based on intensity (1-10)
        this.radius = 15 + (intensity * 3);
        
        // Velocity
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        
        // Appearance
        this.alpha = 0;
        this.targetAlpha = 0.8;
    }

    draw() {
        if (this.alpha < this.targetAlpha) this.alpha += 0.02;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Color based on mood label
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

        // Bounce off edges
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

// Fetch Logic
async function checkHealth() {
    try {
        const res = await fetch(`${REAL_API_URL}/health`);
        const data = await res.json();
        if (data.success) {
            apiStatusDot.className = 'dot live';
            apiStatusText.textContent = 'Live';
            offlineMessage.classList.add('hidden');
            return true;
        }
        throw new Error('Not ok');
    } catch (e) {
        apiStatusDot.className = 'dot offline';
        apiStatusText.textContent = 'Offline';
        offlineMessage.classList.remove('hidden');
        return false;
    }
}

async function fetchStats() {
    try {
        const res = await fetch(`${REAL_API_URL}/moods/stats`);
        const data = await res.json();
        if (data.success) {
            statTotal.textContent = data.data.totalCount;
            statAvg.textContent = data.data.avgIntensity;
            statTop.textContent = data.data.topMood;
            statToday.textContent = data.data.todayCount;
        }
    } catch (e) {
        console.error('Failed to fetch stats', e);
    }
}

async function fetchMoods() {
    try {
        const res = await fetch(`${REAL_API_URL}/moods?filter=${currentFilter}`);
        const data = await res.json();
        if (data.success) {
            moodsData = data.data;
            updateCanvas();
        }
    } catch (e) {
        console.error('Failed to fetch moods', e);
    }
}

function updateCanvas() {
    bubbles = moodsData.map(m => new Bubble(m.emoji, m.intensity, m.label));
}

async function refreshData() {
    const isLive = await checkHealth();
    if (isLive) {
        await Promise.all([fetchStats(), fetchMoods()]);
    }
}

// Event Listeners
emojiBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        emojiBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        inputEmoji.value = btn.dataset.emoji;
        inputLabel.value = btn.dataset.label;
    });
});

slideIntensity.addEventListener('input', (e) => {
    intensityVal.textContent = e.target.value;
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        refreshData();
    });
});

function showMessage(msg, type) {
    formMessage.textContent = msg;
    formMessage.className = `message ${type}`;
    formMessage.classList.remove('hidden');
    setTimeout(() => {
        formMessage.classList.add('hidden');
    }, 3000);
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!inputEmoji.value) {
        showMessage('Please select an emoji!', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Pulsing...';

    const payload = {
        emoji: inputEmoji.value,
        label: inputLabel.value,
        intensity: parseInt(slideIntensity.value),
        note: inputNote.value
    };

    try {
        const res = await fetch(`${REAL_API_URL}/moods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (data.success) {
            showMessage('Mood pulsed successfully!', 'success');
            form.reset();
            emojiBtns.forEach(b => b.classList.remove('selected'));
            inputEmoji.value = '';
            inputLabel.value = '';
            intensityVal.textContent = '5';
            refreshData();
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

// Initialization
animate();
refreshData();

// Auto-poll every 10 seconds
setInterval(refreshData, 10000);
