const Reservation = require('../models/reservation.model');
const Shift = require('../models/shift.model');
const Table = require('../models/table.model');
const User = require('../models/user.model');
const Guest = require('../models/guest.model');
const Block = require('../models/block.model');
const Restaurant = require('../models/Restaurant.model');
const mongoose = require('mongoose');
// const sendSMS = require('../utils/sendSMS'); // <-- optional SMS helper
const sendEmail = require('../utils/mailer'); // <-- optional Email helper

// const getDayOfWeek = (dateString) => {
//     const date = new Date(dateString);
//     const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
//     return days[date.getDay()];
// };

exports.createReservation = async (req, res) => {
    try {
        const {
            reservationId,
            restaurantId,
            tableId,

            firstName,
            lastName,
            guestEmail,
            guestPhone,
            gender,
            dob,

            date,
            time,
            partySize,
            source,
            status,
            seating,
            tags,
            notes
        } = req.body;

        if (!restaurantId || !date || !time) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, date & time are required."
            });
        }

        const reservationDate = new Date(date);

        let existingReservation = null;

        if (reservationId) {
            existingReservation = await Reservation.findById(reservationId);
            if (!existingReservation) {
                return res.status(404).json({
                    success: false,
                    message: "Reservation not found."
                });
            }
        }

        const shortDay = reservationDate.toLocaleDateString("en-US", {
            weekday: "short"
        });

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

        const allShifts = await Shift.find({
            restaurantId,
            isActive: true,
            $or: [
                { type: "Recurring", daysActive: { $in: [weekdayName] } },
                {
                    type: "Special",
                    startDate: { $lte: reservationDate },
                    endDate: { $gte: reservationDate }
                }
            ]
        });

        if (!allShifts.length) {
            return res.status(400).json({
                success: false,
                message: "No shifts available for this day."
            });
        }

        const [hh, mm] = time.split(":").map(Number);
        const reservationMinutes = hh * 60 + mm;

        const convertToMinutes = t => {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
        };

        let shift = allShifts.find(s => {
            const start = convertToMinutes(s.startTime);
            const end = convertToMinutes(s.endTime);
            return reservationMinutes >= start && reservationMinutes < end;
        });

        if (!shift) {
            return res.status(400).json({
                success: false,
                message: "Reservation time is outside all shift timings."
            });
        }

        let guest = null;

        if (guestPhone) {
            guest = await Guest.findOne({ restaurantId, phone: guestPhone });
        }

        if (!guest && guestEmail) {
            guest = await Guest.findOne({
                restaurantId,
                email: guestEmail.toLowerCase()
            });
        }

        if (guest) {
            guest.firstName = firstName || guest.firstName;
            guest.lastName = lastName || guest.lastName;
            guest.phone = guestPhone || guest.phone;
            guest.email = guestEmail || guest.email;
            guest.gender = gender || guest.gender;
            guest.dob = dob || guest.dob;

            await guest.save();
        } else {
            guest = await Guest.create({
                restaurantId,
                firstName,
                lastName,
                phone: guestPhone,
                email: guestEmail,
                gender,
                dob,
                tags,
                notes
            });
        }

        let reservation;

        if (existingReservation) {
            // UPDATE
            existingReservation.tableId = tableId || existingReservation.tableId;
            existingReservation.shiftId = shift._id;
            existingReservation.date = reservationDate;
            existingReservation.time = time;
            existingReservation.partySize = partySize;
            existingReservation.source = source;
            existingReservation.status = status;
            existingReservation.seating = seating;
            existingReservation.tags = tags;
            existingReservation.notes = notes;

            reservation = await existingReservation.save();

        } else {
            // CREATE
            reservation = await Reservation.create({
                restaurantId,
                guestId: guest._id,
                tableId,
                shiftId: shift._id,
                date: reservationDate,
                time,
                partySize,
                source,
                status,
                seating,
                tags,
                notes
            });
        }

        return res.status(200).json({
            success: true,
            message: reservationId
                ? "Reservation updated successfully."
                : "Reservation created successfully.",
            data: reservation
        });

    } catch (error) {
        console.error("Error saving reservation:", error);
        return res.status(500).json({
            success: false,
            message: "Error saving reservation.",
            error: error.message
        });
    }
};

