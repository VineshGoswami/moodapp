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

describe('Mood API - CRUD Tests', () => {
    it('should create a new mood', async () => {
        const res = await request(app).post('/api/moods').send({
            emoji: '😀',
            label: 'Happy',
            intensity: 8,
            note: 'Feeling great!',
            userId: 'test1'
        });
        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.emoji).toBe('😀');
        expect(res.body.data.label).toBe('Happy');
    });

    it('should fetch moods list', async () => {
        await Mood.create({ emoji: '😀', label: 'Happy', intensity: 8, userId: 'test1' });
        await Mood.create({ emoji: '😢', label: 'Sad', intensity: 3, userId: 'test1' });

        const res = await request(app).get('/api/moods');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(2);
    });

    it('should filter moods by label', async () => {
        await Mood.create({ emoji: '😀', label: 'Happy', intensity: 8, userId: 'test1' });
        await Mood.create({ emoji: '😢', label: 'Sad', intensity: 3, userId: 'test1' });

        const res = await request(app).get('/api/moods?mood=sad');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].label).toBe('Sad');
    });
});
