// Default restaurant ID (from existing DB) — overridden by onboarding
const DEFAULT_RESTAURANT_ID = 'cmnczaxjc0000buk8kuy822kj'

export const RESTAURANT_ID =
  (typeof window !== 'undefined' && localStorage.getItem('restaurantId')) || DEFAULT_RESTAURANT_ID

export const API_BASE = ''
