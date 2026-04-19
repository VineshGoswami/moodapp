require('dotenv').config();
const mongoose = require('mongoose');

// Import the plain Express app (no socket.io for serverless)
const express = require('express');
const cors = require('cors');
const moodsRouter = require('../src/routes/moods');
const battleRouter = require('../src/routes/battle');
const authRouter = require('../src/routes/auth');
const errorHandler = require('../src/middleware/errorHandler');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Stub io so controllers don't crash
app.set('io', { emit: () => {} });

// Routes
app.use('/api/moods', moodsRouter);
app.use('/api/battle', battleRouter);
app.use('/api/auth', authRouter);

// Admin cleanup
app.delete('/api/admin/cleanup', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer '))
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        if (decoded.role !== 'admin')
            return res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
        const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
        const Mood = require('../src/models/Mood');
        const result = await Mood.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
        res.json({ success: true, deleted: result.deletedCount, message: 'Cleanup complete' });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        next(error);
    }
});

// Health
app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', uptime: process.uptime(), version: '2.0.0' } });
});

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

// Serverless MongoDB connection (reuses existing connection on warm calls)
let isConnected = false;
async function connectDB() {
    if (isConnected && mongoose.connection.readyState === 1) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
}

// Vercel serverless handler
module.exports = async (req, res) => {
    await connectDB();
    return app(req, res);
};
