import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { readJsonStore, writeJsonAtomically } from './jsonStore.js';
import {
  User,
  MatrimonialProfile,
  InterestRequest,
  ShortlistRecord,
  ProfileViewRecord,
  ChatMessage,
  WeddingChecklistItem,
  WeddingBudgetItem,
  Vendor,
} from '../models/types.js';
import {
  SEED_USERS,
  SEED_PROFILES,
  SEED_VENDORS,
  DEFAULT_CHECKLIST,
  DEFAULT_BUDGET,
} from './mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Development and compiled builds must use the same legacy store during migration.
const STORE_FILE = path.resolve(__dirname, '../../src/data/store.json');

interface DatabaseStore {
  users: User[];
  profiles: MatrimonialProfile[];
  interests: InterestRequest[];
  shortlists: ShortlistRecord[];
  views: ProfileViewRecord[];
  messages: ChatMessage[];
  checklist: WeddingChecklistItem[];
  budget: WeddingBudgetItem[];
  vendors: Vendor[];
}

class DatabaseManager {
  private data: DatabaseStore;

  constructor() {
    this.data = this.loadOrInit();
  }

  private loadOrInit(): DatabaseStore {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const store = readJsonStore(STORE_FILE, ['users', 'profiles', 'interests', 'shortlists', 'views', 'messages', 'checklist', 'budget', 'vendors']) as unknown as DatabaseStore;
        // Older registrations were automatically verified. Send those real
        // member profiles for review while retaining the approved demo seeds.
        const seedIds = new Set(SEED_PROFILES.map((profile) => profile.id));
        let migrated = false;
        for (const profile of store.profiles) {
          if (profile.isVerified && !seedIds.has(profile.id) && !profile.verificationReviewedBy) {
            profile.isVerified = false;
            migrated = true;
          }
        }
        if (migrated) writeJsonAtomically(STORE_FILE, store);
        return store;
      }
    } catch (e) {
      throw new Error('Could not read the existing local store. Startup stopped to preserve your data.', { cause: e });
    }

    // Default seed initialization
    const passwordHash = bcrypt.hashSync('password123', 10);
    const users = SEED_USERS.map((u) => ({ ...u, passwordHash }));
    const profiles = [...SEED_PROFILES];
    const vendors = [...SEED_VENDORS];

    const checklist: WeddingChecklistItem[] = DEFAULT_CHECKLIST.map((item, idx) => ({
      ...item,
      id: `check_${idx + 1}`,
      userId: 'user_1',
    }));

    const budget: WeddingBudgetItem[] = DEFAULT_BUDGET.map((item, idx) => ({
      ...item,
      id: `budget_${idx + 1}`,
      userId: 'user_1',
    }));

    // Seed a couple of mutual interactions & messages so user immediately sees rich data!
    const interests: InterestRequest[] = [
      {
        id: 'int_1',
        senderProfileId: 'prof_2', // Rohit sent to Priya
        receiverProfileId: 'prof_1',
        status: 'pending',
        sentAt: '2024-02-20T10:00:00Z',
        message: 'Namaste Priya, I reviewed your profile and admire your dedication in healthcare. Would love to connect and talk!',
      },
      {
        id: 'int_2',
        senderProfileId: 'prof_4', // Kabir sent to Priya
        receiverProfileId: 'prof_1',
        status: 'accepted',
        sentAt: '2024-02-15T14:30:00Z',
        respondedAt: '2024-02-16T09:00:00Z',
        message: 'Hello Dr. Sharma, our family values resonate deeply with yours. Wishing to take conversations forward.',
      },
    ];

    const shortlists: ShortlistRecord[] = [
      { id: 'short_1', userId: 'user_1', profileId: 'prof_2', savedAt: '2024-02-21T11:00:00Z' },
      { id: 'short_2', userId: 'user_1', profileId: 'prof_3', savedAt: '2024-02-21T11:05:00Z' },
      { id: 'short_3', userId: 'user_2', profileId: 'prof_1', savedAt: '2024-02-20T09:00:00Z' },
    ];

    const views: ProfileViewRecord[] = [
      { id: 'vw_1', viewerProfileId: 'prof_2', viewedProfileId: 'prof_1', viewedAt: '2024-02-22T08:15:00Z' },
      { id: 'vw_2', viewerProfileId: 'prof_4', viewedProfileId: 'prof_1', viewedAt: '2024-02-23T16:40:00Z' },
      { id: 'vw_3', viewerProfileId: 'prof_6', viewedProfileId: 'prof_1', viewedAt: '2024-02-24T12:10:00Z' },
      { id: 'vw_4', viewerProfileId: 'prof_1', viewedProfileId: 'prof_2', viewedAt: '2024-02-22T09:00:00Z' },
    ];

    const messages: ChatMessage[] = [
      {
        id: 'msg_1',
        senderId: 'prof_4',
        receiverId: 'prof_1',
        content: 'Hi Priya, nice to connect here on ShadiPlanner! Hope your medical rounds went smoothly today.',
        timestamp: '2024-02-16T10:00:00Z',
        isRead: true,
      },
      {
        id: 'msg_2',
        senderId: 'prof_1',
        receiverId: 'prof_4',
        content: 'Hi Kabir, thank you! It was quite busy at the hospital. How has your week in Mumbai been?',
        timestamp: '2024-02-16T10:25:00Z',
        isRead: true,
      },
      {
        id: 'msg_3',
        senderId: 'prof_4',
        receiverId: 'prof_1',
        content: 'Quite engaging! We closed an investment round yesterday. Would your family and you be open for a relaxed weekend call?',
        timestamp: '2024-02-16T11:05:00Z',
        isRead: false,
      },
    ];

    const initialStore: DatabaseStore = {
      users,
      profiles,
      interests,
      shortlists,
      views,
      messages,
      checklist,
      budget,
      vendors,
    };

    try {
      writeJsonAtomically(STORE_FILE, initialStore);
    } catch (e) {
      throw new Error('Could not create the local store.', { cause: e });
    }

    return initialStore;
  }

  public save(): void {
    try {
      writeJsonAtomically(STORE_FILE, this.data);
    } catch (e) {
      throw new Error('Could not save local application data.', { cause: e });
    }
  }

  public saveProfileMirror(): void {
    // PostgreSQL has already committed these changes; a disposable local mirror
    // must not make a successful registration or review appear to have failed.
    try { this.save(); }
    catch { console.warn('Profile saved to PostgreSQL; the local JSON mirror could not be updated.'); }
  }

  // Getters for collections
  get users() { return this.data.users; }
  get profiles() { return this.data.profiles; }
  get interests() { return this.data.interests; }
  get shortlists() { return this.data.shortlists; }
  get views() { return this.data.views; }
  get messages() { return this.data.messages; }
  get checklist() { return this.data.checklist; }
  get budget() { return this.data.budget; }
  get vendors() { return this.data.vendors; }
}

export const db = new DatabaseManager();

