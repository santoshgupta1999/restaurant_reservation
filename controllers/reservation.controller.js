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
            shiftId,
            guestName,
            guestEmail,
            guestPhone,
            date,
            time,
            partySize,
            source,
            notes
        } = req.body;

        if (!restaurantId || !shiftId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId and shiftId are required."
            });
        }

        const shiftExists = await Shift.findById(shiftId);
        if (!shiftExists) {
            return res.status(404).json({
                success: false,
                message: "Invalid shiftId — shift not found."
            });
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
            shiftId,
            guestName,
            guestEmail,
            guestPhone,
            date: new Date(date),
            time,
            partySize,
            source,
            notes
        });

        await newReservation.save();

        return res.status(201).json({
            success: true,
            message: "Reservation created successfully.",
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
        const { restaurantId, filter } = req.query;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required in query params."
            });
        }

        const today = new Date();
        const query = { restaurantId };

        switch (filter?.toLowerCase()) {
            case "upcoming":
                query.date = { $gte: today };
                break;

            case "confirmed":
                query.status = "Confirmed";
                break;

            case "seated":
                query.status = "Seated";
                break;

            case "pending":
                query.status = "Pending";
                break;

            case "canceled":
                query.status = "Canceled";
                break;

            case "no-show":
            case "noshow":
                query.status = "No-show";
                break;

            default:
                break;
        }

        const reservations = await Reservation.find(query)
            .populate("restaurantId", "name email phone")
            .populate("tableId", "tableNumber roomName capacity")
            .populate("shiftId", "name startTime endTime")
            .sort({ date: 1, time: 1 });

        if (!reservations.length) {
            return res.status(404).json({
                success: false,
                message:
                    filter
                        ? `No ${filter} reservations found for this restaurant.`
                        : "No reservations found for this restaurant."
            });
        }

        res.status(200).json({
            success: true,
            message: `Reservations fetched successfully${filter ? ` (${filter})` : ""}.`,
            count: reservations.length,
            data: reservations
        });

    } catch (error) {
        console.error("Error fetching reservations:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching reservations.",
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

        const updatedReservation = await Reservation.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate("restaurantId", "name email phone address")
            .populate("tableId", "tableNumber roomName capacity")
            .populate("shiftId", "name startTime endTime type");

        if (!updatedReservation) {
            return res.status(404).json({
                success: false,
                message: "Reservation not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Reservation updated successfully.",
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

        const allowedStatuses = ["Pending", "Confirmed", "Seated", "Canceled", "No-show"];

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
