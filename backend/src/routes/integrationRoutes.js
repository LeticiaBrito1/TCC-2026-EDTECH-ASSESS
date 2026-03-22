import { Router } from "express";
import { integrationController } from "../controllers/integrationController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireRoles } from "../middlewares/authMiddleware.js";

const router = Router();

router.post(
  "/integrations/lms/sync",
  requireRoles("admin", "professor"),
  asyncHandler(integrationController.syncLms)
);

export { router as integrationRoutes };
