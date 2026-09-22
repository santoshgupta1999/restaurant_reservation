const SeatingPreference = require("../models/SeatingPreference");
const StaffAccount = require("../models/staffAccount");
const Room = require('../models/room.model');
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Table = require("../models/table.model");
const Reservation = require("../models/reservation.model");
const Guest = require("../models/guest.model");
const Restaurant = require("../models/Restaurant.model");
const Shift = require("../models/shift.model");
const Block = require("../models/block.model");
const ReservationHold = require("../models/reservationHold.model");
const moment = require("moment-timezone");
const {
    formatDate,
    formatTime
} = require("../utils/dateFormatter");
const { sendReservationNotification } = require("../utils/reservationNotification");

// exports.addSeatingPreference = async (req, res) => {
//     try {
//         const {
//             preferenceName,
//             startDate,
//             endDate,
//             activeDays,
//             firstBookingTime,
//             lastBookingTime,
//             tableAssignment,
//             status
//         } = req.body;

//         /* ========== BASIC VALIDATION ========== */
//         if (
//             !preferenceName ||
//             !startDate ||
//             !endDate ||
//             !activeDays ||
//             !firstBookingTime ||
//             !lastBookingTime ||
//             !tableAssignment
//         ) {
//             return res.status(400).json({
//                 success: false,
//                 message: "All required fields must be provided"
//             });
//         }

//         if (!Array.isArray(activeDays) || activeDays.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Active days must be a non-empty array"
//             });
//         }

//         if (!Array.isArray(tableAssignment) || tableAssignment.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Table assignment must be a non-empty array"
//             });
//         }

//         /* ========== CREATE OBJECT ========== */
//         const seatingPreference = new SeatingPreference({
//             preferenceName,
//             startDate,
//             endDate,
//             activeDays,
//             firstBookingTime,
//             lastBookingTime,
//             tableAssignment,
//             status
//         });

//         await seatingPreference.save();

//         return res.status(201).json({
//             success: true,
//             message: "Seating preference added successfully",
//             data: seatingPreference
//         });

//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message || "Internal server error"
//         });
//     }
// };

