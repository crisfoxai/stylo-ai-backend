export const PLAN_LIMITS = {
  free:          { tryon: 0,  chatMessages: 0,  outfitsPerDay: 1 },
  stylist:       { tryon: 0,  chatMessages: 30, outfitsPerDay: -1 },
  pro:           { tryon: 20, chatMessages: -1, outfitsPerDay: -1 },
  pro_unlimited: { tryon: 80, chatMessages: -1, outfitsPerDay: -1 },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;

export const PRODUCT_TIER_MAP: Record<string, PlanTier> = {
  stylo_stylist_monthly: 'stylist',
  stylo_stylist_annual: 'stylist',
  stylo_pro_monthly: 'pro',
  stylo_pro_annual: 'pro',
  stylo_pro_unlimited_monthly: 'pro_unlimited',
  stylo_pro_unlimited_annual: 'pro_unlimited',
};
