import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/auth/login", asyncHandler(authController.login));
router.get("/auth/me", authenticate, asyncHandler(authController.me));

export { router as authRoutes };
