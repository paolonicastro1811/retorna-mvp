// Default restaurant ID (from existing DB) — overridden by onboarding
const DEFAULT_RESTAURANT_ID = 'cmnczaxjc0000buk8kuy822kj'

/** @deprecated Use useRestaurantId() hook in components or getRestaurantId() in API modules */
export const RESTAURANT_ID =
  (typeof window !== 'undefined' && localStorage.getItem('restaurantId')) || DEFAULT_RESTAURANT_ID

/** Reads restaurantId fresh from localStorage each time — safe after onboarding */
export function getRestaurantId(): string {
  return (typeof window !== 'undefined' && localStorage.getItem('restaurantId')) || DEFAULT_RESTAURANT_ID
}

export const API_BASE = ''
