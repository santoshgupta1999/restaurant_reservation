const Reservation = require('../models/reservation.model');
const Shift = require('../models/shift.model');
const Table = require('../models/table.model');
const User = require('../models/user.model');
const Restaurant = require('../models/restaurant.model');
const mongoose = require('mongoose');
// const sendSMS = require('../utils/sendSMS'); // <-- optional SMS helper
const sendEmail = require('../utils/mailer'); // <-- optional Email helper

const getDayOfWeek = (dateString) => {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
};

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

// exports.getReservation = async (req, res) => {
//     try {
//         const filter = {};
//         if (req.query.restaurantId) filter.restaurantId = req.query.restaurantId;
//         if (req.user.userId) filter.userId = req.user.userId;

//         if (!filter.restaurantId) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Restaurant ID not found'
//             });
//         }

//         const reservations = await Reservation.find(filter)
//             .populate('restaurantId', 'name')
//             .populate('tableId', 'tableNumber capacity')
//             .populate('userId', 'name email');

//         return res.status(200).json({
//             success: true,
//             message: 'Reservation fetched successfully',
//             data: reservations
//         });

//     } catch (error) {
//         console.error('Error fetching reservation', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching reservation',
//             error: error.message
//         });
//     }
// };

// exports.updateReservation = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const userId = req.user._id;
//         const { restaurantId, tableId, date, slot, guestCount } = req.body;

//         const tableExists = await Table.findOne({ _id: tableId, restaurantId });
//         if (!tableExists) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Invalid table ID. No such table found for the selected restaurant.'
//             });
//         }

//         // Find existing reservation
//         const existing = await Reservation.findById(id);
//         if (!existing) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Reservation not found'
//             });
//         }

//         // Validate slot only if date or slot changed
//         const isSlotUpdate = (date && date !== existing.date.toISOString()) || slot;

//         if (isSlotUpdate && restaurantId && date && slot?.startTime && slot?.endTime) {
//             const selectedDay = getDayOfWeek(date);

//             const slotDoc = await Slot.findOne({ restaurantId, day: selectedDay });
//             if (!slotDoc) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'No slot configuration found for this day.'
//                 });
//             }

//             const isSlotAvailable = slotDoc.slots.some(s =>
//                 s.startTime === slot.startTime && s.endTime === slot.endTime
//             );

//             if (!isSlotAvailable) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Selected slot is not available.'
//                 });
//             }

//             // Check for conflict with another reservation
//             const duplicate = await Reservation.findOne({
//                 _id: { $ne: id },
//                 restaurantId,
//                 tableId,
//                 date: new Date(date),
//                 'slot.startTime': slot.startTime,
//                 'slot.endTime': slot.endTime
//             });

//             if (duplicate) {
//                 return res.status(409).json({
//                     success: false,
//                     message: 'This table is already booked for the selected slot.'
//                 });
//             }

//             // Set day field for reservation
//             req.body.day = selectedDay;
//         }

//         // Perform the update
//         const updated = await Reservation.findByIdAndUpdate(id, req.body, {
//             new: true,
//             runValidators: true
//         });

//         try {
//             const user = await User.findById(userId);
//             const restaurant = await Restaurant.findById(restaurantId);

//             if (!user || !restaurant) {
//                 console.warn('User or Restaurant not found');
//             } else {
//                 await sendEmail(
//                     user.email,
//                     user.name,
//                     'Reservation updated successfully',
//                     restaurant.name,
//                     date,
//                     slot.startTime,
//                     slot.endTime
//                 );
//             }
//         } catch (emailErr) {
//             console.warn('Email failed:', emailErr.message);
//         }

//         return res.status(200).json({
//             success: true,
//             message: 'Reservation updated successfully',
//             data: updated
//         });

//     } catch (error) {
//         console.error('Error updating reservation:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Internal server error'
//         });
//     }
// };


// exports.deleteReservation = async (req, res) => {
//     try {
//         const reservationId = req.params.id;
//         const userId = req.user._id;
//         const userRole = req.user.role;

//         const reservation = await Reservation.findById(reservationId);

//         if (!reservation) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Reservation not found'
//             });
//         }

//         // If not admin, allow delete only if reservation belongs to the user
//         if (userRole !== 'admin' && String(reservation.userId) !== String(userId)) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'You are not authorized to delete this reservation'
//             });
//         }

//         await Reservation.findByIdAndDelete(reservationId);

//         return res.status(200).json({
//             success: true,
//             message: 'Reservation deleted successfully'
//         });
//     } catch (error) {
//         console.error('Error deleting reservation:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Internal server error'
//         });
//     }
// };

// exports.getReservationById = async (req, res) => {
//     try {
//         const { id } = req.params;

//         // Validate ObjectId format
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid reservation ID format',
//             });
//         }

//         // Find the reservation
//         const reservation = await Reservation.findById(id)
//             .populate('userId', 'name email')
//             .populate('restaurantId', 'name')
//             .populate('tableId', 'tableNumber capacity');

//         if (!reservation) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Reservation not found',
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             data: reservation,
//         });
//     } catch (error) {
//         console.error('Error fetching reservation:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//         });
//     }
// };

// exports.getAllReservationsByAdmin = async (req, res) => {
//     try {
//         const { restaurantId, filter } = req.query;

//         const query = {};
//         if (restaurantId) {
//             query.restaurantId = restaurantId;
//         }

//         const today = new Date();
//         today.setHours(0, 0, 0, 0);

//         if (filter === "Upcoming") {
//             query.date = { $gte: today };
//         } else if (filter === "Seated") {
//             query.status = "Seated";
//         }

//         const reservations = await Reservation.find(query)
//             .populate("userId", "name email")
//             .populate("restaurantId", "name email phone address")
//             .populate("tableId", "tableNumber seatCount areaName")
//             .sort({ date: 1 });

//         return res.status(200).json({
//             success: true,
//             message:
//                 filter === "Upcoming"
//                     ? "Upcoming reservations fetched successfully"
//                     : filter === "Seated"
//                         ? "Seated reservations fetched successfully"
//                         : restaurantId
//                             ? "All reservations for the restaurant fetched successfully"
//                             : "All reservations fetched successfully",
//             count: reservations.length,
//             data: reservations,
//         });
//     } catch (error) {
//         console.error("Error fetching reservations:", error);
//         res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             error: error.message,
//         });
//     }
// };

// exports.updateReservationStatus = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status } = req.body;

//         if (!id || id.length !== 24) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid reservation ID'
//             });
//         }

//         const updated = await Reservation.findByIdAndUpdate(id, { status }, { new: true });
//         if (!updated) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Reservation not found'
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             message: `Reservation status updated successfully`,
//             data: updated
//         });

//     } catch (error) {
//         console.error('Error updating reservation status:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };
