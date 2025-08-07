const { body } = require('express-validator');

exports.dishValidator = [
    body('name')
        .notEmpty()
        .withMessage('Valid dish name is required'),
    body('description')
        .optional({ checkFalsy: true }),
    body('price')
        .notEmpty()
        .withMessage('Dish price is required')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    body('restaurantId')
        .notEmpty()
        .withMessage('Restaurant ID is required')
];
