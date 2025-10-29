const Table = require('../models/table.model');
const Reservation = require('../models/reservation.model');
const Block = require('../models/block.model');
const Shift = require('../models/shift.model');

exports.createTable = async (req, res) => {
    try {
        const { restaurantId, roomName, tableNumber, capacity, position } = req.body;

        const exists = await Table.findOne({ restaurantId, tableNumber });
        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Table number already exists for this restaurant.'
            });
        }

        const table = new Table({
            restaurantId,
            roomName,
            tableNumber,
            capacity,
            position
        });

        await table.save();

        res.status(201).json({
            success: true,
            message: 'Table created successfully.',
            data: table
        });

    } catch (error) {
        console.error('Error creating table:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating table.',
            error: error.message
        });
    }
};

exports.getAllTables = async (req, res) => {
    try {
        const { restaurantId } = req.query;
        const filter = restaurantId ? { restaurantId } : {};

        const tables = await Table.find(filter).populate('restaurantId', 'name email phone');

        res.status(200).json({
            success: true,
            message: 'Tables fetched successfully.',
            count: tables.length,
            data: tables
        });
    } catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching tables.',
            error: error.message
        });
    }
};

exports.getTableById = async (req, res) => {
    try {
        const { id } = req.params;
        const table = await Table.findById(id).populate('restaurantId', 'name email phone');

        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Table not found.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Table details fetched successfully.',
            data: table
        });

    } catch (error) {
        console.error('Error fetching table:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching table.',
            error: error.message
        });
    }
};

exports.updateTable = async (req, res) => {
    try {
        const { id } = req.params;
        const { restaurantId, roomName, tableNumber, capacity, status, position } = req.body;

        const duplicate = await Table.findOne({
            restaurantId,
            tableNumber,
            _id: { $ne: id }
        });

        if (duplicate) {
            return res.status(400).json({
                success: false,
                message: 'Another table with this number already exists in the restaurant.'
            });
        }

        const updated = await Table.findByIdAndUpdate(
            id,
            { restaurantId, roomName, tableNumber, capacity, status, position },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Table not found.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Table updated successfully.',
            data: updated
        });

    } catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating table.',
            error: error.message
        });
    }
};

exports.deleteTable = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Table.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Table not found.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Table deleted successfully.'
        });

    } catch (error) {
        console.error('Error deleting table:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting table.',
            error: error.message
        });
    }
};

exports.getAvailableTables = async (req, res) => {
    try {
        const { restaurantId, date, shiftId } = req.query;

        if (!restaurantId || !date || !shiftId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, date, and shiftId are required.",
            });
        }

        const reservationDate = new Date(date);

        // Fetch the shift details
        const shift = await Shift.findById(shiftId);
        if (!shift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found.",
            });
        }

        // Get all tables of restaurant
        const allTables = await Table.find({ restaurantId });
        if (!allTables.length) {
            return res.status(404).json({
                success: false,
                message: "No tables found for this restaurant.",
            });
        }

        // Get blocked tables (if any)
        const blockedTables = await Block.find({
            restaurantId,
            isActive: true,
            startDate: { $lte: reservationDate },
            endDate: { $gte: reservationDate },
        }).select("tableIds");

        const blockedIds = blockedTables.flatMap(b => b.tableIds.map(id => id.toString()));

        // Get reserved tables for same date & shift time
        const reservedTables = await Reservation.find({
            restaurantId,
            date: reservationDate,
            "slot.startTime": shift.startTime,
            "slot.endTime": shift.endTime,
            status: { $nin: ["Cancelled", "No-show"] },
        }).select("tableId");

        const reservedIds = reservedTables.map(r => r.tableId.toString());

        // Filter out blocked + reserved tables
        const unavailableIds = [...new Set([...blockedIds, ...reservedIds])];
        const availableTables = allTables.filter(
            table => !unavailableIds.includes(table._id.toString())
        );

        return res.status(200).json({
            success: true,
            message: "Available tables fetched successfully.",
            total: availableTables.length,
            shift: shift.name,
            data: availableTables,
        });

    } catch (error) {
        console.error("Error fetching available tables:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message,
        });
    }
};
