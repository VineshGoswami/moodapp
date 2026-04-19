const Mood = require('../models/Mood');

exports.createMood = async (req, res, next) => {
    try {
        const { emoji, label, intensity, note, userId } = req.body;
        
        if (!emoji || !label || !intensity || !userId) {
            return res.status(400).json({ success: false, message: 'Emoji, label, intensity, and userId are required' });
        }

        if (intensity < 1 || intensity > 10) {
            return res.status(400).json({ success: false, message: 'Intensity must be between 1 and 10' });
        }

        if (note && note.length > 200) {
            return res.status(400).json({ success: false, message: 'Note cannot exceed 200 characters' });
        }

        const mood = new Mood({ emoji, label, intensity, note, userId });
        await mood.save();
        
        // Socket emit
        const io = req.app.get('io');
        if (io) {
            io.emit('new_mood', mood);
            
            // We should also emit stats update since stats changed
            io.emit('mood_stats_update');
        }

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
            { $group: { _id: null, avgIntensity: { $avg: '$intensity' } } }
        ]);
        const avgIntensity = statsAgg.length > 0 ? parseFloat(statsAgg[0].avgIntensity.toFixed(1)) : 0;

        const topMoodAgg = await Mood.aggregate([
            { $group: { _id: '$label', count: { $sum: 1 } } },
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

exports.getHeatmap = async (req, res, next) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0,0,0,0);

        const heatmap = await Mood.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 },
                    avgIntensity: { $avg: "$intensity" },
                    moods: { $push: "$label" } 
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const processed = heatmap.map(day => {
            const moodCounts = day.moods.reduce((acc, mood) => {
                acc[mood] = (acc[mood] || 0) + 1;
                return acc;
            }, {});
            const dominantMood = Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b);
            
            return {
                date: day._id,
                count: day.count,
                avgIntensity: parseFloat(day.avgIntensity.toFixed(1)),
                dominantMood: dominantMood
            };
        });

        res.status(200).json({ success: true, data: processed, message: 'Heatmap retrieved' });
    } catch (error) {
        next(error);
    }
};

exports.getStreak = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const userMoods = await Mood.find({ userId }).sort({ createdAt: -1 });

        if (userMoods.length === 0) {
            return res.status(200).json({ 
                success: true, 
                data: { currentStreak: 0, longestStreak: 0, totalDays: 0, lastMood: null },
                message: 'No moods yet'
            });
        }

        const uniqueDays = [...new Set(userMoods.map(m => m.createdAt.toISOString().split('T')[0]))].sort().reverse();
        
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];

        let expectedDate = new Date();
        if (uniqueDays.length > 0 && uniqueDays[0] !== today && uniqueDays[0] !== yesterday) {
            currentStreak = 0;
        } else {
            let checkDate = new Date(uniqueDays[0]);
            
            for (let i = 0; i < uniqueDays.length; i++) {
                const dayStr = checkDate.toISOString().split('T')[0];
                if (uniqueDays[i] === dayStr) {
                    tempStreak++;
                    // go back one day
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
            currentStreak = tempStreak;
        }

        let currentRun = 1;
        let maxRun = 1;
        for (let i = 1; i < uniqueDays.length; i++) {
            const d1 = new Date(uniqueDays[i-1]);
            const d2 = new Date(uniqueDays[i]);
            const diffTime = Math.abs(d1 - d2);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays === 1) {
                currentRun++;
            } else {
                if (currentRun > maxRun) maxRun = currentRun;
                currentRun = 1;
            }
        }
        if (currentRun > maxRun) maxRun = currentRun;
        longestStreak = maxRun;

        res.status(200).json({ 
            success: true, 
            data: { 
                currentStreak, 
                longestStreak, 
                totalDays: uniqueDays.length, 
                lastMood: userMoods[0]
            }, 
            message: 'Streak calculated' 
        });
    } catch (error) {
        next(error);
    }
};
