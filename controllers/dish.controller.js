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

exports.getDishById = async (req, res) => {
    try {
        const dish = await Dish.findById(req.params.id);

        if (!dish) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found'
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}/uploads/dishes/`;

        const dishWithImageUrls = {
            ...dish.toObject(),
            images: dish.images.map(img => baseUrl + img)
        };

        return res.status(200).json({
            success: true,
            message: 'Dish fetched successfully',
            data: dishWithImageUrls
        });

    } catch (error) {
        console.error('Error fetching dish', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dish',
            error: error.message
        });
    }
};


exports.getDishesByRestaurantId = async (req, res) => {
    try {
        const dishes = await Dish.find({ restaurantId: req.params.restaurantId });

        if (!dishes || dishes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No dishes found for this restaurant'
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}/uploads/dishes/`;

        const updatedDishes = dishes.map(dish => {
            return {
                ...dish.toObject(),
                images: dish.images.map(img => baseUrl + img)
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Dishes fetched successfully',
            data: updatedDishes
        });

    } catch (error) {
        console.error('Error fetching dishes', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dishes',
            error: error.message
        });
    }
};

exports.getAllDishes = async (req, res) => {
    try {
        const { search } = req.query;

        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const dishes = await Dish.find(query);

        const baseUrl = `${req.protocol}://${req.get('host')}/uploads/dishes/`;

        const updatedDishes = dishes.map(dish => ({
            ...dish.toObject(),
            images: dish.images.map(img => baseUrl + img)
        }));

        return res.status(200).json({
            success: true,
            message: 'Dishes fetched successfully',
            data: updatedDishes
        });

    } catch (error) {
        console.error('Error fetching dishes:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching dishes',
            error: error.message
        });
    }
};

exports.updateDishById = async (req, res) => {
    try {
        const { name, description, price, restaurantId } = req.body;
        const dish = await Dish.findById(req.params.id);

        if (!dish) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found'
            });
        }

        if (req.files && req.files.length > 0) {
            if (dish.images && dish.images.length > 0) {
                for (const img of dish.images) {
                    const imgPath = path.join(__dirname, '../uploads/dishes', img);
                    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                }
            }
            dish.images = req.files.map(file => file.filename);
        }

        dish.name = name ?? dish.name;
        dish.description = description ?? dish.description;
        dish.price = price ?? dish.price;
        dish.restaurantId = restaurantId ?? dish.restaurantId;

        await dish.save();

        return res.status(200).json({
            success: true,
            message: 'Dish updated successfully',
            data: dish
        });

    } catch (error) {
        console.error('Error updating dish');
        res.status(500).json({
            success: false,
            message: 'Error updating dish',
            error: error.message
        });
    }
};


exports.deleteDishById = async (req, res) => {
    try {
        const dish = await Dish.findByIdAndDelete(req.params.id);

        if (!dish) {
            return res.status(404).json({
                success: false,
                message: 'Dish not found'
            });
        }

        if (dish.images && dish.images.length > 0) {
            for (const img of dish.images) {
                const imgPath = path.join(__dirname, '../uploads/dishes', img);
                if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Dish deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting dish');
        res.status(500).json({
            success: false,
            message: 'Error deleting dish',
            error: error.message
        });
    }
};
