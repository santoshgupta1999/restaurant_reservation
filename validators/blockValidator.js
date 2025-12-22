const { body } = require("express-validator");

exports.blockValidator = [
    body("restaurantId")
        .notEmpty()
        .withMessage("restaurantId is required")
        .isMongoId()
        .withMessage("Invalid restaurantId"),

    body("reason")
        .notEmpty()
        .withMessage("reason is required"),

    body("startDate")
        .notEmpty()
        .withMessage("startDate is required")
        .isISO8601()
        .withMessage("startDate must be a valid date"),

    body("endDate")
        .notEmpty()
        .withMessage("endDate is required")
        .isISO8601()
        .withMessage("endDate must be a valid date"),

    // CASE 1: Full Restaurant Block
    body("isFullRestaurantBlock")
        .optional()
        .isBoolean()
        .withMessage("isFullRestaurantBlock must be boolean"),

    // CASE 2: Room Block
    body("roomName")
        .optional()
        .isString()
        .withMessage("Block name is required")
        .isLength({ min: 3, max: 60 })
        .withMessage("roomName must be between 3 and 60 characters"),

    // CASE 3: Table Block
    body("tableIds")
        .optional()
        .isArray()
        .withMessage("tableIds must be an array"),

    body("tableIds.*")
        .optional()
        .isMongoId()
        .withMessage("Each tableId must be valid"),

    // Shift IDs
    body("shiftIds")
        .optional()
        .isArray()
        .withMessage("shiftIds must be an array"),
    body("shiftIds.*")
        .optional()
        .isMongoId()
        .withMessage("Invalid shiftId"),

    body("daysActive")
        .optional()
        .isArray()
        .withMessage("daysActive must be an array"),

    body("note")
        .optional()
        .isString()
        .withMessage("note must be string"),

    // Custom Validation Logic
    body()
        .custom((value) => {
            const { isFullRestaurantBlock, roomName, tableIds } = value;

            if (isFullRestaurantBlock) return true; // No need for tables or room

            if (roomName) return true; // Room block valid

            if (tableIds && tableIds.length > 0) return true; // Table block valid

            throw new Error(
                "Provide either isFullRestaurantBlock=true OR roomName OR tableIds[]"
            );
        })
];


exports.updateBlockValidator = [
    body("restaurantId")
        .optional()
        .isMongoId()
        .withMessage("Invalid restaurantId"),

    body("reason")
        .optional()
        .isString(),

    body("startDate")
        .optional()
        .isISO8601()
        .withMessage("startDate must be valid date"),

    body("endDate")
        .optional()
        .isISO8601()
        .withMessage("endDate must be valid date"),

    body("isFullRestaurantBlock")
        .optional()
        .isBoolean(),

    body("roomName")
        .optional()
        .isString(),

    body("tableIds")
        .optional()
        .isArray(),
    body("tableIds.*")
        .optional()
        .isMongoId(),

    body("shiftIds")
        .optional()
        .isArray(),
    body("shiftIds.*")
        .optional()
        .isMongoId(),

    body("daysActive")
        .optional()
        .isArray(),

    body("note")
        .optional()
        .isString()
];
