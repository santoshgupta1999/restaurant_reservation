const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: true
    },
    tableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table"
    },
    shiftId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shift"
    },
    guestName: {
        type: String,
        required: true
    },
    guestEmail: {
        type: String,
        required: true
    },
    guestPhone: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    partySize: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["Pending", "Confirmed", "Seated", "Canceled", "No-show", "Finished"],
        default: "Pending"
    },
    source: {
        type: String,
        enum: ["Online", "Walk-in", "Phone"],
        default: "Online"
    },
    notes: String
}, { timestamps: true });

module.exports = mongoose.model("Reservation", reservationSchema);
