const express = require("express");
const {
    register,
    login,
    getProfile,
    updateProfile,
    logout,
    changePassword,
    forgotPassword,
    verifyOtp,
    resetPassword,
    getAllActiveUser,
    updateUserStatus
} = require("../controllers/user.controllers.js");

const { registerValidator, loginValidator, updateProfileValidator, } = require("../validators/userValidation.js");
const { validate } = require('../middlewares/validationResultHandler.js');
const { verifyToken } = require("../middlewares/auth.middleware.js");
const upload = require('../middlewares/upload.middleware.js');
const router = express.Router();

router.post("/signup", registerValidator, validate, register);
router.post("/login", loginValidator, validate, login);
router.get('/profile', verifyToken, getProfile);
router.post('/profile', upload.single('profile'), verifyToken,
    updateProfileValidator, validate, updateProfile);

router.post('/logout', verifyToken, logout);
router.post('/change-password', verifyToken, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyToken, verifyOtp);
router.post('/reset-password', verifyToken, resetPassword);

router.get('/all_active', getAllActiveUser);
router.put('/updateUserStatus/:id', updateUserStatus);

module.exports = router;
