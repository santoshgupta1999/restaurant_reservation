const express = require('express');
const router = express.Router();

const reservController = require('../controllers/reservation.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { reservationValidator } = require('../validators/reservationValidation');
const { validate } = require('../middlewares/validationResultHandler');


router.post('/add',
    verifyToken,
    reservationValidator,
    validate,
    reservController.createReservation
);

router.post('/', reservController.getReservations);
router.get('/:id', reservController.getReservationById);

router.put('/update/:id',
    reservationValidator,
    validate,
    reservController.updateReservationById
);

router.delete('/:id', reservController.deleteReservationById);
router.post('/status/:id', reservController.updateReservationStatus);

// router.post("/getDashboardOverview", reservController.dashboardSummary)
// router.post("/bookingStats", reservController.bookingStats)
// router.post("/bookingTrend24h", reservController.bookingTrend24h)
// router.post("/mostActiveVenues", reservController.mostActiveVenues)
// router.post("/getRemiUsers", reservController.getRemiUsers)
// router.post("/getNoShowRiskVenues", reservController.getNoShowRiskVenues)
// router.post("/getReservationList", reservController.getReservationList)
// router.post("/getMonthlyGraph", verifyToken, reservController.getMonthlyGraph)

module.exports = router;
