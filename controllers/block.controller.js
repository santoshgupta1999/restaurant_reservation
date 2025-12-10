const Block = require("../models/block.model");
const Table = require("../models/table.model");
const Shift = require("../models/shift.model");


exports.createBlock = async (req, res) => {
    try {
        const {
            restaurantId,
            reason,
            isFullRestaurantBlock,
            tableIds,
            roomName,
            shiftIds,
            startDate,
            endDate,
            daysActive,
            note
        } = req.body;

        if (!restaurantId || !reason || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, reason, startDate, endDate are required."
            });
        }

        let finalTableIds = [];

        if (isFullRestaurantBlock) {
            finalTableIds = [];
        }

        else if (roomName) {
            const roomTables = await Table.find({
                restaurantId,
                roomName,
                isActive: true
            }).select("_id");

            finalTableIds = roomTables.map(t => t._id);
        }

        else if (tableIds && tableIds.length > 0) {
            finalTableIds = tableIds;
        }

        if (!isFullRestaurantBlock && finalTableIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No tables found to block. Provide tableIds or roomName."
            });
        }

        const block = await Block.create({
            restaurantId,
            reason,
            isFullRestaurantBlock: isFullRestaurantBlock || false,
            tableIds: finalTableIds,
            shiftIds: shiftIds || [],
            startDate,
            endDate,
            daysActive: daysActive || [],
            note
        });

        return res.status(201).json({
            success: true,
            message: "Block created successfully",
            data: block
        });

    } catch (error) {
        console.error("Create block error:", error);
        res.status(500).json({
            success: false,
            message: "Error creating block",
            error: error.message
        });
    }
};

exports.getAllBlocks = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = await Block.find({
            restaurantId,
            endDate: { $gte: today }
        })
            .populate("tableIds", "tableNumber roomName capacity")
            .populate("shiftIds", "name startTime endTime")
            .sort({ startDate: 1 });

        const ended = await Block.find({
            restaurantId,
            endDate: { $lt: today }
        })
            .populate("tableIds", "tableNumber roomName capacity")
            .populate("shiftIds", "name startTime endTime")
            .sort({ endDate: -1 });

        res.status(200).json({
            success: true,
            message: "Blocks fetched successfully",
            upcomingCount: upcoming.length,
            endedCount: ended.length,
            upcoming,
            ended
        });

    } catch (error) {
        console.error("Get blocks error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching blocks",
            error: error.message
        });
    }
};

exports.getBlockById = async (req, res) => {
    try {
        const { id } = req.params;

        const block = await Block.findById(id)
            .populate("restaurantId", "name")
            .populate("tableIds", "tableNumber roomName capacity")
            .populate("shiftIds", "name startTime endTime startDate endDate");

        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Block fetched successfully",
            data: block
        });

    } catch (error) {
        console.error("Fetch block error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching block",
            error: error.message
        });
    }
};

exports.updateBlock = async (req, res) => {
    try {
        const { id } = req.params;

        const updated = await Block.findByIdAndUpdate(id, req.body, { new: true });

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Block updated successfully",
            data: updated
        });

    } catch (error) {
        console.error("Update block error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating block",
            error: error.message
        });
    }
};

exports.deleteBlock = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Block.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Block deleted successfully"
        });

    } catch (error) {
        console.error("Delete block error:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting block",
            error: error.message
        });
    }
};

exports.getBlocksCalendarView = async (req, res) => {
    try {
        const { restaurantId, startDate, endDate } = req.query;

        if (!restaurantId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, startDate, and endDate are required."
            });
        }

        const blocks = await Block.find({
            restaurantId,
            startDate: { $lte: new Date(endDate) },
            endDate: { $gte: new Date(startDate) },
            isActive: true
        }).sort({ startDate: 1 });

        const groupedBlocks = {};
        blocks.forEach(block => {
            const dayKey = block.startDate.toISOString().split("T")[0];
            if (!groupedBlocks[dayKey]) groupedBlocks[dayKey] = [];
            groupedBlocks[dayKey].push(block);
        });

        return res.status(200).json({
            success: true,
            message: "Blocks calendar data fetched successfully.",
            data: groupedBlocks
        });

    } catch (error) {
        console.error("Error fetching block calendar:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching block calendar view.",
            error: error.message
        });
    }
};

exports.updateBlockStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const block = await Block.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );

        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found"
            });
        }

        res.status(200).json({
            success: true,
            message: `Block ${isActive ? "activated" : "deactivated"} successfully`,
            data: block
        });

    } catch (error) {
        console.error("Status update error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating block status",
            error: error.message
        });
    }
};
