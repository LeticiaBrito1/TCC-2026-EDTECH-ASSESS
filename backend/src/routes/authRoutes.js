import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/auth/register", asyncHandler(authController.register));
router.post("/auth/verify-phone", asyncHandler(authController.verifyPhone));
router.post("/auth/login", asyncHandler(authController.login));
router.post("/auth/verify-login-code", asyncHandler(authController.verifyLoginCode));
router.post("/auth/forgot-password", asyncHandler(authController.forgotPassword));
router.post("/auth/reset-password", asyncHandler(authController.resetPassword));
router.get("/auth/me", authenticate, asyncHandler(authController.me));
router.patch("/auth/profile", authenticate, asyncHandler(authController.updateProfile));
router.post("/auth/change-password", authenticate, asyncHandler(authController.changePassword));

export { router as authRoutes };
