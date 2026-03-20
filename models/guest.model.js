const mongoose = require("mongoose");
const Counter = require("./Counter");

function capitalize(value) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const guestSchema = new mongoose.Schema(
    {
        remiId: {
            type: String,
            unique: true,
            index: true
        },

        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true
        },
        firstName: { type: String, set: capitalize },
        lastName: { type: String, set: capitalize },
        gender: { type: String, enum: ["Male", "Female", "Other", "Prefer not to say", "N/A"], default: "N/A" },
        dob: { type: Date },
        anniversary: { type: Date },
        secondaryEmail: { type: String },
        secondaryPhone: { type: String },
        address: { type: String },
        marketingOptIn: {
            type: Boolean,
            default: false
        },
        email: { type: String },
        phone: { type: String },
        countryCode: {
            type: String,
            default: "+961"
        },
        notes: { type: String },
        tags: [
            {
                type: String,
                trim: true
            }
        ],
        jobTitle: { type: String },
        company: { type: String },

        preffered: { type: String },

        totalVisits: { type: Number, default: 0 },
        lastVisitAt: { type: Date },
        upcomingVisitAt: { type: Date },

        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

guestSchema.pre("save", async function (next) {
    // agar remiId already hai → skip
    if (this.remiId) return next();

    try {
        const counter = await Counter.findOneAndUpdate(
            { name: "remi_user" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        this.remiId = `RU-${String(counter.seq).padStart(3, "0")}`;
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model("Guest", guestSchema);
