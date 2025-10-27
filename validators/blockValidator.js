const { body } = require('express-validator');

exports.blockValidator = [
    body("restaurantId")
        .notEmpty()
        .withMessage("Restaurant ID is required.")
        .isMongoId()
        .withMessage("Invalid Restaurant ID."),

    body("name")
        .notEmpty()
        .withMessage("Block name is required.")
        .isString()
        .withMessage("Block name must be a string."),

    body("type")
        .optional()
        .isIn(["Maintenance", "Closed", "Day Off"])
        .withMessage("Invalid block type. Allowed values: Maintenance, Closed, Day Off."),

    body("tableIds")
        .optional()
        .isArray()
        .withMessage("tableIds must be an array of Mongo IDs."),

    body("tableIds.*")
        .optional()
        .isMongoId()
        .withMessage("Invalid table ID in tableIds array."),

    body("slotIds")
        .optional()
        .isArray()
        .withMessage("slotIds must be an array of Mongo IDs."),

    body("slotIds.*")
        .optional()
        .isMongoId()
        .withMessage("Invalid slot ID in slotIds array."),

    body("startDate")
        .notEmpty()
        .withMessage("Start date is required.")
        .isISO8601()
        .toDate()
        .withMessage("Invalid start date format."),

    body("endDate")
        .notEmpty()
        .withMessage("End date is required.")
        .isISO8601()
        .toDate()
        .withMessage("Invalid end date format.")
        .custom((endDate, { req }) => {
            if (new Date(endDate) < new Date(req.body.startDate)) {
                throw new Error("End date must be after start date.");
            }
            return true;
        }),

    body("daysActive")
        .optional()
        .isArray()
        .withMessage("daysActive must be an array (e.g., ['Monday', 'Tuesday'])."),

    body("note")
        .optional()
        .isString()
        .withMessage("Note must be a string.")
];
