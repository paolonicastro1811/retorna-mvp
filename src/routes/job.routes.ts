import { Router, Request, Response } from "express";
import { runLifecycleRefresh } from "../jobs/lifecycleRefresh.job";
import { runAudienceBuild } from "../jobs/audienceBuild.job";
import { runMessageDispatch } from "../jobs/messageDispatch.job";
import { segmentationService } from "../services/segmentation.service";
import { param } from "../shared/params";

const router = Router();

router.post("/lifecycle-refresh", async (_req: Request, res: Response) => {
  const result = await runLifecycleRefresh();
  res.json(result);
});

router.post(
  "/lifecycle-refresh/:restaurantId",
  async (req: Request, res: Response) => {
    const result = await segmentationService.refreshAllForRestaurant(
      param(req, "restaurantId")
    );
    res.json(result);
  }
);

router.post("/audience-build", async (_req: Request, res: Response) => {
  const result = await runAudienceBuild();
  res.json(result);
});

router.post("/message-dispatch", async (_req: Request, res: Response) => {
  const result = await runMessageDispatch();
  res.json(result);
});

export const jobRouter = router;
