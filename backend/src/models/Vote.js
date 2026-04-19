const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const voteSchema = new mongoose.Schema({
    _id: { type: String, default: uuidv4 },
    winner: { type: String, required: [true, 'Winner is required'] },
    loser: { type: String, required: [true, 'Loser is required'] },
    createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('Vote', voteSchema);
