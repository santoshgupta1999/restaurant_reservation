const express = require('express');
const router = express.Router();

const { restaurantValidator } = require('../validators/restaurantValidation');
const restController = require('../controllers/restaurant.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

router.post('/restaurants',
    upload.fields([
        { name: 'logo', maxCount: 1 },
    ]), restaurantValidator, verifyToken, restController.createRestaurant);

router.get('/restaurants', restController.getRestaurants);
router.get('/restaurants/:id', restController.getRestaurantById);

router.put('/restaurants/:id',
    upload.fields([
        { name: 'logo', maxCount: 1 },
    ]), restaurantValidator, verifyToken, restController.updateRestaurant);

router.delete('/restaurants/:id', verifyToken, restController.deleteRestaurant);
router.get('/getActiveRestaurants', verifyToken, restController.getActiveRestaurants);
router.put('/updateRestaurantStatus/:id', restController.updateRestaurantStatus);

module.exports = router;
