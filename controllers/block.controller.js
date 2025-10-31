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
        const { restaurantId, filter } = req.query;

        const query = {};
        if (restaurantId) query.restaurantId = restaurantId;

        if (filter === "upcoming") {
            query.type = "Maintenance";
        } else if (filter === "ended") {
            query.type = { $in: ["Closed", "Day Off"] };
        }

        const blocks = await Block.find(query)
            .populate("restaurantId", "name")
            .populate("tableIds", "tableNumber areaName seatCount")
            .populate("shiftIds", "name startDate endDate startTime endTime")
            .sort({ startDate: 1 });

        return res.status(200).json({
            success: true,
            message: 'Block fetched successfully',
            count: blocks.length,
            data: blocks,
        });

    } catch (error) {
        console.error("Error fetching blocks:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
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
