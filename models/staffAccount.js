const mongoose = require('mongoose');

const staffAccountSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: true,
        },

        password: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            required: true,
        },

        status: {
            type: String,
            required: true,
        },

        lastLogin: {
            type: String,
            default: null,
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('staffAccount', staffAccountSchema);
