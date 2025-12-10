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
            required: true
        },

        endDate: {
            type: Date,
            required: true
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
