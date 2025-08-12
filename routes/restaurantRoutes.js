const express = require('express');
const router = express.Router();

const slotController = require('../controllers/slot.controller');
const tableController = require('../controllers/table.controller');
const reviewController = require('../controllers/review.controller');
const dishController = require('../controllers/dish.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const { reviewValidator, checkDuplicateReview } = require('../validators/reviewValidation');
const { validate } = require('../middlewares/validationResultHandler');
const { dishValidator } = require('../validators/dishValidation');

// ------------------------------------------- Slots ----------------------------------- //

router.post('/slot/add_update', verifyToken, requireRole('admin', 'manager'), slotController.addOrUpdateSlot);
router.get('/slot', verifyToken, requireRole('admin'), slotController.getSlotsByRestaurant);
router.delete('/slot/:id', verifyToken, requireRole('admin'), slotController.deleteSlot);

// ------------------------------------------- Table ----------------------------------- //

router.post('/table/add', verifyToken, requireRole('admin'), tableController.createTable);
router.get('/table/', verifyToken, requireRole('admin'), tableController.getTablesByRestaurants);
router.post('/table/update/:id', verifyToken, requireRole('admin'), tableController.updateTable);
router.delete('/table/:id', verifyToken, requireRole('admin'), tableController.deleteTable);


// ------------------------------------------- Dish ------------------------------------ //

router.post('/dish/add',
    verifyToken, requireRole('admin'),
    upload.array('dishImage', 5),
    dishValidator, validate,
    dishController.createDish
);

router.get('/dish/:id', dishController.getDishById);
router.get('/dish/restaurant/:restaurantId', dishController.getDishesByRestaurantId);
router.get('/dishes', dishController.getAllDishes);

router.post('/dish/:id', verifyToken, requireRole('admin'),
    upload.array('dishImage', 5),
    dishValidator, validate,
    dishController.updateDishById
);
router.delete('/dish/:id', verifyToken, requireRole('admin'), dishController.deleteDishById);

// ------------------------------------------- Review ---------------------------------- //

router.post('/review',
    verifyToken, requireRole('user'),
    reviewValidator, checkDuplicateReview,
    validate,
    reviewController.createReview
);
router.get('/review', verifyToken, requireRole('user'), reviewController.getReviews);
router.get('/admin/reviews', verifyToken, requireRole('admin'), reviewController.getAllReviewsByAdmin);
router.get('/avg_rating/:restaurantId', verifyToken, requireRole('admin'), reviewController.getAverageRating);

module.exports = router; 
