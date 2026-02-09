const Tier = require("../models/Tier");
const Restaurant = require("../models/Restaurant.model");


exports.createTier = async (req, res) => {
    try {
        const {
            tierName,
            description,
            basePrice,
            features,
            limits,
            status
        } = req.body || {};

        //  required fields check
        if (!tierName || !description || basePrice === undefined || !features || !limits) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        //  tier name trim
        const cleanName = tierName.trim();

        if (!cleanName) {
            return res.status(400).json({
                success: false,
                message: "Tier name cannot be empty"
            });
        }

        //  unique tier name (case insensitive)
        const existing = await Tier.findOne({
            tierName: { $regex: `^${cleanName}$`, $options: "i" }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Tier name already exists"
            });
        }

        //  base price validation
        if (typeof basePrice !== "number" || basePrice < 0) {
            return res.status(400).json({
                success: false,
                message: "Base price must be valid number"
            });
        }

        // ✅ Feature validation
        const allowedFeatures = [
            "Floor_plan",
            "CRM",
            "Feedback_Dashboard",
            "Card_Holds",
            "Reservation_Preferences",
            "Waitlist",
            "Widget_Customization"
        ];

        // validate features
        const validatedFeatures = { List_view: true }; // always ON

        for (const key of allowedFeatures) {
            validatedFeatures[key] = !!features[key]; // default false if undefined
        }

        const requiredLimitKeys = ["maxMonthlyBookings", "maxStaffAccounts", "maxRooms"];
        const validatedLimits = {};

        for (const key of requiredLimitKeys) {
            if (limits[key] === undefined || limits[key] === null) {
                validatedLimits[key] = 0; // default 0 = unlimited
            } else if (typeof limits[key] !== "number" || limits[key] < 0) {
                return res.status(400).json({
                    success: false,
                    message: `${key} must be a valid number >= 0`
                });
            } else {
                validatedLimits[key] = limits[key];
            }
        }

        // ✅ Create tier
        const tier = await Tier.create({
            tierName: cleanName,
            description,
            basePrice,
            features: validatedFeatures,
            limits: validatedLimits,
            createdBy: req.user?._id
        });

        res.status(201).json({
            success: true,
            message: "Tier created successfully",
            data: tier
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.getTiers = async (req, res) => {
    try {
        const tiers = await Tier.find().select("_id tierName description basePrice");

        if (!tiers.length) {
            return res.status(400).json({
                success: false,
                message: "No tier found"
            });
        }

        const data = [];

        for (const t of tiers) {

            // count restaurants using this tier
            const count = await Restaurant.countDocuments({
                tier: t._id
            });

            data.push({
                tierId: t._id,
                tierName: t.tierName,
                description: t.description,
                basePrice: t.basePrice,
                totalVenues: count
            });
        }

        res.status(200).json({
            success: true,
            message: "Succefully fetch tiers",
            count: data.length,
            data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
