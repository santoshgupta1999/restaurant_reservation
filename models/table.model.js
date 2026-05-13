const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
        },

        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            required: true
        },

        tableNumber: {
            type: String,
            required: true,
            trim: true,
        },

        displayName: {
            type: String,
            trim: true,
            default: null,
        },

        capacity: {
            type: Number,
            required: true,
            min: 1,
        },
        //

        min: {
            type: Number,
            default: 1
        },
        max: {
            type: Number,
            default: 6
        },
        width: {
            type: Number,
            default: 0
        },
        length: {
            type: Number,
            default: 0
        },

        channel: {
            type: String,
            enum: ["online_foh", "online_only", "foh_only"],
            default: "online_foh",
        },

        shape: {
            type: String,
            enum: ["Square", "Round", "Rectangle"],
            default: "Square",
        },

        status: {
            type: String,
            enum: ["Available", "Reserved", "Seated", "OutOfService"],
            default: "Available",
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        isJoined: {
            type: Boolean,
            default: false,
        },

        joinedWith: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Table",
                default: [],
            },
        ],

        position: {
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 },
        },

        rotation: {
            type: Number,
            default: 0,
        },
        lockedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        lockReason: {
            type: String,
            default: null
        },

        isLegacy: {
            type: Boolean,
            default: false
        },

        lockedAt: {
            type: Date,
            default: null
        },
    },
    { timestamps: true }
);

tableSchema.index(
    { restaurantId: 1, roomId: 1, tableNumber: 1 },
    { unique: true }
);

tableSchema.index(
    { restaurantId: 1, roomId: 1, "position.x": 1, "position.y": 1 },
    { unique: true }
);


module.exports = mongoose.model("Table", tableSchema);
