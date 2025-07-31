const Slot = require('../models/slot.model');


exports.createSlots = async (req, res) => {
    try {
        const { restaurantId, slots } = req.body;

        if (!Array.isArray(slots) || !restaurantId) {
            return res.status(400).json({
                success: false,
                message: 'restaurantId and slots array are required'
            });
        }

        const formattedSlots = slots.map(slot => ({
            restaurantId,
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime
        }));

        const createdSlots = await Slot.insertMany(formattedSlots);

        return res.status(201).json({
            success: true,
            message: 'Slots added successfully',
            data: createdSlots
        });

    } catch (err) {
        console.error('Error creating slots:', err);
        return res.status(500).json({
            success: false,
            message: 'Error creating slots',
            error: err.message
        });
    }
};
