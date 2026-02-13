const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

    },
    { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
