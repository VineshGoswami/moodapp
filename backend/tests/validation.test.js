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

describe('Mood API - Input Validation', () => {
    it('should reject missing emoji', async () => {
        const res = await request(app).post('/api/moods').send({
            label: 'Happy',
            intensity: 5
        });
        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
    });

    it('should reject invalid intensity (< 1)', async () => {
        const res = await request(app).post('/api/moods').send({
            emoji: '😀',
            label: 'Happy',
            intensity: 0
        });
        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
    });

    it('should reject invalid intensity (> 10)', async () => {
        const res = await request(app).post('/api/moods').send({
            emoji: '😀',
            label: 'Happy',
            intensity: 11
        });
        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
    });

    it('should reject note exceeding 200 characters', async () => {
        const longNote = 'a'.repeat(201);
        const res = await request(app).post('/api/moods').send({
            emoji: '😀',
            label: 'Happy',
            intensity: 5,
            note: longNote
        });
        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
    });
});
