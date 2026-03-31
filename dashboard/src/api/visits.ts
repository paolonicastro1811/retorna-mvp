import { api } from './client'

export const recordVisit = (rid: string, data: {
  phone: string
  customerName?: string
  amount?: number
}) =>
  api<{ customer: unknown; event: unknown }>(`/restaurants/${rid}/visits`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
