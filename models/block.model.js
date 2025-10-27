const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["Maintenance", "Closed", "Day Off"], default: "Maintenance" },
        tableIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Table" }],
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        daysActive: [{ type: String }],
        slotIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Slot" }],
        isActive: { type: Boolean, default: true },
        note: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Block", blockSchema);
