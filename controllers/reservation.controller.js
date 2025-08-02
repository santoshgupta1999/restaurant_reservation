const Reservation = require('../models/reservation.model');
const Slot = require('../models/slot.model');
const Table = require('../models/table.model');
// const sendSMS = require('../utils/sendSMS'); // <-- optional SMS helper
// const sendEmail = require('../utils/sendEmail'); // <-- optional Email helper

const getDayOfWeek = (dateString) => {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
};

exports.createReservation = async (req, res) => {
    try {
        const { restaurantId, tableId, date, slot, guestCount } = req.body;
        const userId = req.user._id; 

        const selectedDay = getDayOfWeek(date);
        console.log('Selected day:', selectedDay);

        const slotDoc = await Slot.findOne({ restaurantId, day: selectedDay });
        if (!slotDoc) {
            return res.status(400).json({
                success: false,
                message: 'No slot configuration found for this day.'
            });
        }

        const isSlotAvailable = slotDoc.slots.some(s =>
            s.startTime === slot.startTime && s.endTime === slot.endTime
        );

        if (!isSlotAvailable) {
            return res.status(400).json({
                success: false,
                message: 'Selected slot is not available for this day.'
            });
        }

        // Check for duplicate reservation on same date, time, and table
        const duplicate = await Reservation.findOne({
            restaurantId,
            tableId,
            date: new Date(date),
            'slot.startTime': slot.startTime,
            'slot.endTime': slot.endTime
        });

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: 'This table is already booked for the selected slot.'
            });
        }

        const reservation = new Reservation({
            restaurantId,
            tableId,
            date: new Date(date),
            day: selectedDay,
            slot,
            guestCount,
            userId,
            status: 'confirmed'
        });

        await reservation.save();

        // // Optionally send SMS
        // try {
        //     await sendSMS(userId, `Your reservation for ${date} at ${slot.startTime} is confirmed.`);
        // } catch (smsErr) {
        //     console.warn('SMS failed:', smsErr.message);
        // }

        // // Optionally send Email
        // try {
        //     await sendEmail(userId, {
        //         subject: 'Reservation Confirmed',
        //         text: `Reservation confirmed for ${date} from ${slot.startTime} to ${slot.endTime}.`
        //     });
        // } catch (emailErr) {
        //     console.warn('Email failed:', emailErr.message);
        // }

        console.log('Reservation created successfully');
        return res.status(201).json({
            success: true,
            message: 'Reservation created successfully',
            data: reservation
        });

    } catch (error) {
        console.error('Error creating reservation:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
