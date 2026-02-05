const mongoose = require("mongoose");

const SeatingPreferenceSchema = new mongoose.Schema(
    {
        preferenceName: {
            type: String,
            required: true,
            trim: true
        },

        startDate: {
            type: Date,
            required: true
        },

        endDate: {
            type: Date,
            default: null // optional, handle via controller
        },

        indefinite: {
            type: Boolean,
            default: false
        },

        activeDays: {
            type: [String],
            enum: [
                "Mo",
                "Tu",
                "We",
                "Th",
                "Fr",
                "Sa",
                "Su"
            ],
            required: true
        },

        firstBookingTime: {
            type: String, // HH:mm
            required: true
        },

        lastBookingTime: {
            type: String, // HH:mm
            required: true
        },

        tableAssignment: {
            type: [String],
            required: true
        },

        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active",
            index: true
        },

    },
    {
        timestamps: true
    }
);

/* ================== VALIDATIONS ================== */

// startDate < endDate
SeatingPreferenceSchema.pre("save", function (next) {
    if (this.endDate && this.startDate > this.endDate) {
        return next(
            new Error("Start date must be earlier than end date")
        );
    }
    next();
});

// // firstBookingTime < lastBookingTime
// SeatingPreferenceSchema.pre("save", function (next) {
//     if (this.firstBookingTime >= this.lastBookingTime) {
//         return next(
//             new Error("First booking time must be earlier than last booking time")
//         );
//     }
//     next();
// });

module.exports = mongoose.model(
    "SeatingPreference",
    SeatingPreferenceSchema
);
