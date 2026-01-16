const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true
        },
        firstName: { type: String, required: true },
        lastName: { type: String },
        gender: { type: String, enum: ["Male", "Female", "Other", "Prefer not to say"], default: "Prefer not to say" },
        dob: { type: Date },
        email: { type: String },
        phone: { type: String },
        notes: { type: String },
        tags: [
            {
                type: String,
                trim: true
            }
        ],
        jobTitle: { type: String },
        company: { type: String },

        totalVisits: { type: Number, default: 0 },
        lastVisitAt: { type: Date },
        upcomingVisitAt: { type: Date },

        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Guest", guestSchema);
