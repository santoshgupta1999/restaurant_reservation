const Table = require('../models/table.model');
const Reservation = require('../models/reservation.model');
const Block = require('../models/block.model');
const Shift = require('../models/shift.model');
const RoomDecorative = require('../models/roomDecorative.model');
const mongoose = require('mongoose');

// exports.createTable = async (req, res) => {
//     try {
//         const tableData = req.body;

//         const existing = await Table.findOne({
//             restaurantId: tableData.restaurantId,
//             tableNumber: tableData.tableNumber,
//         });

//         if (existing) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Table number already exists for this restaurant.",
//             });
//         }

//         const newTable = await Table.create(tableData);

//         return res.status(201).json({
//             success: true,
//             message: "Table created successfully.",
//             data: newTable,
//         });

//     } catch (error) {
//         console.error("Error creating table:", error);
//         res.status(500).json({
//             success: false,
//             message: "Error creating table.",
//             error: error.message,
//         });
//     }
// };

// exports.createTable = async (req, res) => {
//     try {
//         const { restaurantId, rooms } = req.body;

//         if (!restaurantId || !rooms?.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: "restaurantId and rooms are required"
//             });
//         }

//         let tablesToInsert = [];

//         // 🔹 flatten payload
//         for (const room of rooms) {
//             if (!room.roomName || !room.tables) continue;

//             for (const t of room.tables) {
//                 tablesToInsert.push({
//                     restaurantId,
//                     roomName: room.roomName,
//                     tableNumber: String(t.tableNumber).trim().toUpperCase(),
//                     displayName: t.displayName || null,
//                     capacity: t.capacity || 2,
//                     shape: t.shape || "Square",
//                     status: t.status || "Available",
//                     position: t.position || { x: 0, y: 0 },
//                     rotation: t.rotation || 0
//                 });
//             }
//         }

//         const total = tablesToInsert.length;

//         if (!total) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No tables provided"
//             });
//         }

//         let insertedCount = 0;
//         let skipped = [];

//         try {
//             const inserted = await Table.insertMany(tablesToInsert, {
//                 ordered: false
//             });
//             insertedCount = inserted.length;

//         } catch (error) {

//             if (error?.writeErrors?.length) {

//                 insertedCount = error.result?.nInserted || 0;

//                 for (const e of error.writeErrors) {
//                     const doc = e.err?.op || {};

//                     let reason = "Duplicate table";

//                     const msg =
//                         e.errmsg ||
//                         e.err?.errmsg ||
//                         e.message ||
//                         "";

//                     if (msg.includes("tableNumber")) {
//                         reason = "Same table number already exists in this room";
//                     }

//                     if (msg.includes("position")) {
//                         reason = "Another table already exists at same position in this room";
//                     }

//                     skipped.push({
//                         roomName: doc.roomName,
//                         tableNumber: doc.tableNumber,
//                         reason
//                     });
//                 }

//             } else {
//                 throw error;
//             }
//         }

//         const skippedCount = skipped.length;

//         let message = `${insertedCount} tables inserted successfully`;

//         if (skippedCount) {
//             message += `, ${skippedCount} skipped (duplicate number or position)`;
//         }

