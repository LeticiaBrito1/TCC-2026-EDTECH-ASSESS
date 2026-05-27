import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/auth/register", asyncHandler(authController.register));
router.get("/auth/verify-email", asyncHandler(authController.verifyEmail));
router.post("/auth/resend-verification", asyncHandler(authController.resendVerification));
router.post("/auth/login", asyncHandler(authController.login));
router.post("/auth/verify-login-code", asyncHandler(authController.verifyLoginCode));
router.post("/auth/forgot-password", asyncHandler(authController.forgotPassword));
router.post("/auth/reset-password", asyncHandler(authController.resetPassword));
router.get("/auth/me", authenticate, asyncHandler(authController.me));
router.patch("/auth/profile", authenticate, asyncHandler(authController.updateProfile));
router.post("/auth/change-password", authenticate, asyncHandler(authController.changePassword));

// ── Endpoint exclusivo para testes automatizados ──────────────────────────────
// Só ativo quando ALLOW_DIRECT_LOGIN=true (nunca em produção).
// Retorna um JWT diretamente sem passar pelo fluxo de 2FA.
if (process.env.ALLOW_DIRECT_LOGIN === "true") {
  router.post("/auth/dev-login", asyncHandler(authController.devLogin));
}

export { router as authRoutes };
