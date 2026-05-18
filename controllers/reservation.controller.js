const Reservation = require('../models/reservation.model');
const Shift = require('../models/shift.model');
const Table = require('../models/table.model');
const User = require('../models/user.model');
const Guest = require('../models/guest.model');
const Block = require('../models/block.model');
const Restaurant = require('../models/Restaurant.model');
const ReservationHold = require("../models/reservationHold.model");
const mongoose = require('mongoose');
// const sendSMS = require('../utils/sendSMS'); // <-- optional SMS helper
const sendEmail = require('../utils/mailer'); // <-- optional Email helper
const { sendReservationNotification } = require("../utils/reservationNotification");
const { formatDate, formatDateTime, formatTime } = require('../utils/dateFormatter');


function convertTo24Hour(time) {

    if (!time) return time;

    if (!time.toUpperCase().includes("AM") && !time.toUpperCase().includes("PM")) {
        return time; // already 24H
    }

    const [timePart, modifier] = time.split(" ");
    let [hours, minutes] = timePart.split(":");

    if (modifier.toUpperCase() === "PM" && hours !== "12") {
        hours = parseInt(hours, 10) + 12;
    }

    if (modifier.toUpperCase() === "AM" && hours === "12") {
        hours = "00";
    }

    return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

function convertTo12Hour(time) {
    if (!time) return time;

    const [hours, minutes] = time.split(":");
    let h = parseInt(hours, 10);

    const ampm = h >= 12 ? "PM" : "AM";

    h = h % 12;
    if (h === 0) h = 12;

    return `${h.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}

exports.createReservation = async (req, res) => {
    try {
        const {
            reservationId,
            restaurantId,
            tableIds = [],

            firstName,
            lastName,
            guestEmail,
            guestPhone,
            countryCode,
            gender,
            dob,

            date,
            time,
            partySize,
            source,
            status,
            seating,
            isConfirmedPolicy,
            tags,
            notes
        } = req.body;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required."
            });
        }

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Date is required."
            });
        }

        if (!time) {
            return res.status(400).json({
                success: false,
                message: "Time is required."
            });
        }

        const allowedSources = ["shared_link", "Walk-in", "Phone", "Email-Message", "Remi"];

        if (source && !allowedSources.includes(source)) {
            return res.status(400).json({
                success: false,
                message: "Invalid source type."
            });
        }

        if (!partySize || partySize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid partySize is required."
            });
        }

        const reservationDate = new Date(date);
        let formattedTime = convertTo24Hour(time);
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

        /* ================= SHIFT (OPTIONAL NOW) ================= */

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

        let shift = null;

        if (allShifts.length) {
            const [hh, mm] = formattedTime.split(":").map(Number);
            const reservationMinutes = hh * 60 + mm;

            const convertToMinutes = t => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
            };

            shift = allShifts.find(s => {
                const start = convertToMinutes(s.startTime);
                const end = convertToMinutes(s.endTime);

                // overnight support
                if (end < start) {
                    return reservationMinutes >= start || reservationMinutes < end;
                }

                return reservationMinutes >= start && reservationMinutes < end;
            });
        }

        /* REMOVED HARD ERROR
        if (!shift) return error
        */

        /* ================= TABLE VALIDATION ================= */

        if (tableIds && tableIds.length > 0) {
            const tables = await Table.find({ _id: { $in: tableIds } });

            if (tables.some(table => table.status === "OutOfService")) {
                return res.status(400).json({
                    success: false,
                    message: "One or more selected tables are currently locked (Out of Service)."
                });
            }

            if (tables.some(table => partySize > table.capacity)) {
                return res.status(400).json({
                    success: false,
                    message: "Party size exceeds table capacity."
                });
            }

            const existingBooking = await Reservation.findOne({
                restaurantId,
                tableIds: { $in: tableIds },
                date: reservationDate,
                time,
                status: { $in: ["Pending", "Confirmed", "Upcoming", "Seated"] },
                _id: { $ne: reservationId }
            });

            if (existingBooking) {
                return res.status(400).json({
                    success: false,
                    message: "One or more selected tables are already booked for the selected Date & Time."
                });
            }
        }

        /* ================= GUEST ================= */

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
            guest.countryCode = countryCode || guest.countryCode;
            guest.email = guestEmail || guest.email;

            if (gender && ["Male", "Female", "Other", "Prefer not to say", "N/A"].includes(gender)) {
                guest.gender = gender;
            }

            guest.dob = dob || guest.dob;

            await guest.save();
        } else {
            guest = await Guest.create({
                restaurantId,
                firstName,
                lastName,
                phone: guestPhone,
                countryCode,
                email: guestEmail,
                gender: ["Male", "Female", "Other", "Prefer not to say", "N/A"].includes(gender) ? gender : undefined,
                dob,
                tags,
                notes
            });
        }

        /* ================= CREATE / UPDATE ================= */

        let statusChanged = false;
        let reservation;
        let isUpdate = false;

        if (existingReservation) {

            if (
                existingReservation.date.toISOString() !== reservationDate.toISOString() ||
                existingReservation.time !== formattedTime ||
                existingReservation.partySize !== partySize ||
                String(existingReservation.tableIds) !== String(tableIds) ||
                existingReservation.seating !== seating ||
                existingReservation.source !== source
            ) {
                isUpdate = true;
            }

            if (["No-Show", "Cancelled"].includes(existingReservation.status)) {
                return res.status(400).json({
                    success: false,
                    message: `${existingReservation.status} reservation cannot be modified.`
                });
            }

            if (status && existingReservation.status !== status) {
                statusChanged = true;
            }

            existingReservation.tableIds = tableIds || existingReservation.tableIds;
            existingReservation.shiftId = shift?._id || null;
            existingReservation.date = reservationDate;
            existingReservation.time = formattedTime;
            existingReservation.partySize = partySize;
            existingReservation.source = source;
            existingReservation.status = status;
            existingReservation.seating = seating;
            existingReservation.isConfirmedPolicy = isConfirmedPolicy;
            existingReservation.tags = tags;
            existingReservation.notes = notes;

            reservation = await existingReservation.save();

        } else {

            reservation = await Reservation.create({
                restaurantId,
                guestId: guest._id,
                tableIds: tableIds || [], // table optional
                shiftId: shift?._id || null, // shift optional
                date: reservationDate,
                time: formattedTime,
                partySize,
                source,
                status,
                seating,
                isConfirmedPolicy,
                tags,
                notes
            });

            if (["Confirmed", "Cancelled"].includes(reservation.status)) {
                statusChanged = true;
            }
        }

        await Guest.findByIdAndUpdate(guest._id, {
            upcomingVisitAt: reservationDate
        });

        /* ================= NOTIFICATION ================= */

        if (existingReservation) {

            if (reservation.status === "Cancelled" && statusChanged) {
                sendReservationNotification(reservation, guest, "Cancelled");
            }

            else if (reservation.status === "Confirmed") {

                if (statusChanged) {
                    sendReservationNotification(reservation, guest, "Confirmed");
                }

                else if (isUpdate) {
                    sendReservationNotification(reservation, guest, "Updated");
                }
            }

        } else {

            if (["Confirmed", "Cancelled"].includes(reservation.status)) {
                sendReservationNotification(reservation, guest, reservation.status);
            }
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
            roomId
        } = req.body;

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

            if (status === "Upcoming") {

                const now = new Date();
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                const currentTime = now.toTimeString().slice(0, 5);

                query.status = { $in: ["Upcoming"] };

                query.$or = [
                    // Future dates
                    { date: { $gt: todayStart } },

                    // Today but future time
                    {
                        date: { $eq: todayStart },
                        time: { $gte: currentTime }
                    }
                ];

            } else {
                query.status = status;
            }
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

        const reservationsRaw = await Reservation.find(query)
            .populate({
                path: "guestId",
                select: `
                    firstName
                    lastName
                    gender
                    dob
                    email
                    countryCode
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
                path: "tableIds",
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
            .populate({
                path: "seating",
                select: "preferenceName"
            })
            .sort({ date: 1, time: 1 });

        const trimDate = (val) =>
            val ? new Date(val).toISOString().split("T")[0] : null;

        const reservations = reservationsRaw.map(r => {
            const obj = r.toObject();

            /* Reservation dates */
            obj.date = formatDate(obj.date);
            obj.createdAt = formatDate(obj.createdAt);
            obj.updatedAt = formatDate(obj.updatedAt);

            obj.arrivedAt = formatDateTime(obj.arrivedAt);
            obj.seatedAt = formatDateTime(obj.seatedAt);
            obj.finishedAt = formatDateTime(obj.finishedAt);
            if (obj.cancellation?.at) {
                obj.cancellation.at = formatDateTime(obj.cancellation.at);
            }

            /* Convert reservation time */
            if (obj.time) {
                obj.time = formatTime(obj.time);
            }

            /* Shift time */
            if (obj.shiftId) {
                if (obj.shiftId.startTime) {
                    obj.shiftId.startTime = formatTime(obj.shiftId.startTime);
                }

                if (obj.shiftId.endTime) {
                    obj.shiftId.endTime = formatTime(obj.shiftId.endTime);
                }
            }

            /* Guest dates */
            if (obj.guestId) {
                obj.guestId.dob = formatDate(obj.guestId.dob);
                obj.guestId.lastVisitAt = formatDate(obj.guestId.lastVisitAt);
                obj.guestId.upcomingVisitAt = formatDate(obj.guestId.upcomingVisitAt);
            }

            /* Convert roomId.name → roomName */
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
            .populate("restaurantId", "venueName countryCode phone city")
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
                status: { $nin: ["Canceled", "No-Show"] }
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

        const {
            status,
            cancellationReason,
            cancellationSource
        } = req.body;

        const allowedStatuses = [
            "Pending",
            "Confirmed",
            "Seated",
            "Cancelled",
            "No-Show",
            "Finished"
        ];

        const allowedCancellationSources = [
            "foh",
            "guest",
            "block",
            "shift",
            "table"
        ];

        if (!id || id.length !== 24) {

            return res.status(400).json({
                success: false,
                message: "Invalid reservation ID",
            });
        }

        if (
            !status ||
            !allowedStatuses.includes(status)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `Invalid status. Allowed values are: ${allowedStatuses.join(", ")}`
            });
        }

        // VALIDATE CANCELLATION SOURCE
        if (
            cancellationSource &&
            !allowedCancellationSources.includes(cancellationSource)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid cancellation source."
            });
        }

        // FETCH RESERVATION
        const reservation = await Reservation.findById(id);

        if (!reservation) {

            return res.status(404).json({
                success: false,
                message: "Reservation not found",
            });
        }

        /*
             BLOCK INVALID CANCELLATION
        */
        if (
            status === "Cancelled" &&
            ["Seated", "No-Show", "Finished"]
                .includes(reservation.status)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `${reservation.status} reservation cannot be cancelled.`
            });
        }

        /*
            CANCEL REASON REQUIRED
        */
        if (
            status === "Cancelled" &&
            !cancellationReason
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Cancellation reason is required."
            });
        }

        /*
            UPDATE STATUS
        */
        reservation.status = status;

        /*
            CANCELLATION AUDIT
        */
        if (status === "Cancelled") {

            reservation.cancellation = {
                reason: cancellationReason,
                source: cancellationSource || "foh",
                actorId: req.user?._id || null,
                at: new Date()
            };
        }

        /*
            OPTIONAL:
            CLEAR OLD CANCELLATION
        */
        else {

            reservation.cancellation = null;
        }

        await reservation.save();

        const updated = await Reservation.findById(id)
            .populate(
                "restaurantId",
                "venueName heroImage city"
            );

        return res.status(200).json({
            success: true,
            message: `Reservation ${status} successfully`,
            data: {
                ...updated.toObject(),
            }
        });

    } catch (error) {

        console.error(
            "Error updating reservation status:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

exports.cancelReservation = async (req, res) => {

    try {

        const { id } = req.params;

        const { cancellationReason } = req.body;

        if (!id || id.length !== 24) {

            return res.status(400).json({
                success: false,
                message: "Invalid reservation ID",
            });
        }

        /*
            CANCEL REASON REQUIRED
        */
        if (!cancellationReason) {

            return res.status(400).json({
                success: false,
                message: "Cancellation reason is required."
            });
        }

        const reservation =
            await Reservation.findById(id)
                .populate("guestId");

        if (!reservation) {

            return res.status(404).json({
                success: false,
                message: "Reservation not found",
            });
        }

        /*
            TERMINAL STATUS CHECK
        */
        const restrictedStatuses = [
            "Cancelled",
            "Finished",
            "Seated",
            "No-Show"
        ];

        if (
            restrictedStatuses.includes(
                reservation.status
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `Cannot cancel a reservation that is ${reservation.status}`,
            });
        }

        /*
            UPDATE STATUS
        */
        reservation.status = "Cancelled";

        /*
            CANCELLATION AUDIT
        */
        reservation.cancellation = {
            reason: cancellationReason,

            source: "guest",

            actorId:
                req.user?._id || null,

            at: new Date()
        };

        await reservation.save();

        /*
            FREE TABLE
        */
        if (reservation.tableId) {

            await Table.findByIdAndUpdate(
                reservation.tableId,
                {
                    status: "Available"
                }
            );
        }

        const guest = {
            email:
                reservation.guestId?.email,

            firstName:
                reservation.guestId?.firstName,

            lastName:
                reservation.guestId?.lastName
        };

        await sendReservationNotification(
            reservation,
            guest,
            "Cancelled"
        );

        const updated =
            await reservation.populate(
                "restaurantId",
                "venueName heroImage city"
            );

        return res.status(200).json({
            success: true,
            message:
                "Reservation cancelled successfully",

            data: {
                ...updated.toObject(),

                restaurant: {

                    restaurantId:
                        updated.restaurantId?._id || null,

                    name:
                        updated.restaurantId?.venueName || null,

                    logo:
                        updated.restaurantId?.heroImage || null,

                    address:
                        updated.restaurantId?.city || null
                }
            }
        });

    } catch (error) {

        console.error(
            "Error cancelling reservation:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
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

exports.createWidgetReservation = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const { restaurantId } = req.params;

        const {
            reservationId,
            tableIds = [],
            firstName,
            lastName,
            guestEmail,
            guestPhone,
            countryCode,
            dob,
            gender,
            date,
            time,
            partySize,
            source = "shared_link",
            status,
            seating,
            tags,
            notes
        } = req.body;

        if (!restaurantId || !date || !time) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "restaurantId, date & time are required."
            });
        }

        const allowedSources = ["shared_link", "Walk-in", "Phone", "Email-Message", "Remi"];

        if (source && !allowedSources.includes(source)) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Invalid source type."
            });
        }

        if (!partySize || partySize <= 0) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Valid partySize is required."
            });
        }

        const reservationDate = new Date(date);
        let formattedTime = convertTo24Hour(time);
        let existingReservation = null;

        if (reservationId) {
            existingReservation = await Reservation.findById(reservationId).session(session);
            if (!existingReservation) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    message: "Reservation not found."
                });
            }
        }

        /* ================= SHIFT FIND ================= */

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

        const [hh, mm] = formattedTime.split(":").map(Number);
        const reservationMinutes = hh * 60 + mm;

        const convertToMinutes = t => {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
        };

        let shift = allShifts.find(s => {
            let start = convertToMinutes(s.startTime);
            let end = convertToMinutes(s.endTime);

            // Overnight shift support
            if (end <= start) end += 1440;

            let checkTime = reservationMinutes;
            if (checkTime < start) checkTime += 1440;

            return checkTime >= start && checkTime < end;
        });

        /* ================= TABLE VALIDATION ================= */

        if (tableIds && tableIds.length > 0) {
            const tables = await Table.find({ _id: { $in: tableIds } });

            if (tables.some(table => table.status === "OutOfService")) {
                return res.status(400).json({
                    success: false,
                    message: "One or more selected tables are currently locked (Out of Service)."
                });
            }

            if (tables.some(table => partySize > table.capacity)) {
                return res.status(400).json({
                    success: false,
                    message: "Party size exceeds table capacity."
                });
            }
        }

        /* ================= DUPLICATE BOOKING ================= */

        if (tableIds && tableIds.length > 0) {
            const existingBooking = await Reservation.findOne({
                restaurantId,
                tableIds: { $in: tableIds },
                date: reservationDate,
                time: formattedTime,
                status: { $in: ["Pending", "Confirmed", "Seated"] },
                _id: { $ne: reservationId }
            });

            if (existingBooking) {
                return res.status(400).json({
                    success: false,
                    message: "One or more selected tables are already booked."
                });
            }
        }

        /* ================= GUEST ================= */

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
            guest.countryCode = countryCode || guest.countryCode;
            guest.email = guestEmail || guest.email;
            guest.dob = dob || guest.dob;
            guest.gender = gender || guest.gender;

            await guest.save();
        } else {
            guest = await Guest.create({
                restaurantId,
                firstName,
                lastName,
                phone: guestPhone,
                countryCode,
                email: guestEmail,
                dob,
                gender,
                tags,
                notes
            });
        }

        let statusChanged = false;
        let reservation;
        let isUpdate = false;

        if (existingReservation) {

            // check if important fields changed
            if (
                existingReservation.date.toISOString() !== reservationDate.toISOString() ||
                existingReservation.time !== formattedTime ||
                existingReservation.partySize !== partySize ||
                existingReservation.tableIds.toString() !== (tableIds || []).toString() ||
                existingReservation.seating !== seating ||
                existingReservation.source !== source
            ) {
                isUpdate = true;
            }

            if (["Finished", "No-show", "Cancelled"].includes(existingReservation.status)) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: `${existingReservation.status} reservation cannot be modified.`
                });
            }
            if (status && existingReservation.status !== status) {
                statusChanged = true;
            }
            // UPDATE
            // if (tableIds) existingReservation.tableIds = tableIds;

            if (date) existingReservation.date = reservationDate;

            if (time) existingReservation.time = formattedTime;

            if (partySize) existingReservation.partySize = partySize;

            if (source) existingReservation.source = source;

            if (status) existingReservation.status = status;

            if (seating) existingReservation.seating = seating;

            if (tags) existingReservation.tags = tags;

            if (notes) existingReservation.notes = notes;

            if (date || time) {
                existingReservation.shiftId = shift._id;
            }

            reservation = await existingReservation.save({ session });

        } else {
            // CREATE
            reservation = await Reservation.create({
                restaurantId,
                guestId: guest._id,
                tableIds: tableIds || [],
                shiftId: shift._id,
                date: reservationDate,
                time: formattedTime,
                partySize,
                source,
                status,
                seating,
                tags,
                notes
            });

            if (["Confirmed", "Cancelled"].includes(reservation.status)) {
                statusChanged = true;
            }
        }

        await Guest.findByIdAndUpdate(guest._id, {
            upcomingVisitAt: reservationDate
        });

        if (existingReservation) {

            if (reservation.status === "Cancelled" && statusChanged) {
                console.log("SEND CANCELLED");
                sendReservationNotification(reservation, guest, "Cancelled");
            }

            else if (reservation.status === "Confirmed") {

                if (statusChanged) {
                    console.log("SEND CONFIRMED");
                    sendReservationNotification(reservation, guest, "Confirmed");
                }

                else if (isUpdate) {
                    console.log("SEND UPDATED");
                    sendReservationNotification(reservation, guest, "Updated");
                }
            }

        } else {

            if (["Confirmed", "Cancelled"].includes(reservation.status)) {
                console.log("SEND NEW");
                sendReservationNotification(reservation, guest, reservation.status);
            }
        }

        const restaurant = await Restaurant.findById(restaurantId)
            .select("venueName city heroImage");

        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: reservationId
                ? "Reservation updated successfully."
                : "Reservation created successfully.",
            data: {
                reservation,
                restaurant: {
                    name: restaurant?.venueName,
                    address: restaurant?.city,
                    logo: restaurant?.heroImage
                }
            }
        });

    } catch (error) {
        console.error("Error saving reservation:", error);
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        return res.status(500).json({
            success: false,
            message: "Error saving reservation.",
            error: error.message
        });
    } finally {

        session.endSession();
    }
};

