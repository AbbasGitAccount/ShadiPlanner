import { InterestRequest, MatrimonialProfile } from './types.js';

export function profilesConnected(first: MatrimonialProfile | undefined | null, second: MatrimonialProfile | undefined | null, interests: InterestRequest[]): boolean {
  if (!first || !second) return false;
  return Boolean(first.isVerified && second.isVerified && Array.isArray(interests) && interests.some(interest => interest.status === 'accepted' && (
    (interest.senderProfileId === first.id && interest.receiverProfileId === second.id) ||
    (interest.receiverProfileId === first.id && interest.senderProfileId === second.id)
  )));
}

// Apply the same contact policy to every endpoint, including nested list results.
export function presentProfile(profile: MatrimonialProfile, viewer: { id: string; role: string; membership?: { plan: { contactDetails: boolean } } } | undefined, profiles: MatrimonialProfile[], interests: InterestRequest[]) {
  const ownProfile = viewer && profiles.find(item => item.userId === viewer.id);
  const unlocked = viewer?.id === profile.userId || !!(viewer?.membership?.plan.contactDetails && ownProfile && profilesConnected(ownProfile, profile, interests));
  return {
    ...profile,
    phone: unlocked ? profile.phone : 'Gold or Platinum + mutual consent required',
    email: unlocked ? profile.email : 'Direct contact protected',
    isContactUnlocked: unlocked,
    ...(!unlocked ? { verificationReviewedBy: undefined, verificationReviewedAt: undefined } : {}),
  };
}
