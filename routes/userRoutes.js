const express = require("express");
const {
    register,
    login,
    getProfile,
    uploadProfileImage
} = require("../controllers/user.controllers.js");

const { registerValidation, loginValidation, handleValidationErrors } = require("../validators/userValidation.js");
const { verifyToken } = require("../middlewares/auth.middleware.js");
const upload = require('../middlewares/upload.middleware.js');
const router = express.Router();

router.post("/signup", registerValidation, handleValidationErrors, register);
router.post("/login", loginValidation, handleValidationErrors, login);
router.get('/profile', verifyToken, getProfile);
router.post('/profile_image', upload.single('profile'), verifyToken, uploadProfileImage);

module.exports = router;
