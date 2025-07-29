const Restaurant = require('../models/restaurant.model');

exports.createRestaurant = async (req, res) => {
    try {
        const {
            name, email, phone, address, openingHours, cuisine
        } = req.body;

        const existingRestaurant = await Restaurant.findOne({ email });
        if (existingRestaurant) {
            console.log('Email already exists. Please use another email.');
            return res.status(400).json({
                success: false,
                message: 'Email already exists. Please use another email.'
            });
        }

        const logo = req.files['logo'] ? req.files['logo'][0].filename : null;
        const images = req.files['images'] ? req.files['images'].map(file => file.filename) : [];
        const createdBy = req.user?._id;

        const newRestaurant = new Restaurant({
            name,
            email,
            phone,
            address,
            openingHours: JSON.parse(openingHours),
            cuisine: JSON.parse(cuisine),
            logo,
            images,
            createdBy
        });

        await newRestaurant.save();
        console.log('Restaurant created successfully');
        return res.status(201).json({
            success: true,
            message: 'Restaurant created successfully',
            data: newRestaurant
        });

    } catch (err) {
        console.error('Error creating restaurants', err);
        res.status(500).json({
            success: false,
            message: 'Error creating restaurant',
            error: err.message
        });
    }
};

exports.getRestaurants = async (req, res) => {
    try {
        const { page = 1, limit = 10, name, cuisine, status } = req.query;

        const query = {};
        if (name) query.name = { $regex: name, $options: 'i' };
        if (cuisine) query.cuisine = cuisine;
        if (status) query.status = status;

        const total = await Restaurant.countDocuments(query);
        const restaurants = await Restaurant.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        console.log('Restaurants fetched successfully');
        return res.status(200).json({
            success: true,
            message: 'Restaurants fetched successfully',
            data: restaurants,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.log('Error fetching restaurants');
        res.status(500).json({
            success: false,
            message: 'Error fetching restaurants',
            error: err.message
        });
    }
};

exports.getRestaurantById = async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }
        console.log('Restaurants fetched successfully');
        return res.status(200).json({
            success: true,
            message: 'Restaurants fetched successfully',
            data: restaurant
        });
    } catch (err) {
        console.log('Error fetching restaurants', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching restaurant',
            error: err.message
        });
    }
};

exports.updateRestaurant = async (req, res) => {
    try {
        const updateFields = {
            ...req.body,
            ...(req.files?.logo && { logo: req.files.logo[0].filename }),
            ...(req.files?.images && { images: req.files.images.map(f => f.filename) })
        };

        if (updateFields.openingHours) {
            updateFields.openingHours = JSON.parse(updateFields.openingHours);
        }
        if (updateFields.cuisine) {
            updateFields.cuisine = JSON.parse(updateFields.cuisine);
        }

        const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, updateFields, { new: true });

        if (!restaurant) {
            console.log('Restaurant not found');
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }
        console.log('Restaurant updated successfully');
        return res.status(200).json({
            success: true,
            message: 'Restaurant updated successfully',
            data: restaurant
        });
    } catch (err) {
        console.log('Error updating restaurant');
        res.status(500).json({
            success: false,
            message: 'Error updating restaurant',
            error: err.message
        });
    }
};

exports.deleteRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }
        console.log('Restaurant deleted successfully');
        return res.status(200).json({
            success: true,
            message: 'Restaurant deleted successfully'
        });
    } catch (err) {
        console.log('Error deleting restaurant', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting restaurant',
            error: err.message
        });
    }
};
