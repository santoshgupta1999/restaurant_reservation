const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["Manager", "Call Center", "Host", "Admin"],
        required: true
    },
    permissions: {
        type: [String],
        default: []
    }
}, { timestamps: true });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
