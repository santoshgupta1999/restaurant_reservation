const Dish = require('../models/dish.model');


exports.createDish = async (req, res) => {
    try {
        const { name, description, price, restaurantId, isAvailable } = req.body;

        const images = req.files?.length
            ? req.files.map(file => file.filename)
            : [];

        const newDish = new Dish({
            name,
            description,
            price,
            restaurantId,
            isAvailable,
            images
        });

        await newDish.save();

        res.status(201).json({
            success: true,
            message: 'Dish created successfully',
            data: newDish
        });

    } catch (error) {
        console.error('Error creating dish:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create dish',
            error: error.message
        });
    }
};
