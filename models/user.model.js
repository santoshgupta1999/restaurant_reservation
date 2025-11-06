const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        phone: String,
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['admin', 'host', 'marketer', 'manager'],
            default: 'manager',
        },
        profileImage: {
            type: String,
            default: null,
        },
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant"
        },
        isActive: {
            type: Boolean,
            default: true
        },
        lastLogin: {
            type: Date
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
