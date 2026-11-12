export type Gender = 'Male' | 'Female' | 'Other';
export type MaritalStatus = 'Never Married' | 'Divorced' | 'Widowed' | 'Awaiting Divorce';
export type DietType = 'Vegetarian' | 'Non-Vegetarian' | 'Eggetarian' | 'Jain' | 'Vegan' | 'Prefer not to say';
export type ManglikStatus = 'Yes' | 'No' | 'Partial' | 'Do not believe' | 'Prefer not to say';

export interface PartnerPreferences {
  minAge: number;
  maxAge: number;
  minHeight: number;
  maxHeight: number;
  maritalStatus: MaritalStatus[];
  religions: string[];
  communities: string[];
  motherTongues: string[];
  educationLevels: string[];
  occupations: string[];
  minIncome: number;
  locations: string[];
  diet: DietType[];
  manglikPreference?: string;
}

export interface MatrimonialProfile {
  id: string;
  userId: string;
  fullName: string;
  gender: Gender;
  dateOfBirth: string;
  age: number;
  height: number;
  heightFormatted: string;
  maritalStatus: MaritalStatus;
  motherTongue: string;
  languagesKnown: string[];

  // Religion & Astrology
  religion: string;
  community: string;
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
  annualIncome: number;
  annualIncomeFormatted: string;
  workLocation: string;

  // Location
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

  // Lifestyle
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
  phoneVerified: boolean;
  govtIdVerified: boolean;
  premiumMember: boolean;

  // Partner Preferences
  partnerPreferences: PartnerPreferences;

  // Contact
  phone: string;
  email: string;
  isContactUnlocked?: boolean;

  // Matching metadata
  matchScore?: number;
  matchHighlights?: string[];
  isShortlisted?: boolean;
  interestStatus?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

export interface InterestRequest {
  id: string;
  senderProfileId: string;
  receiverProfileId: string;
  status: 'pending' | 'accepted' | 'declined';
  sentAt: string;
  respondedAt?: string;
  message?: string;
  sender?: MatrimonialProfile;
  receiver?: MatrimonialProfile;
  matchedProfile?: MatrimonialProfile;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface ConversationSummary {
  partnerId: string;
  partner: Pick<MatrimonialProfile, 'id' | 'fullName' | 'profilePhoto'> & Partial<MatrimonialProfile> & { isAdministrator?: boolean };
  lastMessage: ChatMessage | null;
  unreadCount: number;
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

