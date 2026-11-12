import { presentProfile } from '../models/profilePresentation.js';
import { ProfileUpdateError } from '../models/profileUpdate.js';
import { profileSnapshot, requestProfiles, rememberProfile } from '../middleware/profileSnapshot.js';
import { Router, Response } from 'express';
import { db } from '../data/db.js';
import { editProfile } from '../data/profileDatabase.js';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { MatrimonialProfile } from '../models/types.js';
import { hasAdvancedFilters } from '../models/subscriptions.js';

const router = Router();

// Calculate match score between two profiles
export const calculateMatchScore = (
  userProfile: MatrimonialProfile | undefined,
  targetProfile: MatrimonialProfile
): { score: number; highlights: string[] } => {
  if (!userProfile) {
    return { score: 75, highlights: ['Verified Profile', 'Complete Biodata'] };
  }

  let points = 0;
  const maxPoints = 100;
  const highlights: string[] = [];

  const prefs = userProfile.partnerPreferences;

  // Age match (20 pts)
  if (targetProfile.age >= prefs.minAge && targetProfile.age <= prefs.maxAge) {
    points += 20;
    highlights.push('Age within preferred range');
  } else if (Math.abs(targetProfile.age - prefs.minAge) <= 2 || Math.abs(targetProfile.age - prefs.maxAge) <= 2) {
    points += 12;
  }

  // Height match (15 pts)
  if (targetProfile.height >= prefs.minHeight && targetProfile.height <= prefs.maxHeight) {
    points += 15;
    highlights.push('Height compatible');
  } else {
    points += 8;
  }

  // Religion match (20 pts)
  if (
    prefs.religions.length === 0 ||
    prefs.religions.includes(targetProfile.religion) ||
    prefs.religions.includes('Open to All')
  ) {
    points += 20;
    highlights.push(`Faith aligned (${targetProfile.religion})`);
  }

  // Diet match (15 pts)
  if (
    prefs.diet.length === 0 ||
    prefs.diet.includes(targetProfile.diet)
  ) {
    points += 15;
    highlights.push(`Diet compatible (${targetProfile.diet})`);
  }

  // Location / City match (15 pts)
  if (
    prefs.locations.length === 0 ||
    prefs.locations.some(loc => targetProfile.city.toLowerCase().includes(loc.toLowerCase()) || targetProfile.state.toLowerCase().includes(loc.toLowerCase()))
  ) {
    points += 15;
    highlights.push(`Preferred location (${targetProfile.city})`);
  } else {
    points += 5;
  }

  // Education / Income (15 pts)
  if (targetProfile.annualIncome >= prefs.minIncome) {
    points += 15;
    highlights.push('Financial & career expectations aligned');
  } else {
    points += 8;
  }

  const score = Math.min(98, Math.max(50, Math.round((points / maxPoints) * 100)));
  return { score, highlights };
};

