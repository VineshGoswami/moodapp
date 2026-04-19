const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Stub io for serverless environment
app.set('io', { emit: () => {} });

// ─── Database Connection ──────────────────────────────────────────────────
let cachedConnection = null;

async function connectDB() {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI environment variable is missing');
    }
    cachedConnection = await mongoose.connect(process.env.MONGO_URI);
    return cachedConnection;
}

// Middleware to ensure DB connection before processing non-health requests
app.use(async (req, res, next) => {
    if (req.path === '/api/health') return next();
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('DB Connection Error:', err);
        res.status(500).json({ success: false, message: 'Database connection failed' });
    }
});

// ─── Schemas ──────────────────────────────────────────────────────────────────
const MoodSchema = new mongoose.Schema(
    { emoji: String, label: String, intensity: { type: Number, min: 1, max: 10 }, note: String, userId: String },
    { timestamps: true }
);
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['member', 'admin'], default: 'member' }
}, { timestamps: true });
const VoteSchema = new mongoose.Schema(
    { winner: String, loser: String, userId: String },
    { timestamps: true }
);

const Mood = mongoose.models.Mood || mongoose.model('Mood', MoodSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Vote = mongoose.models.Vote || mongoose.model('Vote', VoteSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// ─── Health check (diagnostics) ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        status: 'ok', 
        diagnostics: {
            mongoUriSet: !!process.env.MONGO_URI,
            jwtSecretSet: !!process.env.JWT_SECRET,
            nodeEnv: process.env.NODE_ENV,
            uptime: process.uptime()
        }
    });
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required' });
        const existing = await User.findOne({ username });
        if (existing) return res.status(409).json({ success: false, message: 'Username already taken' });
        const hashedPassword = await bcrypt.hash(password, 12);
        const role = (username === 'admin' || username.includes('@admin')) ? 'admin' : 'member';
        const user = await User.create({ username, password: hashedPassword, role });
        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, token, user: { id: user._id, username: user.username, role: user.role } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required' });
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user._id, username: user.username, role: user.role } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Mood Routes ──────────────────────────────────────────────────────────────
app.get('/api/moods', async (req, res) => {
    try {
        const { filter } = req.query;
        let query = {};
        if (filter === 'today') { const s = new Date(); s.setHours(0,0,0,0); query.createdAt = { $gte: s }; }
        else if (filter === 'week') { const s = new Date(); s.setDate(s.getDate()-7); query.createdAt = { $gte: s }; }
        const moods = await Mood.find(query).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, data: moods });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/moods', async (req, res) => {
    try {
        const { emoji, label, intensity, note, userId } = req.body;
        if (!emoji || !label || !intensity) return res.status(400).json({ success: false, message: 'Missing required fields' });
        const mood = await Mood.create({ emoji, label, intensity, note, userId });
        res.status(201).json({ success: true, data: mood });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/moods/stats', async (req, res) => {
    try {
        const totalCount = await Mood.countDocuments();
        const todayCount = await Mood.countDocuments({ createdAt: { $gte: new Date().setHours(0,0,0,0) } });
        const agg = await Mood.aggregate([{ $group: { _id: '$label', count: { $sum: 1 }, avgInt: { $avg: '$intensity' } } }, { $sort: { count: -1 } }]);
        const avgIntensity = agg.length ? (agg.reduce((s, x) => s + x.avgInt, 0) / agg.length).toFixed(1) : 0;
        const topMood = agg.length ? agg[0]._id : 'None';
        res.json({ success: true, data: { totalCount, avgIntensity, topMood, todayCount } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/moods/heatmap', async (req, res) => {
    try {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
            const end = new Date(d); end.setHours(23,59,59,999);
            const agg = await Mood.aggregate([{ $match: { createdAt: { $gte: d, $lte: end } } }, { $group: { _id: '$label', count: { $sum: 1 }, avg: { $avg: '$intensity' } } }, { $sort: { count: -1 } }]);
            const count = agg.reduce((s, x) => s + x.count, 0);
            const avgIntensity = agg.length ? (agg.reduce((s, x) => s + x.avg, 0) / agg.length).toFixed(1) : 0;
            days.push({ date: d.toISOString().slice(0,10), count, avgIntensity: parseFloat(avgIntensity), dominantMood: agg[0]?._id || 'None' });
        }
        res.json({ success: true, data: days });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/moods/streak/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId || userId === 'null') return res.json({ success: true, data: { currentStreak: 0, longestStreak: 0, totalDays: 0 } });
        const moods = await Mood.find({ userId }).sort({ createdAt: -1 });
        if (!moods.length) return res.json({ success: true, data: { currentStreak: 0, longestStreak: 0, totalDays: 0 } });
        const uniqueDays = [...new Set(moods.map(m => m.createdAt.toISOString().slice(0,10)))].sort().reverse();
        let current = 1, temp = 1;
        for (let i = 1; i < uniqueDays.length; i++) {
            if ((new Date(uniqueDays[i-1]) - new Date(uniqueDays[i])) / 86400000 === 1) temp++; else break;
        }
        const today = new Date().toISOString().slice(0,10);
        const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
        current = (uniqueDays[0] === today || uniqueDays[0] === yesterday) ? temp : 0;
        res.json({ success: true, data: { currentStreak: current, totalDays: uniqueDays.length } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Admin Cleanup ──────────────────────────────────────────────────────────
app.delete('/api/admin/cleanup', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Admins only' });
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const result = await Mood.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
        res.json({ success: true, deleted: result.deletedCount });
    } catch (err) { res.status(401).json({ success: false, message: 'Invalid token' }); }
});

// Catch-all for API
app.use((req, res) => res.status(404).json({ success: false, message: 'API route not found' }));

module.exports = app;
