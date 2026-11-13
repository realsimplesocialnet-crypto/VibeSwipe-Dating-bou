import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vibeswipeRouter from "./vibeswipe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vibeswipeRouter);

export default router;
