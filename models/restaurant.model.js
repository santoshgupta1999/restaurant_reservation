// const mongoose = require('mongoose');

// const restaurantSchema = new mongoose.Schema(
//     {
//         name: {
//             type: String,
//             required: true,
//             trim: true
//         },
//         email: {
//             type: String,
//             required: true,
//             unique: true,
//             lowercase: true,
//             trim: true
//         },
//         phone: {
//             type: String,
//             required: true,
//         },
//         address: {
//             type: String,
//             required: true,
//         },
//         openingHours: {
//             type: String,
//             required: true,
//         },
//         logo: {
//             type: String
//         },
//         status: {
//             type: String,
//             enum: ['active', 'inactive'],
//             default: 'active'
//         },
//         createdBy: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             required: true
//         }
//     },
//     {
//         timestamps: true
//     }
// );

// module.exports = mongoose.model('Restaurant', restaurantSchema);

const mongoose = require("mongoose");
const Counter = require("./CounterResRemi");

const restaurantSchema = new mongoose.Schema(
    {
        remiId: {
            type: String,
            unique: true
        },
        //  BASIC INFO
        venueName: {
            type: String,
            required: true,
            trim: true
        },
        country: {
            type: String,
            // required: true
        },

        city: {
            type: String,
        },

        address: {
            type: String,
        },

        countryCode: {
            type: String,
        },

        phone: {
            type: String,
        },

        billingEmail: {
            type: String,
        },

        //  MANAGER
        managerEmail: {
            type: String,
            required: true,
            lowercase: true
        },

        managerUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        //  PLAN / TIER
        // tier: {
        //     type: String,
        //     required: true,
        // },

        tier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tier",
            required: true
        },

        status: {
            type: String,
            enum: ["Trial", "Active", "Suspended", "Locked"],
            default: "Trial"
        },

        trialEndDate: {
            type: Date
        },

        //  B2C OPTIONAL
        cuisines: {
            type: [String],
            validate: [arr => arr.length <= 3, "Max 3 cuisines"]
        },

        pricePoint: {
            type: String,
        },

        vibeTags: {
            type: [String],
            validate: [arr => arr.length <= 3, "Max 3 vibe tags"]
        },

        shortDescription: String,
        longDescription: String,

        heroImage: String,

        website: String,
        googleMapsLink: String,

        socialHandles: {
            instagram: String,
            facebook: String,
            tiktok: String,
            x: String
        },

        menuLink: String,
        // openingHours: String,

        openingHours: {
            monday: {
                open: String,
                close: String,
                isClosed: { type: Boolean, default: false }
            },
            tuesday: {
                open: String,
                close: String,
                isClosed: { type: Boolean, default: false }
            },
            wednesday: {
                open: String,
                close: String,
                isClosed: { type: Boolean, default: false }
            },
            thursday: {
                open: String,
                close: String,
                isClosed: { type: Boolean, default: false }
            },
            friday: {
                open: String,
                close: String,
                isClosed: { type: Boolean, default: false }
            },
            saturday: {
                open: String,
                close: String,
                isClosed: { type: Boolean, default: false }
            },
            sunday: {
                open: String,
                close: String,
                isClosed: { type: Boolean, default: false }
            }
        },


        //  CREATED BY
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

restaurantSchema.pre("save", async function (next) {
    try {
        if (!this.remiId) {

            const counter = await Counter.findOneAndUpdate(
                { id: "restaurantId" },   //  match with schema
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );

            const number = counter.seq.toString().padStart(3, "0");
            this.remiId = `RU-${number}`;
        }

        next();
    } catch (err) {
        next(err);
    }
});


module.exports = mongoose.model("Restaurant", restaurantSchema);