exports.getReservations = async (req, res) => {
    try {
        const {
            restaurantId,
            date,
            status,
            source,
            roomId   // NEW FILTER
        } = req.body;

        /* ===============================
           VALIDATE RESTAURANT
        =============================== */
        if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({
                success: false,
                message: "Valid restaurantId is required"
            });
        }

        const query = {
            restaurantId: new mongoose.Types.ObjectId(restaurantId)
        };

        /* ---------------- DATE FILTER ---------------- */
        if (date) {
            const d = new Date(date);

            const start = new Date(d);
            start.setHours(0, 0, 0, 0);

            const end = new Date(d);
            end.setHours(23, 59, 59, 999);

            query.date = { $gte: start, $lte: end };
        }

        /* ---------------- STATUS FILTER ---------------- */
        if (status) {
            query.status = status;
        }

        /* ---------------- SOURCE FILTER ---------------- */
        if (source) {
            query.source = source;
        }

        /* ---------------- ROOM FILTER ---------------- */
        if (roomId) {
            if (!mongoose.Types.ObjectId.isValid(roomId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid roomId"
                });
            }

            // Get tables of that room
            const tables = await Table.find({
                restaurantId,
                roomId
            }).select("_id");

            const tableIds = tables.map(t => t._id);

            query.tableId = { $in: tableIds };
        }

        /* ===============================
           FETCH RESERVATIONS
        =============================== */
        const reservationsRaw = await Reservation.find(query)
            .populate({
                path: "guestId",
                select: `
                    firstName
                    lastName
                    gender
                    dob
                    email
                    phone
                    tags
                    notes
                    totalVisits
                    lastVisitAt
                    upcomingVisitAt
                    isActive
                `
            })
            .populate({
                path: "tableId",
                select: "tableNumber roomId capacity",
                populate: {
                    path: "roomId",
                    select: "name"
                }
            })
            .populate({
                path: "shiftId",
                select: "name startTime endTime type"
            })
            .sort({ date: 1, time: 1 });

        /* ===============================
           DATE FORMAT HELPER
        =============================== */
        const trimDate = (val) =>
            val ? new Date(val).toISOString().split("T")[0] : null;

        const reservations = reservationsRaw.map(r => {
            const obj = r.toObject();

            /* Reservation dates */
            obj.date = trimDate(obj.date);
            obj.createdAt = trimDate(obj.createdAt);
            obj.updatedAt = trimDate(obj.updatedAt);

            /* Guest dates */
            if (obj.guestId) {
                obj.guestId.dob = trimDate(obj.guestId.dob);
                obj.guestId.lastVisitAt = trimDate(obj.guestId.lastVisitAt);
                obj.guestId.upcomingVisitAt = trimDate(obj.guestId.upcomingVisitAt);
            }

            /* ✅ Convert roomId.name → roomName */
            if (obj.tableId?.roomId) {
                obj.tableId.roomName = obj.tableId.roomId.name;
                delete obj.tableId.roomId;
            }

            return obj;
        });

        return res.status(200).json({
            success: true,
            message: "Reservations fetched successfully",
            total: reservations.length,
            data: reservations
        });

    } catch (error) {
        console.error("Error fetching reservations:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching reservations",
            error: error.message
        });
    }
};

exports.getReservationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Reservation ID is required."
            });
        }

        const reservation = await Reservation.findById(id)
            .populate("restaurantId", "name email phone address")
            .populate("tableId", "tableNumber roomName capacity")
            .populate("shiftId", "name startTime endTime type");

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Reservation details fetched successfully.",
            data: reservation
        });

    } catch (error) {
        console.error("Error fetching reservation by ID:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching reservation.",
            error: error.message
        });
    }
};

