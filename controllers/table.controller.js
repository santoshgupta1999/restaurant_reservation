const Table = require('../models/table.model');
const Reservation = require('../models/reservation.model');
const Block = require('../models/block.model');
const Shift = require('../models/shift.model');

exports.createTable = async (req, res) => {
    try {
        const tableData = req.body;

        const existing = await Table.findOne({
            restaurantId: tableData.restaurantId,
            tableNumber: tableData.tableNumber,
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Table number already exists for this restaurant.",
            });
        }

        const newTable = await Table.create(tableData);

        return res.status(201).json({
            success: true,
            message: "Table created successfully.",
            data: newTable,
        });

    } catch (error) {
        console.error("Error creating table:", error);
        res.status(500).json({
            success: false,
            message: "Error creating table.",
            error: error.message,
        });
    }
};

exports.getAllTables = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        const filter = {};
        if (restaurantId) filter.restaurantId = restaurantId;

        const tables = await Table.find(filter).populate("joinedWith", "tableNumber");

        return res.status(200).json({
            success: true,
            message: "Tables fetched successfully.",
            count: tables.length,
            data: tables,
        });

    } catch (error) {
        console.error("Error fetching tables:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching tables.",
            error: error.message,
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
        const updateData = req.body;

        const table = await Table.findById(id);
        if (!table) {
            return res.status(404).json({
                success: false,
                message: "Table not found.",
            });
        }

        if (updateData.tableNumber) {
            const duplicate = await Table.findOne({
                restaurantId: table.restaurantId,
                tableNumber: updateData.tableNumber,
                _id: { $ne: id },
            });
            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: "Table number already exists for this restaurant.",
                });
            }
        }

        const updatedTable = await Table.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        return res.status(200).json({
            success: true,
            message: "Table updated successfully.",
            data: updatedTable,
        });

    } catch (error) {
        console.error("Error updating table:", error);
        res.status(500).json({
            success: false,
            message: "Error updating table.",
            error: error.message,
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

        return res.status(200).json({
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

exports.mergeTables = async (req, res) => {
    try {
        const { primaryTableId, tableIds } = req.body;

        if (!primaryTableId || !Array.isArray(tableIds) || !tableIds.length) {
            return res.status(400).json({
                success: false,
                message: "primaryTableId and tableIds (array) are required."
            });
        }

        // Fetch primary and all tables
        const primary = await Table.findById(primaryTableId);
        const others = await Table.find({ _id: { $in: tableIds } });

        if (!primary || !others.length) {
            return res.status(404).json({
                success: false,
                message: "Invalid table IDs."
            });
        }

        // Check restaurant consistency
        const allSameRestaurant = others.every(
            (t) => t.restaurantId.toString() === primary.restaurantId.toString()
        );
        if (!allSameRestaurant) {
            return res.status(400).json({
                success: false,
                message: "All tables must belong to the same restaurant."
            });
        }

        // Update tables as joined
        const allIds = [primaryTableId, ...tableIds];
        await Table.updateMany(
            { _id: { $in: allIds } },
            { $set: { isJoined: true, joinedWith: allIds } }
        );

        return res.status(200).json({
            success: true,
            message: "Tables merged successfully.",
            data: {
                primaryTableId,
                mergedTables: allIds
            }
        });

    } catch (error) {
        console.error("Error merging tables:", error);
        res.status(500).json({
            success: false,
            message: "Error merging tables.",
            error: error.message
        });
    }
};

exports.unmergeTables = async (req, res) => {
    try {
        const { tableId } = req.params;

        if (!tableId) {
            return res.status(400).json({
                success: false,
                message: "tableId is required."
            });
        }

        const table = await Table.findById(tableId);
        if (!table || !table.isJoined) {
            return res.status(404).json({
                success: false,
                message: "Table not found or not part of a merged group."
            });
        }

        const joinedIds = table.joinedWith;

        // Reset all joined tables
        await Table.updateMany(
            { _id: { $in: joinedIds } },
            { $set: { isJoined: false, joinedWith: [] } }
        );

        return res.status(200).json({
            success: true,
            message: "Tables unmerged successfully.",
            data: joinedIds
        });

    } catch (error) {
        console.error("Error unmerging tables:", error);
        res.status(500).json({
            success: false,
            message: "Error unmerging tables.",
            error: error.message
        });
    }
};

exports.unmergeSeatedTables = async (req, res) => {
    try {
        const { tableId, force } = req.body; // force = true to override

        if (!tableId) {
            return res.status(400).json({
                success: false,
                message: "tableId is required."
            });
        }

        const table = await Table.findById(tableId);
        if (!table || !table.isJoined) {
            return res.status(404).json({
                success: false,
                message: "Table not found or not part of a merged group."
            });
        }

        // Check if any table is occupied
        const joinedTables = await Table.find({ _id: { $in: table.joinedWith } });
        const seatedTables = joinedTables.filter((t) => t.status === "Seated");

        if (seatedTables.length && !force) {
            return res.status(400).json({
                success: false,
                message: "Some tables are currently seated. Set force=true to override."
            });
        }

        // Unmerge all
        await Table.updateMany(
            { _id: { $in: table.joinedWith } },
            { $set: { isJoined: false, joinedWith: [] } }
        );

        return res.status(200).json({
            success: true,
            message: "Tables unmerged successfully (seated handled).",
            data: table.joinedWith
        });

    } catch (error) {
        console.error("Error unmerging seated tables:", error);
        res.status(500).json({
            success: false,
            message: "Error unmerging seated tables.",
            error: error.message
        });
    }
};

exports.getAllMergedTables = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        const filter = { isJoined: true };
        if (restaurantId) filter.restaurantId = restaurantId;

        const mergedTables = await Table.find(filter)
            .populate("restaurantId", "name address")
            .populate("joinedWith", "tableNumber capacity roomName")
            .sort({ updatedAt: -1 });

        if (!mergedTables.length) {
            return res.status(404).json({
                success: false,
                message: "No merged tables found."
            });
        }

        // Optional: Group by merged cluster (unique set of joined tables)
        const grouped = [];
        const seen = new Set();

        mergedTables.forEach((table) => {
            const key = table.joinedWith.map((id) => id.toString()).sort().join(",");
            if (!seen.has(key)) {
                grouped.push({
                    mainTable: table,
                    mergedGroup: table.joinedWith
                });
                seen.add(key);
            }
        });

        res.status(200).json({
            success: true,
            message: "Merged tables fetched successfully.",
            totalGroups: grouped.length,
            data: grouped
        });
    } catch (error) {
        console.error("Error fetching merged tables:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching merged tables.",
            error: error.message
        });
    }
};

exports.lockTable = async (req, res) => {
    try {
        const { tableId } = req.params;
        const { reason, force } = req.body;
        const userId = req.user._id;

        if (!tableId) {
            return res.status(400).json({
                success: false,
                message: "Table Id is required"
            });
        }

        const table = await Table.findById(tableId);
        if (!table) {
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        if (["Reserved", "Seated"].includes(table.status) && !force) {
            return res.status(400).json({
                success: false,
                message: `Table is currently ${table.status} Use 'force': true to override.`
            });
        }

        table.status = "OutOfService";
        table.lockReason = reason || "Temporarily unavailable";
        table.lockedBy = userId;

        await table.save();

        return res.status(200).json({
            success: true,
            message: "Table locked successfully",
            data: {
                id: table._id,
                status: table.status,
                lockReason: table.lockReason,
                lockedBy: table.lockedBy
            }
        });

    } catch (error) {
        console.error('Error while locks the tables', error);
        res.status(500).json({
            success: false,
            message: "Error while locks the tables",
            Error: error.message
        });
    }
};

exports.unlockTable = async (req, res) => {
    try {
        const { tableId } = req.params;

        if (!tableId) {
            return res.status(400).json({
                success: false,
                message: "tableId is required."
            });
        }

        const table = await Table.findById(tableId);
        if (!table) {
            return res.status(404).json({
                success: false,
                message: "Table not found."
            });
        }

        if (table.status !== "OutOfService") {
            return res.status(400).json({
                success: false,
                message: "Table is not locked or already available."
            });
        }

        table.status = "Available";
        table.lockReason = null;
        table.lockedBy = null;

        await table.save();

        return res.status(200).json({
            success: true,
            message: "Table unlocked successfully.",
            data: { id: table._id, status: table.status }
        });

    } catch (error) {
        console.error("Error unlocking table:", error);
        res.status(500).json({
            success: false,
            message: "Error unlocking table.",
            error: error.message
        });
    }
};

exports.getAllLockedTables = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        const filter = { status: "OutOfService" };
        if (restaurantId) filter.restaurantId = restaurantId;

        const lockedTables = await Table.find(filter)
            .populate("restaurantId", "name address")
            .populate("lockedBy", "name email role")
            .sort({ updatedAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Locked tables fetched successfully.",
            count: lockedTables.length,
            data: lockedTables
        });

    } catch (error) {
        console.error("Error fetching locked tables:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching locked tables.",
            error: error.message
        });
    }
};
