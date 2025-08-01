// models/reservation.model.js
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    tableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    day: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    slot: {
        startTime: { type: String, required: true }, // "HH:mm"
        endTime: { type: String, required: true }
    },
    guestCount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Reservation', reservationSchema);
