const express = require('express');
const battleController = require('../controllers/battleController');

const router = express.Router();

router.get('/today', battleController.getTodayBattle);
router.get('/leaderboard', battleController.getLeaderboard);
router.post('/vote', battleController.vote);

module.exports = router;
