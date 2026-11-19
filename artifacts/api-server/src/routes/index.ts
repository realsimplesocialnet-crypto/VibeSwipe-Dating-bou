import { Router, type IRouter } from "express";
import healthRouter from "./health";
import onboardingArtRouter from "./onboarding-art";
import vibeswipeProfileViewsRouter from "./vibeswipe-profile-views";
import vibeswipeSocialRouter from "./vibeswipe-social";
import vibeswipePushRouter from "./vibeswipe-push";
import vibeswipeRealtimeRouter from "./vibeswipe-realtime";
import vibeswipeRouter from "./vibeswipe";
import vibeswipeReelsRouter from "./vibeswipe-reels";
import vibeswipeDirectChatsRouter from "./vibeswipe-direct-chats";
import vibeswipeAdminRouter from "./vibeswipe-admin";
import vibeswipeAdminPostsRouter from "./vibeswipe-admin-posts";
import vibeswipeSafetyRouter from "./vibeswipe-safety";
import vibeswipeStoriesRouter from "./vibeswipe-stories";
import vibeswipeVerificationRouter from "./vibeswipe-verification";
import vibeswipeVerificationAdminRouter from "./vibeswipe-verification-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(onboardingArtRouter);
router.use(vibeswipeAdminRouter);
router.use(vibeswipeAdminPostsRouter);
router.use(vibeswipeVerificationAdminRouter);
router.use(vibeswipeSafetyRouter);
router.use(vibeswipeStoriesRouter);
router.use(vibeswipeVerificationRouter);
router.use(vibeswipeReelsRouter);
router.use(vibeswipeDirectChatsRouter);
router.use(vibeswipeRouter);
router.use(vibeswipeRealtimeRouter);
router.use(vibeswipeProfileViewsRouter);
router.use(vibeswipeSocialRouter);
router.use(vibeswipePushRouter);

export default router;
