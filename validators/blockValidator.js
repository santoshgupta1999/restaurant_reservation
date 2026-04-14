const { body } = require("express-validator");

exports.blockValidator = [

    body("restaurantId")
        .notEmpty().withMessage("restaurantId is required")
        .isMongoId().withMessage("Invalid restaurantId"),

    body("reason")
        .notEmpty().withMessage("reason is required")
        .isLength({ min: 3, max: 60 })
        .withMessage("reason must be between 3 and 60 characters"),

    body("status")
        .optional()
        .isIn(["Draft", "Active"])
        .withMessage("status must be Draft or Active"),

    /* ================= DATE ================= */

    body("startDate")
        .if(body("status").not().equals("Draft"))
        .notEmpty().withMessage("startDate is required")
        .isISO8601().withMessage("Invalid startDate"),

    body("endDate")
        .if(body("status").not().equals("Draft"))
        .notEmpty().withMessage("endDate is required")
        .isISO8601().withMessage("Invalid endDate"),

    /* ================= BLOCK TYPE ================= */

    body("isFullRestaurantBlock")
        .optional()
        .isBoolean()
        .withMessage("isFullRestaurantBlock must be boolean"),

    body("roomId")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("Invalid roomId"),

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

    // body("note")
    //     .optional()
    //     .isString()
    //     .withMessage("note must be a string"),

    /* ================= CUSTOM LOGIC ================= */

    body().custom((value) => {
        const { status, isFullRestaurantBlock, roomId, tableIds } = value;

        if (status === "Draft") return true;

        if (isFullRestaurantBlock) return true;
        if (roomId) return true;
        if (tableIds && tableIds.length > 0) return true;

        throw new Error(
            "Provide isFullRestaurantBlock=true OR roomId OR tableIds[]"
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
        .isLength({ min: 3, max: 60 })
        .withMessage("reason must be between 3 and 60 characters"),

    body("status")
        .optional()
        .isIn(["Draft", "Active", "Expired"])
        .withMessage("Invalid status"),

    body("startDate")
        .optional()
        .isISO8601()
        .withMessage("Invalid startDate"),

    body("endDate")
        .optional()
        .isISO8601()
        .withMessage("Invalid endDate"),

    body("isFullRestaurantBlock")
        .optional()
        .isBoolean()
        .withMessage("isFullRestaurantBlock must be boolean"),

    body("roomId")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("Invalid roomId"),

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

    // body("note")
    //     .optional()
    //     .isString()
    //     .withMessage("note must be a string")
];
