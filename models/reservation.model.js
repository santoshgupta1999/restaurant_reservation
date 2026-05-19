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
    tableIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table"
    }],
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
        enum: ["Pending", "Confirmed", "Seated", "Cancelled", "No-Show", "Finished", "Upcoming", "Arrived"],
        default: "Confirmed"
    },
    source: {
        type: String,
        enum: ["Online", "Walk-in", "Phone", "Email-Message", "Remi", "shared_link"],
        default: "Phone"
    },
    tags: [
        {
            type: String,
            trim: true
        }
    ],
    seating: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SeatingPreference"
    },

    isConfirmedPolicy: {
        type: Boolean,
        default: false
    },

    arrivedAt: {
        type: Date,
        default: null
    },

    seatedAt: {
        type: Date,
        default: null
    },

    finishedAt: {
        type: Date,
        default: null
    },

    reminderSentAt: {
        type: Date,
        default: null
    },

    isLegacy: {
        type: Boolean,
        default: false
    },

    legacyReason: {
        type: String,
        default: null
    },

    cancellation: {
        reason: {
            type: String,
            default: null
        },
        source: {
            type: String,
            enum: ["foh", "guest", "block", "shift", "table", "seating_preference"],
            default: null
        },
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        at: {
            type: Date,
            default: null
        }
    },

    notes: String
}, { timestamps: true });

reservationSchema.index({
    status: 1,
    date: 1
});


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
