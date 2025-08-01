// models/slot.model.js
const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
    startTime: { type: String, required: true }, // Format: "HH:mm"
    endTime: { type: String, required: true }
}, { _id: false });

const slotSchema = new mongoose.Schema({
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
    },
    slots: {
        type: [timeSlotSchema],
        required: true
    }
}, { timestamps: true });

slotSchema.index({ restaurantId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('Slot', slotSchema);
