import {
  MatrimonialProfile,
  InterestRequest,
  ChatMessage,
  ConversationSummary,
  WeddingChecklistItem,
  WeddingBudgetItem,
  Vendor,
  User,
} from '../types';
import { Membership, PlanId, SubscriptionCatalogue } from '../types/subscriptions';

const API_BASE = '/api';

export interface AccountSecurity {
  email: string;
  phone: string;
  phoneVerified: boolean;
  phoneTestEnabled: boolean;
  testOnly: boolean;
}
export interface PhoneTestChallenge {
  challengeId: string;
  phone: string;
  testCode: string;
  testOnly: boolean;
  expiresAt: string;
  resendAt: string;
}

interface AuthResponse {
  token: string;
  user: User;
  profile: MatrimonialProfile | null;
}

export class ApiError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

const readJsonResponse = async <T>(res: Response, fallbackMessage: string): Promise<T> => {
  const body = await res.text();
  let data: unknown;

  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      const message = res.ok
        ? `${fallbackMessage}: the server returned an invalid response`
        : `${fallbackMessage} (HTTP ${res.status})`;
      throw new Error(message);
    }
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string'
        ? data.message
        : `${fallbackMessage} (HTTP ${res.status})`;
    const fieldErrors = typeof data === 'object' && data !== null && 'fieldErrors' in data &&
      typeof data.fieldErrors === 'object' && data.fieldErrors !== null && !Array.isArray(data.fieldErrors)
      ? Object.fromEntries(Object.entries(data.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : undefined;
    throw new ApiError(message, fieldErrors && Object.keys(fieldErrors).length ? fieldErrors : undefined);
  }

  if (data === undefined) {
    throw new Error(`${fallbackMessage}: the server returned an empty response`);
  }

  return data as T;
};

