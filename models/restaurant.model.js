const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
        },
        address: {
            type: String,
            required: true,
        },
        openingHours: {
            type: String,
            required: true,
            match: [/^([1-9]|1[0-2])(AM|PM)-([1-9]|1[0-2])(AM|PM)$/, 'Invalid opening hours format']
        },
        cuisine: {
            type: [String],
            default: []
            // Example: ["Italian", "Chinese"]
        },
        logo: {
            type: String
        },
        images: {
            type: [String],
            default: []
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active'
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Restaurant', restaurantSchema);
