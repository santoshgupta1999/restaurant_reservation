const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    tableNumber: {
        type: String,
        required: true,
        unique: true
    },
    seatCount: {
        type: Number,
        required: true
    },
    areaName: {
        type: String,
        enum: ['Main Dining', 'First Floor', 'Bar'],
        required: true
    }
}, { timestamps: true });

tableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model('Table', tableSchema);
