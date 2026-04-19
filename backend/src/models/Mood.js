const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const moodSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: uuidv4
    },
    emoji: {
        type: String,
        required: [true, 'Emoji is required']
    },
    label: {
        type: String,
        required: [true, 'Label is required']
    },
    intensity: {
        type: Number,
        required: [true, 'Intensity is required'],
        min: [1, 'Intensity must be at least 1'],
        max: [10, 'Intensity cannot exceed 10']
    },
    note: {
        type: String,
        maxlength: [200, 'Note cannot exceed 200 characters'],
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

module.exports = mongoose.model('Mood', moodSchema);
