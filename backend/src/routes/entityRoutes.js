import { Router } from "express";
import { entityController } from "../controllers/entityController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = Router();

router.get("/entities/:entity", asyncHandler(entityController.list));
router.get("/entities/:entity/:id", asyncHandler(entityController.getById));
router.post("/entities/:entity", asyncHandler(entityController.create));
router.put("/entities/:entity/:id", asyncHandler(entityController.update));
router.delete("/entities/:entity/:id", asyncHandler(entityController.remove));

export { router as entityRoutes };
