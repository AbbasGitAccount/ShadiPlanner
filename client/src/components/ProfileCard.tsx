import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  MapPin,
  Send,
  CheckCircle2,
  Lock,
  MessageCircle,
  Eye,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MatrimonialProfile } from '../types';
import { CompatibilityBadge } from './CompatibilityBadge';
import { QuickConnectModal } from './QuickConnectModal';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ProfileCardProps {
  profile: MatrimonialProfile;
  onInterestChange?: () => void;
  onShortlistChange?: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onInterestChange,
  onShortlistChange,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isShortlisted, setIsShortlisted] = useState(profile.isShortlisted || false);
  const [interestStatus, setInterestStatus] = useState<string | null>(profile.interestStatus || null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleToggleShortlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.toggleShortlist(profile.id);
      setIsShortlisted(res.shortlisted);
      if (onShortlistChange) onShortlistChange();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendInterest = async (message: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setIsSending(true);
    try {
      await api.sendInterest(profile.id, message);
      setInterestStatus('sent_pending');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
      if (onInterestChange) onInterestChange();
    } catch (err: any) {
      alert(err.message || 'Could not send interest');
    } finally {
      setIsSending(false);
    }
  };

  const isConnected = interestStatus === 'sent_accepted' || interestStatus === 'received_accepted';
  const isPendingSent = interestStatus === 'sent_pending';
  const isPendingReceived = interestStatus === 'received_pending';

  return (
    <>
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group">
        {/* Top Image & Badges */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <img
            src={profile.profilePhoto}
            alt={profile.fullName}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />

          {/* Gradient Overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80" />

          {/* Top badges: Shortlist heart & Verified tag */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {profile.isVerified && (
              <span className="inline-flex items-center gap-1 bg-emerald-600/90 backdrop-blur-md text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            )}
            {profile.premiumMember && (
              <span className="inline-flex items-center gap-1 bg-amber-500/90 backdrop-blur-md text-slate-900 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                <Sparkles className="w-3 h-3" />
                <span>VIP</span>
              </span>
            )}
          </div>

          <button
            onClick={handleToggleShortlist}
            className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition shadow-md ${
              isShortlisted
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-white/80 text-slate-700 hover:bg-white hover:text-rose-600'
            }`}
            title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
          >
            <Heart className={`w-4 h-4 ${isShortlisted ? 'fill-white' : ''}`} />
          </button>

          {/* Bottom photo overlay: Name, Age, Score */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="text-white">
              <h3 className="font-playfair text-lg font-bold tracking-tight drop-shadow-md">
                {profile.fullName}
              </h3>
              <p className="text-xs text-slate-200 font-medium drop-shadow">
                {profile.age} yrs • {profile.heightFormatted.split('(')[0].trim()}
              </p>
            </div>
            <div>
              <CompatibilityBadge
                score={profile.matchScore || 85}
                highlights={profile.matchHighlights}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div className="space-y-2 text-xs text-slate-600">
            {/* Religion & Community */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-semibold text-slate-800">
                {profile.religion} • {profile.community}
              </span>
              <span className="text-[11px] px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md font-medium">
                {profile.motherTongue}
              </span>
            </div>

            {/* Profession & Education */}
            <div className="space-y-1 pt-1">
              <div className="flex items-start gap-2">
                <Briefcase className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span className="truncate font-medium text-slate-700">
                  {profile.profession} {profile.company ? `at ${profile.company}` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate text-slate-600">
                  {profile.highestEducation}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate text-slate-600">
                  {profile.city}, {profile.state}
                </span>
              </div>
            </div>

            {/* About teaser */}
            <p className="text-[11px] text-slate-500 line-clamp-2 pt-2 border-t border-slate-100 italic">
              "{profile.aboutMe}"
            </p>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
            <Link
              to={`/profile/${profile.id}`}
              className="flex-1 text-center py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50/50 transition flex items-center justify-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Biodata</span>
            </Link>

            {isConnected ? (
              <Link
                to={`/messages`}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Chat Now</span>
              </Link>
            ) : isPendingSent ? (
              <span className="flex-1 py-2 px-3 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Interest Sent</span>
              </span>
            ) : isPendingReceived ? (
              <Link
                to="/interests"
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm text-center flex items-center justify-center gap-1"
              >
                <span>Respond</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white text-xs font-semibold shadow-md shadow-rose-200 transition flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Connect Note Modal */}
      <QuickConnectModal
        targetProfile={profile}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSend={handleSendInterest}
      />
    </>
  );
};

