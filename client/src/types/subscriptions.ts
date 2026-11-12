export type PlanId = 'free' | 'gold' | 'platinum';
export interface SubscriptionPlan {
  id: PlanId; name: string; pricePaise: number; currency: 'INR'; durationDays: number | null;
  interestLimit: number | null; browseLimit: number | null; advancedSearch: boolean;
  contactDetails: boolean; enhancedVisibility: boolean; compatibleFirst: boolean; premiumBadge: boolean;
  support: 'standard' | 'priority' | 'dedicated';
}
export interface Membership {
  plan: SubscriptionPlan; status: 'free' | 'active' | 'expired' | 'cancelled'; startedAt: string | null; expiresAt: string | null;
  interestsUsed: number; interestsResetAt: string;
}
export interface SubscriptionCatalogue { plans: SubscriptionPlan[]; checkout: { available: boolean; message: string } }
export const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(paise / 100);
export const subscriptionDate = (date: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