// Search / Browse profiles
router.get('/', authenticateToken, profileSnapshot, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && !req.user?.membership?.plan.advancedSearch && hasAdvancedFilters(req.query)) {
      res.status(403).json({ message: 'Advanced filters are included with Gold and Platinum. Clear those filters or explore subscription plans.' }); return;
    }
    const {
      gender,
      minAge,
      maxAge,
      religion,
      motherTongue,
      diet,
      maritalStatus,
      city,
      profession,
      manglik,
      query,
      sortBy = 'recommended',
    } = req.query as Record<string, string>;

    const currentUserId = req.user?.id;
    const currentUserProfile = currentUserId ? requestProfiles(req).find((p) => p.userId === currentUserId) : undefined;

    let results = requestProfiles(req).filter((profile) => {
      if (!profile.isVerified) return false;
      // Exclude own profile if logged in
      if (currentUserProfile && profile.id === currentUserProfile.id) {
        return false;
      }

      // Gender filter (if not specified, prefer opposite gender if user is logged in)
      if (gender) {
        if (profile.gender.toLowerCase() !== gender.toLowerCase()) return false;
      } else if (currentUserProfile) {
        const preferredGender = currentUserProfile.gender === 'Male' ? 'Female' : 'Male';
        if (profile.gender !== preferredGender) return false;
      }

      // Age range
      if (minAge && profile.age < Number(minAge)) return false;
      if (maxAge && profile.age > Number(maxAge)) return false;

      // Religion
      if (religion && religion !== 'all' && profile.religion.toLowerCase() !== religion.toLowerCase()) {
        return false;
      }

      // Mother tongue
      if (motherTongue && motherTongue !== 'all' && profile.motherTongue.toLowerCase() !== motherTongue.toLowerCase()) {
        return false;
      }

      // Diet
      if (diet && diet !== 'all' && profile.diet.toLowerCase() !== diet.toLowerCase()) {
        return false;
      }

      // Marital status
      if (maritalStatus && maritalStatus !== 'all' && profile.maritalStatus.toLowerCase() !== maritalStatus.toLowerCase()) {
        return false;
      }

      // City / location
      if (city && !profile.city.toLowerCase().includes(city.toLowerCase())) {
        return false;
      }

      // Profession
      if (profession && !profile.profession.toLowerCase().includes(profession.toLowerCase())) {
        return false;
      }

      // Manglik
      if (manglik && manglik !== 'all' && profile.manglik.toLowerCase() !== manglik.toLowerCase()) {
        return false;
      }

      // Free text query
      if (query && query.trim() !== '') {
        const q = query.toLowerCase();
        const matches =
          profile.fullName.toLowerCase().includes(q) ||
          profile.profession.toLowerCase().includes(q) ||
          profile.city.toLowerCase().includes(q) ||
          profile.highestEducation.toLowerCase().includes(q) ||
          profile.community.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });

    // Attach match score, shortlist status, and interest status to each profile
    const enhancedResults = results.map((profile) => {
      const match = calculateMatchScore(currentUserProfile, profile);
      const isShortlisted = currentUserProfile
        ? db.shortlists.some((s) => s.userId === currentUserId && s.profileId === profile.id)
        : false;

      let interestStatus: string | null = null;
      if (currentUserProfile) {
        const interest = db.interests.find(
          (i) =>
            (i.senderProfileId === currentUserProfile.id && i.receiverProfileId === profile.id) ||
            (i.senderProfileId === profile.id && i.receiverProfileId === currentUserProfile.id)
        );
        if (interest) {
          interestStatus = interest.senderProfileId === currentUserProfile.id ? `sent_${interest.status}` : `received_${interest.status}`;
        }
      }

      return {
        ...presentProfile(profile, req.user, requestProfiles(req), db.interests),
        matchScore: match.score,
        matchHighlights: match.highlights,
        isShortlisted,
        interestStatus,
      };
    });

    // Sorting
    if (sortBy === 'score' || sortBy === 'recommended') {
      enhancedResults.sort((a, b) => req.user?.membership?.plan.compatibleFirst ? b.matchScore - a.matchScore : Number(!!b.enhancedVisibility) - Number(!!a.enhancedVisibility) || b.matchScore - a.matchScore);
    } else if (sortBy === 'age_asc') {
      enhancedResults.sort((a, b) => a.age - b.age);
    } else if (sortBy === 'age_desc') {
      enhancedResults.sort((a, b) => b.age - a.age);
    } else if (sortBy === 'income_desc') {
      enhancedResults.sort((a, b) => b.annualIncome - a.annualIncome);
    }

    res.json({
      total: enhancedResults.length,
      profiles: enhancedResults,
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ message: 'Error retrieving profiles' });
  }
});

// Platform stats
router.get('/stats', profileSnapshot, (req, res) => {
  const profiles = requestProfiles(req).filter(profile => profile.isVerified);
  const visible = new Set(profiles.map(profile => profile.id));
  const acceptedMatches = new Set(db.interests.filter(interest => interest.status === 'accepted' && visible.has(interest.senderProfileId) && visible.has(interest.receiverProfileId)).map(interest => [interest.senderProfileId, interest.receiverProfileId].sort().join(':'))).size;
  const idAndPhoneVerified = profiles.filter(profile => profile.phoneVerified && profile.govtIdVerified).length;

  res.json({
    totalMembers: profiles.length,
    activeMatches: acceptedMatches,
    verifiedRate: `${profiles.length ? Math.round(idAndPhoneVerified / profiles.length * 100) : 0}%`,
    phoneVerifiedProfiles: profiles.filter(profile => profile.phoneVerified).length,
    recentProfilesCount: profiles.length,
  });
});

