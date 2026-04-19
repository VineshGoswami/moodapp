const Mood = require('../models/Mood');

exports.createMood = async (req, res, next) => {
    try {
        const { emoji, label, intensity, note } = req.body;
        
        if (!emoji || !label || !intensity) {
            return res.status(400).json({ success: false, message: 'Emoji, label, and intensity are required' });
        }

        if (intensity < 1 || intensity > 10) {
            return res.status(400).json({ success: false, message: 'Intensity must be between 1 and 10' });
        }

        if (note && note.length > 200) {
            return res.status(400).json({ success: false, message: 'Note cannot exceed 200 characters' });
        }

        const mood = new Mood({ emoji, label, intensity, note });
        await mood.save();
        
        res.status(201).json({ success: true, data: mood, message: 'Mood created successfully' });
    } catch (error) {
        next(error);
    }
};

exports.getMoods = async (req, res, next) => {
    try {
        const { filter, mood: moodType } = req.query;
        let query = {};
        
        if (moodType) {
            query.label = { $regex: new RegExp(`^${moodType}$`, 'i') };
        }

        const now = new Date();
        if (filter === 'today') {
            const startOfDay = new Date(now.setHours(0,0,0,0));
            query.createdAt = { $gte: startOfDay };
        } else if (filter === 'week') {
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            startOfWeek.setHours(0,0,0,0);
            query.createdAt = { $gte: startOfWeek };
        }

        // Limit to 50 for pagination constraint in requirements
        const moods = await Mood.find(query).sort({ createdAt: -1 }).limit(50);
        
        res.status(200).json({ success: true, data: moods, message: 'Moods retrieved successfully' });
    } catch (error) {
        next(error);
    }
};

exports.getStats = async (req, res, next) => {
    try {
        const totalCount = await Mood.countDocuments();
        
        const now = new Date();
        const startOfDay = new Date(now.setHours(0,0,0,0));
        const todayCount = await Mood.countDocuments({ createdAt: { $gte: startOfDay } });

        const statsAgg = await Mood.aggregate([
            {
                $group: {
                    _id: null,
                    avgIntensity: { $avg: '$intensity' }
                }
            }
        ]);

        const avgIntensity = statsAgg.length > 0 ? parseFloat(statsAgg[0].avgIntensity.toFixed(1)) : 0;

        const topMoodAgg = await Mood.aggregate([
            {
                $group: {
                    _id: '$label',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        const topMood = topMoodAgg.length > 0 ? topMoodAgg[0]._id : 'None';

        res.status(200).json({ 
            success: true, 
            data: { totalCount, avgIntensity, topMood, todayCount }, 
            message: 'Stats retrieved successfully' 
        });
    } catch (error) {
        next(error);
    }
};
