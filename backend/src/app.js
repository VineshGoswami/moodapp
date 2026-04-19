const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');

const moodsRouter = require('./routes/moods');
const battleRouter = require('./routes/battle');
const authRouter = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ["GET", "POST", "DELETE"]
    }
});

app.set('io', io);

// Security headers disabled locally to allow cross-origin websockets
// app.use(helmet());

const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/moods', moodsRouter);
app.use('/api/battle', battleRouter);
app.use('/api/auth', authRouter);

// Secret Admin Cleanup Middleware
const jwt = require('jsonwebtoken');
app.delete('/api/admin/cleanup', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
        }
        
        const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
        
        const Mood = require('./models/Mood');
        const result = await Mood.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });

        res.status(200).json({ 
            success: true, 
            deleted: result.deletedCount, 
            message: "Cleanup complete" 
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }
        next(error);
    }
});

// Healthcheck
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        data: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), version: '2.0.0' },
        message: 'Health check passed'
    });
});

app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

app.httpServer = httpServer;
app.io = io;
module.exports = app;
