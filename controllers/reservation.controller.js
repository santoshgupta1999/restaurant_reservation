const Reservation = require('../models/reservation.model');
const Shift = require('../models/shift.model');
const Table = require('../models/table.model');
const User = require('../models/user.model');
const Restaurant = require('../models/restaurant.model');
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
            restaurantId,
            tableId,
            firstName,
            lastName,
            guestEmail,
            guestPhone,
            dob,
            date,
            time,
            partySize,
            source,
            status,
            seating,
            tag,
            constraint,
            logistic,
            behavior,
            notes
        } = req.body;

        if (!restaurantId || !date || !time) {
            return res.status(400).json({
                success: false,
                message: "restaurantId, date & time are required."
            });
        }

        const reservationDate = new Date(date);
        const weekdayName = reservationDate.toLocaleDateString("en-US", { weekday: "long" });

        const allShifts = await Shift.find({
            restaurantId,
            isActive: true,
            $or: [
                {
                    type: "Recurring",
                    daysActive: { $in: [weekdayName] }
                },
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

        // Convert time to minutes
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
            let nearestShift = null;
            let minDiff = Infinity;

            allShifts.forEach(s => {
                const start = convertToMinutes(s.startTime);
                const diff = Math.abs(reservationMinutes - start);

                if (diff < minDiff) {
                    minDiff = diff;
                    nearestShift = s;
                }
            });

            if (minDiff > 60) {
                return res.status(400).json({
                    success: false,
                    message: "Reservation time is outside all shift timings."
                });
            }

            shift = nearestShift;
        }

        if (tableId) {
            const existing = await Reservation.findOne({
                restaurantId,
                tableId,
                date: new Date(date),
                time,
                status: { $nin: ["Canceled", "No-show"] }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "This table is already reserved for the selected date & time."
                });
            }
        }

        const newReservation = new Reservation({
            restaurantId,
            tableId,
            shiftId: shift._id,
            firstName,
            lastName,
            guestEmail,
            guestPhone,
            dob,
            date: reservationDate,
            time,
            partySize,
            source,
            status,
            seating,
            tag,
            constraint,
            logistic,
            behavior,
            notes
        });

        await newReservation.save();

        return res.status(201).json({
            success: true,
            message: "Reservation created successfully.",
            assignedShift: shift.name,
            data: newReservation
        });

    } catch (error) {
        console.error("Error creating reservation:", error);
        res.status(500).json({
            success: false,
            message: "Error creating reservation.",
            error: error.message
        });
    }
};

exports.getReservations = async (req, res) => {
    try {
        const { restaurantId, date } = req.query;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required"
            });
        }

        const query = { restaurantId };

        if (date) {
            const parsedDate = new Date(date);
            if (isNaN(parsedDate)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format. Use YYYY-MM-DD"
                });
            }

            const start = new Date(parsedDate.setHours(0, 0, 0, 0));
            const end = new Date(parsedDate.setHours(23, 59, 59, 999));

            query.date = { $gte: start, $lte: end };
        }

        const reservations = await Reservation.find(query)
            .populate("restaurantId", "name email phone")
            .populate("tableId", "tableNumber roomName capacity")
            .populate({
                path: "shiftId",
                select: "name startTime endTime type"
            })
            .sort({ time: 1 });

        if (date && reservations.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No reservations found for date ${date}`
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reservations fetched successfully",
            count: reservations.length,
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

        // If date or time is updated → re-evaluate shift
        let shiftId = reservation.shiftId;

        if (updateData.date || updateData.time) {
            const reservationDate = updateData.date
                ? new Date(updateData.date)
                : reservation.date;

            const time = updateData.time || reservation.time;

            const weekdayName = reservationDate.toLocaleDateString("en-US", {
                weekday: "long"
            });

            const allShifts = await Shift.find({
                restaurantId: reservation.restaurantId,
                isActive: true,
                $or: [
                    {
                        type: "Recurring",
                        daysActive: { $in: [weekdayName] }
                    },
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

            const convertToMinutes = (t) => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
            };

            const reservationMinutes = convertToMinutes(time);

            let matchedShift = allShifts.find(s => {
                const start = convertToMinutes(s.startTime);
                const end = convertToMinutes(s.endTime);
                return reservationMinutes >= start && reservationMinutes < end;
            });

            if (!matchedShift) {
                let nearestShift = null;
                let minDiff = Infinity;

                allShifts.forEach(s => {
                    const diff = Math.abs(
                        reservationMinutes - convertToMinutes(s.startTime)
                    );
                    if (diff < minDiff) {
                        minDiff = diff;
                        nearestShift = s;
                    }
                });

                if (minDiff > 60) {
                    return res.status(400).json({
                        success: false,
                        message: "Reservation time is outside all shift timings."
                    });
                }

                matchedShift = nearestShift;
            }

            shiftId = matchedShift._id;
            updateData.shiftId = shiftId;
            updateData.date = reservationDate;
        }

        // Table availability check (if tableId/date/time changes)
        if (updateData.tableId || updateData.date || updateData.time) {
            const tableId = updateData.tableId || reservation.tableId;
            const date = updateData.date || reservation.date;
            const time = updateData.time || reservation.time;

            if (tableId) {
                const existing = await Reservation.findOne({
                    _id: { $ne: id },
                    restaurantId: reservation.restaurantId,
                    tableId,
                    date,
                    time,
                    status: { $nin: ["Canceled", "No-show"] }
                });

                if (existing) {
                    return res.status(400).json({
                        success: false,
                        message: "This table is already reserved for the selected date & time."
                    });
                }
            }
        }

        const updatedReservation = await Reservation.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate("restaurantId", "name phone")
            .populate("tableId", "tableNumber roomName capacity")
            .populate("shiftId", "name startTime endTime");

        return res.status(200).json({
            success: true,
            message: "Reservation updated successfully.",
            assignedShift: updatedReservation.shiftId?.name,
            data: updatedReservation
        });

    } catch (error) {
        console.error("Error updating reservation:", error);
        res.status(500).json({
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
