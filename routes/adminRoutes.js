const express = require('express');
const router = express.Router();

const { restaurantValidator } = require('../validators/restaurantValidation');
const restController = require('../controllers/restaurant.controller');
const guestController = require('../controllers/guest.controller');
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

// ------------------------------------------- Guest ---------------------------------------------- //

router.post('/createGuest', guestController.createGuest);
router.get('/getGuests', guestController.getGuests);
router.get('/getGuestById/:id', guestController.getGuestById);
router.post('/updateGuest/:id', guestController.updateGuest);
router.post('/deleteGuest/:id', guestController.deleteGuest);

module.exports = router;
