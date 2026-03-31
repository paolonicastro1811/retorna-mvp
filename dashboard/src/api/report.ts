import { api } from './client'
import type { DemoReport } from '../types'

export const getReport = (restaurantId: string) =>
  api<DemoReport>(`/demo/report?restaurantId=${restaurantId}`)
