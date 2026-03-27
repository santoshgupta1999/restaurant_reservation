const Table = require('../models/table.model');
const Reservation = require('../models/reservation.model');
const Block = require('../models/block.model');
const Shift = require('../models/shift.model');
const RoomDecorative = require('../models/roomDecorative.model');
const Guest = require("../models/guest.model");
const sendMail = require("../utils/mailer");
const mongoose = require('mongoose');
const Room = require('../models/room.model');
const moment = require('moment');

exports.createTable = async (req, res) => {
    try {
        const { restaurantId, rooms } = req.body;

        if (!restaurantId || !Array.isArray(rooms) || !rooms.length) {
            return res.status(400).json({
                success: false,
                message: "restaurantId and rooms are required"
            });
        }

        let skipped = [];

        for (const room of rooms) {

            if (!room.roomName) continue;

            let existingRoom;

            if (room.roomId) {
                existingRoom = await Room.findOne({
                    _id: room.roomId,
                    restaurantId
                });

                if (!existingRoom) {
                    skipped.push({
                        roomName: room.roomName,
                        type: "ROOM",
                        reason: "Room not found"
                    });
                    continue;
                }

                // Rename if changed
                if (existingRoom.name !== room.roomName) {
                    existingRoom.name = room.roomName;
                    await existingRoom.save();
                }

            } else {
                existingRoom = await Room.findOne({
                    restaurantId,
                    name: room.roomName
                });

                if (!existingRoom) {
                    existingRoom = await Room.create({
                        restaurantId,
                        name: room.roomName
                    });
                }
            }

            const roomId = existingRoom._id;

            if (Array.isArray(room.tables)) {

                for (const t of room.tables) {

                    if (!t.tableNumber || !t.position) continue;

                    const tableNumber = String(t.tableNumber)
                        .trim()
                        .toUpperCase();

                    try {

                        await Table.updateOne(
                            {
                                restaurantId,
                                roomId,
                                tableNumber
                            },
                            {
                                $set: {
                                    restaurantId,
                                    roomId,
                                    tableNumber,
                                    displayName: t.displayName || null,
                                    capacity: t.capacity || 2,
                                    min: t.min || 1,
                                    max: t.max || t.capacity || 6,
                                    width: t.width || 0,
                                    length: t.length || 0,
                                    channel: t.channel || "Online & FOH",
                                    shape: t.shape || "Square",
                                    status: t.status || "Available",
                                    position: t.position,
                                    rotation: t.rotation || 0,
                                    isActive: true
                                }
                            },
                            { upsert: true }
                        );

                    } catch (err) {

                        if (err.code === 11000) {
                            skipped.push({
                                roomName: room.roomName,
                                ref: tableNumber,
                                type: "TABLE",
                                reason: "Duplicate position or tableNumber"
                            });
                            continue;
                        }

                        throw err;
                    }
                }
            }

            if (Array.isArray(room.decoratives)) {

                for (const d of room.decoratives) {

                    if (!d.name || !d.position) continue;

                    try {

                        await RoomDecorative.updateOne(
                            {
                                restaurantId,
                                roomId,
                                name: d.name
                            },
                            {
                                $set: {
                                    restaurantId,
                                    roomId,
                                    name: d.name,
                                    width: d.width || 0,
                                    length: d.length || 0,
                                    position: d.position,
                                    rotation: d.rotation || 0,
                                    isActive: true
                                }
                            },
                            { upsert: true }
                        );

                    } catch (err) {

                        if (err.code === 11000) {
                            skipped.push({
                                roomName: room.roomName,
                                ref: d.name,
                                type: "DECORATIVE",
                                reason: "Duplicate position"
                            });
                            continue;
                        }

                        throw err;
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "Room layout saved successfully",
            skippedCount: skipped.length,
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

        const tablesRaw = await Table.find({ restaurantId })
            .populate("roomId", "name")
            .populate("joinedWith", "tableNumber")
            .sort({ roomId: 1, tableNumber: 1 });

        const decorativesRaw = await RoomDecorative.find({
            restaurantId,
            isActive: true
        })
            .populate("roomId", "name")
            .sort({ roomId: 1 });

        const formatDoc = (doc) => {
            const obj = doc.toObject();

            if (obj.roomId) {
                obj.roomName = obj.roomId.name;
                obj.roomId;
            }

            if (obj.createdAt)
                obj.createdAt = obj.createdAt.toISOString().split("T")[0];

            if (obj.updatedAt)
                obj.updatedAt = obj.updatedAt.toISOString().split("T")[0];

            return obj;
        };

        const tables = tablesRaw.map(formatDoc);
        const decoratives = decorativesRaw.map(formatDoc);

        const roomMap = {};

        for (const table of tables) {
            if (!roomMap[table.roomName]) {
                roomMap[table.roomName] = {
                    tables: [],
                    decoratives: []
                };
            }
            roomMap[table.roomName].tables.push(table);
        }

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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { restaurantId, roomId, action } = req.body;

        if (!restaurantId || !roomId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId and roomId are required"
            });
        }

        if (
            !mongoose.Types.ObjectId.isValid(restaurantId) ||
            !mongoose.Types.ObjectId.isValid(roomId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid restaurantId or roomId"
            });
        }

        const allowedActions = ["CANCEL_BOOKINGS", "MARK_AS_LEGACY"];
        if (action && !allowedActions.includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid action value"
            });
        }

        const tableIds = await Table
            .find({ restaurantId, roomId })
            .distinct("_id")
            .session(session);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const futureReservations = await Reservation.find({
            restaurantId,
            tableId: { $in: tableIds },
            date: { $gte: todayStart },
            status: { $in: ["Pending", "Confirmed", "Seated"] }
        }).session(session);

        if (futureReservations.length > 0) {

            if (!action) {
                await session.abortTransaction();
                session.endSession();

                return res.status(409).json({
                    success: false,
                    type: "FUTURE_RESERVATIONS_EXIST",
                    message: "Room has future reservations",
                    totalFutureReservations: futureReservations.length,
                    options: allowedActions
                });
            }

            /* OPTION 1: MARK AS LEGACY */
            if (action === "MARK_AS_LEGACY") {

                await Table.updateMany(
                    { restaurantId, roomId },
                    { $set: { isLegacy: true } },
                    { session }
                );

                await session.commitTransaction();
                session.endSession();

                return res.status(200).json({
                    success: true,
                    message: "Room marked as legacy. Future reservations preserved."
                });
            }

            /* OPTION 2: CANCEL BOOKINGS */
            if (action === "CANCEL_BOOKINGS") {

                await Reservation.updateMany(
                    { _id: { $in: futureReservations.map(r => r._id) } },
                    { $set: { status: "Cancelled" } },
                    { session }
                );
            }
        }

        const tableResult = await Table.deleteMany(
            { restaurantId, roomId },
            { session }
        );

        const decorativeResult = await RoomDecorative.deleteMany(
            { restaurantId, roomId },
            { session }
        );

        await Room.deleteOne(
            { _id: roomId, restaurantId },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        if (action === "CANCEL_BOOKINGS" && futureReservations.length > 0) {

            const guestIds = futureReservations
                .map(r => r.guestId)
                .filter(Boolean);

            const reservationTableIds = futureReservations
                .map(r => r.tableId)
                .filter(Boolean);

            const [guests, reservationTables] = await Promise.all([
                Guest.find({ _id: { $in: guestIds }, isActive: true }),
                Table.find({ _id: { $in: reservationTableIds } })
            ]);

            const guestMap = {};
            guests.forEach(g => {
                guestMap[g._id.toString()] = g;
            });

            const tableMap = {};
            reservationTables.forEach(t => {
                tableMap[t._id.toString()] = t;
            });

            // Fire and forget (non-blocking)
            futureReservations.forEach(async (reservation) => {
                try {
                    const guest = guestMap[reservation.guestId?.toString()];
                    if (!guest?.email) return;

                    const table = tableMap[reservation.tableId?.toString()];

                    const fullName =
                        `${guest.firstName || ""} ${guest.lastName || ""}`.trim();

                    const subject = "Reservation Cancelled";

                    const message = `
Dear ${fullName || "Guest"},

Your reservation has been cancelled because the room is no longer available.

Reservation Details:
Date: ${reservation.date.toDateString()}
Time: ${reservation.time}
Party Size: ${reservation.partySize}
Table No: ${table?.tableNumber || "N/A"}

We apologize for the inconvenience.

Best Regards,
Restaurant Team
                    `;

                    await sendMail(guest.email, subject, message);
                } catch (err) {
                    console.error("Email failed:", err.message);
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: "Room deleted successfully",
            deletedTables: tableResult.deletedCount,
            deletedDecoratives: decorativeResult.deletedCount
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

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

// exports.mergeTables = async (req, res) => {
//     try {
//         const { tableIds } = req.body;

//         if (!Array.isArray(tableIds) || tableIds.length < 2) {
//             return res.status(400).json({
//                 success: false,
//                 message: "At least two tableIds are required to merge."
//             });
//         }

//         const tables = await Table.find({ _id: { $in: tableIds } });

//         if (tables.length !== tableIds.length) {
//             return res.status(404).json({
//                 success: false,
//                 message: "One or more tables not found."
//             });
//         }

//         const restaurantId = tables[0].restaurantId.toString();

//         const sameRestaurant = tables.every(
//             t => t.restaurantId.toString() === restaurantId
//         );

//         if (!sameRestaurant) {
//             return res.status(400).json({
//                 success: false,
//                 message: "All tables must belong to the same restaurant."
//             });
//         }

//         const roomId = tables[0].roomId?.toString();

//         const sameRoom = tables.every(
//             t => t.roomId?.toString() === roomId
//         );

//         if (!sameRoom) {
//             return res.status(400).json({
//                 success: false,
//                 message: "All tables must belong to the same room."
//             });
//         }

//         let finalTableSet = new Set(tableIds.map(id => id.toString()));

//         // include already merged tables
//         tables.forEach(table => {
//             if (table.joinedWith && table.joinedWith.length > 0) {
//                 table.joinedWith.forEach(id =>
//                     finalTableSet.add(id.toString())
//                 );
//             }
//         });

//         const finalTableIds = Array.from(finalTableSet);

//         await Table.updateMany(
//             { _id: { $in: finalTableIds } },
//             {
//                 $set: {
//                     isJoined: true,
//                     joinedWith: finalTableIds
//                 }
//             }
//         );

//         return res.status(200).json({
//             success: true,
//             message: "Tables merged successfully.",
//             data: {
//                 restaurantId,
//                 roomId,
//                 mergedTableIds: finalTableIds
//             }
//         });

//     } catch (error) {
//         console.error("Error merging tables:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Error merging tables.",
//             error: error.message
//         });
//     }
// };


exports.mergeTables = async (req, res) => {
    try {
        const { tableIds } = req.body;

        if (!Array.isArray(tableIds) || tableIds.length !== 2) {
            return res.status(400).json({
                success: false,
                message: "Exactly two tableIds are required to merge."
            });
        }

        const [tableAId, tableBId] = tableIds;

        const tableA = await Table.findById(tableAId);
        const tableB = await Table.findById(tableBId);

        if (!tableA || !tableB) {
            return res.status(404).json({
                success: false,
                message: "One or more tables not found."
            });
        }

        if (tableA.restaurantId.toString() !== tableB.restaurantId.toString()) {
            return res.status(400).json({
                success: false,
                message: "Tables must belong to same restaurant."
            });
        }

        if (tableA.roomId.toString() !== tableB.roomId.toString()) {
            return res.status(400).json({
                success: false,
                message: "Tables must belong to same room."
            });
        }

        let finalSet = new Set();

        if (tableA.isJoined && tableA.joinedWith.length > 0) {
            tableA.joinedWith.forEach(id => finalSet.add(id.toString()));
        } else {
            finalSet.add(tableA._id.toString());
        }

        if (tableB.isJoined && tableB.joinedWith.length > 0) {
            tableB.joinedWith.forEach(id => finalSet.add(id.toString()));
        } else {
            finalSet.add(tableB._id.toString());
        }

        const finalTableIds = Array.from(finalSet);

        await Table.updateMany(
            { _id: { $in: finalTableIds } },
            {
                $set: {
                    isJoined: true,
                    joinedWith: finalTableIds
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "Tables merged successfully.",
            data: {
                mergedTableIds: finalTableIds
            }
        });

    } catch (error) {
        console.error("Error merging tables:", error);
        return res.status(500).json({
            success: false,
            message: "Error merging tables.",
            error: error.message
        });
    }
};

exports.unmergeTables = async (req, res) => {
    try {
        const { tableId, force } = req.body;

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
                message: "Table not part of merged group."
            });
        }

        const groupIds = table.joinedWith.map(id => id.toString());

        const joinedTables = await Table.find({
            _id: { $in: groupIds }
        });

        /* Check seated tables */
        const seatedTables = joinedTables.filter(
            t => t.status === "Seated"
        );

        if (seatedTables.length && !force) {
            return res.status(400).json({
                success: false,
                message: "Some tables are seated. Use force=true."
            });
        }

        /* If center table removed (more than 2 tables in group) */
        if (groupIds.length > 2 && tableId === groupIds[1]) {

            await Table.updateMany(
                { _id: { $in: groupIds } },
                { $set: { isJoined: false, joinedWith: [] } }
            );

            return res.status(200).json({
                success: true,
                message: "Center table removed. All tables unmerged."
            });
        }

        /* Remove selected table from group */
        const remainingTables = groupIds.filter(
            id => id !== tableId
        );

        /* Update remaining group */
        await Table.updateMany(
            { _id: { $in: remainingTables } },
            {
                $set: {
                    joinedWith: remainingTables,
                    isJoined: remainingTables.length > 1
                }
            }
        );

        /* Update removed table */
        await Table.updateOne(
            { _id: tableId },
            { $set: { isJoined: false, joinedWith: [] } }
        );

        return res.status(200).json({
            success: true,
            message: "Table unmerged successfully.",
            remainingTables
        });

    } catch (error) {
        console.error("Error unmerging tables:", error);
        return res.status(500).json({
            success: false,
            message: "Error unmerging tables.",
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { tableId, reason, force } = req.body;
        const userId = req.user?._id;

        if (!tableId) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "tableId is required"
            });
        }

        const table = await Table.findById(tableId).session(session);

        if (!table) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        if (table.status === "OutOfService") {

            table.status = "Available";
            table.lockReason = null;
            table.lockedBy = null;
            table.lockedAt = null;

            await table.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).json({
                success: true,
                message: "Table unlocked successfully",
                data: table
            });
        }

        if (["Reserved", "Seated"].includes(table.status) && !force) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Table is currently ${table.status}. Use force:true to override.`
            });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const todaysBookings = await Reservation.find({
            tableId: table._id,
            restaurantId: table.restaurantId,
            date: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ["Pending", "Confirmed"] }
        }).session(session);

        for (let booking of todaysBookings) {
            booking.status = "Cancelled";
            booking.notes = "Cancelled due to table locked";
            await booking.save({ session });
        }

        table.status = "OutOfService";
        table.lockReason = reason || "Temporarily unavailable";
        table.lockedBy = userId;
        table.lockedAt = new Date();

        await table.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Table locked successfully",
            data: {
                tableId: table._id,
                cancelledBookings: todaysBookings.length
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: "Error locking table",
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
        const { status, source, partySize } = req.body;

        const allowedStatuses = ["Available", "Reserved", "Seated", "OutOfService"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`
            });
        }

        const table = await Table.findById(id);

        if (!table) {
            return res.status(404).json({
                success: false,
                message: "Table not found."
            });
        }

        let updatedReservation = null;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        if (status === "Seated") {

            // Try to seat existing reservation first
            updatedReservation = await Reservation.findOneAndUpdate(
                {
                    tableId: id,
                    date: { $gte: todayStart, $lte: todayEnd },
                    status: { $in: ["Pending", "Confirmed"] }
                },
                { status: "Seated" },
                { new: true, sort: { time: 1 } }
            );

            // If no reservation found & source is Walk-in
            if (!updatedReservation && source === "Walk-in") {

                if (!partySize) {
                    return res.status(400).json({
                        success: false,
                        message: "partySize is required for walk-in seating."
                    });
                }

                if (partySize > table.capacity) {
                    return res.status(400).json({
                        success: false,
                        message: "Party size exceeds table capacity."
                    });
                }

                updatedReservation = await Reservation.create({
                    restaurantId: table.restaurantId,
                    tableId: id,
                    shiftId: null,
                    date: new Date(),
                    time: new Date().toTimeString().slice(0, 5),
                    partySize,
                    source: "Walk-in",
                    status: "Seated"
                });
            }
        }

        if (status === "Available") {
            updatedReservation = await Reservation.findOneAndUpdate(
                {
                    tableId: id,
                    date: { $gte: todayStart, $lte: todayEnd },
                    status: "Seated"
                },
                { status: "Finished" },
                { new: true, sort: { time: -1 } }
            );
        }

        // Finally update table status
        table.status = status;
        await table.save();

        return res.status(200).json({
            success: true,
            message: `Table status updated successfully to ${status}.`,
            data: {
                table: {
                    id: table._id,
                    tableNumber: table.tableNumber,
                    capacity: table.capacity,
                    status: table.status
                },
                reservationUpdated: updatedReservation || null
            }
        });

    } catch (error) {
        console.error("Error updating table status:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error updating table status."
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

exports.unassignTable = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { tableId, force = false } = req.body;

        if (!tableId) {
            return res.status(400).json({
                success: false,
                message: "tableId is required."
            });
        }

        session.startTransaction();

        const table = await Table.findById(tableId).session(session);

        if (!table) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Table not found."
            });
        }

        let affectedTableIds = [tableId];

        if (table.isJoined && table.joinedWith?.length) {
            affectedTableIds = table.joinedWith.map(id => id.toString());
        }

        const now = new Date();

        const reservations = await Reservation.find({
            tableId: { $in: affectedTableIds },
            status: { $in: ["Pending", "Confirmed", "Seated"] }
        }).session(session);

        // helper to combine date + time
        const getReservationDateTime = (r) => {
            const d = new Date(r.date);
            const [hh, mm] = r.time.split(":");
            d.setHours(Number(hh), Number(mm), 0, 0);
            return d;
        };

        const validReservations = reservations
            .map(r => ({
                doc: r,
                dateTime: getReservationDateTime(r)
            }))
            .filter(r => r.dateTime >= now)
            .sort((a, b) => a.dateTime - b.dateTime);

        const nearest = validReservations[0]?.doc || null;

        if (nearest?.status === "Seated" && !force) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Guest already seated. Use force=true to unassign."
            });
        }

        let updatedReservation = null;

        if (nearest) {
            nearest.tableId = null;
            updatedReservation = await nearest.save({ session });
        }

        await Table.updateMany(
            { _id: { $in: affectedTableIds } },
            { $set: { status: "Available" } },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Table unassigned successfully.",
            data: {
                affectedTables: affectedTableIds,
                reservationUpdated: updatedReservation || null
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error("Error unassigning table:", error);
        return res.status(500).json({
            success: false,
            message: "Error unassigning table.",
            error: error.message
        });
    }
};

