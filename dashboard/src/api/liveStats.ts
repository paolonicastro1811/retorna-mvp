import { api } from './client'
import type { LiveStats } from '../types'

export const getLiveStats = (rid: string) =>
  api<LiveStats>(`/restaurants/${rid}/live-stats`)