exports.getReservationConfirmation = async (req, res) => {
    try {

        const { reservationId } = req.params;

        const reservation = await Reservation.findById(reservationId)
            .populate("guestId")
            .populate("restaurantId")
            .populate(
                "tableIds",
                "tableNumber capacity"
            );

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found"
            });
        }

        const guest = reservation.guestId;
        const restaurant = reservation.restaurantId;

        const logoUrl = restaurant?.heroImage
            ? `/uploads/restaurants/logo/${restaurant.heroImage}`
            : null;

        const response = {

            guest: {
                firstName: guest?.firstName,
                lastName: guest?.lastName,
                countryCode: guest?.countryCode,
                phone: guest?.phone,
                email: guest?.email
            },

            booking: {
                reservationNo: reservation.reservationNo,
                date: reservation.date,
                time: convertTo12Hour(reservation.time),
                partySize: reservation.partySize,
                status: reservation.status,
                seating: reservation.seating
            },

            restaurant: {
                restaurantId: restaurant?._id,
                name: restaurant?.venueName,
                address: restaurant?.city,
                countryCode: restaurant?.countryCode,
                phone: restaurant?.phone,
                website: restaurant?.website,
                logo: logoUrl
            },

            table: reservation.tableIds?.map(table => ({
                id: table._id,
                tableNumber: table.tableNumber,
                capacity: table.capacity
            })),

            // shareLink: `https://remi.com/${restaurant?.slug || "restaurant"}`,

            calendar: {
                title: `Reservation at ${restaurant?.venueName}`,
                date: reservation.date,
                time: convertTo12Hour(reservation.time)
            }
        };

        return res.status(200).json({
            success: true,
            message: "Reservation confirmation fetched successfully",
            data: response
        });

    } catch (error) {
        console.error("Error fetching reservation confirmation:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.createReservationHold = async (req, res) => {

    try {

        const { restaurantId } = req.params;

        const {
            tableIds,
            date,
            time
        } = req.body;

        /* ================= VALIDATION ================= */

        if (
            !restaurantId ||
            !tableIds ||
            !tableIds.length ||
            !date ||
            !time
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "restaurantId, tableIds, date and time are required"
            });
        }

        // SINGLE TABLE ONLY
        if (tableIds.length > 1) {
            return res.status(400).json({
                success: false,
                message:
                    "Currently only single table booking is allowed"
            });
        }

        /* ================= CHECK ACTIVE HOLD ================= */

        const existingHold =
            await ReservationHold.findOne({
                tableIds: {
                    $in: tableIds
                },
                date,
                time,
                expiresAt: {
                    $gt: new Date()
                }
            });

        if (existingHold) {
            return res.status(400).json({
                success: false,
                message:
                    "Table is temporarily locked by another guest for the selected date and time"
            });
        }

        /* ================= CHECK REAL RESERVATION ================= */

        const existingReservation =
            await Reservation.findOne({

                tableIds: {
                    $in: tableIds
                },

                date,
                time,

                status: {
                    $nin: [
                        "Cancelled",
                        "Finished",
                        "No-Show"
                    ]
                }
            });

        if (existingReservation) {
            return res.status(400).json({
                success: false,
                message:
                    "Table already booked for the selected date and time"
            });
        }

        /* ================= CREATE HOLD ================= */

        const hold =
            await ReservationHold.create({

                restaurantId,

                tableIds,

                date,

                time,

                expiresAt: new Date(
                    Date.now() + 150 * 1000
                ) // 150 seconds
            });

        return res.status(201).json({
            success: true,
            message:
                "Table locked successfully",

            expiresIn: 150,

            holdId: hold._id
        });

    } catch (error) {

        console.error(
            "createReservationHold error:",
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
