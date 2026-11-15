import { Router, type IRouter } from "express";
import healthRouter from "./health";
import onboardingArtRouter from "./onboarding-art";
import vibeswipeProfileViewsRouter from "./vibeswipe-profile-views";
import vibeswipePushRouter from "./vibeswipe-push";
import vibeswipeRealtimeRouter from "./vibeswipe-realtime";
import vibeswipeRouter from "./vibeswipe";
import vibeswipeSafetyRouter from "./vibeswipe-safety";
import vibeswipeStoriesRouter from "./vibeswipe-stories";

const router: IRouter = Router();

router.use(healthRouter);
router.use(onboardingArtRouter);
router.use(vibeswipeSafetyRouter);
router.use(vibeswipeStoriesRouter);
router.use(vibeswipeRouter);
router.use(vibeswipeRealtimeRouter);
router.use(vibeswipeProfileViewsRouter);
router.use(vibeswipePushRouter);

export default router;
