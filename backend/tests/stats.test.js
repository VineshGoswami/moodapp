const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Mood = require('../src/models/Mood');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
});

afterEach(async () => {
    await Mood.deleteMany({});
});

describe('Mood API - Stats Tests', () => {
    it('should get correct total and top mood stats', async () => {
        await Mood.create({ emoji: '😀', label: 'Happy', intensity: 8 });
        await Mood.create({ emoji: '😀', label: 'Happy', intensity: 6 });
        await Mood.create({ emoji: '😢', label: 'Sad', intensity: 4 });

        const res = await request(app).get('/api/moods/stats');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.totalCount).toBe(3);
        expect(res.body.data.topMood).toBe('Happy');
        expect(res.body.data.avgIntensity).toBe(6);
    });
});
