const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema(
    {
        firstName: { type: String, required: true },
        lastName: { type: String },
        gender: { type: String, enum: ["Male", "Female", "Other", "Prefer not to say"], default: "Prefer not to say" },
        dob: { type: Date },
        email: { type: String },
        phone: { type: String },
        notes: { type: String },
        tags: [{ type: String }],

        totalVisits: { type: Number, default: 0 },
        totalSpend: { type: Number, default: 0 },

        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Guest", guestSchema);
