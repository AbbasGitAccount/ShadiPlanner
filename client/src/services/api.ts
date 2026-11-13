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

const resolveApiBase = () => {
  const envUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_API_URL);
  if (!envUrl) {
    return 'https://server-git-main-abbas1-54fd.vercel.app/api';
  }
  const trimmed = envUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export const API_BASE = resolveApiBase();

export interface ApkDownloadInfo {
  available: boolean;
  appName: string;
  packageName: string;
  version: string;
  versionCode: number;
  buildType: string;
  minAndroidVersion: string;
  architectures: string[];
  fileName: string;
  downloadUrl: string;
  externalUrl?: string | null;
  fileSize?: number | null;
  fileSizeFormatted?: string;
  installGuide?: string[];
  message?: string;
}

export const getApkDownloadUrl = (): string => {
  const customUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APK_DOWNLOAD_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_APK_DOWNLOAD_URL);
  if (customUrl) return customUrl.trim();
  return `${API_BASE}/download/apk`;
};

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
  let data: any;
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

    const fieldErrors =
      typeof data === 'object' &&
      data !== null &&
      'fieldErrors' in data &&
      typeof data.fieldErrors === 'object' &&
      data.fieldErrors !== null &&
      !Array.isArray(data.fieldErrors)
        ? Object.fromEntries(
            Object.entries(data.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          )
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
  // --- Account Security & Subscriptions ---
  changeEmail: async (newEmail: string, confirmEmail: string, currentPassword: string): Promise<{ message: string }> => readJsonResponse(await fetch(`${API_BASE}/account-security/email`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ newEmail, confirmEmail, currentPassword }) }), 'Could not update your email address'),
  getSubscriptionPlans: async (): Promise<SubscriptionCatalogue> => readJsonResponse(await fetch(`${API_BASE}/subscriptions/plans`), 'Could not load subscription plans'),
  getSubscription: async (): Promise<Membership> => readJsonResponse(await fetch(`${API_BASE}/subscriptions/me`, { headers: getHeaders() }), 'Could not load your subscription'),
  createSubscriptionCheckout: async (planId: PlanId): Promise<{ orderId: string; checkoutUrl: string }> => readJsonResponse(await fetch(`${API_BASE}/subscriptions/checkout`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ planId }) }), 'Could not start checkout'),
  getAccountSecurity: async (): Promise<AccountSecurity> => {
    const res = await fetch(`${API_BASE}/account-security`, { headers: getHeaders() });
    return readJsonResponse<AccountSecurity>(res, 'Could not load account security settings');
  },
  changePassword: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/account-security/password`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
    return readJsonResponse<{ message: string }>(res, 'Could not update your password');
  },
  startPhoneTest: async (phone: string, currentPassword: string): Promise<PhoneTestChallenge> => {
    const res = await fetch(`${API_BASE}/account-security/phone/test-code`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ phone, currentPassword }) });
    return readJsonResponse<PhoneTestChallenge>(res, 'Could not create a test code');
  },
  confirmPhoneTest: async (challengeId: string, code: string): Promise<{ message: string; phone: string; phoneVerified: boolean }> => {
    const res = await fetch(`${API_BASE}/account-security/phone/confirm-test`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ challengeId, code }) });
    return readJsonResponse<{ message: string; phone: string; phoneVerified: boolean }>(res, 'Could not verify test phone number');
  },

  // --- Auth ---
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return readJsonResponse<AuthResponse>(res, 'Could not sign in to your account');
  },

  register: async (data: any): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return readJsonResponse<AuthResponse>(res, 'Could not complete registration');
  },

  getCurrentUser: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return readJsonResponse<any>(res, 'Could not verify your session');
  },

  getDemoAccounts: async () => {
    const res = await fetch(`${API_BASE}/auth/demo-accounts`);
    return readJsonResponse<any>(res, 'Could not load test accounts');
  },

  // --- Profiles ---
  getProfiles: async (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/profiles?${query}`, {
      headers: getHeaders(),
    });
    return readJsonResponse<{ total: number; profiles: MatrimonialProfile[] }>(
      res,
      'Could not load matrimonial profiles'
    );
  },

  getProfileById: async (id: string): Promise<MatrimonialProfile> => {
    const res = await fetch(`${API_BASE}/profiles/${id}`, {
      headers: getHeaders(),
    });
    return readJsonResponse<MatrimonialProfile>(res, 'Could not load this profile');
  },

  getRecommendedProfiles: async (): Promise<MatrimonialProfile[]> => {
    const res = await fetch(`${API_BASE}/profiles/recommended`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return readJsonResponse<MatrimonialProfile[]>(res, 'Could not load recommended profiles');
  },

  getPlatformStats: async () => {
    const res = await fetch(`${API_BASE}/profiles/stats`);
    return readJsonResponse<any>(res, 'Could not load platform statistics');
  },

  updateProfile: async (id: string, data: Partial<MatrimonialProfile>, ifUnmodifiedSince?: string) => {
    const headers = getHeaders();
    if (ifUnmodifiedSince) {
      headers['If-Unmodified-Since'] = ifUnmodifiedSince;
    }
    const res = await fetch(`${API_BASE}/profiles/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return readJsonResponse<MatrimonialProfile>(res, 'Could not update your biodata');
  },

  // --- Interactions ---
  sendInterest: async (targetProfileId: string, message?: string) => {
    const res = await fetch(`${API_BASE}/interactions/interest/${targetProfileId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    return readJsonResponse<{ message: string; interest: InterestRequest }>(
      res,
      'Could not send interest'
    );
  },

  respondToInterest: async (interestId: string, action: 'accepted' | 'declined') => {
    const res = await fetch(`${API_BASE}/interactions/interest/${interestId}/respond`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
    return readJsonResponse<{ message: string; interest: InterestRequest }>(
      res,
      'Could not update interest status'
    );
  },

  getInterests: async () => {
    const res = await fetch(`${API_BASE}/interactions/interests`, {
      headers: getHeaders(),
    });
    return readJsonResponse<{ received: InterestRequest[]; sent: InterestRequest[]; connected: InterestRequest[] }>(
      res,
      'Could not load your interests'
    );
  },

  toggleShortlist: async (profileId: string) => {
    const res = await fetch(`${API_BASE}/interactions/shortlist/${profileId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return readJsonResponse<{ shortlisted: boolean; message: string }>(
      res,
      'Could not update your shortlist'
    );
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
  getConversations: async () => {
    const res = await fetch(`${API_BASE}/messages/conversations`, {
      headers: getHeaders(),
    });
    return readJsonResponse<ConversationSummary[]>(res, 'Could not load conversations');
  },

  getMessages: async (partnerProfileId: string) => {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(partnerProfileId)}`, {
      headers: getHeaders(),
    });
    return readJsonResponse<ChatMessage[]>(res, 'Could not load this conversation');
  },

  sendMessage: async (partnerProfileId: string, content: string) => {
    const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(partnerProfileId)}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    return readJsonResponse<ChatMessage>(res, 'Could not send your message. Your draft has been kept.');
  },

  // --- Wedding Planner ---
  getVendors: async (category?: string, city?: string) => {
    const query = new URLSearchParams();
    if (category) query.append('category', category);
    if (city) query.append('city', city);
    const res = await fetch(`${API_BASE}/wedding/vendors?${query.toString()}`);
    return readJsonResponse<Vendor[]>(res, 'Could not load the wedding vendor directory');
  },

  getChecklist: async () => {
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

  getBudget: async () => {
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

  getApkInfo: async (): Promise<ApkDownloadInfo> => {
    const res = await fetch(`${API_BASE}/download/info`);
    if (!res.ok) {
      throw new Error('Failed to retrieve APK build information');
    }
    return res.json();
  },
};
