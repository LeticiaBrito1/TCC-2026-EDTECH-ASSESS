import { Router } from "express";
import { correctionController } from "../controllers/correctionController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireRoles } from "../middlewares/authMiddleware.js";

const router = Router();

router.post(
  "/corrections/ocr",
  requireRoles("admin", "professor"),
  asyncHandler(correctionController.correctByOcr)
);

export { router as correctionRoutes };
