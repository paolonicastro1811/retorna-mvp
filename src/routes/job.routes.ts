import { Router, Request, Response } from "express";
import { runLifecycleRefresh } from "../jobs/lifecycleRefresh.job";
import { runAudienceBuild } from "../jobs/audienceBuild.job";
import { runMessageDispatch } from "../jobs/messageDispatch.job";
import { segmentationService } from "../services/segmentation.service";
import { param } from "../shared/params";

const router = Router();

// Global job endpoints — restricted to API key auth only (no JWT users)
router.post("/lifecycle-refresh", async (req: Request, res: Response) => {
  try {
    // Only allow if API key auth (server-to-server), not JWT user
    if ((req as any).user) {
      return res.status(403).json({ error: "Global jobs are restricted to server-to-server API key auth" });
    }
    const result = await runLifecycleRefresh();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post(
  "/lifecycle-refresh/:restaurantId",
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const rid = param(req, "restaurantId");
      if (user && user.restaurantId !== rid) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const result = await segmentationService.refreshAllForRestaurant(rid);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

router.post("/audience-build", async (req: Request, res: Response) => {
  try {
    if ((req as any).user) {
      return res.status(403).json({ error: "Global jobs are restricted to server-to-server API key auth" });
    }
    const result = await runAudienceBuild();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/message-dispatch", async (req: Request, res: Response) => {
  try {
    if ((req as any).user) {
      return res.status(403).json({ error: "Global jobs are restricted to server-to-server API key auth" });
    }
    const result = await runMessageDispatch();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export const jobRouter = router;