exports.changeTableAssignment = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { reservationId, newTableId, force = false } = req.body;

        if (!reservationId || !newTableId) {
            return res.status(400).json({
                success: false,
                message: "reservationId and newTableId are required."
            });
        }

        session.startTransaction();

        const reservation = await Reservation.findById(reservationId).session(session);

        if (!reservation) {
            throw new Error("Reservation not found.");
        }

        const reservationDate = reservation.date;

        const newTable = await Table.findById(newTableId).session(session);

        if (!newTable) {
            throw new Error("New table not found.");
        }

        if (newTable.status === "OutOfService" && !force) {
            throw new Error("Selected table is locked.");
        }

        const conflictingBlock = await Block.findOne({
            restaurantId: reservation.restaurantId,
            isActive: true,
            status: "Active",
            isExpired: false,
            startDate: { $lte: reservationDate },
            endDate: { $gte: reservationDate },
            $or: [
                { isFullRestaurantBlock: true },
                { tableIds: newTableId },
                reservation.shiftId ? { shiftIds: reservation.shiftId } : {}
            ]
        }).session(session);

        if (conflictingBlock && !force) {
            throw new Error(
                `Table is blocked: ${conflictingBlock.reason}`
            );
        }

        const conflictingReservation = await Reservation.findOne({
            _id: { $ne: reservationId },
            tableId: newTableId,
            date: reservation.date,
            time: reservation.time,
            status: { $in: ["Pending", "Confirmed", "Seated"] }
        }).session(session);

        if (conflictingReservation && !force) {
            throw new Error("Selected table already assigned.");
        }

        const oldTableId = reservation.tableId;

        reservation.tableId = newTableId;
        await reservation.save({ session });

        if (oldTableId) {
            await Table.findByIdAndUpdate(
                oldTableId,
                { status: "Available" },
                { session }
            );
        }

        const newStatus =
            reservation.status === "Seated" ? "Seated" : "Reserved";

        await Table.findByIdAndUpdate(
            newTableId,
            { status: newStatus },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Table assignment changed successfully.",
            data: {
                reservationId,
                oldTableId,
                newTableId,
                tableStatus: newStatus
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error("Error changing table assignment:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Error changing table assignment."
        });
    }
};

