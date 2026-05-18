import { Router } from "express";
import { entityController } from "../controllers/entityController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { validateEntityParam, validateIdParam } from "../middlewares/validateParams.js";

const router = Router();

router.get("/entities/:entity", validateEntityParam, asyncHandler(entityController.list));
router.get("/entities/:entity/:id", validateEntityParam, validateIdParam, asyncHandler(entityController.getById));
router.post("/entities/:entity", validateEntityParam, asyncHandler(entityController.create));
router.put("/entities/:entity/:id", validateEntityParam, validateIdParam, asyncHandler(entityController.update));
router.delete("/entities/:entity/:id", validateEntityParam, validateIdParam, asyncHandler(entityController.remove));

export { router as entityRoutes };
