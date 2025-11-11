const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
        type: String,
        enum: ["Reminder", "System", "Feedback", "Reservation"],
        default: "System",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    link: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
