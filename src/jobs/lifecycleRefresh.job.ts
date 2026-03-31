import { restaurantRepository } from "../repositories/restaurant.repository";
import { segmentationService } from "../services/segmentation.service";

/**
 * Lifecycle Refresh Job
 * Ricalcola lifecycle_status, isFrequent, isHighSpender per tutti i clienti
 * di tutti i ristoranti. Pensato per essere eseguito via cron (es. ogni ora).
 */
export async function runLifecycleRefresh() {
  console.log("[Job:LifecycleRefresh] Starting...");

  const restaurants = await restaurantRepository.findAll();
  let totalUpdated = 0;

  for (const restaurant of restaurants) {
    try {
      const result = await segmentationService.refreshAllForRestaurant(
        restaurant.id
      );
      totalUpdated += result.updated;
      console.log(
        `[Job:LifecycleRefresh] ${restaurant.name}: ${result.updated} customers updated`
      );
    } catch (err) {
      console.error(
        `[Job:LifecycleRefresh] Error for restaurant ${restaurant.id}:`,
        err
      );
    }
  }

  console.log(
    `[Job:LifecycleRefresh] Done. Total updated: ${totalUpdated}`
  );
  return { totalUpdated };
}