exports.addSeatingPreference = async (req, res) => {
    try {
        const {
            id,
            preferenceName,
            restaurantId,
            startDate,
            endDate,
            activeDays,
            firstBookingTime,
            lastBookingTime,
            tableIds,
            status,
            indefinite
        } = req.body || {};

        /* ================= BASIC VALIDATION ================= */

        if (
            !preferenceName ||
            !restaurantId ||
            !startDate ||
            !activeDays ||
            !firstBookingTime ||
            !lastBookingTime ||
            !tableIds
        ) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be provided"
            });
        }

        if (
            !Array.isArray(activeDays) ||
            activeDays.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please select at least one active day"
            });
        }

        /* ================= TABLE IDS VALIDATION ================= */

        if (
            !Array.isArray(tableIds) ||
            tableIds.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please select at least one table"
            });
        }

        // validate object ids
        const invalidTableIds = tableIds.filter(
            (tableId) =>
                !mongoose.Types.ObjectId.isValid(
                    tableId
                )
        );

        if (invalidTableIds.length) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid tableIds found"
            });
        }

        // remove duplicate ids
        const uniqueTableIds = [
            ...new Set(
                tableIds.map((id) =>
                    id.toString()
                )
            )
        ];

        // validate tables exist
        const tables = await Table.find({
            _id: { $in: uniqueTableIds },
            restaurantId
        }).select("_id");

        if (
            tables.length !==
            uniqueTableIds.length
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Some selected tables do not exist"
            });
        }

        /* ================= DATE VALIDATION ================= */

        if (!indefinite && !endDate) {

            return res.status(400).json({
                success: false,
                message:
                    "End date is required for non-indefinite preference"
            });
        }

        if (indefinite && endDate) {

            return res.status(400).json({
                success: false,
                message:
                    "Please select either endDate or indefinite"
            });
        }

        if (
            !indefinite &&
            new Date(startDate) > new Date(endDate)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Start date cannot be greater than end date"
            });
        }

        /* ================= TIME VALIDATION ================= */

        const toMinutes = (time) => {

            const [h, m] = time
                .split(":")
                .map(Number);

            return (h * 60) + m;
        };

        const first =
            toMinutes(firstBookingTime);

        const last =
            toMinutes(lastBookingTime);

        // SAME TIME NOT ALLOWED
        if (first === last) {

            return res.status(400).json({
                success: false,
                message:
                    "First booking time and last booking time cannot be same"
            });
        }

        /*
            CROSS MIDNIGHT SUPPORT

            VALID:
            18:00 -> 02:00
        */

        /* ================= DUPLICATE NAME CHECK ================= */

        const duplicateQuery = {
            restaurantId,
            preferenceName:
                preferenceName.trim()
        };

        if (id) {
            duplicateQuery._id = {
                $ne: id
            };
        }

        const existing =
            await SeatingPreference.findOne(
                duplicateQuery
            );

        if (existing) {

            return res.status(400).json({
                success: false,
                message:
                    "Preference name already exists"
            });
        }

        /* ================= UPDATE ================= */

        if (id) {

            const existingPreference =
                await SeatingPreference.findById(id);

            if (!existingPreference) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Seating preference not found"
                });
            }

            existingPreference.preferenceName =
                preferenceName.trim();

            existingPreference.restaurantId =
                restaurantId;

            existingPreference.startDate =
                startDate;

            existingPreference.endDate =
                indefinite
                    ? null
                    : endDate;

            existingPreference.indefinite =
                !!indefinite;

            existingPreference.activeDays =
                activeDays;

            existingPreference.firstBookingTime =
                firstBookingTime;

            existingPreference.lastBookingTime =
                lastBookingTime;

            // FIXED TABLE IDS
            existingPreference.tableIds =
                uniqueTableIds;

            existingPreference.status =
                status ||
                existingPreference.status;

            await existingPreference.save();

            return res.status(200).json({
                success: true,
                message:
                    "Seating preference updated successfully",
                data: existingPreference
            });
        }

        /* ================= CREATE ================= */

        const newPreference =
            await SeatingPreference.create({

                preferenceName:
                    preferenceName.trim(),

                restaurantId,

                startDate,

                endDate:
                    indefinite
                        ? null
                        : endDate,

                indefinite:
                    !!indefinite,

                activeDays,

                firstBookingTime,

                lastBookingTime,

                // FIXED TABLE IDS
                tableIds:
                    uniqueTableIds,

                status
            });

        return res.status(201).json({
            success: true,
            message:
                "Seating preference added successfully",
            data: newPreference
        });

    } catch (error) {

        console.error(
            "Add seating preference error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Internal server error"
        });
    }
};

exports.deleteSeatingPreference = async (req, res) => {

    const session = await mongoose.startSession();

    try {

        const {
            id,
            action = "cancel", // cancel | legacy
            notifyGuests = true
        } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Seating preference ID is required."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid seating preference ID."
            });
        }

        if (!["cancel", "legacy"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "action must be either cancel or legacy."
            });
        }

        session.startTransaction();

        /* ================= PREFERENCE ================= */

        const seatingPreference =
            await SeatingPreference.findById(id)
                .session(session);

        if (!seatingPreference) {

            await session.abortTransaction();
            session.endSession();

            return res.status(404).json({
                success: false,
                message: "Seating preference not found."
            });
        }

        /* ================= FUTURE RESERVATIONS ================= */

        const todayStart = moment()
            .startOf("day")
            .toDate();

        const reservations = await Reservation.find({
            seating: seatingPreference._id,
            status: {
                $in: [
                    "Pending",
                    "Confirmed",
                    "Upcoming"
                ]
            },
            date: { $gte: todayStart }
        }).session(session);

        /* ================= CANCEL FLOW ================= */

        if (action === "cancel") {

            for (const reservation of reservations) {

                reservation.status = "Cancelled";

                reservation.cancellation =
                    reservation.cancellation || {};

                reservation.cancellation.at =
                    new Date();

                reservation.cancellation.reason =
                    `Cancelled due to deleted seating preference (${seatingPreference.preferenceName})`;

                reservation.cancellation.source =
                    "seating_preference";

                await reservation.save({ session });

                /* FREE TABLES */

                if (
                    reservation.tableIds &&
                    reservation.tableIds.length
                ) {

                    await Table.updateMany(
                        {
                            _id: {
                                $in: reservation.tableIds
                            }
                        },
                        {
                            $set: {
                                status: "Available"
                            }
                        },
                        { session }
                    );
                }

                /* EMAIL */

                if (notifyGuests) {

                    try {

                        const guest =
                            await Guest.findById(
                                reservation.guestId
                            );

                        if (guest?.email) {

                            await sendReservationNotification(
                                reservation,
                                guest,
                                "Cancelled"
                            );
                        }

                    } catch (emailError) {

                        console.error(
                            "Cancellation email error:",
                            emailError.message
                        );
                    }
                }
            }
        }

        /* ================= LEGACY FLOW ================= */

        if (action === "legacy") {

            for (const reservation of reservations) {

                const oldTableIds =
                    reservation.tableIds || [];

                reservation.isLegacy = true;

                reservation.legacyReason =
                    `Seating preference deleted (${seatingPreference.preferenceName})`;

                reservation.tableIds = [];

                reservation.seating = null;

                reservation.notes =
                    `${reservation.notes || ""}\nMarked as legacy due to deleted seating preference`;

                await reservation.save({ session });

                /* FREE OLD TABLES */

                if (oldTableIds.length) {

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
                        { session }
                    );
                }
            }
        }

        /* ================= DELETE PREFERENCE ================= */

        await SeatingPreference.findByIdAndDelete(
            seatingPreference._id,
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message:
                "Seating preference deleted successfully.",
            data: {
                preferenceId:
                    seatingPreference._id,
                preferenceName:
                    seatingPreference.preferenceName,
                action,
                affectedReservations:
                    reservations.length
            }
        });

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        console.error(
            "Error deleting seating preference:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Error deleting seating preference.",
            error: error.message
        });
    }
};

