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
  tier?: string
  currentStreak?: number
  streakUpdatedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerSearchResult {
  id: string
  name: string | null
  phone: string
  tier: string
  totalVisits: number
  currentStreak: number
  streakUpdatedAt: string | null
  lastVisitAt: string | null
  lifecycleStatus: string
}

export interface LoyaltyFeedback {
  tier: string
  nextTier: string | null
  visitsToNextTier: number
  currentStreak: number
  streakTarget: number
  totalVisits: number
}

export interface VisitResponse {
  customer: Customer
  event: { id: string; amount: number | null; occurredAt: string }
  loyaltyFeedback: LoyaltyFeedback | null
}

export interface LiveStats {
  tablesOccupied: number
  tablesTotal: number
  revenueToday: number
  customersServedToday: number
  avgTicketToday: number
  reservations: LiveReservation[]
}

export interface LiveReservation {
  id: string
  customerName: string | null
  phone: string
  time: string
  partySize: number
  status: string
  table: { tableNumber: number; label: string | null; seats: number } | null
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