//         return res.status(201).json({
//             success: true,
//             message,
//             stats: {
//                 totalReceived: total,
//                 inserted: insertedCount,
//                 skipped: skippedCount
//             },
//             skippedTables: skipped
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({
//             success: false,
//             message: "Error creating tables",
//             error: error.message
//         });
//     }
// };

exports.createTable = async (req, res) => {
    try {
        const { restaurantId, rooms } = req.body;

        if (!restaurantId || !Array.isArray(rooms) || !rooms.length) {
            return res.status(400).json({
                success: false,
                message: "restaurantId and rooms are required"
            });
        }

        let tablesToInsert = [];
        let decorativesToInsert = [];
        let skipped = [];

        const tableNumberMap = new Map();
        const positionMap = new Map(); // table + decorative common

        /* ---------------- PAYLOAD VALIDATION ---------------- */
        for (const room of rooms) {
            if (!room.roomName) continue;

            /* ---------- TABLES ---------- */
            if (Array.isArray(room.tables)) {
                for (const t of room.tables) {
                    if (!t.tableNumber || !t.position) continue;

                    const tableNumber = String(t.tableNumber).trim().toUpperCase();
                    const numKey = `${restaurantId}_${room.roomName}_${tableNumber}`;
                    const posKey = `${restaurantId}_${room.roomName}_${t.position.x}_${t.position.y}`;

                    if (tableNumberMap.has(numKey)) {
                        skipped.push({
                            roomName: room.roomName,
                            ref: tableNumber,
                            type: "TABLE",
                            reason: "Duplicate tableNumber in request"
                        });
                        continue;
                    }

                    if (positionMap.has(posKey)) {
                        skipped.push({
                            roomName: room.roomName,
                            ref: tableNumber,
                            type: "TABLE",
                            reason: "Duplicate position in request"
                        });
                        continue;
                    }

                    tableNumberMap.set(numKey, true);
                    positionMap.set(posKey, true);

                    tablesToInsert.push({
                        restaurantId,
                        roomName: room.roomName,
                        tableNumber,
                        displayName: t.displayName || null,
                        capacity: t.capacity || 2,
                        min: t.min || 1,
                        max: t.max || t.capacity || 6,
                        width: t.width || 0,
                        length: t.length || 0,
                        channel: t.channel || "Online & FOH",
                        shape: t.shape || "Square",
                        status: "Available",
                        position: t.position,
                        rotation: t.rotation || 0
                    });
                }
            }

            /* ---------- DECORATIVES ---------- */
            if (Array.isArray(room.decoratives)) {
                for (const d of room.decoratives) {
                    if (!d.name || !d.position) continue;

                    const posKey = `${restaurantId}_${room.roomName}_${d.position.x}_${d.position.y}`;

                    if (positionMap.has(posKey)) {
                        skipped.push({
                            roomName: room.roomName,
                            ref: d.name,
                            type: "DECORATIVE",
                            reason: "Position already used (table/decorative)"
                        });
                        continue;
                    }

                    positionMap.set(posKey, true);

                    decorativesToInsert.push({
                        restaurantId,
                        roomName: room.roomName,
                        name: d.name,
                        width: d.width || 0,
                        length: d.length || 0,
                        position: d.position,
                        rotation: d.rotation || 0,
                        isActive: true
                    });
                }
            }
        }

        /* ---------------- DB VALIDATION ---------------- */

        for (const t of tablesToInsert) {

            const existingTable = await Table.findOne({
                restaurantId,
                roomName: t.roomName,
                tableNumber: t.tableNumber
            });

            // Check if some OTHER table already occupies this position
            const positionConflict = await Table.findOne({
                restaurantId,
                roomName: t.roomName,
                "position.x": t.position.x,
                "position.y": t.position.y,
                tableNumber: { $ne: t.tableNumber } // exclude itself
            });

            // Check decorative conflict
            const decorativeConflict = await RoomDecorative.findOne({
                restaurantId,
                roomName: t.roomName,
                "position.x": t.position.x,
                "position.y": t.position.y
            });

            if (positionConflict || decorativeConflict) {
                skipped.push({
                    roomName: t.roomName,
                    ref: t.tableNumber,
                    type: "TABLE",
                    reason: "Position already occupied"
                });
                continue;
            }

            if (existingTable) {
                //UPDATE
                await Table.updateOne(
                    { _id: existingTable._id },
                    { $set: t }
                );
            } else {
                //CREATE
                await Table.create(t);
            }
        }

        for (const d of decorativesToInsert) {

            const existingDecorative = await RoomDecorative.findOne({
                restaurantId,
                roomName: d.roomName,
                name: d.name
            });

            // 🔎 Position conflict with OTHER decorative
            const positionConflict = await RoomDecorative.findOne({
                restaurantId,
                roomName: d.roomName,
                "position.x": d.position.x,
                "position.y": d.position.y,
                name: { $ne: d.name } // exclude itself
            });

            // 🔎 Conflict with table
            const tableConflict = await Table.findOne({
                restaurantId,
                roomName: d.roomName,
                "position.x": d.position.x,
                "position.y": d.position.y
            });

            if (positionConflict || tableConflict) {
                skipped.push({
                    roomName: d.roomName,
                    ref: d.name,
                    type: "DECORATIVE",
                    reason: "Position already occupied"
                });
                continue;
            }

            if (existingDecorative) {
                // UPDATE
                await RoomDecorative.updateOne(
                    { _id: existingDecorative._id },
                    { $set: d }
                );
            } else {
                // CREATE
                await RoomDecorative.create(d);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Room layout published successfully",
            stats: {
                tablesInserted: tablesToInsert.length,
                decorativesInserted: decorativesToInsert.length,
                skipped: skipped.length
            },
            skipped
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

exports.getAllTables = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId."
            });
        }

        /* ===============================
           FETCH TABLES
        =============================== */
        const tablesRaw = await Table.find({ restaurantId })
            .populate("joinedWith", "tableNumber")
            .sort({ roomName: 1, tableNumber: 1 });

        /* ===============================
           FETCH DECORATIVES
        =============================== */
        const decorativesRaw = await RoomDecorative.find({
            restaurantId,
            isActive: true
        }).sort({ roomName: 1 });

        /* ===============================
           DATE FORMATTER
        =============================== */
        const formatDates = (doc) => {
            const obj = doc.toObject();
            if (obj.createdAt) obj.createdAt = obj.createdAt.toISOString().split("T")[0];
            if (obj.updatedAt) obj.updatedAt = obj.updatedAt.toISOString().split("T")[0];
            return obj;
        };

        const tables = tablesRaw.map(formatDates);
        const decoratives = decorativesRaw.map(formatDates);

        /* ===============================
           GROUP BY ROOM
        =============================== */
        const roomMap = {};

        // tables group
        for (const table of tables) {
            if (!roomMap[table.roomName]) {
                roomMap[table.roomName] = {
                    tables: [],
                    decoratives: []
                };
            }
            roomMap[table.roomName].tables.push(table);
        }

        // decoratives group
        for (const decor of decoratives) {
            if (!roomMap[decor.roomName]) {
                roomMap[decor.roomName] = {
                    tables: [],
                    decoratives: []
                };
            }
            roomMap[decor.roomName].decoratives.push(decor);
        }

        return res.status(200).json({
            success: true,
            message: "Tables & decoratives fetched successfully.",
            totalRooms: Object.keys(roomMap).length,
            totalTable: tablesRaw.length,
            totalDecorative: decorativesRaw.length,
            data: roomMap
        });

    } catch (error) {
        console.error("Error fetching tables & decoratives:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching data",
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

const checkPositionConflict = async ({
    restaurantId,
    roomName,
    position,
    excludeId,
    excludeType // "TABLE" | "DECORATIVE"
}) => {

    if (!position || !roomName) return false;

    const baseQuery = {
        restaurantId,
        roomName,
        "position.x": position.x,
        "position.y": position.y
    };

    // Check TABLES
    const tableConflict = await Table.findOne({
        ...baseQuery,
        ...(excludeType === "TABLE" && { _id: { $ne: excludeId } })
    });

    if (tableConflict) return {
        type: "TABLE",
        ref: tableConflict.tableNumber
    };

    // Check DECORATIVES
    const decorativeConflict = await RoomDecorative.findOne({
        ...baseQuery,
        ...(excludeType === "DECORATIVE" && { _id: { $ne: excludeId } })
    });

    if (decorativeConflict) return {
        type: "DECORATIVE",
        ref: decorativeConflict.name
    };

    return false;
};

exports.updateTable = async (req, res) => {
    try {
        const { tableId, ...updates } = req.body;

        if (!tableId) {
            return res.status(400).json({
                success: false,
                message: "tableId is required"
            });
        }

        const table = await Table.findById(tableId);
        if (!table) {
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        const newRoom = updates.roomName || table.roomName;
        const newPosition = updates.position || table.position;

        const conflict = await checkPositionConflict({
            restaurantId: table.restaurantId,
            roomName: newRoom,
            position: newPosition,
            excludeId: table._id,
            excludeType: "TABLE"
        });

        if (conflict) {
            return res.status(409).json({
                success: false,
                message: `Position already occupied by ${conflict.type}`,
                conflict
            });
        }

        await Table.updateOne(
            { _id: tableId },
            { $set: updates }
        );

        return res.json({
            success: true,
            message: "Table updated successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

exports.updateDecorative = async (req, res) => {
    try {
        const { decorativeId, ...updates } = req.body;

        if (!decorativeId) {
            return res.status(400).json({
                success: false,
                message: "decorativeId is required"
            });
        }

        const decorative = await RoomDecorative.findById(decorativeId);
        if (!decorative) {
            return res.status(404).json({
                success: false,
                message: "Decorative element not found"
            });
        }

        const newRoom = updates.roomName || decorative.roomName;
        const newPosition = updates.position || decorative.position;

        const conflict = await checkPositionConflict({
            restaurantId: decorative.restaurantId,
            roomName: newRoom,
            position: newPosition,
            excludeId: decorative._id,
            excludeType: "DECORATIVE"
        });

        if (conflict) {
            return res.status(409).json({
                success: false,
                message: `Position already occupied by ${conflict.type}`,
                conflict
            });
        }

        await RoomDecorative.updateOne(
            { _id: decorativeId },
            { $set: updates }
        );

        return res.json({
            success: true,
            message: "Decorative updated successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

exports.bulkUpdateLayout = async (req, res) => {
    try {
        const { restaurantId, roomName, tables = [], decoratives = [] } = req.body;

        if (!restaurantId || !roomName) {
            return res.status(400).json({
                success: false,
                message: "restaurantId and roomName are required"
            });
        }

        /* ===============================
           COLLECT ALL POSITIONS (IN-MEMORY)
        =============================== */

        const positionMap = new Map();

        const addPosition = (x, y, ref, type) => {
            const key = `${x}_${y}`;
            if (positionMap.has(key)) {
                throw {
                    status: 409,
                    message: "Position conflict in request payload",
                    conflict: {
                        first: positionMap.get(key),
                        second: { type, ref }
                    }
                };
            }
            positionMap.set(key, { type, ref });
        };

        tables.forEach(t => {
            if (t.position) {
                addPosition(t.position.x, t.position.y, t._id, "TABLE");
            }
        });

        decoratives.forEach(d => {
            if (d.position) {
                addPosition(d.position.x, d.position.y, d._id, "DECORATIVE");
            }
        });

        /* ===============================
           DB CONFLICT CHECK
        =============================== */

        for (const [key, value] of positionMap.entries()) {
            const [x, y] = key.split("_").map(Number);

            const tableConflict = await Table.findOne({
                restaurantId,
                roomName,
                "position.x": x,
                "position.y": y,
                _id: { $ne: value.ref }
            });

            if (tableConflict) {
                return res.status(409).json({
                    success: false,
                    message: "Position already occupied by table",
                    conflict: {
                        type: "TABLE",
                        ref: tableConflict.tableNumber
                    }
                });
            }

            const decorativeConflict = await RoomDecorative.findOne({
                restaurantId,
                roomName,
                "position.x": x,
                "position.y": y,
                _id: { $ne: value.ref }
            });

            if (decorativeConflict) {
                return res.status(409).json({
                    success: false,
                    message: "Position already occupied by decorative",
                    conflict: {
                        type: "DECORATIVE",
                        ref: decorativeConflict.name
                    }
                });
            }
        }

        /* ===============================
           BULK UPDATE
        =============================== */

        const bulkTableOps = tables.map(t => ({
            updateOne: {
                filter: { _id: t._id },
                update: { $set: t }
            }
        }));

        const bulkDecorativeOps = decoratives.map(d => ({
            updateOne: {
                filter: { _id: d._id },
                update: { $set: d }
            }
        }));

        if (bulkTableOps.length) {
            await Table.bulkWrite(bulkTableOps);
        }

        if (bulkDecorativeOps.length) {
            await RoomDecorative.bulkWrite(bulkDecorativeOps);
        }

        return res.json({
            success: true,
            message: "Floor layout updated successfully",
            stats: {
                tablesUpdated: tables.length,
                decorativesUpdated: decoratives.length
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.message || "Server error",
            conflict: error.conflict || null
        });
    }
};

exports.deleteTable = async (req, res) => {
    try {
        const { tableId } = req.body;

        if (!tableId) {
            return res.status(400).json({
                success: false,
                message: "tableId is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(tableId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid tableId"
            });
        }

        const table = await Table.findById(tableId);
        if (!table) {
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        await Table.findByIdAndDelete(tableId);

        return res.status(200).json({
            success: true,
            message: "Table deleted successfully"
        });

    } catch (error) {
        console.error("Delete table error:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting table",
            error: error.message
        });
    }
};

exports.deleteDecorative = async (req, res) => {
    try {
        const { decorativeId } = req.body;

        if (!decorativeId) {
            return res.status(400).json({
                success: false,
                message: "decorativeId is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(decorativeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid decorativeId"
            });
        }

        const decorative = await RoomDecorative.findById(decorativeId);
        if (!decorative) {
            return res.status(404).json({
                success: false,
                message: "Decorative element not found"
            });
        }

        await RoomDecorative.findByIdAndDelete(decorativeId);

        return res.status(200).json({
            success: true,
            message: "Decorative element deleted successfully"
        });

    } catch (error) {
        console.error("Delete decorative error:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting decorative element",
            error: error.message
        });
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const { restaurantId, roomName } = req.body;

        if (!restaurantId || !roomName) {
            return res.status(400).json({
                success: false,
                message: "restaurantId and roomName are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId"
            });
        }

        // Delete all tables of the room
        const tableResult = await Table.deleteMany({
            restaurantId,
            roomName
        });

        // Delete all decoratives of the room
        const decorativeResult = await RoomDecorative.deleteMany({
            restaurantId,
            roomName
        });

        return res.status(200).json({
            success: true,
            message: "Room deleted successfully",
            deletedTables: tableResult.deletedCount,
            deletedDecoratives: decorativeResult.deletedCount
        });

    } catch (error) {
        console.error("Delete room error:", error);
        return res.status(500).json({
            success: false,
            message: "Error deleting room",
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
        const { tableIds } = req.body;

        if (!Array.isArray(tableIds) || tableIds.length < 2) {
            return res.status(400).json({
                success: false,
                message: "At least two tableIds are required to merge."
            });
        }

        const tables = await Table.find({ _id: { $in: tableIds } });

        if (tables.length !== tableIds.length) {
            return res.status(404).json({
                success: false,
                message: "One or more tables not found."
            });
        }

        const alreadyJoined = tables.find(t => t.isJoined);
        if (alreadyJoined) {
            return res.status(400).json({
                success: false,
                message: `Table ${alreadyJoined.tableNumber} is already merged.`
            });
        }

        const restaurantId = tables[0].restaurantId.toString();
        const allSameRestaurant = tables.every(
            t => t.restaurantId.toString() === restaurantId
        );

        if (!allSameRestaurant) {
            return res.status(400).json({
                success: false,
                message: "All tables must belong to the same restaurant."
            });
        }

        await Table.updateMany(
            { _id: { $in: tableIds } },
            {
                $set: {
                    isJoined: true,
                    joinedWith: tableIds
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "Tables merged successfully.",
            data: {
                mergedTableIds: tableIds
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

exports.updateTableStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["Available", "Reserved", "Seated", "OutOfService"];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`
            });
        }

        const updatedTable = await Table.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        ).populate("restaurantId", "name email phone");

        if (!updatedTable) {
            return res.status(404).json({
                success: false,
                message: "Table not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: `Table status updated successfully to ${status}.`,
            data: {
                id: updatedTable._id,
                tableNumber: updatedTable.tableNumber,
                roomName: updatedTable.roomName,
                capacity: updatedTable.capacity,
                status: updatedTable.status,
                restaurant: updatedTable.restaurantId
            }
        });

    } catch (error) {
        console.error("Error updating table status:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating table status.",
            error: error.message
        });
    }
};

exports.getAllBookingsDetails = async (req, res) => {
    try {
        const { restaurantId, date, status, tableId } = req.body;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        const query = { restaurantId };

        if (tableId) query.tableId = tableId;
        if (status) query.status = status;

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            query.date = { $gte: start, $lte: end };
        }

        const bookings = await Reservation.find(query)
            .populate("tableId", "tableNumber roomName capacity status")
            .populate("shiftId", "name startTime endTime")
            .sort({ date: 1, time: 1 });

        return res.status(200).json({
            success: true,
            message: "Bookings fetched successfully",
            count: bookings.length,
            data: bookings
        });

    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message
        });
    }
};
