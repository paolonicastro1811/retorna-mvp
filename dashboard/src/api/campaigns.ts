import { api } from './client'
import type { Campaign, CampaignStats, MessageTemplate } from '../types'

export const getCampaigns = (rid: string) =>
  api<Campaign[]>(`/restaurants/${rid}/campaigns`)

export const createCampaign = (rid: string, data: {
  name: string
  segmentRules: { lifecycle?: string[]; flags?: string[] }
  templateId?: string
}) =>
  api<Campaign>(`/restaurants/${rid}/campaigns`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const buildAudience = (campaignId: string) =>
  api<{ audienceSize: number }>(`/restaurants/campaigns/${campaignId}/build`, { method: 'POST' })

export const queueMessages = (campaignId: string) =>
  api<{ queued: number }>(`/restaurants/campaigns/${campaignId}/queue`, { method: 'POST' })

export const dispatchCampaign = (campaignId: string) =>
  api<{ sent: number; failed: number; total: number }>(`/restaurants/campaigns/${campaignId}/dispatch`, { method: 'POST' })

export const getCampaignStats = (campaignId: string) =>
  api<CampaignStats[]>(`/restaurants/campaigns/${campaignId}/stats`)

export const getTemplates = (rid: string) =>
  api<MessageTemplate[]>(`/restaurants/${rid}/templates`)
