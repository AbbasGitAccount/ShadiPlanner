import { InterestRequest, MatrimonialProfile } from './types.js';

export function profilesConnected(first: MatrimonialProfile | undefined | null, second: MatrimonialProfile | undefined | null, interests: InterestRequest[]): boolean {
  if (!first || !second) return false;
  return Boolean(first.isVerified && second.isVerified && Array.isArray(interests) && interests.some(interest => interest.status === 'accepted' && (
    (interest.senderProfileId === first.id && interest.receiverProfileId === second.id) ||
    (interest.receiverProfileId === first.id && interest.senderProfileId === second.id)
  )));
}

// Apply the same photo and contact privacy policy to every endpoint, including nested list results.
export function presentProfile(
  profile: MatrimonialProfile,
  viewer: { id: string; role: string; membership?: { plan: { contactDetails?: boolean; id?: string }; status?: string } } | undefined,
  profiles: MatrimonialProfile[],
  interests: InterestRequest[]
) {
  const isOwnProfile = viewer?.id === profile.userId;
  const isSubscribed = viewer?.role === 'admin' || Boolean(
    viewer?.membership?.status === 'active' &&
    viewer?.membership?.plan?.id !== 'free'
  );
  const unlocked = isOwnProfile || isSubscribed;
  const lockedAvatar = '/avatar-placeholder.svg';

  return {
    ...profile,
    profilePhoto: unlocked ? profile.profilePhoto : lockedAvatar,
    phone: unlocked ? profile.phone : 'Subscribe to view phone number',
    email: unlocked ? profile.email : 'Subscribe to view email',
    isContactUnlocked: unlocked,
    isPhotoUnlocked: unlocked,
    galleryPhotos: unlocked ? (profile.galleryPhotos || []) : [],
    ...(!unlocked ? { verificationReviewedBy: undefined, verificationReviewedAt: undefined } : {}),
  };
}
