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
            type: Map,
            of: String,
            default: {}
            // Example: { "mon": "9AM-10PM", "tue": "9AM-10PM" }
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