exports.updateReservationById = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Reservation ID is required."
            });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found."
            });
        }

        /* ================= GUEST HANDLING ================= */
        let guest = await Guest.findById(reservation.guestId);

        const guestPayload = {
            restaurantId: reservation.restaurantId,
            firstName: updateData.firstName,
            lastName: updateData.lastName,
            gender: updateData.gender,
            dob: updateData.dob,
            email: updateData.email,
            phone: updateData.phone,
            notes: updateData.notes,
            tags: updateData.tags
        };

        const isGuestChanged =
            (updateData.phone && updateData.phone !== guest.phone) ||
            (updateData.email && updateData.email !== guest.email);

        if (isGuestChanged) {
            guest = await Guest.create(guestPayload);
            updateData.guestId = guest._id;
        } else {
            await Guest.findByIdAndUpdate(
                guest._id,
                guestPayload,
                { runValidators: true }
            );
        }

        /* ================= SHIFT LOGIC (SAME AS CREATE) ================= */
        const finalDate = updateData.date
            ? new Date(updateData.date)
            : reservation.date;

        const finalTime = updateData.time || reservation.time;

        if (updateData.date || updateData.time) {
            const daysMap = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
            const weekdayName = daysMap[finalDate.getDay()];

            const shifts = await Shift.find({
                restaurantId: reservation.restaurantId,
                isActive: true,
                $or: [
                    { type: "Recurring", daysActive: { $in: [weekdayName] } },
                    { type: "Special", startDate: { $lte: finalDate }, endDate: { $gte: finalDate } }
                ]
            });

            const toMinutes = t => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
            };

            const resMin = toMinutes(finalTime);

            const matchedShift = shifts.find(s => {
                return resMin >= toMinutes(s.startTime) &&
                    resMin < toMinutes(s.endTime);
            });

            if (!matchedShift) {
                return res.status(400).json({
                    success: false,
                    message: "Reservation time does not match any shift."
                });
            }

            updateData.shiftId = matchedShift._id;
            updateData.date = finalDate;
            updateData.time = finalTime;
        }

        /* ================= TABLE AVAILABILITY ================= */
        if (updateData.tableId || updateData.date || updateData.time) {
            const clash = await Reservation.findOne({
                _id: { $ne: id },
                restaurantId: reservation.restaurantId,
                tableId: updateData.tableId || reservation.tableId,
                date: finalDate,
                time: finalTime,
                status: { $nin: ["Canceled", "No-show"] }
            });

            if (clash) {
                return res.status(400).json({
                    success: false,
                    message: "Table already reserved for this time."
                });
            }
        }

        /* ================= UPDATE RESERVATION ================= */
        const updatedReservation = await Reservation.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        const populatedReservation = await Reservation.findById(updatedReservation._id)
            .populate("restaurantId", "name phone")
            .populate("tableId", "tableNumber roomName capacity")
            .populate("shiftId", "name startTime endTime type");

        return res.status(200).json({
            success: true,
            message: "Reservation updated successfully.",
            assignedShift: populatedReservation.shiftId?.name,
            data: {
                reservation: populatedReservation,
                guest
            }
        });

    } catch (error) {
        console.error("Update reservation error:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating reservation.",
            error: error.message
        });
    }
};