exports.toggleSeatingPreferenceStatus = async (req, res) => {
    try {
        const { id } = req.body || {};

        /* ================= BASIC VALIDATION ================= */
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Seating preference ID is required"
            });
        }

        /* ================= FIND FIRST ================= */
        const seatingPreference = await SeatingPreference.findById(id);

        if (!seatingPreference) {
            return res.status(404).json({
                success: false,
                message: "Seating preference not found"
            });
        }

        /* ================= DELETE ================= */
        if (seatingPreference.status === "Active") {
            seatingPreference.status = "Inactive"
        }
        else {
            seatingPreference.status = "Active"
        }

        await seatingPreference.save();

        return res.status(200).json({
            success: true,
            message: `Status update successfully to ${seatingPreference.status}`
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

exports.getAllPreference = async (req, res) => {

    try {

        const { restaurantId } = req.body;

        /* ================= VALIDATION ================= */

        if (!restaurantId) {

            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        /* ================= FETCH DATA ================= */

        const preferences =
            await SeatingPreference.find({
                restaurantId
            })
                .populate({
                    path: "tableIds",
                    select:
                        "_id tableNumber displayName capacity shape status"
                })
                .sort({ createdAt: 1 })
                .select(
                    "-createdAt -updatedAt -__v"
                );

        /* ================= FORMAT RESPONSE ================= */

        const formattedPreferences =
            preferences.map((p) => ({

                _id: p._id,

                preferenceName:
                    p.preferenceName,

                startDate:
                    formatDate(p.startDate),

                endDate:
                    p.indefinite
                        ? null
                        : formatDate(p.endDate),

                indefinite:
                    p.indefinite,

                activeDays:
                    p.activeDays,

                firstBookingTime:
                    formatTime(
                        p.firstBookingTime
                    ),

                lastBookingTime:
                    formatTime(
                        p.lastBookingTime
                    ),

                /* ================= FIXED TABLE IDS ================= */

                tableIds:
                    p.tableIds?.map((table) => ({

                        _id: table._id,

                        tableNumber:
                            table.tableNumber,

                        displayName:
                            table.displayName,

                        capacity:
                            table.capacity,

                        shape:
                            table.shape,

                        status:
                            table.status
                    })) || [],

                status:
                    p.status,

                restaurantId:
                    p.restaurantId
            }));

        /* ================= RESPONSE ================= */

        return res.status(200).json({
            success: true,
            message:
                "Seating preferences fetched successfully",

            count:
                formattedPreferences.length,

            data:
                formattedPreferences
        });

    } catch (error) {

        console.error(
            "getAllPreference error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Internal server error"
        });
    }
};

exports.saveStaffAccount = async (req, res) => {
    try {
        const { id, userName, password, role, status } = req.body || {};

        /* ================= VALIDATIONS ================= */

        if (!userName || !role || !status) {
            return res.status(400).json({
                success: false,
                message: "userName, role and status are required"
            });
        }

        // Username trim
        const trimmedUserName = userName.trim();

        /* ================= CREATE ================= */
        if (!id) {

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: "Password is required while creating staff account"
                });
            }

            // Duplicate username check
            const existingUser = await StaffAccount.findOne({
                userName: trimmedUserName
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Username already exists"
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            const newStaff = await StaffAccount.create({
                userName: trimmedUserName,
                password: hashedPassword,
                role,
                status
            });

            return res.status(201).json({
                success: true,
                message: "Staff account created successfully",
                data: newStaff
            });
        }

        /* ================= UPDATE ================= */

        const staff = await StaffAccount.findById(id);

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: "Staff account not found"
            });
        }

        // Duplicate username check except self
        const duplicate = await StaffAccount.findOne({
            userName: trimmedUserName,
            _id: { $ne: id }
        });

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        staff.userName = trimmedUserName;
        staff.role = role;
        staff.status = status;

        // Update password only if provided
        if (password) {
            staff.password = await bcrypt.hash(password, 10);
        }

        await staff.save();

        return res.status(200).json({
            success: true,
            message: "Staff account updated successfully",
            data: staff
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

exports.deleteStaff = async (req, res) => {
    try {
        const { id } = req.body || {}; // ya req.params.id

        /* ================= BASIC VALIDATION ================= */
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Staff ID is required"
            });
        }

        /* ================= FIND FIRST ================= */
        const staff = await StaffAccount.findById(id);

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: "Staff not found"
            });
        }

        /* ================= DELETE ================= */
        await staff.deleteOne({ _id: id });

        return res.status(200).json({
            success: true,
            message: "Staff account deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

exports.getAllStaff = async (req, res) => {
    try {
        const staffs = await StaffAccount.find()
            .sort({ createdAt: 1 })
            .select("-createdAt -updatedAt -__v")

        const formattedStaffs = staffs.map((s) => ({
            _id: s._id,
            userName: s.userName,
            role: s.role,
            status: s.status,
            lastLogin: s.lastLogin
        }));

        return res.status(200).json({
            success: true,
            message: "Staffs fetched successfully",
            count: formattedStaffs.length,
            data: formattedStaffs,

        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

exports.getRoomsByRestaurant = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        const rooms = await Room.find(
            { restaurantId, isActive: true },
            { _id: 1, name: 1 }
        ).sort({ name: 1 }).lean();

        const formatted = rooms.map(room => ({
            id: room._id,
            name: room.name
        }));

        return res.status(200).json({
            success: true,
            data: formatted
        });

    } catch (error) {
        console.error("Error fetching room dropdown:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching rooms",
            error: error.message
        });
    }
};

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

function convertTo24Hour(time) {
    if (!time) return time;
    const cleanTime = String(time).trim();
    const m = moment(cleanTime, ["hh:mm A", "h:mm A", "HH:mm", "H:mm", "hh:mma", "h:mma", "hh:mm a", "h:mm a"], true);
    if (m.isValid()) {
        return m.format("HH:mm");
    }
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
    if (match) {
        let [_, h, minutes, modifier] = match;
        let hours = parseInt(h, 10);
        if (modifier) {
            modifier = modifier.toUpperCase();
            if (modifier === "PM" && hours !== 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
        }
        return `${hours.toString().padStart(2, "0")}:${minutes}`;
    }
    return cleanTime;
}

function convertTo12Hour(time) {
    if (!time) return time;
    const cleanTime = String(time).trim();
    const m = moment(cleanTime, ["HH:mm", "H:mm", "hh:mm A", "h:mm A"], true);
    if (m.isValid()) {
        return m.format("hh:mm A");
    }
    return cleanTime;
}

exports.getSeatingPrefrencesName = async (req, res) => {
    try {
        const { restaurantId, date, time } = req.body;

        /* ================= VALIDATION ================= */
        if (!restaurantId || !date || !time) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, date and time are required"
            });
        }

        /* ================= PARSE INPUT ================= */

        const selectedDate = moment.tz(
            date,
            ["DD/MM/YYYY", "YYYY-MM-DD"],
            true,
            DEFAULT_TIMEZONE
        );

        if (!selectedDate.isValid()) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format"
            });
        }

        const selectedTime = moment(
            time,
            ["hh:mm A", "HH:mm"],
            true
        ).format("HH:mm");

        const selectedDay = selectedDate.format("dd"); // Mo, Tu

        /* ================= FETCH DATA ================= */

        const preferences = await SeatingPreference.find({
            restaurantId,
            status: "Active"
        }).select(
            "_id preferenceName startDate endDate indefinite activeDays firstBookingTime lastBookingTime"
        );

        /* ================= FILTER ================= */

        const filtered = preferences.filter(p => {

            /* ---------- DATE CHECK ---------- */
            const start = moment(p.startDate).tz(DEFAULT_TIMEZONE);
            const end = p.indefinite
                ? null
                : moment(p.endDate).tz(DEFAULT_TIMEZONE);

            const isDateValid = p.indefinite
                ? selectedDate.isSameOrAfter(start, "day")
                : selectedDate.isBetween(start, end, "day", "[]");

            if (!isDateValid) return false;

            /* ---------- DAY CHECK ---------- */
            if (p.activeDays?.length && !p.activeDays.includes(selectedDay)) {
                return false;
            }

            /* ---------- TIME CHECK ---------- */
            const startTime = moment(
                p.firstBookingTime,
                ["hh:mm A", "HH:mm"]
            );

            const endTime = moment(
                p.lastBookingTime,
                ["hh:mm A", "HH:mm"]
            );

            const currentTime = moment(selectedTime, "HH:mm");

            if (!currentTime.isBetween(startTime, endTime, null, "[]")) {
                return false;
            }

            return true;
        });

        /* ================= RESPONSE ================= */

        const response = filtered.map(p => ({
            id: p._id,
            preferenceName: p.preferenceName
        }));

        return res.status(200).json({
            success: true,
            count: response.length,
            data: response
        });

    } catch (error) {
        console.error("Seating preference fetch error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching seating preferences",
            error: error.message
        });
    }
};

