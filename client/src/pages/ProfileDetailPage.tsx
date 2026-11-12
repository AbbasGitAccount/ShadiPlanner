import { ReportProfile } from '../components/ReportProfile';
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Heart,
  MessageCircle,
  Send,
  Phone,
  Mail,
  Lock,
  Unlock,
  CheckCircle2,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  Printer,
  ChevronLeft,
  Calendar,
  UserCheck,
  Compass,
  Home,
  Coffee,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { MatrimonialProfile } from '../types';
import { CompatibilityBadge } from '../components/CompatibilityBadge';
import { QuickConnectModal } from '../components/QuickConnectModal';
import { useAuth } from '../context/AuthContext';

export const ProfileDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile } = useAuth();

  const [profile, setProfile] = useState<MatrimonialProfile | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [interestStatus, setInterestStatus] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getProfileById(id);
      setProfile(data);
      setSelectedPhoto(data.profilePhoto);
      setIsShortlisted(data.isShortlisted || false);
      if (data.interestStatus) setInterestStatus(data.interestStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const handleToggleShortlist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!profile) return;
    try {
      const res = await api.toggleShortlist(profile.id);
      setIsShortlisted(res.shortlisted);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendInterest = async (message: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!profile) return;
    try {
      await api.sendInterest(profile.id, message);
      setInterestStatus('sent_pending');
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
      });
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Error sending interest');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500">Loading authentic biodata...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Profile Not Found</h2>
        <p className="text-xs text-slate-500">This profile may have been deactivated or matched.</p>
        <Link to="/matches" className="inline-block px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold">
          Return to Matches
        </Link>
      </div>
    );
  }

  const isConnected = interestStatus === 'sent_accepted' || interestStatus === 'received_accepted' || profile.isContactUnlocked;
  const isPendingSent = interestStatus === 'sent_pending';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {user?.role !== 'admin' && profile.userId !== user?.id && <ReportProfile id={profile.id} />}
      {/* Top breadcrumb & back */}
      <div className="flex items-center justify-between">
        <Link
          to="/matches"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to All Matches</span>
        </Link>

        <button
          onClick={handlePrint}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
          title="Print official Biodata document"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Biodata</span>
        </button>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-3xl border border-rose-100 shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 sm:p-8">
          {/* Photo Gallery Column */}
          <div className="md:col-span-5 space-y-3">
            <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden bg-slate-100 relative shadow-md">
              <img
                src={selectedPhoto || profile.profilePhoto}
                alt={profile.fullName}
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {profile.isVerified && (
                  <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ID Verified</span>
                  </span>
                )}
                {profile.premiumMember && (
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-900 text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>VIP Member</span>
                  </span>
                )}
              </div>
            </div>

            {/* Gallery Thumbnail Switcher */}
            {profile.galleryPhotos && profile.galleryPhotos.length > 1 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                {profile.galleryPhotos.map((photo, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPhoto(photo)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                      selectedPhoto === photo ? 'border-rose-600 scale-105' : 'border-slate-200 opacity-70'
                    }`}
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Info & Action Column */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-wider">
                  Matrimonial Profile #{profile.id.toUpperCase()}
                </span>
                <CompatibilityBadge
                  score={profile.matchScore || 88}
                  highlights={profile.matchHighlights}
                  size="md"
                />
              </div>

              <div className="mt-4">
                <h1 className="font-playfair text-3xl sm:text-4xl font-extrabold text-slate-900">
                  {profile.fullName}
                </h1>
                <p className="text-sm font-semibold text-slate-600 mt-1">
                  {profile.age} Years • {profile.heightFormatted} • {profile.religion} ({profile.community})
                </p>
              </div>

              {/* Primary Highlights Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Profession</div>
                  <div className="text-xs font-bold text-slate-800 truncate mt-0.5">{profile.profession}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Education</div>
                  <div className="text-xs font-bold text-slate-800 truncate mt-0.5">{profile.highestEducation}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Annual Income</div>
                  <div className="text-xs font-bold text-emerald-700 truncate mt-0.5">{profile.annualIncomeFormatted}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Location</div>
                  <div className="text-xs font-bold text-slate-800 truncate mt-0.5">{profile.city}, {profile.state}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Mother Tongue</div>
                  <div className="text-xs font-bold text-slate-800 truncate mt-0.5">{profile.motherTongue}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Kundali / Manglik</div>
                  <div className="text-xs font-bold text-rose-700 truncate mt-0.5">{profile.manglik}</div>
                </div>
              </div>

              {/* About Teaser */}
              <div className="mt-6 bg-rose-50/40 p-4 rounded-2xl border border-rose-100">
                <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-1">
                  About Candidate
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  "{profile.aboutMe}"
                </p>
              </div>
            </div>

            {/* Contact Security Box */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  {profile.isContactUnlocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Contact Details Unlocked</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-amber-700" />
                      <span>Direct Contact Details Protected</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap gap-4">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <strong>{profile.phone}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <strong>{profile.email}</strong>
                  </span>
                </div>
              </div>

              {!profile.isContactUnlocked && <Link to="/subscriptions" className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800">Gold + mutual consent required</Link>}
            </div>

            {/* Action Buttons Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {isConnected ? (
                <Link
                  to="/messages"
                  className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Start Conversation in Chat</span>
                </Link>
              ) : isPendingSent ? (
                <div className="flex-1 py-3 px-5 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>Interest Request Sent (Awaiting Response)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white text-xs font-bold shadow-lg shadow-rose-200 transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Express Free Interest</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleShortlist}
                className={`py-3 px-5 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-2 ${
                  isShortlisted
                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${isShortlisted ? 'fill-rose-600 text-rose-600' : ''}`} />
                <span>{isShortlisted ? 'Shortlisted' : 'Save / Bookmark'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Biodata Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Religious & Kundali Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-slate-900">
            <Compass className="w-4 h-4 text-rose-600" />
            <span>Religious & Astrological Details (Kundali)</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400">Religion:</span>
              <p className="font-semibold text-slate-800">{profile.religion}</p>
            </div>
            <div>
              <span className="text-slate-400">Caste / Community:</span>
              <p className="font-semibold text-slate-800">{profile.community}</p>
            </div>
            <div>
              <span className="text-slate-400">Sub-Community:</span>
              <p className="font-semibold text-slate-800">{profile.subCommunity || 'Not Specified'}</p>
            </div>
            <div>
              <span className="text-slate-400">Gothram:</span>
              <p className="font-semibold text-slate-800">{profile.gothram || 'Not Specified'}</p>
            </div>
            <div>
              <span className="text-slate-400">Manglik Status:</span>
              <p className="font-semibold text-slate-800">{profile.manglik}</p>
            </div>
            <div>
              <span className="text-slate-400">Rashi (Zodiac):</span>
              <p className="font-semibold text-slate-800">{profile.rashi || 'Consult Family'}</p>
            </div>
            <div>
              <span className="text-slate-400">Nakshatra:</span>
              <p className="font-semibold text-slate-800">{profile.nakshatra || 'Consult Family'}</p>
            </div>
            <div>
              <span className="text-slate-400">Languages Known:</span>
              <p className="font-semibold text-slate-800">{profile.languagesKnown?.join(', ')}</p>
            </div>
          </div>
        </div>

        {/* Education & Career Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-slate-900">
            <GraduationCap className="w-4 h-4 text-amber-600" />
            <span>Education & Career Credentials</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400">Highest Degree:</span>
              <p className="font-semibold text-slate-800">{profile.highestEducation}</p>
            </div>
            <div>
              <span className="text-slate-400">College / Institute:</span>
              <p className="font-semibold text-slate-800">{profile.collegeUniversity || 'Reputed Institution'}</p>
            </div>
            <div>
              <span className="text-slate-400">Profession / Designation:</span>
              <p className="font-semibold text-slate-800">{profile.profession}</p>
            </div>
            <div>
              <span className="text-slate-400">Company / Organization:</span>
              <p className="font-semibold text-slate-800">{profile.company || 'Leading Firm'}</p>
            </div>
            <div>
              <span className="text-slate-400">Annual Income:</span>
              <p className="font-semibold text-emerald-700">{profile.annualIncomeFormatted}</p>
            </div>
            <div>
              <span className="text-slate-400">Work City:</span>
              <p className="font-semibold text-slate-800">{profile.workLocation}</p>
            </div>
          </div>
        </div>

        {/* Family Background */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-slate-900">
            <Home className="w-4 h-4 text-pink-600" />
            <span>Family Values & Background</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400">Family Type:</span>
              <p className="font-semibold text-slate-800">{profile.familyType} Family</p>
            </div>
            <div>
              <span className="text-slate-400">Family Status:</span>
              <p className="font-semibold text-slate-800">{profile.familyStatus}</p>
            </div>
            <div>
              <span className="text-slate-400">Father's Occupation:</span>
              <p className="font-semibold text-slate-800">{profile.fatherOccupation}</p>
            </div>
            <div>
              <span className="text-slate-400">Mother's Occupation:</span>
              <p className="font-semibold text-slate-800">{profile.motherOccupation}</p>
            </div>
            <div>
              <span className="text-slate-400">Brothers:</span>
              <p className="font-semibold text-slate-800">{profile.brothersCount}</p>
            </div>
            <div>
              <span className="text-slate-400">Sisters:</span>
              <p className="font-semibold text-slate-800">{profile.sistersCount}</p>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400">Family Origin & Base:</span>
              <p className="font-semibold text-slate-800">{profile.familyLocation}</p>
            </div>
          </div>
        </div>

        {/* Lifestyle & Hobbies */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-slate-900">
            <Coffee className="w-4 h-4 text-rose-600" />
            <span>Lifestyle & Personal Interests</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400">Diet:</span>
              <p className="font-semibold text-slate-800">{profile.diet}</p>
            </div>
            <div>
              <span className="text-slate-400">Smoking Habit:</span>
              <p className="font-semibold text-slate-800">{profile.smoking}</p>
            </div>
            <div>
              <span className="text-slate-400">Drinking Habit:</span>
              <p className="font-semibold text-slate-800">{profile.drinking}</p>
            </div>
            <div>
              <span className="text-slate-400">Citizenship:</span>
              <p className="font-semibold text-slate-800">{profile.citizenship}</p>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs text-slate-400 block mb-2">Hobbies & Passions:</span>
            <div className="flex flex-wrap gap-2">
              {profile.hobbies?.map((hobby, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-rose-50 text-rose-800 rounded-lg text-xs font-medium"
                >
                  {hobby}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Partner Preferences Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-rose-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-playfair text-xl font-bold text-slate-900">
              Ideal Partner Expectations
            </h3>
            <p className="text-xs text-slate-500">
              Preferences specified by {profile.fullName.split(' ')[0]} and family
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {profile.matchScore || 85}% Matched with You
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Age Preference:</span>
            <p className="font-semibold text-slate-800">
              {profile.partnerPreferences?.minAge} to {profile.partnerPreferences?.maxAge} Years
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Height Preference:</span>
            <p className="font-semibold text-slate-800">
              {profile.partnerPreferences?.minHeight} cm - {profile.partnerPreferences?.maxHeight} cm
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Religion & Community:</span>
            <p className="font-semibold text-slate-800">
              {profile.partnerPreferences?.religions?.join(', ')} • {profile.partnerPreferences?.communities?.join(', ')}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Education Background:</span>
            <p className="font-semibold text-slate-800">
              {profile.partnerPreferences?.educationLevels?.join(', ')}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Preferred Occupations:</span>
            <p className="font-semibold text-slate-800">
              {profile.partnerPreferences?.occupations?.join(', ')}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium">Preferred Cities:</span>
            <p className="font-semibold text-slate-800">
              {profile.partnerPreferences?.locations?.join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Connect Modal */}
      <QuickConnectModal
        targetProfile={profile}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSend={handleSendInterest}
      />
    </div>
  );
};

