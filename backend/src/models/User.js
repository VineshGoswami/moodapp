const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
    _id: { type: String, default: uuidv4 },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['member', 'admin'], default: 'member' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
