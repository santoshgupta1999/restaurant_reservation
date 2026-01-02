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
            enum: ["Draft", "Active", "Ended"],
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
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Block", blockSchema);
