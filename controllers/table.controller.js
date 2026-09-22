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
const { sendReservationNotification } = require('../utils/reservationNotification');

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
                                    channel: t.channel || "online_foh",
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
            status: { $nin: ["Cancelled", "No-Show"] },
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

        /* ================= VALIDATION ================= */

        if (!Array.isArray(tableIds) || tableIds.length < 2) {

            return res.status(400).json({
                success: false,
                message: "Minimum 2 tables are required to merge."
            });
        }

        // MAX 5 TABLES
        if (tableIds.length > 5) {

            return res.status(400).json({
                success: false,
                message: "Maximum 5 tables can be merged."
            });
        }

        // UNIQUE IDS
        const uniqueTableIds = [...new Set(tableIds)];

        if (uniqueTableIds.length !== tableIds.length) {

            return res.status(400).json({
                success: false,
                message: "Duplicate tableIds are not allowed."
            });
        }

        /* ================= FETCH TABLES ================= */

        const tables = await Table.find({
            _id: { $in: uniqueTableIds }
        });

        if (tables.length !== uniqueTableIds.length) {

            return res.status(404).json({
                success: false,
                message: "One or more tables not found."
            });
        }

        /* ================= SAME RESTAURANT ================= */

        const restaurantIds = [
            ...new Set(
                tables.map(t => t.restaurantId.toString())
            )
        ];

        if (restaurantIds.length > 1) {

            return res.status(400).json({
                success: false,
                message: "Tables must belong to same restaurant."
            });
        }

        /* ================= SAME ROOM ================= */

        const roomIds = [
            ...new Set(
                tables.map(t => t.roomId.toString())
            )
        ];

        if (roomIds.length > 1) {

            return res.status(400).json({
                success: false,
                message: "Tables must belong to same room."
            });
        }

        /* ================= VALIDATE TABLE STATUS ================= */

        const invalidTables = tables.filter(
            t =>
                t.status === "OutOfService"
        );

        if (invalidTables.length > 0) {

            return res.status(400).json({
                success: false,
                message:
                    "OutOfService tables cannot be merged."
            });
        }

        /* ================= BUILD FINAL MERGED GROUP ================= */

        let finalSet = new Set();

        for (const table of tables) {

            // add self
            finalSet.add(table._id.toString());

            // already merged tables
            if (
                table.isJoined &&
                table.joinedWith?.length
            ) {

                table.joinedWith.forEach(id => {
                    finalSet.add(id.toString());
                });
            }
        }

        const finalTableIds = Array.from(finalSet);

        /* ================= MAX 5 AFTER EXPANSION ================= */

        if (finalTableIds.length > 5) {

            return res.status(400).json({
                success: false,
                message:
                    "Merged group cannot exceed 5 tables."
            });
        }

        /* ================= UPDATE ALL TABLES ================= */

        await Table.updateMany(
            {
                _id: { $in: finalTableIds }
            },
            {
                $set: {
                    isJoined: true,
                    joinedWith: finalTableIds
                }
            }
        );

        /* ================= RESPONSE ================= */

        return res.status(200).json({
            success: true,
            message: "Tables merged successfully.",
            data: {
                mergedTableIds: finalTableIds,
                totalTables: finalTableIds.length
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

        const {
            tableId,
            reason,
            force = false,
            lockType = "day" // "day" | "permanent"
        } = req.body;

        const userId = req.user?._id;

        /* ================= VALIDATION ================= */

        if (!tableId) {

            await session.abortTransaction();

            return res.status(400).json({
                success: false,
                message: "tableId is required"
            });
        }

        if (!["day", "permanent"].includes(lockType)) {

            await session.abortTransaction();

            return res.status(400).json({
                success: false,
                message: "lockType must be either day or permanent"
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

        /* ================= UNLOCK FLOW ================= */

        if (table.status === "OutOfService") {

            // permanent unlock restriction
            if (
                table.lockType === "permanent" &&
                req.body.from !== "builder"
            ) {

                await session.abortTransaction();

                return res.status(400).json({
                    success: false,
                    message:
                        "Permanent locked tables can only be unlocked from Builder"
                });
            }

            table.status = "Available";
            table.lockReason = null;
            table.lockedBy = null;
            table.lockedAt = null;
            table.lockType = null;
            table.lockUntilShiftEnd = null;

            await table.save({ session });

            await session.commitTransaction();
            session.endSession();

            return res.status(200).json({
                success: true,
                message: "Table unlocked successfully",
                data: table
            });
        }

        /* ================= CANNOT LOCK SEATED ================= */

        if (table.status === "Seated" && !force) {

            await session.abortTransaction();

            return res.status(400).json({
                success: false,
                message:
                    "Table occupied — clear before locking"
            });
        }

        /* ================= FORCE OVERRIDE ================= */

        if (table.status === "Reserved" && !force) {

            await session.abortTransaction();

            return res.status(400).json({
                success: false,
                message:
                    "Table is currently Reserved. Use force:true to override."
            });
        }

        /* ================= DAY RANGE ================= */

        const now = new Date();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        // AC-9
        // include post-midnight till 04:00 AM next day
        const tomorrowFourAM = new Date(todayStart);
        tomorrowFourAM.setDate(tomorrowFourAM.getDate() + 1);
        tomorrowFourAM.setHours(4, 0, 0, 0);

        /* ================= FIND ACTIVE BOOKINGS ================= */

        const todaysBookings = await Reservation.find({
            tableIds: table._id,
            restaurantId: table.restaurantId,
            date: {
                $gte: todayStart,
                $lt: tomorrowFourAM
            },
            status: {
                $in: [
                    "Pending",
                    "Confirmed",
                    "Upcoming"
                ]
            }
        }).session(session);

        /* ================= CANCEL BOOKINGS ================= */

        for (const booking of todaysBookings) {

            booking.status = "Cancelled";
            booking.cancellation.at = new Date();
            booking.cancellation.actorId = userId;
            booking.cancellation.reason = "Cancelled automatically due to table lock";
            booking.cancellation.source = "table";
            booking.notes =
                "Cancelled automatically due to table lock";

            await booking.save({ session });

            const guest = await Guest.findById(
                booking.guestId
            );

            // optional email
            if (guest?.email) {
                await sendReservationNotification(
                    booking,
                    guest,
                    "Cancelled"
                );
            }
        }

        /* ================= DAY LOCK SHIFT END ================= */

        let lockUntilShiftEnd = null;

        if (lockType === "day") {

            const currentDayMap = [
                "Su",
                "Mo",
                "Tu",
                "We",
                "Th",
                "Fr",
                "Sa"
            ];

            const currentDay =
                currentDayMap[now.getDay()];

            const activeShifts = await Shift.find({
                restaurantId: table.restaurantId,
                isActive: true,
                isExpired: false,
                daysActive: currentDay
            }).session(session);

            if (activeShifts.length > 0) {

                let latestShiftEnd = null;

                for (const shift of activeShifts) {

                    if (!shift.endTime) continue;

                    const [hours, minutes] =
                        shift.endTime.split(":").map(Number);

                    let shiftEnd = new Date(now);

                    shiftEnd.setHours(
                        hours,
                        minutes,
                        0,
                        0
                    );

                    // cross midnight shift
                    if (hours < 4) {
                        shiftEnd.setDate(
                            shiftEnd.getDate() + 1
                        );
                    }

                    if (
                        !latestShiftEnd ||
                        shiftEnd > latestShiftEnd
                    ) {
                        latestShiftEnd = shiftEnd;
                    }
                }

                lockUntilShiftEnd = latestShiftEnd;
            }
        }

        /* ================= LOCK TABLE ================= */

        table.status = "OutOfService";

        table.lockReason =
            reason || "Temporarily unavailable";

        table.lockedBy = userId;

        table.lockedAt = new Date();

        table.lockType = lockType;

        table.lockUntilShiftEnd =
            lockType === "day"
                ? lockUntilShiftEnd
                : null;

        await table.save({ session });

        /* ================= PROPAGATE TO MERGED TABLES ================= */

        if (
            table.isJoined &&
            table.joinedWith?.length > 0
        ) {

            await Table.updateMany(
                {
                    _id: {
                        $in: table.joinedWith
                    }
                },
                {
                    $set: {
                        status: "OutOfService",
                        lockReason:
                            table.lockReason,
                        lockedBy: userId,
                        lockedAt: table.lockedAt,
                        lockType,
                        lockUntilShiftEnd
                    }
                },
                { session }
            );
        }

        await session.commitTransaction();

        session.endSession();

        return res.status(200).json({
            success: true,
            message: `Table locked successfully`,
            data: {
                tableId: table._id,
                lockType,
                lockUntilShiftEnd,
                cancelledBookings:
                    todaysBookings.length
            }
        });

    } catch (error) {

        await session.abortTransaction();

        session.endSession();

        console.error("lockTable error:", error);

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

        const allowedStatuses = [
            "Available",
            "Reserved",
            "Seated",
            "OutOfService"
        ];

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

        /*
        ==========================================
        TABLE -> SEATED
        ==========================================
        */
        if (status === "Seated") {

            // First try existing reservation
            updatedReservation = await Reservation.findOne({
                tableIds: id,
                date: {
                    $gte: todayStart,
                    $lte: todayEnd
                },
                status: {
                    $in: ["Pending", "Confirmed", "Upcoming", "Arrived"]
                }
            }).sort({ time: 1 });

            // EXISTING RESERVATION
            if (updatedReservation) {

                updatedReservation.status = "Seated";

                // immutable timestamps
                if (!updatedReservation.arrivedAt) {
                    updatedReservation.arrivedAt = new Date();
                }

                if (!updatedReservation.seatedAt) {
                    updatedReservation.seatedAt = new Date();
                }

                await updatedReservation.save();
            }

            /*
            WALK-IN FLOW
            */
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

                const now = new Date();

                updatedReservation = await Reservation.create({

                    restaurantId: table.restaurantId,
                    tableId: id,
                    shiftId: null,

                    date: now,

                    time: now.toTimeString().slice(0, 5),

                    partySize,

                    source: "Walk-in",

                    status: "Seated",

                    // timestamps
                    arrivedAt: now,
                    seatedAt: now
                });
            }
        }

        /*
        ==========================================
        TABLE -> AVAILABLE
        ==========================================
        */
        if (status === "Available") {

            updatedReservation = await Reservation.findOne({
                tableIds: id,
                date: {
                    $gte: todayStart,
                    $lte: todayEnd
                },
                status: "Seated"
            }).sort({ time: -1 });

            if (updatedReservation) {

                updatedReservation.status = "Finished";

                // immutable finishedAt
                if (!updatedReservation.finishedAt) {
                    updatedReservation.finishedAt = new Date();
                }

                await updatedReservation.save();
            }
        }

        /*
        ==========================================
        UPDATE TABLE STATUS
        ==========================================
        */

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

        console.error(
            "Error updating table status:",
            error
        );

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

        const { tableIds, force = false } = req.body;

        if (!tableIds || !Array.isArray(tableIds) || tableIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "tableIds is required and must be an array."
            });
        }

        session.startTransaction();

        // Fetch all requested tables
        const tables = await Table.find({
            _id: { $in: tableIds }
        }).session(session);

        if (!tables.length) {
            await session.abortTransaction();
            session.endSession();

            return res.status(404).json({
                success: false,
                message: "Table(s) not found."
            });
        }

        // Collect all affected table ids (including joined tables)
        let affectedTableIds = [];

        tables.forEach(table => {

            affectedTableIds.push(table._id.toString());

            if (table.isJoined && table.joinedWith?.length) {
                table.joinedWith.forEach(id => {
                    affectedTableIds.push(id.toString());
                });
            }

        });

        // Remove duplicate ids
        affectedTableIds = [...new Set(affectedTableIds)];

        const now = new Date();

        // Find reservation using any affected table
        const reservations = await Reservation.find({
            tableIds: { $in: affectedTableIds },
            status: { $in: ["Pending", "Confirmed", "Seated"] }
        }).session(session);

        // Helper
        const getReservationDateTime = (reservation) => {

            const d = new Date(reservation.date);

            const [hh, mm] = reservation.time.split(":");

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
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "Guest already seated. Use force=true to unassign."
            });

        }

        let updatedReservation = null;

        if (nearest) {

            // Remove affected table ids from reservation
            nearest.tableIds = nearest.tableIds.filter(id =>
                !affectedTableIds.includes(id.toString())
            );

            updatedReservation = await nearest.save({ session });

        }

        // Make all tables available
        await Table.updateMany(
            {
                _id: { $in: affectedTableIds }
            },
            {
                $set: {
                    status: "Available",
                    isJoined: false,
                    joinedWith: []
                }
            },
            {
                session
            }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Table unassigned successfully.",
            data: {
                affectedTables: affectedTableIds,
                reservationUpdated: updatedReservation
            }
        });

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        console.error(error);

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

        const {
            reservationId,
            newTableId,
            force = false
        } = req.body;

        /* ================= VALIDATION ================= */

        if (!reservationId || !newTableId) {
            return res.status(400).json({
                success: false,
                message: "reservationId and newTableId are required."
            });
        }

        session.startTransaction();

        /* ================= RESERVATION ================= */

        const reservation = await Reservation.findById(reservationId)
            .session(session);

        if (!reservation) {
            throw new Error("Reservation not found.");
        }

        const reservationDate = new Date(reservation.date);

        /* ================= NEW TABLE ================= */

        const newTable = await Table.findById(newTableId)
            .session(session);

        if (!newTable) {
            throw new Error("New table not found.");
        }

        /* ================= SAME TABLE CHECK ================= */

        const currentTableIds =
            reservation.tableIds?.map(id => id.toString()) || [];

        if (currentTableIds.includes(newTableId.toString())) {
            throw new Error("Reservation is already assigned to this table.");
        }

        /* ================= LOCK CHECK ================= */

        if (
            newTable.status === "OutOfService" &&
            !force
        ) {
            throw new Error("Selected table is locked.");
        }

        /* ================= BLOCK CHECK ================= */

        const conflictingBlock = await Block.findOne({
            restaurantId: reservation.restaurantId,
            isActive: true,
            status: "Active",
            isExpired: false,

            startDate: {
                $lte: reservationDate
            },

            endDate: {
                $gte: reservationDate
            },

            $or: [
                { isFullRestaurantBlock: true },
                { tableIds: newTable._id },
                reservation.shiftId
                    ? { shiftIds: reservation.shiftId }
                    : null
            ].filter(Boolean)

        }).session(session);

        if (conflictingBlock && !force) {

            throw new Error(
                `Table is blocked: ${conflictingBlock.reason || "Blocked"}`
            );
        }

        /* ================= TIME OVERLAP CHECK ================= */

        const conflictingReservation = await Reservation.findOne({

            _id: { $ne: reservationId },

            tableIds: newTable._id,

            date: reservation.date,

            status: {
                $in: [
                    "Pending",
                    "Confirmed",
                    "Seated",
                    "Upcoming"
                ]
            }

        }).session(session);

        if (conflictingReservation) {

            const existingStart = conflictingReservation.time;
            const existingEnd =
                conflictingReservation.endTime ||
                conflictingReservation.expectedEndTime;

            const currentStart = reservation.time;
            const currentEnd =
                reservation.endTime ||
                reservation.expectedEndTime;

            const hasOverlap =
                currentStart < existingEnd &&
                currentEnd > existingStart;

            if (hasOverlap && !force) {

                throw new Error(
                    "Selected table is already assigned for this time slot."
                );
            }
        }

        /* ================= OLD TABLES ================= */

        const oldTableIds = reservation.tableIds || [];

        /* ================= UPDATE RESERVATION ================= */

        reservation.tableIds = [newTable._id];

        // backward compatibility
        reservation.tableId = newTable._id;

        await reservation.save({ session });

        /* ================= FREE OLD TABLES ================= */

        if (oldTableIds.length > 0) {

            await Table.updateMany(
                {
                    _id: {
                        $in: oldTableIds
                    }
                },
                {
                    $set: {
                        status: "Available"
                    }
                },
                {
                    session
                }
            );
        }

        /* ================= UPDATE NEW TABLE STATUS ================= */

        const tableStatus =
            reservation.status === "Seated"
                ? "Seated"
                : "Reserved";

        await Table.findByIdAndUpdate(
            newTable._id,
            {
                $set: {
                    status: tableStatus
                }
            },
            { session }
        );

        /* ================= COMMIT ================= */

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Table assignment changed successfully.",
            data: {
                reservationId: reservation._id,
                oldTableIds,
                newTableId: newTable._id,
                tableStatus
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
        const { restaurantId, date, time, partySize = 1 } = req.body;

        /* ================= VALIDATION ================= */

        if (!restaurantId || !date || !time) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, date & time are required"
            });
        }

        if (partySize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid partySize is required"
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

        /* ================= SHIFT VALIDATION ================= */

        const shortDay = selectedDate.format("ddd");

        const map = {
            Mon: "Mo",
            Tue: "Tu",
            Wed: "We",
            Thu: "Th",
            Fri: "Fr",
            Sat: "Sa",
            Sun: "Su"
        };

        const weekdayName = map[shortDay];

        const shifts = await Shift.find({
            restaurantId,
            isActive: true
        });

        if (!shifts.length) {
            return res.status(200).json({
                success: true,
                message: "No shifts available",
                data: []
            });
        }

        const convertToMinutes = (t) => {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
        };

        const slotMinutes = convertToMinutes(slotTime);

        let validShift = shifts.find(shift => {

            const isRecurringValid =
                shift.type === "Recurring" &&
                (!shift.daysActive?.length || shift.daysActive.includes(weekdayName)) &&
                (!shift.startDate || !selectedDate.isBefore(moment(shift.startDate), "day")) &&
                (shift.isIndefinite ||
                    !shift.endDate ||
                    !selectedDate.isAfter(moment(shift.endDate), "day"));

            const isSpecialValid =
                shift.type === "Special" &&
                shift.startDate &&
                !selectedDate.isBefore(moment(shift.startDate), "day") &&
                (!shift.endDate ||
                    !selectedDate.isAfter(moment(shift.endDate), "day"));

            if (!isRecurringValid && !isSpecialValid) return false;

            let start = convertToMinutes(shift.startTime);
            let end = convertToMinutes(shift.endTime);

            /* OVERNIGHT FIX */
            if (end <= start) end += 1440;

            let checkTime = slotMinutes;

            if (checkTime < start) checkTime += 1440;

            return checkTime >= start && checkTime < end;
        });

        if (!validShift) {
            return res.status(400).json({
                success: false,
                message: "Selected slot is not valid for any shift"
            });
        }

        /* ================= FETCH TABLES ================= */

        const tables = await Table.find({
            restaurantId,
            status: "Available",
            capacity: { $gte: partySize }
        })
            .select("_id tableNumber capacity roomId joinedWith")
            .populate("roomId", "name");

        if (!tables.length) {
            return res.status(200).json({
                success: true,
                message: "No tables found",
                totalTables: 0,
                totalRooms: 0,
                data: []
            });
        }

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

            /* FULL RESTAURANT BLOCK */
            if (block.isFullRestaurantBlock) {

                if (block.startTime && block.endTime) {
                    if (slotTime >= block.startTime && slotTime < block.endTime) {
                        return res.status(200).json({
                            success: true,
                            message: "Restaurant blocked for this time",
                            totalTables: 0,
                            totalRooms: 0,
                            data: []
                        });
                    }
                } else {
                    return res.status(200).json({
                        success: true,
                        message: "Restaurant fully blocked",
                        totalTables: 0,
                        totalRooms: 0,
                        data: []
                    });
                }
            }

            /* 🔥 TABLE BLOCK */
            if (block.tableIds?.length) {

                const validIds = block.tableIds.filter(id => id);

                if (block.startTime && block.endTime) {
                    if (slotTime >= block.startTime && slotTime < block.endTime) {
                        validIds.forEach(id =>
                            blockedTableIds.add(id.toString())
                        );
                    }
                } else {
                    validIds.forEach(id =>
                        blockedTableIds.add(id.toString())
                    );
                }
            }
        }

        /* ================= RESERVATION CHECK ================= */

        const dateStr = selectedDate.format("YYYY-MM-DD");
        const startOfDay = new Date(Math.min(
            selectedDate.clone().startOf("day").toDate().getTime(),
            moment.utc(dateStr).startOf("day").toDate().getTime()
        ));
        const endOfDay = new Date(Math.max(
            selectedDate.clone().endOf("day").toDate().getTime(),
            moment.utc(dateStr).endOf("day").toDate().getTime()
        ));

        const reservations = await Reservation.find({
            restaurantId,
            date: {
                $gte: startOfDay,
                $lte: endOfDay
            },
            status: { $nin: ["Cancelled", "Finished", "No-Show"] }
        })
            .populate("shiftId", "duration sameDurationForAll durationByPartySize")
            .select("tableIds time partySize shiftId");

        let requestedDuration = 120;
        if (validShift) {
            if (validShift.sameDurationForAll && validShift.duration) {
                requestedDuration = validShift.duration;
            } else if (!validShift.sameDurationForAll && validShift.durationByPartySize?.length) {
                const rule = validShift.durationByPartySize.find(tier => {
                    const [min, max] = tier.range.split("-").map(Number);
                    return Number(partySize) >= min && Number(partySize) <= max;
                });
                if (rule?.duration) requestedDuration = rule.duration;
                else if (validShift.duration) requestedDuration = validShift.duration;
            }
        }

        const slotEndMinutes = slotMinutes + requestedDuration;
        let reservedTableIds = new Set();

        for (const r of reservations) {
            if (!r.time) continue;
            const rTime24 = moment(r.time, ["HH:mm", "H:mm", "hh:mm A", "h:mm A"]).format("HH:mm");
            const rStartMin = convertToMinutes(rTime24);

            let rDuration = 120;
            if (r.shiftId) {
                if (r.shiftId.sameDurationForAll && r.shiftId.duration) {
                    rDuration = r.shiftId.duration;
                } else if (!r.shiftId.sameDurationForAll && r.shiftId.durationByPartySize?.length) {
                    const rule = r.shiftId.durationByPartySize.find(tier => {
                        const [min, max] = tier.range.split("-").map(Number);
                        return (r.partySize || 1) >= min && (r.partySize || 1) <= max;
                    });
                    if (rule?.duration) rDuration = rule.duration;
                    else if (r.shiftId.duration) rDuration = r.shiftId.duration;
                }
            }
            const rEndMin = rStartMin + rDuration;

            // Overlap check
            if (slotMinutes < rEndMin && rStartMin < slotEndMinutes) {
                if (Array.isArray(r.tableIds)) {
                    r.tableIds.forEach(id => reservedTableIds.add(id.toString()));
                }
            }
        }

        /* ================= FINAL FILTER ================= */

        const availableTables = tables.filter(t => {
            if (!t?._id) return false;
            const tId = t._id.toString();
            if (blockedTableIds.has(tId) || reservedTableIds.has(tId)) return false;

            // Merged table check
            if (Array.isArray(t.joinedWith) && t.joinedWith.length) {
                const isJoinedUnavailable = t.joinedWith.some(jwId =>
                    blockedTableIds.has(jwId.toString()) || reservedTableIds.has(jwId.toString())
                );
                if (isJoinedUnavailable) return false;
            }

            return true;
        });

        /* ================= GROUP BY ROOM ================= */

        const roomMap = new Map();

        for (const table of availableTables) {

            const roomId = table.roomId?._id?.toString() || "no-room";

            if (!roomMap.has(roomId)) {
                roomMap.set(roomId, {
                    roomId,
                    roomName: table.roomId?.name || "No Room",
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

        /* ================= RESPONSE ================= */

        return res.status(200).json({
            success: true,
            message: "Available tables fetched successfully",
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
