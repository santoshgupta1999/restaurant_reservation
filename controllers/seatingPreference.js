const SeatingPreference = require("../models/SeatingPreference");
const StaffAccount = require("../models/staffAccount");
const Room = require('../models/room.model');
const bcrypt = require("bcrypt");
const moment = require("moment");
const {
    formatDate,
    formatTime
} = require("../utils/dateFormatter");

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
            id, // optional
            preferenceName,
            restaurantId,
            startDate,
            endDate,
            activeDays,
            firstBookingTime,
            lastBookingTime,
            tableAssignment,
            status,
            indefinite // new boolean flag
        } = req.body || {};

        /* ================= BASIC VALIDATION ================= */
        if (
            !preferenceName ||
            !restaurantId ||
            !startDate ||
            (!indefinite && !endDate) || // only require endDate if NOT indefinite
            !activeDays ||
            !firstBookingTime ||
            !lastBookingTime ||
            !tableAssignment
        ) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be provided"
            });
        }

        if (!Array.isArray(activeDays) || activeDays.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one active day"
            });
        }

        if (!Array.isArray(tableAssignment) || tableAssignment.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one table assignment"
            });
        }

        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be greater than end date"
            });
        }

        if (!indefinite && !endDate) {
            return res.status(400).json({
                success: false,
                message: "End date is required for non-indefinite shifts"
            });
        }

        if (indefinite && endDate) {
            return res.status(400).json({
                success: false,
                message: "please select one End date or non-indefinite shifts"
            });
        }

        const duplicateQuery = {
            restaurantId,
            preferenceName: preferenceName.trim()
        };

        if (id) {
            duplicateQuery._id = { $ne: id };
        }

        const existing = await SeatingPreference.findOne(duplicateQuery);

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Preference name already exists."
            });
        }

        /* ================= UPDATE (ID EXISTS) ================= */
        if (id) {
            const existingPreference = await SeatingPreference.findById(id);

            if (!existingPreference) {
                return res.status(404).json({
                    success: false,
                    message: "Seating preference not found"
                });
            }

            existingPreference.preferenceName = preferenceName.trim();
            existingPreference.restaurantId = restaurantId;
            existingPreference.startDate = startDate;
            existingPreference.endDate = indefinite ? null : endDate; // null for indefinite
            existingPreference.indefinite = indefinite ? true : false; // null for indefinite
            existingPreference.activeDays = activeDays;
            existingPreference.firstBookingTime = firstBookingTime;
            existingPreference.lastBookingTime = lastBookingTime;
            existingPreference.tableAssignment = tableAssignment;
            existingPreference.status = status || existingPreference.status;

            await existingPreference.save();

            return res.status(200).json({
                success: true,
                message: "Seating preference updated successfully",
                data: existingPreference
            });
        }

        /* ================= CREATE (NO ID) ================= */
        const newPreference = await SeatingPreference.create({
            preferenceName: preferenceName.trim(),
            restaurantId,
            startDate,
            endDate: indefinite ? null : endDate, // null if indefinite
            indefinite: indefinite ? true : false,
            activeDays,
            firstBookingTime,
            lastBookingTime,
            tableAssignment,
            status
        });

        return res.status(201).json({
            success: true,
            message: "Seating preference added successfully",
            data: newPreference
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

exports.deleteSeatingPreference = async (req, res) => {
    try {
        const { id } = req.body || {}; // ya req.params.id

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
        await SeatingPreference.deleteOne({ _id: id });

        return res.status(200).json({
            success: true,
            message: "Seating preference deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
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
        const preferences = await SeatingPreference.find({
            restaurantId
        })
            .sort({ createdAt: 1 })
            .select("-createdAt -updatedAt -__v");

        /* ================= FORMAT RESPONSE ================= */
        const formattedPrefences = preferences.map((p) => ({
            _id: p._id,
            preferenceName: p.preferenceName,

            startDate: formatDate(p.startDate),
            endDate: p.indefinite ? null : formatDate(p.endDate),

            indefinite: p.indefinite,
            activeDays: p.activeDays,

            firstBookingTime: formatTime(p.firstBookingTime),
            lastBookingTime: formatTime(p.lastBookingTime),

            tableAssignment: p.tableAssignment,
            status: p.status,
            restaurantId: p.restaurantId
        }));

        /* ================= RESPONSE ================= */
        return res.status(200).json({
            success: true,
            message: "Seating preferences fetched successfully",
            count: formattedPrefences.length,
            data: formattedPrefences
        });

    } catch (error) {
        console.error("getAllPreference error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
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
