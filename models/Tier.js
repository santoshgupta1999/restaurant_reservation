const mongoose = require("mongoose");

const tierSchema = new mongoose.Schema(
    {
        tierName: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        description: {
            type: String,
            default: ""
        },

        status: {
            type: String,
            enum: ["Active", "Archived"],
            default: "Active"
        },

        basePrice: {
            type: Number,
            default: 0
        },

        // 🔘 Feature Flags
        features: {
            List_view: {
                type: Boolean,
                default: true,   // always ON
                immutable: true  // editable nahi
            },
            Floor_plan: { type: Boolean, default: false },
            CRM: { type: Boolean, default: false },
            Feedback_Dashboard: { type: Boolean, default: false },
            Card_Holds: { type: Boolean, default: false },
            Reservation_Preferences: { type: Boolean, default: false },
            Waitlist: { type: Boolean, default: false },
            Widget_Customization: { type: Boolean, default: false }
        },

        // 📊 Limits
        limits: {
            maxMonthlyBookings: { type: Number, default: 0 }, // 0 = unlimited
            maxStaffAccounts: { type: Number, default: 0 },
            maxRooms: { type: Number, default: 0 }
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }

    },
    { timestamps: true }
);

module.exports = mongoose.model("Tier", tierSchema);
