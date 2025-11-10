const { body, param } = require("express-validator");

exports.feedbackValidator = [
    body("restaurantId").notEmpty().withMessage("Restaurant ID is required").isMongoId(),
    body("rating").notEmpty().withMessage("Rating is required").isFloat({ min: 1, max: 5 }),
    body("guestName").optional().isString(),
    body("comment").optional().isString()
];

exports.updateFeedbackValidator = [
    param("id").isMongoId().withMessage("Invalid Feedback ID"),
    body("rating").optional().isFloat({ min: 1, max: 5 }),
    body("comment").optional().isString()
];
