const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const moodsRouter = require('./routes/moods');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Parsing JSON body
app.use(express.json());

// Routes
app.use('/api/moods', moodsRouter);

// Healthcheck Route
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        },
        message: 'Health check passed'
    });
});

// Unknown Routes
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
