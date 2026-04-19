const express = require('express');
const rateLimit = require('express-rate-limit');
const moodController = require('../controllers/moodController');

const router = express.Router();

const createMoodLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many mood entries created from this IP, please try again after 15 minutes' }
});

router.get('/heatmap', moodController.getHeatmap);
router.get('/stats', moodController.getStats);
router.get('/streak/:userId', moodController.getStreak);
router.get('/', moodController.getMoods);
router.post('/', createMoodLimiter, moodController.createMood);

module.exports = router;
