import { Router } from "express";
import { notificationController } from "../controllers/notificationController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = Router();

router.get("/notifications", asyncHandler(notificationController.list));
router.patch("/notifications/:id/read", asyncHandler(notificationController.markAsRead));
router.post("/notifications/read-all", asyncHandler(notificationController.markAllAsRead));

export { router as notificationRoutes };
