import { Router, Request, Response } from "express";
import { attributionService } from "../services/attribution.service";
import { param, queryString } from "../shared/params";

const router = Router();

router.get("/:restaurantId/roi", async (req: Request, res: Response) => {
  try {
    const since = queryString(req, "since");
    const roi = await attributionService.getRestaurantROI(
      param(req, "restaurantId"),
      since ? new Date(since) : undefined
    );
    res.json(roi);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get("/:restaurantId/attributions", async (req: Request, res: Response) => {
  try {
    const since = queryString(req, "since");
    const attributions = await attributionService.getAttributionsByRestaurant(
      param(req, "restaurantId"),
      since ? new Date(since) : undefined
    );
    res.json(attributions);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export const attributionRouter = router;
