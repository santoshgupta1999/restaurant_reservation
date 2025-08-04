const Restaurant = require('../models/restaurant.model');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const baseUrl = process.env.BASE_URL;


exports.createRestaurant = async (req, res) => {
    try {
        const {
            name, email, phone, address, openingHours, cuisine
        } = req.body;

        const existingRestaurant = await Restaurant.findOne({ email });
        if (existingRestaurant) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists. Please use another email.'
            });
        }

        const logo = req.files['logo']
            ? `${req.files['logo'][0].filename}`
            : null;

        const images = req.files['images']
            ? req.files['images'].map(file => `${file.filename}`)
            : [];

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
        return res.status(201).json({
            success: true,
            message: 'Restaurant created successfully',
            Id: newRestaurant.id,
            data: newRestaurant
        });

    } catch (err) {
        console.error('Error creating restaurant:', err);
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

        const host = `${req.protocol}://${req.get('host')}`;

        const transformed = restaurants.map((r) => ({
            ...r._doc,
            logo: r.logo ? `${host}/uploads/restaurants/logo/${r.logo}` : null,
            images: r.images?.map(img => `${host}/uploads/restaurants/images/${img}`) || []
        }));

        return res.status(200).json({
            success: true,
            message: 'Restaurants fetched successfully',
            data: transformed,
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
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid restaurant ID'
            });
        }

        const restaurant = await Restaurant.findById(id);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        const host = `${req.protocol}://${req.get('host')}`;
        const transformed = {
            ...restaurant._doc,
            logo: restaurant.logo ? `${host}/uploads/restaurants/logo/${restaurant.logo}` : null,
            images: restaurant.images?.map(img => `${host}/uploads/restaurants/images/${img}`) || []
        };

        return res.status(200).json({
            success: true,
            message: 'Restaurant fetched successfully',
            data: transformed
        });

    } catch (err) {
        console.error('Error fetching restaurant', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching restaurant',
            error: err.message
        });
    }
};

exports.updateRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        const updateFields = {
            ...req.body
        };

        // Parse JSON fields
        if (updateFields.openingHours) {
            updateFields.openingHours = JSON.parse(updateFields.openingHours);
        }
        if (updateFields.cuisine) {
            updateFields.cuisine = JSON.parse(updateFields.cuisine);
        }

        // Handle logo
        if (req.files?.logo) {
            const newLogo = req.files.logo[0].filename;

            // Delete old logo
            if (restaurant.logo) {
                const oldLogoPath = path.join(__dirname, '../uploads/restaurants/logo/', restaurant.logo);
                if (fs.existsSync(oldLogoPath)) {
                    fs.unlinkSync(oldLogoPath);
                }
            }

            updateFields.logo = newLogo;
        }

        // Handle images
        if (req.files?.images) {
            const newImages = req.files.images.map(f => f.filename);

            // Delete old images
            if (restaurant.images && restaurant.images.length > 0) {
                restaurant.images.forEach(img => {
                    const imgPath = path.join(__dirname, '../uploads/restaurants/images/', img);
                    if (fs.existsSync(imgPath)) {
                        fs.unlinkSync(imgPath);
                    }
                });
            }

            updateFields.images = newImages;
        }

        const updatedRestaurant = await Restaurant.findByIdAndUpdate(req.params.id, updateFields, { new: true });

        return res.status(200).json({
            success: true,
            message: 'Restaurant updated successfully',
            data: updatedRestaurant
        });

    } catch (err) {
        console.error('Error updating restaurant', err);
        return res.status(500).json({
            success: false,
            message: 'Error updating restaurant',
            error: err.message
        });
    }
};

exports.deleteRestaurant = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid restaurant ID'
            });
        }

        const restaurant = await Restaurant.findByIdAndDelete(id);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant not found'
            });
        }

        // Auto-delete logo file if exists
        if (restaurant.logo) {
            const logoPath = path.join(__dirname, '../uploads/restaurants/logo/', restaurant.logo);
            if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
        }

        // Auto-delete image files if exist
        if (restaurant.images && restaurant.images.length > 0) {
            restaurant.images.forEach(img => {
                const imgPath = path.join(__dirname, '../uploads/restaurants/images/', img);
                if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Restaurant deleted successfully'
        });

    } catch (err) {
        console.error('Error deleting restaurant', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting restaurant',
            error: err.message
        });
    }
};
