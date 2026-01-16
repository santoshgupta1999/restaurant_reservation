const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: true
    },
    guestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Guest",
    },
    tableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table"
    },
    shiftId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shift"
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
        enum: ["Pending", "Confirmed", "Seated", "Cancelled", "No-show", "Finished"],
        default: "Pending"
    },
    source: {
        type: String,
        enum: ["Online", "Walk-in", "Phone", "Email", "Remi"],
        default: "Phone"
    },
    seating: {
        type: String,
        enum: ["Any", "Outdoor", "Indoor", "Non Smoking", "Window"],
        default: "Any"
    },

    notes: String
}, { timestamps: true });

module.exports = mongoose.model("Reservation", reservationSchema);
