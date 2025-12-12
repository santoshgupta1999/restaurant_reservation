const { body } = require("express-validator");

exports.shiftValidator = [
    body("restaurantId")
        .notEmpty().withMessage("Restaurant ID is required.")
        .isMongoId().withMessage("Invalid restaurant ID."),

    body("name")
        .notEmpty().withMessage("Shift name is required.")
        .isString().withMessage("Shift name must be a string."),

    body("type")
        .optional()
        .isIn(["Recurring", "Special"])
        .withMessage("Shift type must be 'Recurring' or 'Special'."),

    body("startTime")
        .notEmpty().withMessage("Start time is required.")
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage("Invalid time format (HH:mm)."),

    body("endTime")
        .notEmpty().withMessage("End time is required.")
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .withMessage("Invalid time format (HH:mm)."),

    body("daysActive")
        .optional()
        .isArray().withMessage("daysActive must be an array.")
        .custom(arr => {
            const valid = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
            arr.forEach(d => {
                if (!valid.includes(d)) {
                    throw new Error(`Invalid day: ${d}`);
                }
            });
            return true;
        }),

    body("startDate")
        .optional()
        .isISO8601().toDate()
        .withMessage("Invalid startDate format."),

    body("endDate")
        .optional()
        .isISO8601().toDate()
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

    body("leadTime")
        .optional()
        .isInt({ min: 0 })
        .withMessage("leadTime must be 0 or a positive number (minutes)."),

    body("advanceBookingWindow")
        .optional()
        .isInt({ min: 0 })
        .withMessage("advanceBookingWindow must be a positive number (days)."),

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

    body("sameDurationForAll")
        .optional()
        .isBoolean()
        .withMessage("sameDurationForAll must be true or false.")
        .toBoolean(),

    body("duration")
        .optional()
        .isInt({ min: 1 })
        .withMessage("duration must be a positive number (minutes)."),

    body("durationByPartySize")
        .optional()
        .isArray().withMessage("durationByPartySize must be an array."),

    body("durationByPartySize.*.range")
        .optional()
        .isString()
        .withMessage("range must be a string (e.g., '1-2 pax')."),

    body("durationByPartySize.*.duration")
        .optional()
        .isInt({ min: 1 })
        .withMessage("duration must be a positive number (minutes)."),

    body("channel")
        .optional()
        .isIn(["online_foh", "online_only", "foh_only"])
        .withMessage("channel must be one of: online_foh, online_only, foh_only."),

    body("includePayment")
        .optional()
        .isBoolean()
        .withMessage("includePayment must be true or false.")
        .toBoolean(),

    body("payment.amountPerGuest")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("amountPerGuest must be 0 or a positive number."),

    body("payment.currency")
        .optional()
        .isString()
        .withMessage("currency must be a string."),

    body("payment.paymentType")
        .optional()
        .isIn(["hold", "deposit", null])
        .withMessage("paymentType must be 'hold', 'deposit', or null."),

    body("payment.noFeeCancellationWindow")
        .optional()
        .isInt({ min: 0 })
        .withMessage("noFeeCancellationWindow must be 0 or a positive number (hours)."),

    body("policyNote")
        .optional()
        .isString()
        .withMessage("policyNote must be a string.")
];