exports.getwidgetSeatingPrefrencesName = async (req, res) => {
    try {

        const { restaurantId } = req.params;
        const { date, time } = req.body;

        /* ================= VALIDATION ================= */
        if (!restaurantId || !date || !time) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, date and time are required"
            });
        }

        /* ================= PARSE INPUT ================= */

        const selectedDate = moment.tz(
            date,
            ["DD/MM/YYYY", "YYYY-MM-DD"],
            true,
            DEFAULT_TIMEZONE
        );

        if (!selectedDate.isValid()) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format"
            });
        }

        const selectedTime = moment(
            time,
            ["hh:mm A", "HH:mm"],
            true
        ).format("HH:mm");

        const selectedDay = selectedDate.format("dd"); // Mo, Tu

        /* ================= FETCH DATA ================= */

        const preferences = await SeatingPreference.find({
            restaurantId,
            status: "Active"
        }).select(
            "_id preferenceName startDate endDate indefinite activeDays firstBookingTime lastBookingTime"
        );

        /* ================= FILTER ================= */

        const filtered = preferences.filter(p => {

            /* ---------- DATE CHECK ---------- */
            const start = moment(p.startDate).tz(DEFAULT_TIMEZONE);
            const end = p.indefinite
                ? null
                : moment(p.endDate).tz(DEFAULT_TIMEZONE);

            const isDateValid = p.indefinite
                ? selectedDate.isSameOrAfter(start, "day")
                : selectedDate.isBetween(start, end, "day", "[]");

            if (!isDateValid) return false;

            /* ---------- DAY CHECK ---------- */
            if (p.activeDays?.length && !p.activeDays.includes(selectedDay)) {
                return false;
            }

            /* ---------- TIME CHECK ---------- */
            const startTime = moment(
                p.firstBookingTime,
                ["hh:mm A", "HH:mm"]
            );

            const endTime = moment(
                p.lastBookingTime,
                ["hh:mm A", "HH:mm"]
            );

            const currentTime = moment(selectedTime, "HH:mm");

            if (!currentTime.isBetween(startTime, endTime, null, "[]")) {
                return false;
            }

            return true;
        });

        /* ================= RESPONSE ================= */

        const response = filtered.map(p => ({
            id: p._id,
            preferenceName: p.preferenceName
        }));

        return res.status(200).json({
            success: true,
            count: response.length,
            data: response
        });

    } catch (error) {
        console.error("Seating preference fetch error:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching seating preferences",
            error: error.message
        });
    }
};

