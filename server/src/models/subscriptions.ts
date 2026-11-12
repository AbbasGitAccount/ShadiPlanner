export type PlanId = 'free' | 'gold' | 'platinum';
export interface SubscriptionPlan {
  enabled?: boolean;
  id: PlanId; name: string; pricePaise: number; currency: 'INR'; durationDays: number | null;
  interestLimit: number | null; browseLimit: number | null; advancedSearch: boolean;
  contactDetails: boolean; enhancedVisibility: boolean; compatibleFirst: boolean; premiumBadge: boolean;
  support: 'standard' | 'priority' | 'dedicated';
}
export class SubscriptionError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
export const planRank = { free: 0, gold: 1, platinum: 2 };
export const advancedFilters = ['diet', 'maritalStatus', 'city', 'profession', 'manglik', 'query'];
export function hasAdvancedFilters(query: Record<string, unknown>): boolean {
  return advancedFilters.some(key => query[key] !== undefined && query[key] !== '' && query[key] !== 'all') || query.sortBy === 'income_desc';
}