const getHeaders = () => {
  const token = localStorage.getItem('shadi_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  changeEmail: async (newEmail: string, confirmEmail: string, currentPassword: string): Promise<{ message: string }> => readJsonResponse(await fetch(`${API_BASE}/account-security/email`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ newEmail, confirmEmail, currentPassword }) }), 'Could not update your email address'),
  getSubscriptionPlans: async (): Promise<SubscriptionCatalogue> => readJsonResponse(await fetch(`${API_BASE}/subscriptions/plans`), 'Could not load subscription plans'),
  getSubscription: async (): Promise<Membership> => readJsonResponse(await fetch(`${API_BASE}/subscriptions/me`, { headers: getHeaders() }), 'Could not load your subscription'),
  createSubscriptionCheckout: async (planId: PlanId): Promise<{ orderId: string; checkoutUrl: string }> => readJsonResponse(await fetch(`${API_BASE}/subscriptions/checkout`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ planId }) }), 'Could not start checkout'),
  getAccountSecurity: async (): Promise<AccountSecurity> => {
    const res = await fetch(`${API_BASE}/account-security`, { headers: getHeaders() });
    return readJsonResponse(res, 'Could not load account settings');
  },
  changePassword: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/account-security/password`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    return readJsonResponse(res, 'Could not change your password');
  },
  startPhoneTest: async (phone: string, currentPassword: string): Promise<PhoneTestChallenge> => {
    const res = await fetch(`${API_BASE}/account-security/phone/test-code`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone, currentPassword }) });
    return readJsonResponse(res, 'Could not create a test code');
  },
  confirmPhoneTest: async (challengeId: string, code: string): Promise<{ message: string; phone: string }> => {
    const res = await fetch(`${API_BASE}/account-security/phone/confirm-test`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ challengeId, code }) });
    return readJsonResponse(res, 'Could not complete the test');
  },
  // --- Auth ---
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return readJsonResponse<AuthResponse>(res, 'Login failed');
  },

  register: async (data: Record<string, unknown>): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return readJsonResponse<AuthResponse>(res, 'Registration failed');
  },

  getCurrentUser: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  },

  // --- Profiles ---
  getProfiles: async (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/profiles?${query}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch profiles');
    return res.json();
  },

  getProfileById: async (id: string): Promise<MatrimonialProfile> => {
    const res = await fetch(`${API_BASE}/profiles/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Profile not found');
    return res.json();
  },

  getRecommendedProfiles: async (): Promise<MatrimonialProfile[]> => {
    const res = await fetch(`${API_BASE}/profiles/recommended`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  getPlatformStats: async () => {
    const res = await fetch(`${API_BASE}/profiles/stats`);
    return readJsonResponse<{ totalMembers: number; activeMatches: number; phoneVerifiedProfiles: number; verifiedRate: string }>(res, 'Could not load platform statistics');
  },

  updateProfile: async (id: string, data: Partial<MatrimonialProfile>) => {
    const res = await fetch(`${API_BASE}/profiles/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return readJsonResponse<MatrimonialProfile>(res, 'Could not update your profile');
  },

  // --- Interactions ---
  sendInterest: async (targetProfileId: string, message?: string) => {
    const res = await fetch(`${API_BASE}/interactions/interest/${targetProfileId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to send interest');
    }
    return res.json();
  },

  respondToInterest: async (interestId: string, action: 'accepted' | 'declined') => {
    const res = await fetch(`${API_BASE}/interactions/interest/${interestId}/respond`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
    if (!res.ok) throw new Error('Failed to respond to interest');
    return res.json();
  },

  getInterests: async () => {
    const res = await fetch(`${API_BASE}/interactions/interests`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load interests');
    return res.json();
  },

  toggleShortlist: async (profileId: string) => {
    const res = await fetch(`${API_BASE}/interactions/shortlist/${profileId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to update shortlist');
    return res.json();
  },

  getShortlists: async (): Promise<MatrimonialProfile[]> => {
    const res = await fetch(`${API_BASE}/interactions/shortlists`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  getProfileViews: async () => {
    const res = await fetch(`${API_BASE}/interactions/views`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  // --- Messages ---
  getConversations: async (): Promise<ConversationSummary[]> => {
    const res = await fetch(`${API_BASE}/messages/conversations`, {
      headers: getHeaders(),
    });
    return readJsonResponse<ConversationSummary[]>(res, 'Could not load conversations');
  },

  getMessages: async (partnerProfileId: string): Promise<ChatMessage[]> => {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(partnerProfileId)}`, {
      headers: getHeaders(),
    });
    return readJsonResponse<ChatMessage[]>(res, 'Could not load this conversation');
  },

  sendMessage: async (partnerProfileId: string, content: string): Promise<ChatMessage> => {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(partnerProfileId)}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    return readJsonResponse<ChatMessage>(res, 'Could not send your message. Your draft has been kept.');
  },

  // --- Wedding Planner ---
  getVendors: async (category?: string, city?: string): Promise<Vendor[]> => {
    const query = new URLSearchParams();
    if (category) query.append('category', category);
    if (city) query.append('city', city);
    const res = await fetch(`${API_BASE}/wedding/vendors?${query.toString()}`);
    return readJsonResponse<Vendor[]>(res, 'Could not load the wedding vendor directory');
  },

  getChecklist: async (): Promise<WeddingChecklistItem[]> => {
    const res = await fetch(`${API_BASE}/wedding/checklist`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  addChecklistItem: async (item: Partial<WeddingChecklistItem>) => {
    const res = await fetch(`${API_BASE}/wedding/checklist`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(item),
    });
    return res.json();
  },

  toggleChecklistItem: async (id: string, completed: boolean) => {
    const res = await fetch(`${API_BASE}/wedding/checklist/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ completed }),
    });
    return res.json();
  },

  deleteChecklistItem: async (id: string) => {
    const res = await fetch(`${API_BASE}/wedding/checklist/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  getBudget: async (): Promise<WeddingBudgetItem[]> => {
    const res = await fetch(`${API_BASE}/wedding/budget`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  addBudgetItem: async (item: Partial<WeddingBudgetItem>) => {
    const res = await fetch(`${API_BASE}/wedding/budget`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(item),
    });
    return res.json();
  },

  updateBudgetItem: async (id: string, data: Partial<WeddingBudgetItem>) => {
    const res = await fetch(`${API_BASE}/wedding/budget/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteBudgetItem: async (id: string) => {
    const res = await fetch(`${API_BASE}/wedding/budget/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },
};
