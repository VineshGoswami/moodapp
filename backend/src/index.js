require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { httpServer, io } = app;

const PORT = process.env.PORT || 5000;
let MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/moodpulse';

let activeConnections = 0;
io.on('connection', (socket) => {
    activeConnections++;
    io.emit('user_count', { count: activeConnections });

    socket.on('disconnect', () => {
        activeConnections--;
        io.emit('user_count', { count: activeConnections });
    });
});

async function startServer() {
    try {
        if (MONGO_URI.includes('localhost')) {
            const { MongoMemoryServer } = require('mongodb-memory-server');
            const mongoServer = await MongoMemoryServer.create();
            MONGO_URI = mongoServer.getUri();
            console.log('Running using In-Memory MongoDB');
        }
        
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');
        
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
        process.exit(1);
    }
}

startServer();
