require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection(uri, label) {
    try {
        await mongoose.connect(uri);
        console.log(`[SUCCESS] ${label} WORKS!`);
        process.exit(0);
    } catch (err) {
        console.error(`[FAIL] ${label}: ${err.message}`);
        process.exit(1);
    }
}

async function run() {
    console.log('Testing new password: Vinesh123');
    await testConnection('mongodb+srv://vineshgoswami:Vinesh123@cluster0.is9mm.mongodb.net/moodpulse?appName=Cluster0', 'URI_A');
}

run();
