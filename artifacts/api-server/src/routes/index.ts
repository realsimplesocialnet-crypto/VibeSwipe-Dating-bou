import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vibeswipeProfileViewsRouter from "./vibeswipe-profile-views";
import vibeswipeRealtimeRouter from "./vibeswipe-realtime";
import vibeswipeRouter from "./vibeswipe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vibeswipeRouter);
router.use(vibeswipeRealtimeRouter);
router.use(vibeswipeProfileViewsRouter);

export default router;
