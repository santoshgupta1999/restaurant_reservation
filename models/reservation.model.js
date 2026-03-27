const mongoose = require("mongoose");
const Counter = require('./Counter');

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
    reservationNo: {
        type: String,
        unique: true,
        index: true
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
        default: "Confirmed"
    },
    source: {
        type: String,
        enum: ["Online", "Walk-in", "Phone", "Email", "Remi"],
        default: "Phone"
    },
    tags: [
        {
            type: String,
            trim: true
        }
    ],
    seating: {
        type: String,
        enum: ["Any", "Outdoor", "Indoor", "Non Smoking", "Window"],
        default: "Any"
    },

    isConfirmedPolicy: {
        type: Boolean,
        default: false
    },

    notes: String
}, { timestamps: true });


reservationSchema.pre("save", async function (next) {

    if (!this.isNew || this.reservationNo) {
        return next();
    }

    try {

        const counter = await Counter.findOneAndUpdate(
            { name: "reservation_no" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        this.reservationNo = `RES-${String(counter.seq).padStart(6, "0")}`;

        next();

    } catch (err) {
        next(err);
    }

});

module.exports = mongoose.model("Reservation", reservationSchema);
