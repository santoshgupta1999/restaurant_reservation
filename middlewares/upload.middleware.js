const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Multer storage config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'uploads/restaurants/others';

        if (file.fieldname === 'logo') {
            folder = 'uploads/restaurants/logo';
        } else if (file.fieldname === 'images') {
            folder = 'uploads/restaurants/images';
        } else if (file.fieldname === 'profile') {
            folder = 'uploads/users';
        } else if (file.fieldname === 'dishImage') {
            folder = 'uploads/dishes';
        }

        fs.mkdirSync(folder, { recursive: true });
        cb(null, folder);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    }
});

// File filter to allow only image types
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/webp',
        'image/gif',
        'image/bmp',
        'image/svg+xml',
        'image/avif'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error('Only image files (jpeg, png, jpg, webp, gif, bmp, svg) are allowed.'),
            false
        );
    }
};

// Multer instance
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB max per file
    }
});

module.exports = upload;
