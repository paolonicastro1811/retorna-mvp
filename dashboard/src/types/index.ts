export interface Customer {
  id: string
  restaurantId: string
  phone: string
  name: string | null
  lifecycleStatus: 'active' | 'inactive'
  totalVisits: number
  totalSpent: number
  avgTicket: number
  lastVisitAt: string | null
  lastVisitAmount: number | null
  whatsappOptInStatus: 'unknown' | 'granted' | 'revoked'
  contactableStatus: 'contactable' | 'do_not_contact'
  marketingOptInAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BookingLead {
  id: string
  customerName: string | null
  phone: string
  requestedDate: string | null
  requestedTime: string | null
  partySize: number | null
  status: 'pending' | 'confirmed' | 'completed'
  createdAt: string
}
