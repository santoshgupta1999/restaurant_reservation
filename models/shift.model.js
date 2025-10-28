const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["Recurring", "Special"], default: "Recurring" },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        daysActive: [{ type: String }],
        startDate: { type: Date },
        endDate: { type: Date },
        isIndefinite: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        lastBookableTime: { type: String },
        slotInterval: { type: Number, default: 15 },
        minPartySize: { type: Number, default: 1 },
        maxPartySize: { type: Number, default: 20 },
        bufferTime: { type: Number, default: 15 },
        policyNote: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Shift", shiftSchema);
