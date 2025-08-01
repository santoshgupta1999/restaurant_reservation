const Slot = require('../models/slot.model');


exports.addOrUpdateSlot = async (req, res) => {
    try {
        const { restaurantId, day, slots } = req.body;

        if (!restaurantId || !day || !slots || !Array.isArray(slots)) {
            return res.status(400).json({
                success: false,
                message: "Missing or invalid input"
            });
        }

        const existingSlot = await Slot.findOne({ restaurantId, day });

        let message = "";

        if (existingSlot) {
            await Slot.updateOne(
                { restaurantId, day },
                { $set: { slots } }
            );
            message = "Slots updated successfully";
        } else {
            await Slot.create({ restaurantId, day, slots });
            message = "Slots added successfully";
        }
        console.log(message);
        return res.status(200).json({
            success: true,
            message
        });

    } catch (error) {
        console.error("Slot error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


exports.getSlotsByRestaurant = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: 'restaurantId is required in query params',
            });
        }

        const slots = await Slot.find({ restaurantId });

        console.log('Slots fetched successfully');
        return res.status(200).json({
            success: true,
            message: 'Slots fetched successfully',
            data: slots,
        });
    } catch (error) {
        console.error('Error fetching slots:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching slots',
            error: error.message,
        });
    }
};


exports.deleteSlot = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedSlot = await Slot.findByIdAndDelete(id);

        if (!deletedSlot) {
            return res.status(404).json({
                success: false,
                message: 'Slot not found',
            });
        }

        console.log('Slots deleted successfully');
        return res.status(200).json({
            success: true,
            message: 'Slots deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting slot:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting slot',
            error: error.message,
        });
    }
};