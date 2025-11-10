const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
    {
        reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation" },
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" },
        guestName: { type: String },
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String },
        respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
