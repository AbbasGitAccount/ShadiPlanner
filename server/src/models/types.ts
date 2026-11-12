export type Gender = 'Male' | 'Female' | 'Other';
export type MaritalStatus = 'Never Married' | 'Divorced' | 'Widowed' | 'Awaiting Divorce';
export type DietType = 'Vegetarian' | 'Non-Vegetarian' | 'Eggetarian' | 'Jain' | 'Vegan' | 'Prefer not to say';
export type ManglikStatus = 'Yes' | 'No' | 'Partial' | 'Do not believe' | 'Prefer not to say';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  createdAt: string;
  authVersion?: number;
  suspended?: boolean;
}

export interface PartnerPreferences {
  minAge: number;
  maxAge: number;
  minHeight: number; // in cm
  maxHeight: number; // in cm
  maritalStatus: MaritalStatus[];
  religions: string[];
  communities: string[];
  motherTongues: string[];
  educationLevels: string[];
  occupations: string[];
  minIncome: number; // in LPA (Lakhs per annum)
  locations: string[];
  diet: DietType[];
  manglikPreference?: string;
}

export interface MatrimonialProfile {
  id: string;
  userId: string;
  fullName: string;
  gender: Gender;
  dateOfBirth: string; // YYYY-MM-DD
  age: number;
  height: number; // cm e.g. 175 = 5'9"
  heightFormatted: string; // e.g. "5 ft 9 in (175 cm)"
  maritalStatus: MaritalStatus;
  motherTongue: string;
  languagesKnown: string[];

  // Religion & Astrology
  religion: string;
  community: string; // Caste / Community
  subCommunity?: string;
  gothram?: string;
  manglik: ManglikStatus;
  rashi?: string;
  nakshatra?: string;

  // Education & Career
  highestEducation: string;
  collegeUniversity?: string;
  profession: string;
  company?: string;
  annualIncome: number; // in Lakhs per annum
  annualIncomeFormatted: string; // e.g. "₹25 - 30 Lakhs / yr"
  workLocation: string; // City, State, Country

  // Location & Residential
  city: string;
  state: string;
  country: string;
  citizenship: string;

  // Family Background
  familyType: 'Nuclear' | 'Joint' | 'Prefer not to say';
  familyStatus: 'Middle Class' | 'Upper Middle Class' | 'Rich / Affluent' | 'Prefer not to say';
  fatherOccupation: string;
  motherOccupation: string;
  brothersCount: number;
  sistersCount: number;
  familyLocation: string;

  // Lifestyle & Habits
  diet: DietType;
  smoking: 'No' | 'Yes' | 'Occasionally' | 'Prefer not to say';
  drinking: 'No' | 'Yes' | 'Occasionally' | 'Prefer not to say';
  hobbies: string[];

  // Media & Bio
  profilePhoto: string;
  galleryPhotos: string[];
  aboutMe: string;
  aboutFamily?: string;

  // Verification & Badges
  isVerified: boolean;
  verificationReviewedBy?: string;
  verificationReviewedAt?: string;
  phoneVerified: boolean;
  govtIdVerified: boolean;
  premiumMember: boolean;
  enhancedVisibility?: boolean; // Computed from the active subscription snapshot.

  // Partner Preferences
  partnerPreferences: PartnerPreferences;

  // Contact (unlocked upon match/request approval)
  phone: string;
  email: string;

  createdAt: string;
  updatedAt: string;
}

export type InterestStatus = 'pending' | 'accepted' | 'declined';

export interface InterestRequest {
  id: string;
  senderProfileId: string;
  receiverProfileId: string;
  status: InterestStatus;
  sentAt: string;
  respondedAt?: string;
  message?: string;
}

export interface ShortlistRecord {
  id: string;
  userId: string;
  profileId: string;
  savedAt: string;
}

export interface ProfileViewRecord {
  id: string;
  viewerProfileId: string;
  viewedProfileId: string;
  viewedAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string; // profileId or userId
  receiverId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface WeddingChecklistItem {
  id: string;
  userId: string;
  title: string;
  category: 'Venue & Food' | 'Attire & Jewelry' | 'Ceremony & Rituals' | 'Invitations & Gifts' | 'Photography & Music';
  dueDate: string;
  completed: boolean;
  estimatedCost?: number;
}

export interface WeddingBudgetItem {
  id: string;
  userId: string;
  category: string;
  allocatedAmount: number;
  actualAmount: number;
  notes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: 'Venue' | 'Photographer' | 'Catering' | 'Makeup & Mehndi' | 'Decorator' | 'DJ & Music';
  city: string;
  priceRange: string;
  rating: number;
  reviewsCount: number;
  image: string;
  phone: string;
  email: string;
  features: string[];
}

