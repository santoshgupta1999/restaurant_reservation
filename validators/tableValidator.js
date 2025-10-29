const { body } = require('express-validator');

exports.tableValidator = [
    body('restaurantId')
        .notEmpty().withMessage('Restaurant ID is required.')
        .isMongoId().withMessage('Invalid Restaurant ID.'),

    body('roomName')
        .notEmpty().withMessage('Room name is required.')
        .isIn(['Main Dining', 'First Floor', 'Bar'])
        .withMessage('Invalid room name.'),

    body('tableNumber')
        .notEmpty().withMessage('Table number is required.'),

    body('capacity')
        .notEmpty().withMessage('Capacity is required.')
        .isInt({ min: 1 }).withMessage('Capacity must be a positive number.')
];
