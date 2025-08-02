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
    }
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);
