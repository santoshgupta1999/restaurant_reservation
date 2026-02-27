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

    notes: String
}, { timestamps: true });

reservationSchema.pre("findOneAndUpdate", async function (next) {
    const doc = await this.model.findOne(this.getQuery());

    if (doc && doc.status === "Finished") {
        return next(new Error("Finished reservation cannot be modified."));
    }

    next();
});

reservationSchema.pre("save", function (next) {
    if (!this.isNew && this.status === "Finished") {
        return next(new Error("Finished reservation cannot be modified."));
    }
    next();
});

module.exports = mongoose.model("Reservation", reservationSchema);
