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

export interface Campaign {
  id: string
  restaurantId: string
  name: string
  status: 'draft' | 'building' | 'ready' | 'sending' | 'completed'
  segmentRules: { lifecycle?: string[]; flags?: string[] }
  templateId: string | null
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  _count?: { audience: number; messages: number }
}

export interface MessageTemplate {
  id: string
  restaurantId: string
  name: string
  body: string
  channel: string
  isActive: boolean
  createdAt: string
}

export interface CampaignStats {
  status: string
  _count: number
}

export interface DemoReport {
  restaurant: string
  period: string
  customers: {
    total: number
    lifecycle: { active: number; at_risk: number; inactive: number }
    consent: { unknown: number; granted: number; revoked: number }
  }
  campaigns: {
    contacted_customers: number
    total_messages: number
    delivery: Record<string, number>
  }
  reactivation: {
    reactivated_customers: number
    total_revenue: number
    roi_estimate: string
    details: Array<{
      customer: string
      phone: string
      revenue: number
      visit_date: string
      attributed_at: string
    }>
  }
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
