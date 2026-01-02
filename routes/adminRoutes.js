const express = require('express');
const router = express.Router();

const { restaurantValidator } = require('../validators/restaurantValidation');
const restController = require('../controllers/restaurant.controller');
const guestController = require('../controllers/guest.controller');
const { createGuestValidator, updateGuestValidator, searchGuestValidator } = require('../validators/guestValidator');
const { validate } = require('../middlewares/validationResultHandler');
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

router.post('/createGuest', createGuestValidator, validate, guestController.createGuest);
router.post('/getGuests', guestController.getGuests);
router.post('/getGuestById/:id', guestController.getGuestById);
router.post('/updateGuest/:id', updateGuestValidator, validate, guestController.updateGuest);
router.post('/deleteGuest/:id', guestController.deleteGuest);

router.post('/updateGuestStatus', guestController.updateGuestStatus);

module.exports = router;