// Recommended for logged in user
router.get('/recommended', authenticateToken, profileSnapshot, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const currentUserProfile = requestProfiles(req).find((p) => p.userId === userId);

  if (!currentUserProfile) {
    res.status(404).json({ message: 'User profile not found' });
    return;
  }

  const oppositeGender = currentUserProfile.gender === 'Male' ? 'Female' : 'Male';
  const candidates = requestProfiles(req).filter((p) => p.isVerified && p.id !== currentUserProfile.id && p.gender === oppositeGender);

  const scored = candidates.map((p) => {
    const { score, highlights } = calculateMatchScore(currentUserProfile, p);
    const isShortlisted = db.shortlists.some((s) => s.userId === userId && s.profileId === p.id);
    const interest = db.interests.find(
      (i) =>
        (i.senderProfileId === currentUserProfile.id && i.receiverProfileId === p.id) ||
        (i.senderProfileId === p.id && i.receiverProfileId === currentUserProfile.id)
    );

    return {
      ...presentProfile(p, req.user, requestProfiles(req), db.interests),
      matchScore: score,
      matchHighlights: highlights,
      isShortlisted,
      interestStatus: interest ? (interest.senderProfileId === currentUserProfile.id ? `sent_${interest.status}` : `received_${interest.status}`) : null,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  res.json(scored);
});

// Get single profile by ID
router.get('/:id', authenticateToken, profileSnapshot, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const profile = requestProfiles(req).find((p) => p.id === id);

  if (!profile || (!profile.isVerified && profile.userId !== req.user?.id && req.user?.role !== 'admin')) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const currentUserId = req.user?.id;
  const currentUserProfile = currentUserId ? requestProfiles(req).find((p) => p.userId === currentUserId) : undefined;

  // Track profile view
  if (currentUserProfile && currentUserProfile.id !== profile.id) {
    const existingView = db.views.find(
      (v) => v.viewerProfileId === currentUserProfile.id && v.viewedProfileId === profile.id
    );
    if (!existingView) {
      db.views.push({
        id: `vw_${Date.now()}`,
        viewerProfileId: currentUserProfile.id,
        viewedProfileId: profile.id,
        viewedAt: new Date().toISOString(),
      });
      db.save();
    }
  }

  const { score, highlights } = calculateMatchScore(currentUserProfile, profile);
  const isShortlisted = currentUserProfile
    ? db.shortlists.some((s) => s.userId === currentUserId && s.profileId === profile.id)
    : false;

  let interestRecord = null;
  if (currentUserProfile) {
    interestRecord = db.interests.find(
      (i) =>
        (i.senderProfileId === currentUserProfile.id && i.receiverProfileId === profile.id) ||
        (i.senderProfileId === profile.id && i.receiverProfileId === currentUserProfile.id)
    ) || null;
  }

  res.json({
    ...presentProfile(profile, req.user, requestProfiles(req), db.interests),
    matchScore: score,
    matchHighlights: highlights,
    isShortlisted,
    interestRecord,
  });
});

// Update profile
router.put('/:id', authenticateToken, profileSnapshot, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const profileIndex = requestProfiles(req).findIndex((p) => p.id === id && p.userId === userId);
  if (profileIndex === -1) {
    res.status(403).json({ message: 'Not authorized to update this profile' });
    return;
  }

  let updatedProfile;
  try {
    updatedProfile = await editProfile(id, userId!, req.body);
  } catch (error) {
    if (error instanceof ProfileUpdateError) {
      res.status(error.status).json({ message: error.message, ...(error.field ? { fieldErrors: { [error.field]: error.message } } : {}) });
      return;
    }
    console.error('Could not save profile:', error);
    res.status(500).json({ message: 'Could not save your profile. Please try again.' });
    return;
  }
  rememberProfile(updatedProfile);
  db.saveProfileMirror();

  res.json(updatedProfile);
});

export default router;

