import type { MatrimonialProfile as BaseProfile, InterestRequest, User } from '../../client/src/types';
export type { User, InterestRequest, ChatMessage, ConversationSummary, WeddingChecklistItem, WeddingBudgetItem, Vendor } from '../../client/src/types';
export type MatrimonialProfile = BaseProfile & { interestRecord?: InterestRequest | null };
import type { Membership, SubscriptionCatalogue, SubscriptionPlan } from '../../client/src/types/subscriptions';
export type { Membership, SubscriptionCatalogue, SubscriptionPlan };
export interface Session { token: string; user: User; profile: MatrimonialProfile | null; membership?: Membership | null }
export interface Suggestion { id: number; partner_name: string; consent: boolean | null; mutual_consent: boolean; partner_id: string | null }
export type AdminRow = Record<string, any>;
