const express = require('express');
const router = express.Router();

const { restaurantValidator } = require('../validators/restaurantValidation');
const restController = require('../controllers/restaurant.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

router.post('/restaurants',
    upload.fields([
        { name: 'logo', maxCount: 1 },
        { name: 'images', maxCount: 5 }
    ]), restaurantValidator, verifyToken, requireRole('admin'), restController.createRestaurant);

router.get('/restaurants', verifyToken, requireRole('admin'), restController.getRestaurants);

module.exports = router;
