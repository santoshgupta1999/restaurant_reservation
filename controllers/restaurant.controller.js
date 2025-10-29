const Restaurant = require('../models/restaurant.model');
const Shift = require('../models/shift.model');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const baseUrl = process.env.BASE_URL;


exports.createRestaurant = async (req, res) => {
    try {
        const {
            name, email, phone, address, openingHours
        } = req.body;

        const existingRestaurant = await Restaurant.findOne({ email });
        if (existingRestaurant) {
            return res.status(400).json({
                success: false,
                message: 'Email already in use. Please use another email.'
            });
        }

        const logo = req.files['logo']
            ? `${req.files['logo'][0].filename}`
            : null;

        const createdBy = req.user?._id;

        const newRestaurant = new Restaurant({
            name,
            email,
            phone,
            address,
            openingHours: JSON.parse(openingHours),
            logo,
            createdBy
        });

        await newRestaurant.save();
        return res.status(201).json({
            success: true,
            message: 'Restaurant created successfully',
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
        const { page = 1, limit = 10, name, status } = req.query;

        const query = {};
        if (name) query.name = { $regex: name, $options: 'i' };
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
            logo: restaurant.logo ? `${host}/uploads/restaurants/logo/${restaurant.logo}` : null
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

        const updateFields = { ...req.body };

        if (updateFields.openingHours) {
            try {
                updateFields.openingHours = JSON.parse(updateFields.openingHours);
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid JSON in openingHours',
                    error: e.message
                });
            }
        }

        if (req.files?.logo) {
            const newLogo = req.files.logo[0].filename;

            // Delete old logo if exists
            if (restaurant.logo) {
                const oldLogoPath = path.join(__dirname, '../uploads/restaurants/logo/', restaurant.logo);
                if (fs.existsSync(oldLogoPath)) {
                    fs.unlinkSync(oldLogoPath);
                }
            }

            updateFields.logo = newLogo;
        }

        const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Restaurant updated successfully',
            data: updatedRestaurant
        });

    } catch (err) {
        console.error('Error updating restaurant:', err);
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

// -------------------------------------------- Shift -------------------------------------------- //

exports.createShift = async (req, res) => {
    try {
        const shift = await Shift.create(req.body);

        return res.status(201).json({
            success: true,
            message: "Shift created successfully",
            data: shift
        });

    } catch (error) {
        console.error('Error creating shift', error);
        res.status(500).json({
            success: false,
            message: 'Error during creating shifts',
            Error: error.message
        });
    }
};

exports.getAllShift = async (req, res) => {
    try {
        const { restaurantId } = req.query;
        const query = {};

        if (restaurantId) query.restaurantId = restaurantId;

        const shifts = await Shift.find(query).populate("restaurantId", "name email phone");

        res.status(200).json({
            success: true,
            message: 'Shift fetched successfully',
            count: shifts.length,
            data: shifts
        });

    } catch (error) {
        console.error("Error fetching shifts:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.getShiftById = async (req, res) => {
    try {
        const { id } = req.params;

        const shift = await Shift.findById(id).populate("restaurantId", "name");
        if (!shift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Shifts fetched successfully',
            data: shift
        });

    } catch (error) {
        console.error('Error while fetching shifts');
        res.status(500).json({
            success: false,
            message: 'Error fetching shifts',
            Error: error.message
        });
    }
};

exports.updateShift = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedShift = await Shift.findOneAndUpdate({ _id: id }, req.body, { new: true });
        if (!updatedShift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Shift updated successfully',
            data: updatedShift
        });

    } catch (error) {
        console.error('Error while updating shifts', error);
        res.status(500).json({
            success: false,
            message: 'Error while updating shifts',
            Error: error.message
        });
    }
};

exports.deleteShift = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedShift = await Shift.findByIdAndDelete(id);

        if (!deletedShift) {
            return res.status(404).json({
                success: false,
                message: "Shift not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Shift deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting shift:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.getActiveShiftsForToday = async (req, res) => {
    try {
        const { restaurantId } = req.query;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "restaurantId is required in query params."
            });
        }

        const today = new Date();
        const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" });

        const shifts = await Shift.find({
            restaurantId,
            isActive: true,
            $or: [
                { isIndefinite: true },
                {
                    $and: [
                        { startDate: { $lte: today } },
                        { endDate: { $gte: today } }
                    ]
                }
            ],
            daysActive: dayOfWeek
        }).sort({ startTime: 1 });

        if (!shifts.length) {
            return res.status(404).json({
                success: false,
                message: `No active shifts found for ${dayOfWeek}.`
            });
        }

        return res.status(200).json({
            success: true,
            message: `Active shifts for ${dayOfWeek} fetched successfully.`,
            count: shifts.length,
            data: shifts
        });

    } catch (error) {
        console.error("Error fetching active shifts:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
