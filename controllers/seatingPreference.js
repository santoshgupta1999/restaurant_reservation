const SeatingPreference = require("../models/SeatingPreference");
const StaffAccount = require("../models/staffAccount");
const Room = require('../models/room.model');
const bcrypt = require("bcrypt");

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
        const preferences = await SeatingPreference.find()
            .sort({ createdAt: 1 })
            .select("-createdAt -updatedAt -__v")

        const formattedPrefences = preferences.map((p) => ({
            _id: p._id,
            preferenceName: p.preferenceName,
            startDate: p.startDate
                ? p.startDate.toISOString().split("T")[0]
                : null,
            endDate: p.endDate
                ? p.endDate.toISOString().split("T")[0]
                : null,
            indefinite: p.indefinite,
            activeDays: p.activeDays,
            firstBookingTime: p.firstBookingTime,
            lastBookingTime: p.lastBookingTime,
            tableAssignment: p.tableAssignment,
            status: p.status
        }));

        return res.status(200).json({
            success: true,
            message: "Seating preferences fetched successfully",
            count: formattedPrefences.length,
            data: formattedPrefences,

        });

    } catch (error) {
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
