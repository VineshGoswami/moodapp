const Mood = require('../models/Mood');
const Vote = require('../models/Vote');

exports.getTodayBattle = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0,0,0,0));
        
        const topMoodsAgg = await Mood.aggregate([
            { $match: { createdAt: { $gte: startOfDay } } },
            { $group: { _id: '$label', emoji: { $first: '$emoji' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        if (topMoodsAgg.length < 2) {
            return res.status(200).json({ success: true, data: null, message: 'Not enough moods today for a battle' });
        }

        // Pick 2 random from top 10
        const shuffled = topMoodsAgg.sort(() => 0.5 - Math.random());
        const selected = [shuffled[0], shuffled[1]];

        res.status(200).json({ success: true, data: selected, message: 'Battle moods retrieved' });
    } catch (error) {
        next(error);
    }
};

exports.vote = async (req, res, next) => {
    try {
        const { winner, loser } = req.body;
        if (!winner || !loser) {
            return res.status(400).json({ success: false, message: 'Winner and loser required' });
        }

        const vote = new Vote({ winner, loser });
        await vote.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('vote_update', { winner, loser });
        }

        res.status(201).json({ success: true, data: vote, message: 'Vote recorded' });
    } catch (error) {
        next(error);
    }
};

exports.getLeaderboard = async (req, res, next) => {
    try {
        const leaderboard = await Vote.aggregate([
            { $group: { _id: '$winner', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        res.status(200).json({ success: true, data: leaderboard, message: 'Leaderboard retrieved' });
    } catch (error) {
        next(error);
    }
};
