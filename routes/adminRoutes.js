const express = require('express');
const router = express.Router();

const { restaurantValidator } = require('../validators/restaurantValidation');
const restController = require('../controllers/restaurant.controller');
const guestController = require('../controllers/guest.controller');
const { createGuestValidator, updateGuestValidator, searchGuestValidator } = require('../validators/guestValidator');
const { validate } = require('../middlewares/validationResultHandler');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const seatingPreference = require("../controllers/seatingPreference");
const restaurantController = require("../controllers/restaurant.controller");
const TierController = require("../controllers/tier.controller");
const DashboardController = require("../controllers/dashboard.controller");


router.get('/restaurants', restController.getRestaurants);
router.get('/restaurants/:id', restController.getRestaurantById);

router.put('/restaurants/:id',
    upload.fields([
        { name: 'logo', maxCount: 1 },
    ]), restaurantValidator, verifyToken, restController.updateRestaurant);

router.delete('/restaurants/:id', verifyToken, restController.deleteRestaurant);
router.get('/getActiveRestaurants', verifyToken, restController.getActiveRestaurants);
router.put('/updateRestaurantStatus/:id', restController.updateRestaurantStatus);

// ------------------------ Restaurant edit details admin side  -------------------------- //

// ------------------------------------------- Guest ---------------------------------------------- //

router.post('/createGuest', createGuestValidator, validate, guestController.createGuest);
router.post('/getGuests', guestController.getGuests);
router.post('/getGuestById/:id', guestController.getGuestById);
router.post('/updateGuest/:id', updateGuestValidator, validate, guestController.updateGuest);
router.post('/deleteGuest/:id', guestController.deleteGuest);

router.post('/updateGuestStatus', guestController.updateGuestStatus);
router.post('/getRemiUsersList', guestController.getRemiUsersList);
router.post('/editGuest', guestController.editGuest);
router.post('/getRemiUsersList/reservations', guestController.getCrossVenue);
router.post('/getRemiUsersList/getGlobalVisit', guestController.getGlobalVisit);

// restaurant


router.post('/venues/add', upload.fields([{ name: 'heroImage', maxCount: 1 },]), restController.createRestaurant);
router.post('/venues/edit', upload.single("heroImage"), restController.editVenue);
router.post('/venues/editPlanStatus', restController.editVenuePlanAndStatus);
router.post('/venues/opertionalMetrics', restController.opertionalMetrics);
router.post('/venues', restaurantController.getVenueList);

// Tier
router.post("/tiers/add", TierController.createTier)
router.post("/tiers", TierController.getTiers)

// dashborad
router.post("/dashboard/venues", DashboardController.getVenues);
router.post("/dashboard/getBooking24hTrend", DashboardController.getBooking24hTrend);
router.post("/dashboard/getBookingKPIs", DashboardController.getBookingKPIs);
router.post("/dashboard/mostActiveVenues", DashboardController.mostActiveVenues);
router.post("/dashboard/getRemiUsersStats", DashboardController.getRemiUsersStats);

module.exports = router;