const Block = require("../models/block.model");
const Table = require("../models/table.model");
const Shift = require("../models/shift.model");


exports.createBlock = async (req, res) => {
    try {
        const {
            restaurantId,
            name,
            type,
            tableIds,
            startDate,
            endDate,
            daysActive,
            shiftIds,
            note
        } = req.body;

        if (!restaurantId || !name || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'restaurantId, name, startDate and endDate are required'
            });
        }

        if (tableIds.length > 0) {
            const existingTables = await Table.find({ _id: { $in: tableIds } });
            if (existingTables.length !== tableIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "One or more tableIds do not exist in the database",
                });
            }
        }

        if (shiftIds.length > 0) {
            const existingShifts = await Shift.find({ _id: { $in: shiftIds } });
            if (existingShifts.length !== shiftIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "One or more shiftIds do not exist in the database",
                });
            }
        }

        const block = await Block.create({
            restaurantId,
            name,
            type,
            tableIds,
            startDate,
            endDate,
            daysActive,
            shiftIds,
            note
        });

        return res.status(201).json({
            success: true,
            message: 'Block created successfully',
            data: block
        });

    } catch (error) {
        console.error('Block creating error', error);
        res.status(500).json({
            success: false,
            message: 'Error while creating Block',
            Error: error.message
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

        // ------------ UPCOMING (Maintenance only) -------------
        const upcoming = await Block.find({
            restaurantId,
            type: "Maintenance",
            endDate: { $gte: today }
        })
            .populate("restaurantId", "name")
            .populate("tableIds", "tableNumber areaName seatCount")
            .populate("shiftIds", "name startDate endDate startTime endTime")
            .sort({ startDate: 1 });

        // ------------ ENDED (Closed + Day Off) -------------
        const ended = await Block.find({
            restaurantId,
            type: { $in: ["Closed", "Day Off"] },
            endDate: { $lt: today }
        })
            .populate("restaurantId", "name")
            .populate("tableIds", "tableNumber areaName seatCount")
            .populate("shiftIds", "name startDate endDate startTime endTime")
            .sort({ endDate: -1 }); // latest ended first

        return res.status(200).json({
            success: true,
            message: "Blocks fetched successfully",
            // upcomingCount: upcoming.length,
            // endedCount: ended.length,
            upcoming,
            ended
        });

    } catch (error) {
        console.error("Error fetching blocks:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.getBlockById = async (req, res) => {
    try {
        const { id } = req.params;

        const block = await Block.findById(id)
            .populate("restaurantId", "name")
            .populate("tableIds", "tableNumber areaName seatCount")
            .populate("shiftIds", "name startDate endDate startTime endTime");

        if (!block) {
            return res.status(404).json({
                success: false,
                message: "Block not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: block,
        });
    } catch (error) {
        console.error("Error fetching block:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

exports.updateBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            type,
            tableIds,
            startDate,
            endDate,
            daysActive,
            shiftIds,
            note,
            isActive,
        } = req.body;

        const updatedBlock = await Block.findByIdAndUpdate(
            id,
            {
                name,
                type,
                tableIds,
                startDate,
                endDate,
                daysActive,
                shiftIds,
                note,
                isActive,
            },
            { new: true }
        );

        if (!updatedBlock) {
            return res.status(404).json({
                success: false,
                message: "Block not found",
            });
        }

        if (tableIds.length > 0) {
            const existingTables = await Table.find({ _id: { $in: tableIds } });
            if (existingTables.length !== tableIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "One or more tableIds do not exist in the database",
                });
            }
        }

        if (shiftIds.length > 0) {
            const existingShifts = await Shift.find({ _id: { $in: shiftIds } });
            if (existingShifts.length !== shiftIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "One or more slotIds do not exist in the database",
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Block updated successfully",
            data: updatedBlock,
        });

    } catch (error) {
        console.error("Error updating block:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
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
                message: "Block not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Block deleted successfully",
        });

    } catch (error) {
        console.error("Error deleting block:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
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

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Invalid input. 'isActive' must be true or false."
            });
        }

        const updatedBlock = await Block.findByIdAndUpdate(
            id,
            { isActive },
            { new: true, runValidators: true }
        )
            .populate("restaurantId", "name email phone address")
            .populate("tableIds", "tableNumber roomName")
            .populate("shiftIds", "name startDate endDate");

        if (!updatedBlock) {
            return res.status(404).json({
                success: false,
                message: "Block not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: `Block has been ${isActive ? "activated" : "deactivated"} successfully.`,
            data: updatedBlock
        });

    } catch (error) {
        console.error("Error updating block status:", error);
        res.status(500).json({
            success: false,
            message: "Error updating block status.",
            error: error.message
        });
    }
};
