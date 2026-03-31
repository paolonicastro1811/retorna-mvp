import { api } from './client'
import type { Customer } from '../types'

export const getCustomers = (rid: string) =>
  api<Customer[]>(`/restaurants/${rid}/customers`)

export const deleteCustomer = (rid: string, cid: string) =>
  api<{ deleted: boolean }>(`/restaurants/${rid}/customers/${cid}`, { method: 'DELETE' })

export const updateCustomerStatus = (rid: string, cid: string, lifecycleStatus: 'active' | 'inactive') =>
  api<Customer>(`/restaurants/${rid}/customers/${cid}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ lifecycleStatus }),
  })

export const updateLastVisitAmount = (rid: string, cid: string, amount: number) =>
  api<Customer>(`/restaurants/${rid}/customers/${cid}/last-visit-amount`, {
    method: 'PATCH',
    body: JSON.stringify({ amount }),
  })
