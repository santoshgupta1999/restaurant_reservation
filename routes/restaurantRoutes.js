const express = require('express');
const router = express.Router();

const slotController = require('../controllers/slot.controller');
const tableController = require('../controllers/table.controller');
const reviewController = require('../controllers/review.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const { reviewValidator, checkDuplicateReview } = require('../validators/reviewValidation');
const { validate } = require('../middlewares/validationResultHandler');

// ------------------------------------------- Slots ----------------------------------- //

router.post('/slot/add_update', slotController.addOrUpdateSlot);
router.get('/slot', slotController.getSlotsByRestaurant);
router.delete('/slot/:id', slotController.deleteSlot);

// ------------------------------------------- Table ----------------------------------- //

router.post('/table/add', verifyToken, tableController.createTable);
router.get('/table/', verifyToken, requireRole('admin'), tableController.getTablesByRestaurants);
router.post('/table/update/:id', verifyToken, requireRole('admin'), tableController.updateTable);
router.delete('/table/:id', verifyToken, requireRole('admin'), tableController.deleteTable);


// ------------------------------------------- Review ----------------------------------- //

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
