const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    roomName: {
        type: String,
        enum: ['Main Dining', 'First Floor', 'Bar'],
        required: true
    },
    tableNumber: { type: String, required: true },
    capacity: { type: Number, required: true },
    status: {
        type: String,
        enum: ["Available", "Reserved", "Seated", "OutOfService"],
        default: "Available"
    },
    position: {
        x: Number,
        y: Number
    }
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
