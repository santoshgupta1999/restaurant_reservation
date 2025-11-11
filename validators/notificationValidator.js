const { body, param } = require("express-validator");

exports.createNotificationValidator = [
    body("recipientId")
        .notEmpty().withMessage("Recipient ID is required.")
        .isMongoId().withMessage("Invalid recipient ID."),
    body("title").notEmpty().withMessage("Title is required."),
    body("message").notEmpty().withMessage("Message is required."),
    body("type")
        .optional()
        .isIn(["Reminder", "System", "Feedback", "Reservation"])
        .withMessage("Invalid notification type."),
];

exports.updateNotificationStatusValidator = [
    param("id").isMongoId().withMessage("Invalid notification ID."),
    body("isRead")
        .notEmpty().withMessage("isRead field is required.")
        .isBoolean().withMessage("isRead must be true or false."),
];