exports.updateReservationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["Pending", "Confirmed", "Seated", "Canceled", "No-show", "Finished"];

        if (!id || id.length !== 24) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reservation ID',
            });
        }

        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values are: ${allowedStatuses.join(', ')}`,
            });
        }

        const updated = await Reservation.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Reservation not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: `Reservation status updated to ${status} successfully`,
            data: updated,
        });

    } catch (error) {
        console.error('Error updating reservation status:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

exports.deleteReservationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Reservation ID is required."
            });
        }

        const deletedReservation = await Reservation.findByIdAndDelete(id);

        if (!deletedReservation) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found or already deleted."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reservation deleted successfully."
        });

    } catch (error) {
        console.error("Error deleting reservation:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting reservation.",
            error: error.message
        });
    }
};

// exports.dashboardSummary = async (req, res) => {
//     try {
//         const [stats, newVenues] = await Promise.all([
//             Restaurant.aggregate([
//                 {
//                     $group: {
//                         _id: null,
//                         total: { $sum: 1 },
//                         active: {
//                             $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
//                         },
//                         inactive: {
//                             $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] }
//                         }
//                     }
//                 }
//             ]),
//             Restaurant.countDocuments({
//                 createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
//             })
//         ]);

//         return res.json({
//             success: true,
//             data: {
//                 totalVenues: stats[0]?.total || 0,
//                 activeVenues: stats[0]?.active || 0,
//                 inactiveVenues: stats[0]?.inactive || 0,
//                 newVenuesLast30Days: newVenues
//             }
//         });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };

// exports.getMonthlyGraph = async (req, res) => {
//     try {
//         const user = req.user;
//         const { restaurantId, startDate, endDate } = req.body;

//         let matchQuery = {};

//         /* ================= ADMIN ================= */
//         if (user.role === "admin") {

//             if (restaurantId) {
//                 if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
//                     return res.status(400).json({
//                         success: false,
//                         message: "Invalid restaurantId"
//                     });
//                 }
//                 matchQuery.restaurantId = new mongoose.Types.ObjectId(restaurantId);
//             }

//         }
//         /* ================= RESTAURANT USER ================= */
//         else {
//             if (!user.restaurantId) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Restaurant not linked with this user"
//                 });
//             }
//             matchQuery.restaurantId = new mongoose.Types.ObjectId(user.restaurantId);
//         }

//         /* ================= DATE FILTER ================= */
//         if (startDate || endDate) {
//             matchQuery.createdAt = {};

//             if (startDate) {
//                 matchQuery.createdAt.$gte = new Date(startDate);
//             }

//             if (endDate) {
//                 const end = new Date(endDate);
//                 end.setHours(23, 59, 59, 999); // poora din cover
//                 matchQuery.createdAt.$lte = end;
//             }
//         }

//         const data = await Reservation.aggregate([
//             { $match: matchQuery },
//             {
//                 $group: {
//                     _id: { $month: "$createdAt" },

//                     confirmed: {
//                         $sum: {
//                             $cond: [{ $eq: ["$status", "Confirmed"] }, 1, 0]
//                         }
//                     },

//                     cancelled: {
//                         $sum: {
//                             $cond: [{ $eq: ["$status", "Canceled"] }, 1, 0]
//                         }
//                     },

//                     revenue: {
//                         $sum: {
//                             $cond: [{ $eq: ["$status", "Confirmed"] }, "$totalAmount", 0]
//                         }
//                     }
//                 }
//             },
//             { $sort: { "_id": 1 } }
//         ]);

//         const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

//         const formatted = months.map((month, index) => {
//             const found = data.find(d => d._id === index + 1);
//             return {
//                 month,
//                 confirmed: found?.confirmed || 0,
//                 cancelled: found?.cancelled || 0,
//                 revenue: found?.revenue || 0
//             };
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Monthly reservation performance fetched successfully",
//             data: formatted
//         });

//     } catch (error) {
//         console.error("Monthly performance API error:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Error fetching monthly performance",
//             error: error.message
//         });
//     }
// };

// exports.getReservationList = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 10,
//             search,
//             restaurantId,
//             status,
//             source,
//             seating,
//             shiftId,
//             fromDate,
//             toDate,
//             partySize
//         } = req.body;

//         const skip = (page - 1) * limit;

//         let filter = {};

//         // 🔹 Filters
//         if (restaurantId && mongoose.Types.ObjectId.isValid(restaurantId)) {
//             filter.restaurantId = restaurantId;
//         }

//         if (status) {
//             filter.status = status;
//         }

//         if (source) {
//             filter.source = source;
//         }

//         if (seating) {
//             filter.seating = seating;
//         }

//         if (shiftId && mongoose.Types.ObjectId.isValid(shiftId)) {
//             filter.shiftId = shiftId;
//         }

//         if (partySize) {
//             filter.partySize = partySize;
//         }

//         // 🔹 Date Range Filter
//         if (fromDate || toDate) {
//             filter.date = {};
//             if (fromDate) filter.date.$gte = new Date(fromDate);
//             if (toDate) filter.date.$lte = new Date(toDate);
//         }

//         // 🔹 Global Search
//         if (search) {
//             filter.$or = [
//                 { firstName: { $regex: search, $options: "i" } },
//                 { lastName: { $regex: search, $options: "i" } },
//                 { guestEmail: { $regex: search, $options: "i" } },
//                 { guestPhone: { $regex: search, $options: "i" } },
//                 { notes: { $regex: search, $options: "i" } },
//                 { tags: { $in: [new RegExp(search, "i")] } }
//             ];
//         }

//         const [reservations, total] = await Promise.all([
//             Reservation.find(filter)
//                 .populate("restaurantId", "name email phone")
//                 .populate("tableId", "tableNumber")
//                 .populate("shiftId", "name startTime endTime")
//                 .sort({ createdAt: -1 })
//                 .skip(skip)
//                 .limit(parseInt(limit)),

//             Reservation.countDocuments(filter)
//         ]);

//         return res.status(200).json({
//             success: true,
//             message: "Reservation list fetched successfully",
//             data: reservations,
//             pagination: {
//                 totalRecords: total,
//                 currentPage: parseInt(page),
//                 totalPages: Math.ceil(total / limit),
//                 limit: parseInt(limit)
//             }
//         });

//     } catch (error) {
//         console.error("Admin reservation list error:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to fetch reservations",
//             error: error.message
//         });
//     }
// };

// exports.bookingStats = async (req, res) => {
//     try {
//         const now = new Date();

//         const startOfToday = new Date(now.setHours(0, 0, 0, 0));
//         const startOfWeek = new Date();
//         startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
//         startOfWeek.setHours(0, 0, 0, 0);

//         const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
//         const startOfYear = new Date(new Date().getFullYear(), 0, 1);

//         const [today, wtd, mtd, ytd] = await Promise.all([
//             Reservation.countDocuments({ createdAt: { $gte: startOfToday } }),
//             Reservation.countDocuments({ createdAt: { $gte: startOfWeek } }),
//             Reservation.countDocuments({ createdAt: { $gte: startOfMonth } }),
//             Reservation.countDocuments({ createdAt: { $gte: startOfYear } })
//         ]);

//         res.json({
//             success: true,
//             data: {
//                 today,
//                 weekToDate: wtd,
//                 monthToDate: mtd,
//                 yearToDate: ytd
//             }
//         });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };

// exports.bookingTrend24h = async (req, res) => {
//     try {
//         const start = new Date();
//         start.setHours(start.getHours() - 24);

//         const trend = await Reservation.aggregate([
//             { $match: { createdAt: { $gte: start } } },
//             {
//                 $group: {
//                     _id: { hour: { $hour: "$createdAt" } },
//                     count: { $sum: 1 }
//                 }
//             },
//             { $sort: { "_id.hour": 1 } }
//         ]);

//         res.json({
//             success: true,
//             data: trend.map(t => ({
//                 hour: `${t._id.hour}:00`,
//                 count: t.count
//             }))
//         });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };

// exports.mostActiveVenues = async (req, res) => {
//     try {
//         const data = await Reservation.aggregate([
//             {
//                 $group: {
//                     _id: "$restaurantId",
//                     totalBookings: { $sum: 1 }
//                 }
//             },
//             { $sort: { totalBookings: -1 } },
//             { $limit: 5 },
//             {
//                 $lookup: {
//                     from: "restaurants",
//                     localField: "_id",
//                     foreignField: "_id",
//                     as: "restaurant"
//                 }
//             },
//             { $unwind: "$restaurant" }
//         ]);

//         res.json({
//             success: true,
//             data: data.map(d => ({
//                 restaurantName: d.restaurant.name,
//                 totalBookings: d.totalBookings
//             }))
//         });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };

// exports.getRemiUsers = async (req, res) => {
//     try {
//         const { range = "12m" } = req.query;

//         /* ================= DATE RANGE ================= */
//         const now = new Date();
//         let startDate = new Date();

//         switch (range) {
//             case "24h": startDate.setHours(now.getHours() - 24); break;
//             case "7d": startDate.setDate(now.getDate() - 7); break;
//             case "30d": startDate.setDate(now.getDate() - 30); break;
//             case "3m": startDate.setMonth(now.getMonth() - 3); break;
//             default: startDate.setMonth(now.getMonth() - 12);
//         }

//         const REMI_REGEX = /(Remi user|Remi influencer)/i;

//         /* ================= TOTAL REMI USERS ================= */
//         const totalRemiUsersPromise = Guest.countDocuments({
//             tags: { $elemMatch: { $regex: REMI_REGEX } }
//         });

//         /* ================= NEW REMI USERS ================= */
//         const newRemiUsersPromise = Guest.countDocuments({
//             tags: { $elemMatch: { $regex: REMI_REGEX } },
//             createdAt: { $gte: startDate }
//         });

//         /* ================= MOST ACTIVE VENUES ================= */
//         const mostActiveVenuesPromise = Reservation.aggregate([
//             {
//                 $match: {
//                     createdAt: { $gte: startDate }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "guests",
//                     localField: "guestId",
//                     foreignField: "_id",
//                     as: "guest"
//                 }
//             },
//             { $unwind: "$guest" },
//             {
//                 $match: {
//                     "guest.tags": { $elemMatch: { $regex: REMI_REGEX } }
//                 }
//             },
//             {
//                 $group: {
//                     _id: {
//                         restaurantId: "$restaurantId",
//                         guestId: "$guestId"
//                     }
//                 }
//             },
//             {
//                 $group: {
//                     _id: "$_id.restaurantId",
//                     remiUsers: { $sum: 1 }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "restaurants",
//                     localField: "_id",
//                     foreignField: "_id",
//                     as: "restaurant"
//                 }
//             },
//             { $unwind: "$restaurant" },
//             {
//                 $project: {
//                     restaurantId: "$_id",
//                     restaurantName: "$restaurant.name",
//                     remiUsers: 1,
//                     _id: 0
//                 }
//             },
//             { $sort: { remiUsers: -1 } },
//             { $limit: 5 }
//         ]);

//         /* ================= TREND ================= */
//         const trendPromise = Guest.aggregate([
//             {
//                 $match: {
//                     tags: { $elemMatch: { $regex: REMI_REGEX } },
//                     createdAt: { $gte: startDate }
//                 }
//             },
//             {
//                 $group: {
//                     _id: {
//                         month: { $month: "$createdAt" },
//                         year: { $year: "$createdAt" }
//                     },
//                     count: { $sum: 1 }
//                 }
//             },
//             { $sort: { "_id.year": 1, "_id.month": 1 } }
//         ]);

//         const [
//             totalRemiUsers,
//             newRemiUsers,
//             mostActiveVenues,
//             trendRaw
//         ] = await Promise.all([
//             totalRemiUsersPromise,
//             newRemiUsersPromise,
//             mostActiveVenuesPromise,
//             trendPromise
//         ]);

//         return res.json({
//             success: true,
//             data: {
//                 summary: {
//                     totalRemiUsers,
//                     newRemiUsers,
//                     growthPercent: totalRemiUsers
//                         ? Math.round((newRemiUsers / totalRemiUsers) * 100)
//                         : 0
//                 },
//                 mostActiveVenues,
//                 trend: trendRaw.map(t => ({
//                     label: `${t._id.month}/${t._id.year}`,
//                     count: t.count
//                 }))
//             }
//         });

//     } catch (error) {
//         console.error("Remi Dashboard Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to load Remi dashboard",
//             error: error.message
//         });
//     }
// };

// exports.getNoShowRiskVenues = async (req, res) => {
//     try {
//         const { range = "12m" } = req.query;

//         /* ================= DATE RANGE ================= */
//         const now = new Date();
//         let startDate = new Date();

//         switch (range) {
//             case "24h": startDate.setHours(now.getHours() - 24); break;
//             case "7d": startDate.setDate(now.getDate() - 7); break;
//             case "30d": startDate.setDate(now.getDate() - 30); break;
//             case "3m": startDate.setMonth(now.getMonth() - 3); break;
//             default: startDate.setMonth(now.getMonth() - 12);
//         }

//         /* ================= AGGREGATION ================= */
//         const data = await Reservation.aggregate([
//             {
//                 $match: {
//                     createdAt: { $gte: startDate }
//                 }
//             },
//             {
//                 $group: {
//                     _id: "$restaurantId",
//                     totalReservations: { $sum: 1 },
//                     noShows: {
//                         $sum: {
//                             $cond: [{ $eq: ["$status", "No-show"] }, 1, 0]
//                         }
//                     }
//                 }
//             },
//             {
//                 $project: {
//                     totalReservations: 1,
//                     noShows: 1,
//                     noShowRate: {
//                         $multiply: [
//                             { $divide: ["$noShows", "$totalReservations"] },
//                             100
//                         ]
//                     }
//                 }
//             },
//             {
//                 $match: {
//                     noShowRate: { $gt: 15 }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "restaurants",
//                     localField: "_id",
//                     foreignField: "_id",
//                     as: "restaurant"
//                 }
//             },
//             { $unwind: "$restaurant" },
//             {
//                 $project: {
//                     restaurantId: "$_id",
//                     restaurantName: "$restaurant.name",
//                     noShowRate: { $round: ["$noShowRate", 1] },
//                     _id: 0
//                 }
//             },
//             { $sort: { noShowRate: -1 } },
//             { $limit: 4 }
//         ]);

//         return res.json({
//             success: true,
//             count: data.length,
//             data
//         });

//     } catch (error) {
//         console.error("No-show Risk Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch no-show risk data",
//             error: error.message
//         });
//     }
// };

// exports.createReservation = async (req, res) => {
//     try {
//         const {
//             reservationId, // 🔥 NEW (optional)

//             restaurantId,
//             tableId,

//             // Guest fields
//             firstName,
//             lastName,
//             guestEmail,
//             guestPhone,
//             gender,
//             dob,

//             // Reservation fields
//             date,
//             time,
//             partySize,
//             source,
//             status,
//             seating,
//             tags,
//             notes
//         } = req.body;

//         if (!restaurantId || !date || !time) {
//             return res.status(400).json({
//                 success: false,
//                 message: "restaurantId, date & time are required."
//             });
//         }

//         const reservationDate = new Date(date);
//         const weekdayName = reservationDate.toLocaleDateString("en-US", {
//             weekday: "long"
//         });

//         /* ---------------------------------------------------
//            🔹 SHIFT LOGIC (UNCHANGED)
//         --------------------------------------------------- */

//         const allShifts = await Shift.find({
//             restaurantId,
//             isActive: true,
//             $or: [
//                 { type: "Recurring", daysActive: { $in: [weekdayName] } },
//                 {
//                     type: "Special",
//                     startDate: { $lte: reservationDate },
//                     endDate: { $gte: reservationDate }
//                 }
//             ]
//         });

//         if (!allShifts.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No shifts available for this day."
//             });
//         }

//         const [hh, mm] = time.split(":").map(Number);
//         const reservationMinutes = hh * 60 + mm;

//         const toMinutes = t => {
//             const [h, m] = t.split(":").map(Number);
//             return h * 60 + m;
//         };

//         let shift = allShifts.find(s => {
//             const start = toMinutes(s.startTime);
//             const end = toMinutes(s.endTime);
//             return reservationMinutes >= start && reservationMinutes < end;
//         });

//         if (!shift) {
//             let nearest = null;
//             let minDiff = Infinity;

//             allShifts.forEach(s => {
//                 const diff = Math.abs(reservationMinutes - toMinutes(s.startTime));
//                 if (diff < minDiff) {
//                     minDiff = diff;
//                     nearest = s;
//                 }
//             });

//             if (minDiff > 60) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Reservation time is outside all shift timings."
//                 });
//             }

//             shift = nearest;
//         }

//         /* ---------------------------------------------------
//            🔹 TABLE AVAILABILITY (EXCLUDE SELF IF UPDATE)
//         --------------------------------------------------- */

//         if (tableId) {
//             const conflictQuery = {
//                 restaurantId,
//                 tableId,
//                 date: reservationDate,
//                 time,
//                 status: { $nin: ["Cancelled", "No-show"] }
//             };

//             if (reservationId) {
//                 conflictQuery._id = { $ne: reservationId };
//             }

//             const existing = await Reservation.findOne(conflictQuery);

//             if (existing) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "This table is already reserved for the selected date & time."
//                 });
//             }
//         }

//         /* ---------------------------------------------------
//            🔹 CREATE / UPDATE GUEST (UNCHANGED)
//         --------------------------------------------------- */

//         let guest = null;

//         if (guestPhone) {
//             guest = await Guest.findOne({ restaurantId, phone: guestPhone });
//         }

//         if (!guest && guestEmail) {
//             guest = await Guest.findOne({
//                 restaurantId,
//                 email: guestEmail.toLowerCase()
//             });
//         }

//         if (guest) {
//             guest.firstName = firstName || guest.firstName;
//             guest.lastName = lastName || guest.lastName;
//             guest.phone = guestPhone || guest.phone;
//             guest.email = guestEmail || guest.email;
//             guest.gender = gender || guest.gender;
//             guest.dob = dob || guest.dob;

//             if (tags?.length) {
//                 guest.tags = [...new Set([...guest.tags, ...tags])];
//             }

//             await guest.save();
//         } else {
//             guest = await Guest.create({
//                 restaurantId,
//                 firstName,
//                 lastName,
//                 phone: guestPhone,
//                 email: guestEmail,
//                 gender,
//                 dob,
//                 tags,
//                 notes
//             });
//         }

//         /* ---------------------------------------------------
//            🔹 CREATE OR UPDATE RESERVATION
//         --------------------------------------------------- */

//         let reservation;

//         if (reservationId) {
//             reservation = await Reservation.findByIdAndUpdate(
//                 reservationId,
//                 {
//                     restaurantId,
//                     guestId: guest._id,
//                     tableId,
//                     shiftId: shift._id,
//                     date: reservationDate,
//                     time,
//                     partySize,
//                     source,
//                     status,
//                     seating,
//                     tags,
//                     notes
//                 },
//                 { new: true }
//             );

//             if (!reservation) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "Reservation not found."
//                 });
//             }
//         } else {
//             reservation = await Reservation.create({
//                 restaurantId,
//                 guestId: guest._id,
//                 tableId,
//                 shiftId: shift._id,
//                 date: reservationDate,
//                 time,
//                 partySize,
//                 source,
//                 status,
//                 seating,
//                 tags,
//                 notes
//             });
//         }

//         /* ---------------------------------------------------
//            🔹 UPDATE UPCOMING VISIT
//         --------------------------------------------------- */

//         await Guest.findByIdAndUpdate(guest._id, {
//             upcomingVisitAt: reservationDate
//         });

//         return res.status(201).json({
//             success: true,
//             message: reservationId
//                 ? "Reservation updated successfully."
//                 : "Reservation created successfully.",
//             assignedShift: shift.name,
//             data: {
//                 reservation,
//                 guest
//             }
//         });

//     } catch (error) {
//         console.error("Reservation error:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Error processing reservation.",
//             error: error.message
//         });
//     }
// };