exports.getAvailableTablesByPreference = async (req, res) => {
    try {

        const {
            seatingPreferenceId,
            date,
            time,
            partySize
        } = req.body;

        /* ================= VALIDATION ================= */

        if (
            !seatingPreferenceId ||
            !date ||
            !time ||
            !partySize
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "seatingPreferenceId, date, time and partySize are required"
            });
        }

        if (
            !mongoose.Types.ObjectId.isValid(
                seatingPreferenceId
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid seatingPreferenceId"
            });
        }

        if (
            isNaN(partySize) ||
            Number(partySize) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid partySize"
            });
        }

        /* ================= FETCH PREFERENCE ================= */

        const preference =
            await SeatingPreference.findById(
                seatingPreferenceId
            ).lean();

        if (!preference) {
            return res.status(404).json({
                success: false,
                message:
                    "Seating preference not found"
            });
        }

        if (preference.status !== "Active") {
            return res.status(400).json({
                success: false,
                message:
                    "Seating preference is inactive"
            });
        }

        /* ================= DATE VALIDATION ================= */

        // ACCEPT MULTIPLE DATE FORMATS
        const selectedDate = moment(
            date,
            [
                "YYYY-MM-DD",
                "DD/MM/YYYY",
                "MM/DD/YYYY",
                "DD-MM-YYYY",
                "MM-DD-YYYY",
                "YYYY/MM/DD"
            ],
            true
        );

        if (!selectedDate.isValid()) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid date format"
            });
        }

        // NORMALIZED DATE
        const formattedDate =
            selectedDate.format("YYYY-MM-DD");

        const startDate = moment(
            preference.startDate
        ).startOf("day");

        if (selectedDate.isBefore(startDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "Preference is not active yet"
            });
        }

        if (
            !preference.indefinite &&
            preference.endDate
        ) {

            const endDate = moment(
                preference.endDate
            ).endOf("day");

            if (selectedDate.isAfter(endDate)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Preference has expired"
                });
            }
        }

        /* ================= ACTIVE DAY VALIDATION ================= */

        const dayMap = [
            "Su",
            "Mo",
            "Tu",
            "We",
            "Th",
            "Fr",
            "Sa"
        ];

        const selectedDay =
            dayMap[selectedDate.day()];

        if (
            !preference.activeDays.includes(
                selectedDay
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Preference not available on ${selectedDay}`
            });
        }

        /* ================= TIME VALIDATION ================= */

        const selectedTime = moment(
            time,
            [
                "hh:mm A",
                "h:mm A",
                "HH:mm"
            ],
            true
        );

        if (!selectedTime.isValid()) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid time format"
            });
        }

        // STORE IN 24 HOUR FORMAT
        const formattedTime =
            selectedTime.format("HH:mm");

        const firstBookingTime = moment(
            preference.firstBookingTime,
            ["hh:mm A", "HH:mm"]
        );

        const lastBookingTime = moment(
            preference.lastBookingTime,
            ["hh:mm A", "HH:mm"]
        );

        const selectedMinutes =
            selectedTime.hours() * 60 +
            selectedTime.minutes();

        const firstMinutes =
            firstBookingTime.hours() * 60 +
            firstBookingTime.minutes();

        const lastMinutes =
            lastBookingTime.hours() * 60 +
            lastBookingTime.minutes();

        /* ================= TIME RANGE CHECK ================= */

        if (
            selectedMinutes < firstMinutes ||
            selectedMinutes > lastMinutes
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Preference available only between ${preference.firstBookingTime} and ${preference.lastBookingTime}`
            });
        }

        /* ================= FETCH TABLES ================= */

        const allTables = await Table.find({
            _id: {
                $in: preference.tableIds
            },
            status: {
                $ne: "OutOfService"
            },
            capacity: {
                $gte: Number(partySize)
            }
        })
            .select("_id tableNumber capacity displayName shape status joinedWith roomId")
            .populate("roomId", "name")
            .lean();

        if (!allTables.length) {
            return res.status(200).json({
                success: true,
                message: "No active tables available for this preference or party size",
                selectedDate: formattedDate,
                selectedTime: formattedTime,
                requestedPartySize: Number(partySize),
                totalTables: 0,
                bookedTables: 0,
                availableCount: 0,
                data: []
            });
        }

        /* ================= TIMEZONE & DAY RANGE ================= */

        const restaurant = await Restaurant.findById(preference.restaurantId).select("timezone").lean();
        const timezone = restaurant?.timezone || DEFAULT_TIMEZONE;

        const tzStart = selectedDate.clone().tz(timezone).startOf("day").toDate();
        const tzEnd = selectedDate.clone().tz(timezone).endOf("day").toDate();
        const utcStart = moment.utc(formattedDate).startOf("day").toDate();
        const utcEnd = moment.utc(formattedDate).endOf("day").toDate();

        const startOfDay = new Date(Math.min(tzStart.getTime(), utcStart.getTime()));
        const endOfDay = new Date(Math.max(tzEnd.getTime(), utcEnd.getTime()));

        /* ================= DURATION OVERLAP CALCULATION ================= */

        const [reqH, reqM] = formattedTime.split(":").map(Number);
        const reqStartMin = reqH * 60 + reqM;

        // Fetch active shifts for this day to find duration
        const shortDayShift = selectedDate.format("ddd");
        const dayMapShift = { Mon: "Mo", Tue: "Tu", Wed: "We", Thu: "Th", Fri: "Fr", Sat: "Sa", Sun: "Su" };
        const weekdayNameShift = dayMapShift[shortDayShift] || shortDayShift;

        const shifts = await Shift.find({
            restaurantId: preference.restaurantId,
            isActive: true,
            $or: [
                { type: "Recurring", daysActive: { $in: [weekdayNameShift] } },
                { type: "Special", startDate: { $lte: endOfDay }, endDate: { $gte: startOfDay } }
            ]
        }).lean();

        const toMinutes = t => {
            if (!t) return 0;
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
        };

        let matchedShift = shifts.find(s => {
            const start = toMinutes(s.startTime);
            const end = toMinutes(s.endTime);
            if (end < start) {
                return reqStartMin >= start || reqStartMin < end;
            }
            return reqStartMin >= start && reqStartMin < end;
        });

        let requestedDuration = 120; // default 2 hours
        if (matchedShift) {
            if (matchedShift.sameDurationForAll && matchedShift.duration) {
                requestedDuration = matchedShift.duration;
            } else if (!matchedShift.sameDurationForAll && matchedShift.durationByPartySize?.length) {
                const rule = matchedShift.durationByPartySize.find(tier => {
                    const [min, max] = tier.range.split("-").map(Number);
                    return Number(partySize) >= min && Number(partySize) <= max;
                });
                if (rule?.duration) requestedDuration = rule.duration;
                else if (matchedShift.duration) requestedDuration = matchedShift.duration;
            }
        }
        const reqEndMin = reqStartMin + requestedDuration;

        /* ================= COLLECT AFFECTED TABLE IDS ================= */

        const allTableIdsToCheck = new Set();
        allTables.forEach(t => {
            allTableIdsToCheck.add(t._id.toString());
            if (Array.isArray(t.joinedWith)) {
                t.joinedWith.forEach(jw => allTableIdsToCheck.add(jw.toString()));
            }
        });

        /* ================= FIND BOOKED & BLOCKED TABLES ================= */

        const bookedReservations = await Reservation.find({
            restaurantId: preference.restaurantId,
            tableIds: { $in: Array.from(allTableIdsToCheck) },
            date: { $gte: startOfDay, $lte: endOfDay },
            status: {
                $nin: [
                    "Cancelled",
                    "Finished",
                    "No-Show"
                ]
            }
        })
            .populate("shiftId", "duration sameDurationForAll durationByPartySize")
            .select("tableIds time partySize shiftId")
            .lean();

        const bookedTableIds = new Set();

        for (const resv of bookedReservations) {
            const resvTime24 = convertTo24Hour(resv.time);
            if (!resvTime24 || !resvTime24.includes(":")) continue;

            const [bH, bM] = resvTime24.split(":").map(Number);
            const bStartMin = bH * 60 + bM;

            let bDuration = 120;
            if (resv.shiftId) {
                if (resv.shiftId.sameDurationForAll && resv.shiftId.duration) {
                    bDuration = resv.shiftId.duration;
                } else if (!resv.shiftId.sameDurationForAll && resv.shiftId.durationByPartySize?.length) {
                    const rule = resv.shiftId.durationByPartySize.find(tier => {
                        const [min, max] = tier.range.split("-").map(Number);
                        return (resv.partySize || 1) >= min && (resv.partySize || 1) <= max;
                    });
                    if (rule?.duration) bDuration = rule.duration;
                    else if (resv.shiftId.duration) bDuration = resv.shiftId.duration;
                }
            }
            const bEndMin = bStartMin + bDuration;

            // Overlap condition: reqStartMin < bEndMin && bStartMin < reqEndMin
            if (reqStartMin < bEndMin && bStartMin < reqEndMin) {
                if (Array.isArray(resv.tableIds)) {
                    resv.tableIds.forEach(tId => bookedTableIds.add(tId.toString()));
                }
            }
        }

        // Active temporary holds
        const activeHolds = await ReservationHold.find({
            restaurantId: preference.restaurantId,
            tableIds: { $in: Array.from(allTableIdsToCheck) },
            date: formattedDate,
            time: formattedTime,
            expiresAt: { $gt: new Date() }
        }).select("tableIds").lean();

        activeHolds.forEach(h => {
            if (Array.isArray(h.tableIds)) {
                h.tableIds.forEach(tId => bookedTableIds.add(tId.toString()));
            }
        });

        // Table blocks
        const blocks = await Block.find({
            restaurantId: preference.restaurantId,
            status: "Active",
            isExpired: false,
            startDate: { $lte: endOfDay },
            endDate: { $gte: startOfDay }
        }).lean();

        for (const block of blocks) {
            if (block.isFullRestaurantBlock) {
                if (block.startTime && block.endTime) {
                    const bStart = toMinutes(convertTo24Hour(block.startTime));
                    const bEnd = toMinutes(convertTo24Hour(block.endTime));
                    if (reqStartMin < bEnd && bStart < reqEndMin) {
                        allTables.forEach(t => bookedTableIds.add(t._id.toString()));
                    }
                } else {
                    allTables.forEach(t => bookedTableIds.add(t._id.toString()));
                }
            } else if (Array.isArray(block.tableIds) && block.tableIds.length) {
                if (block.startTime && block.endTime) {
                    const bStart = toMinutes(convertTo24Hour(block.startTime));
                    const bEnd = toMinutes(convertTo24Hour(block.endTime));
                    if (reqStartMin < bEnd && bStart < reqEndMin) {
                        block.tableIds.forEach(id => bookedTableIds.add(id.toString()));
                    }
                } else {
                    block.tableIds.forEach(id => bookedTableIds.add(id.toString()));
                }
            }
        }

        /* ================= FILTER AVAILABLE TABLES ================= */

        const availableTables = allTables.filter(table => {
            const tableIdStr = table._id.toString();
            // 1. Table itself is booked or blocked
            if (bookedTableIds.has(tableIdStr)) return false;

            // 2. Any merged/joined table is booked or blocked
            if (Array.isArray(table.joinedWith) && table.joinedWith.length) {
                const isAnyJoinedBooked = table.joinedWith.some(jwId =>
                    bookedTableIds.has(jwId.toString())
                );
                if (isAnyJoinedBooked) return false;
            }

            return true;
        });

        /* ================= RESPONSE ================= */

        const formattedAvailableTables = availableTables.map(table => ({
            _id: table._id,
            tableNumber: table.tableNumber,
            displayName: table.displayName,
            capacity: table.capacity,
            shape: table.shape,
            status: table.status,
            roomId: table.roomId?._id || table.roomId || null,
            roomName: table.roomId?.name || null
        }));

        return res.status(200).json({
            success: true,
            message: "Available tables fetched successfully",
            selectedDate: formattedDate,
            selectedTime: formattedTime,
            requestedPartySize: Number(partySize),
            totalTables: allTables.length,
            bookedTables: bookedTableIds.size,
            availableCount: formattedAvailableTables.length,
            data: formattedAvailableTables
        });

    } catch (error) {

        console.error("getAvailableTablesByPreference error:", error);

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Internal server error"
        });
    }
};

exports.getSeatingPreferences = async (req, res) => {
    try {

        const { restaurantId } = req.params;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required."
            });
        }

        const preferences = await SeatingPreference.find({
            restaurantId,
            status: "Active"
        })
            .select("_id preferenceName")
            .sort({ preferenceName: 1 });

        return res.status(200).json({
            success: true,
            message: "Seating preferences fetched successfully.",
            data: preferences.map(item => ({
                id: item._id,
                preferenceName: item.preferenceName
            }))
        });

    } catch (error) {
        console.error("Error fetching seating preferences:", error);

        return res.status(500).json({
            success: false,
            message: "Error fetching seating preferences.",
            error: error.message
        });
    }
};
