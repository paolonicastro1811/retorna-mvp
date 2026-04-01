import { api } from './client'
import type { VisitResponse } from '../types'

export const recordVisit = (rid: string, data: {
  phone: string
  customerName?: string
  amount?: number
}) =>
  api<VisitResponse>(`/restaurants/${rid}/visits`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
