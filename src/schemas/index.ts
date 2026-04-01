import { z } from 'zod';

export const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(100, 'Nome deve ter no maximo 100 caracteres'),
  email: z.string().email('Email invalido'),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(100, 'Nome deve ter no maximo 100 caracteres'),
  templateId: z.string().optional(),
});

export const recordVisitSchema = z.object({
  phone: z.string().min(8, 'Telefone deve ter no minimo 8 caracteres').max(20, 'Telefone deve ter no maximo 20 caracteres'),
  customerName: z.string().optional(),
  spendAmount: z.number().min(0, 'Valor deve ser positivo').optional(),
});

export const magicLinkSchema = z.object({
  email: z.string().email('Email invalido'),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  body: z.string().min(1, 'Corpo do template e obrigatorio'),
});
