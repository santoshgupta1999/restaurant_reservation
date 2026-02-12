const mongoose = require("mongoose");

const roomDecorativeSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true
        },

        roomName: {
            type: String,
            required: true
        },

        name: {
            type: String,
            required: true
        },

        width: { type: Number, default: 0 },
        length: { type: Number, default: 0 },

        position: {
            x: { type: Number, required: true },
            y: { type: Number, required: true }
        },

        rotation: {
            type: Number,
            default: 0
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

roomDecorativeSchema.index(
    { restaurantId: 1, roomName: 1, "position.x": 1, "position.y": 1 },
    { unique: true }
);

roomDecorativeSchema.index(
    { restaurantId: 1, roomName: 1, name: 1 },
    { unique: true }
);

module.exports = mongoose.model("RoomDecorative", roomDecorativeSchema);
