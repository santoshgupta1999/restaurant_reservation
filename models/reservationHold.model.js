const mongoose = require("mongoose");

const ReservationHoldSchema = new mongoose.Schema(
    {

        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true
        },

        tableIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Table",
                required: true
            }
        ],

        date: {
            type: String,
            required: true
        },

        time: {
            type: String,
            required: true
        },

        source: {
            type: String,
            default: "Widget"
        },

        expiresAt: {
            type: Date,
            required: true,
            index: {
                expires: 0
            }
        }

    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "ReservationHold",
    ReservationHoldSchema
);
