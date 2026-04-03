const mongoose = require("mongoose");
const Counter = require("./Counter");

function capitalize(value) {
    if (!value) return value;

    return value
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
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
        gender: {
            type: String,
            enum: ["Male", "Female", "Other", "Prefer not to say", "N/A"],
            default: "N/A",
            set: (value) => {
                if (!value) return "N/A";

                const map = {
                    male: "Male",
                    female: "Female",
                    other: "Other"
                };

                return map[value.toLowerCase()] || value;
            }
        },
        dob: { type: Date },
        anniversary: { type: Date },
        secondaryEmail: { type: String },
        secondaryPhone: { type: String },
        address: { type: String },
        marketingOptIn: {
            type: Boolean,
            default: false
        },
        email: {
            type: String,
            lowercase: true,
            trim: true
        },
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

guestSchema.index(
    { restaurantId: 1, email: 1 },
    { unique: true, sparse: true }
);

guestSchema.index(
    { restaurantId: 1, phone: 1 },
    { unique: true, sparse: true }
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

        this.remiId = `RU-${String(counter.seq).padStart(6, "0")}`;
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model("Guest", guestSchema);
