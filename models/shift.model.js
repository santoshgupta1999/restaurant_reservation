const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["Recurring", "Special"], default: "Recurring" },

        startDate: { type: Date },
        endDate: { type: Date },
        isIndefinite: { type: Boolean, default: false },

        daysActive: [{ type: String }],

        startTime: { type: String, required: true },
        endTime: { type: String, required: true },

        lastBookableTime: { type: String },
        slotInterval: { type: Number, default: 15 },
        leadTime: { type: Number, default: 0 },
        advanceBookingWindow: { type: Number, default: 0 },
        minPartySize: { type: Number, default: 1 },
        maxPartySize: { type: Number, default: 20 },
        bufferTime: { type: Number, default: 15 },
        sameDurationForAll: { type: Boolean, default: true },
        duration: { type: Number },
        durationByPartySize: [
            {
                range: { type: String },
                duration: { type: Number }
            }
        ],
        channel: {
            type: String,
            enum: ["online_foh", "online_only", "foh_only"],
            default: "online_foh"
        },
        includePayment: { type: Boolean, default: false },
        payment: {
            amountPerGuest: { type: Number },
            currency: { type: String, default: "USD" },
            paymentType: { type: String, enum: ["hold", "deposit", null], default: null },
            noFeeCancellationWindow: { type: Number },
        },
        policyNote: { type: String },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Shift", shiftSchema);
