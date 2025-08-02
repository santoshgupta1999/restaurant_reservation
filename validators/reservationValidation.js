const { body } = require('express-validator');

exports.reservationValidator = [
    body('restaurantId')
        .notEmpty().withMessage('Restaurant ID is required')
        .isMongoId().withMessage('Invalid Restaurant ID'),

    body('tableId')
        .notEmpty().withMessage('Table ID is required')
        .isMongoId().withMessage('Invalid Table ID'),

    body('date')
        .notEmpty().withMessage('Date is required')
        .isISO8601().toDate().withMessage('Invalid date format'),

    body('guestCount')
        .notEmpty().withMessage('Guest count is required')
        .isInt({ min: 1 }).withMessage('Guest count must be at least 1'),

    body('slot')
        .notEmpty().withMessage('Slot is required')
        .isObject().withMessage('Slot must be an object'),

    body('slot.startTime')
        .notEmpty().withMessage('Slot start time is required')
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid start time format (HH:mm)'),

    body('slot.endTime')
        .notEmpty().withMessage('Slot end time is required')
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid end time format (HH:mm)')
];
