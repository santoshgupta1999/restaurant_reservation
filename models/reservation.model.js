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
    firstName: {
        type: String,
        required: true
    },
    lastName: {
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
        enum: ["Pending", "Confirmed", "Seated", "Cancelled", "No-show", "Finished"],
        default: "Pending"
    },
    source: {
        type: String,
        enum: ["Online", "Walk-in", "Phone", "Email", "Remi"],
        default: "Online"
    },
    seating: {
        type: String,
        enum: ["Any", "Outdoor", "Indoor", "Non Smoking", "Window"],
        default: "Any"
    },
    tag: {
        type: String
    },
    constraint: {
        type: String
    },
    logistic: {
        type: String
    },
    behavior: {
        type: String
    },

    notes: String
}, { timestamps: true });

module.exports = mongoose.model("Reservation", reservationSchema);
