const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
        },

        roomName: {
            type: String,
            enum: ["Main Dining", "First Floor", "Bar", "Outdoor", "Terrace"],
            required: true,
        },

        tableNumber: {
            type: String,
            required: true,
            trim: true,
        },

        displayName: {
            type: String,
            trim: true,
            default: null, // it's optional field for display label (e.g., “T1”, “VIP-01”)
        },

        capacity: {
            type: Number,
            required: true,
            min: 1,
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
    },
    { timestamps: true }
);

tableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model("Table", tableSchema);