exports.getAvailableTable = async (req, res) => {
    try {
        const { restaurantId, date, time, partySize } = req.body;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        if (!partySize || partySize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid partySize is required"
            });
        }

        if (!date || !time) {
            return res.status(400).json({
                success: false,
                message: "date and time are required"
            });
        }

        const selectedDate = moment(date, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
        if (!selectedDate.isValid()) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format"
            });
        }

        const slotTime = moment(time, "hh:mm A").format("HH:mm");

        /* ================= FETCH TABLES WITH ROOM ================= */
        const tables = await Table.find({
            restaurantId,
            status: "Available",
            capacity: { $gte: partySize }
        })
            .select("_id tableNumber capacity roomId")
            .populate("roomId", "name");

        if (!tables.length) {
            return res.status(200).json({
                success: true,
                totalTables: 0,
                totalRooms: 0,
                data: []
            });
        }

        const tableIds = tables.map(t => t._id);

        /* ================= BLOCK CHECK ================= */
        const blocks = await Block.find({
            restaurantId,
            status: "Active",
            isExpired: false,
            startDate: { $lte: selectedDate.toDate() },
            endDate: { $gte: selectedDate.toDate() }
        });

        let blockedTableIds = new Set();

        for (const block of blocks) {

            if (block.isFullRestaurantBlock) {
                return res.status(200).json({
                    success: true,
                    totalTables: 0,
                    totalRooms: 0,
                    data: []
                });
            }

            if (block.tableIds?.length) {

                if (block.startTime && block.endTime) {
                    if (slotTime >= block.startTime && slotTime < block.endTime) {
                        block.tableIds.forEach(id =>
                            blockedTableIds.add(id.toString())
                        );
                    }
                } else {
                    block.tableIds.forEach(id =>
                        blockedTableIds.add(id.toString())
                    );
                }
            }
        }

        /* ================= RESERVATION CHECK ================= */
        const reservations = await Reservation.find({
            restaurantId,
            date: {
                $gte: selectedDate.startOf("day").toDate(),
                $lte: selectedDate.endOf("day").toDate()
            },
            status: { $in: ["Pending", "Confirmed"] }
        }).select("tableId time");

        let reservedTableIds = new Set();

        for (const r of reservations) {
            const resTime = moment(r.time, "HH:mm").format("HH:mm");

            if (resTime === slotTime) {
                reservedTableIds.add(r.tableId.toString());
            }
        }

        /* ================= FILTER AVAILABLE ================= */
        const availableTables = tables.filter(t =>
            !blockedTableIds.has(t._id.toString()) &&
            !reservedTableIds.has(t._id.toString())
        );

        /* ================= GROUP BY ROOM ================= */
        const roomMap = new Map();

        for (const table of availableTables) {

            const roomId = table.roomId?._id?.toString() || "no-room";
            const roomName = table.roomId?.name || "No Room";

            if (!roomMap.has(roomId)) {
                roomMap.set(roomId, {
                    roomId,
                    roomName,
                    tables: []
                });
            }

            roomMap.get(roomId).tables.push({
                _id: table._id,
                tableNumber: table.tableNumber,
                capacity: table.capacity
            });
        }

        const groupedData = Array.from(roomMap.values());

        return res.status(200).json({
            success: true,
            totalTables: availableTables.length,
            totalRooms: groupedData.length,
            data: groupedData
        });

    } catch (error) {
        console.error("Error fetching available tables:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching available tables",
            error: error.message
        });
    }
};
