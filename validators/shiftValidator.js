const { body } = require('express-validator');

exports.shiftValidator = [
    body("restaurantId")
        .notEmpty()
        .withMessage("Restaurant ID is required.")
        .isMongoId()
        .withMessage("Invalid restaurant ID."),

    body("name")
        .notEmpty()
        .withMessage("Shift name is required.")
        .isIn(["Breakfast", "Lunch", "Dinner", "Brunch"])
        .withMessage("Shift name must be one of: Breakfast, Lunch, Dinner, Brunch."),

    body("type")
        .optional()
        .isIn(["Recurring", "Special"])
        .withMessage("Shift type must be 'Recurring' or 'Special'."),

    body("startTime")
        .notEmpty()
        .withMessage("Start time is required.")
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage("Invalid time format (HH:mm)."),

    body("endTime")
        .notEmpty()
        .withMessage("End time is required.")
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage("Invalid time format (HH:mm)."),

    body("daysActive")
        .optional()
        .isArray()
        .withMessage("daysActive must be an array of weekday names."),

    body("startDate")
        .optional()
        .isISO8601()
        .toDate()
        .withMessage("Invalid startDate format."),

    body("endDate")
        .optional()
        .isISO8601()
        .toDate()
        .withMessage("Invalid endDate format.")
        .custom((endDate, { req }) => {
            if (req.body.startDate && new Date(endDate) < new Date(req.body.startDate)) {
                throw new Error("endDate must be after startDate.");
            }
            return true;
        }),

    body("slotInterval")
        .optional()
        .isInt({ min: 5, max: 120 })
        .withMessage("slotInterval must be between 5 and 120 minutes."),

    body("minPartySize")
        .optional()
        .isInt({ min: 1 })
        .withMessage("minPartySize must be at least 1."),

    body("maxPartySize")
        .optional()
        .isInt({ min: 1 })
        .withMessage("maxPartySize must be at least 1."),

    body("bufferTime")
        .optional()
        .isInt({ min: 0 })
        .withMessage("bufferTime must be a positive number."),

    body("policyNote")
        .optional()
        .isString()
        .withMessage("policyNote must be a string.")
];
