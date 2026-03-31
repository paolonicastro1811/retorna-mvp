import { api } from './client'

export const refreshLifecycle = (rid: string) =>
  api<{ restaurants_processed: number; customers_updated: number }>(
    `/jobs/lifecycle-refresh/${rid}`,
    { method: 'POST' }
  )
