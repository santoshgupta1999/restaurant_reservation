const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true
        },

        reason: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["Draft", "Active", "Ended", "Expired"],
            default: "Active"
        },

        isFullRestaurantBlock: {
            type: Boolean,
            default: false
        },

        tableIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Table"
            }
        ],

        shiftIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Shift"
            }
        ],

        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            default: null
        },

        startDate: {
            type: Date,
            required: function () {
                return this.status !== "Draft";
            }
        },

        endDate: {
            type: Date,
            required: function () {
                return this.status !== "Draft";
            }
        },

        daysActive: [
            {
                type: String
            }
        ],

        note: {
            type: String,
            default: null
        },

        isActive: {
            type: Boolean,
            default: true
        },

        priority: {
            type: Number
        },

        isExpired: {
            type: Boolean
        },

        startTime: { type: String },

        endTime: { type: String },

        channel: {
            type: String,
            enum: ["online_foh", "online_only", "foh_only"],
            default: "online_foh"
        },

    },
    { timestamps: true }
);

module.exports = mongoose.model("Block", blockSchema);
