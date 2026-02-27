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

        //  Feature validation
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

        //  Create tier
        const tier = await Tier.create({
            tierName: cleanName,
            description,
            basePrice,
            features: validatedFeatures,
            limits: validatedLimits,
            status: status,
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
        const tiers = await Tier.find().select("_id tierName description basePrice status");

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
                totalVenues: count,
                status: t.status
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

exports.getTierById = async (req, res) => {
    try {
        const { tierId } = req.body;
        if (!tierId) {
            return res.status(400).json({
                success: false,
                message: "tierId is required"
            });
        }

        // tier find
        const tier = await Tier.findById(tierId)
            .select("tierName description features limits basePrice status")
            .lean();

        if (!tier) {
            return res.status(404).json({
                success: false,
                message: "Tier not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: tier
        })

    } catch (error) {

    }
}

exports.updateTierStatus = async (req, res) => {
    try {
        const { tierId, status } = req.body || {};

        if (!tierId || !status) {
            return res.status(400).json({
                success: false,
                message: "tierId and status are required"
            });
        }

        // valid status check
        const allowedStatus = ["Active", "Archived"];

        if (!allowedStatus.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be Active or Archived"
            });
        }

        // tier find
        const tier = await Tier.findById(tierId);
        if (!tier) {
            return res.status(404).json({
                success: false,
                message: "Tier not found"
            });
        }

        tier.status = status;
        // tier.updatedBy = req.user?._id;

        await tier.save();

        return res.status(200).json({
            success: true,
            message: `Status updated to ${status}`,
            data: tier
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateTier = async (req, res) => {
    try {
        const {
            tierId,
            tierName,
            description,
            basePrice,
            features,
            limits,
            status
        } = req.body || {};

        if (!tierId) {
            return res.status(400).json({
                success: false,
                message: "Tier id is required"
            });
        }

        const tier = await Tier.findById(tierId);
        if (!tier) {
            return res.status(404).json({
                success: false,
                message: "Tier not found"
            });
        }

        // ---------------- NAME (optional) ----------------
        if (tierName !== undefined) {
            const cleanName = tierName.trim();

            if (!cleanName) {
                return res.status(400).json({
                    success: false,
                    message: "Tier name cannot be empty"
                });
            }

            // unique check except current tier
            const existing = await Tier.findOne({
                _id: { $ne: tierId },
                tierName: { $regex: `^${cleanName}$`, $options: "i" }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "Tier name already exists"
                });
            }

            tier.tierName = cleanName;
        }

        // ---------------- DESCRIPTION (optional) ----------------
        if (description !== undefined) {
            tier.description = description;
        }

        // ---------------- BASE PRICE (optional) ----------------
        if (basePrice !== undefined) {
            if (typeof basePrice !== "number" || basePrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Base price must be valid number"
                });
            }
            tier.basePrice = basePrice;
        }

        // ---------------- FEATURES (optional) ----------------
        if (features !== undefined) {
            const allowedFeatures = [
                "Floor_plan",
                "CRM",
                "Feedback_Dashboard",
                "Card_Holds",
                "Reservation_Preferences",
                "Waitlist",
                "Widget_Customization"
            ];

            const updatedFeatures = {
                ...tier.features,
                List_view: true // always ON
            };

            for (const key of allowedFeatures) {
                if (features[key] !== undefined) {
                    updatedFeatures[key] = !!features[key];
                }
            }

            tier.features = updatedFeatures;
        }

        // ---------------- LIMITS (optional) ----------------
        if (limits !== undefined) {
            const requiredLimitKeys = [
                "maxMonthlyBookings",
                "maxStaffAccounts",
                "maxRooms"
            ];

            const updatedLimits = { ...tier.limits };

            for (const key of requiredLimitKeys) {
                if (limits[key] !== undefined) {
                    if (typeof limits[key] !== "number" || limits[key] < 0) {
                        return res.status(400).json({
                            success: false,
                            message: `${key} must be >= 0`
                        });
                    }
                    updatedLimits[key] = limits[key];
                }
            }

            tier.limits = updatedLimits;
        }

        // ---------------- STATUS (optional) ----------------
        if (status !== undefined) {
            tier.status = status;
        }

        tier.updatedBy = req.user?._id;

        await tier.save();

        res.status(200).json({
            success: true,
            message: "Tier updated successfully",
            data: tier
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.deleteTier = async (req, res) => {
    try {
        const { tierId } = req.body || {};

        if (!tierId) {
            return res.status(400).json({
                success: false,
                message: "tierId is required"
            });
        }

        // tier find
        const tier = await Tier.findById(tierId);

        if (!tier) {
            return res.status(404).json({
                success: false,
                message: "Tier not found"
            });
        }

        if (tier.status === "Archived") {
            return res.status(400).json({
                success: false,
                message: "Tier already archived"
            });
        }

        //  AC-T4 → archive only
        tier.status = "Archived";
        await tier.save();

        return res.status(200).json({
            success: true,
            message: "Tier archived successfully"
        });

    } catch (error) {
        console.error("DELETE TIER ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

exports.getActiveTiersForVenue = async (req, res) => {
    try {
        const tiers = await Tier.find(
            { status: "Active" }
        )
            .sort({ tierName: 1 })
            .select("_id tierName")
            .lean();

        return res.status(200).json({
            success: true,
            count: tiers.length,
            data: tiers
        });

    } catch (error) {
        console.error("getActiveTiersForVenue error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
