const { body } = require("express-validator");

exports.blockValidator = [
    body("restaurantId")
        .notEmpty().withMessage("restaurantId is required")
        .isMongoId().withMessage("Invalid restaurantId"),

    body("reason")
        .notEmpty().withMessage("reason is required")
        .isIn(["Maintenance", "Closed", "Day Off"])
        .withMessage("Invalid reason"),

    body("status")
        .optional()
        .isIn(["Draft", "Active"])
        .withMessage("status must be Draft or Active"),

    // startDate & endDate only REQUIRED if status !== Draft
    body("startDate")
        .if(body("status").not().equals("Draft"))
        .notEmpty().withMessage("startDate is required")
        .isISO8601().withMessage("Invalid startDate"),

    body("endDate")
        .if(body("status").not().equals("Draft"))
        .notEmpty().withMessage("endDate is required")
        .isISO8601().withMessage("Invalid endDate"),

    body("isFullRestaurantBlock")
        .optional()
        .isBoolean().withMessage("isFullRestaurantBlock must be boolean"),

    body("roomName")
        .optional()
        .isString()
        .isLength({ min: 3, max: 60 })
        .withMessage("roomName must be between 3 and 60 characters"),

    body("tableIds")
        .optional()
        .isArray()
        .withMessage("tableIds must be an array"),

    body("tableIds.*")
        .optional()
        .isMongoId()
        .withMessage("Invalid tableId"),

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
        .isString(),

    body().custom((value) => {
        const { status, isFullRestaurantBlock, roomName, tableIds } = value;

        if (status === "Draft") return true;

        if (isFullRestaurantBlock) return true;
        if (roomName) return true;
        if (tableIds && tableIds.length > 0) return true;

        throw new Error(
            "Provide isFullRestaurantBlock=true OR roomName OR tableIds[]"
        );
    }),
];


exports.updateBlockValidator = [
    body("restaurantId").optional().isMongoId(),

    body("reason")
        .optional()
        .isIn(["Maintenance", "Closed", "Day Off"]),

    body("status")
        .optional()
        .isIn(["Draft", "Active", "Ended"])
        .withMessage("Invalid status"),

    body("startDate")
        .optional()
        .isISO8601(),

    body("endDate")
        .optional()
        .isISO8601(),

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
