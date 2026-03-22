import { Router } from "express";
import { auditController } from "../controllers/auditController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireRoles } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/audit-logs", requireRoles("admin"), asyncHandler(auditController.list));

export { router as auditRoutes };
