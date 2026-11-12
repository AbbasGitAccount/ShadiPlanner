import { AssistedSuggestions } from '../components/AssistedSuggestions';
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Heart,
  Check,
  X,
  Clock,
  MessageCircle,
  Eye,
  ShieldCheck,
  Send,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { InterestRequest, MatrimonialProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { ProfileCard } from '../components/ProfileCard';

export const InterestsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = requestedTab === 'sent' || requestedTab === 'shortlist' || requestedTab === 'views' ? requestedTab : 'received';
  const setActiveTab = (tab: 'received' | 'sent' | 'shortlist' | 'views') => setSearchParams(current => { const next = new URLSearchParams(current); next.set('tab', tab); return next; });
  const [receivedInterests, setReceivedInterests] = useState<InterestRequest[]>([]);
  const [sentInterests, setSentInterests] = useState<InterestRequest[]>([]);
  const [shortlistedProfiles, setShortlistedProfiles] = useState<MatrimonialProfile[]>([]);
  const [profileViewers, setProfileViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [interestsData, shortlistsData, viewsData] = await Promise.all([
        api.getInterests(),
        api.getShortlists(),
        api.getProfileViews(),
      ]);

      if (interestsData) {
        setReceivedInterests(interestsData.received || []);
        setSentInterests(interestsData.sent || []);
      }
      if (shortlistsData) {
        setShortlistedProfiles(shortlistsData);
      }
      if (viewsData) {
        setProfileViewers(viewsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRespond = async (interestId: string, action: 'accepted' | 'declined') => {
    try {
      await api.respondToInterest(interestId, action);
      if (action === 'accepted') {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {user?.role !== 'admin' && <AssistedSuggestions />}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="font-playfair text-3xl font-bold text-slate-900">
            Interests & Shortlists
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track connection proposals, review pending interests, and manage bookmarked profiles
          </p>
        </div>

        {/* Tab Navigator */}
        <div className="bg-slate-100 p-1 rounded-2xl flex flex-wrap items-center border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === 'received'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Received</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {receivedInterests.filter((i) => i.status === 'pending').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === 'sent'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Sent Requests</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {sentInterests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('shortlist')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === 'shortlist'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Shortlisted</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {shortlistedProfiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('views')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === 'views'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Profile Viewers</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {profileViewers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : activeTab === 'received' ? (
        /* Received Interests Tab */
        <div className="space-y-4">
          {receivedInterests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Heart className="w-12 h-12 text-rose-300 mx-auto" />
              <h3 className="font-semibold text-slate-800">No received interests yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Keep your profile 100% complete and verified to attract more auspicious interest requests!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receivedInterests.map((interest) => {
                const sender = interest.sender;
                if (!sender) return null;
                const isPending = interest.status === 'pending';
                const isAccepted = interest.status === 'accepted';

                return (
                  <div
                    key={interest.id}
                    className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start space-x-4">
                      <img
                        src={sender.profilePhoto}
                        alt={sender.fullName}
                        className="w-16 h-16 rounded-2xl object-cover border border-rose-200 shrink-0"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/profile/${sender.id}`}
                            className="font-playfair text-base font-bold text-slate-900 hover:text-rose-600 transition"
                          >
                            {sender.fullName}
                          </Link>
                          {sender.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          {sender.age} yrs • {sender.profession} • {sender.city}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Sent: {new Date(interest.sentAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Accompanying personal message */}
                    {interest.message && (
                      <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-100 text-xs text-slate-700 italic">
                        "{interest.message}"
                      </div>
                    )}

                    {/* Status / Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                      <Link
                        to={`/profile/${sender.id}`}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        View Biodata
                      </Link>

                      {isPending ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRespond(interest.id, 'declined')}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleRespond(interest.id, 'accepted')}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-sm hover:shadow transition flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept & Connect</span>
                          </button>
                        </div>
                      ) : isAccepted ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Connected
                          </span>
                          <Link
                            to="/messages"
                            className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Declined</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'sent' ? (
        /* Sent Requests Tab */
        <div className="space-y-4">
          {sentInterests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Send className="w-12 h-12 text-rose-300 mx-auto" />
              <h3 className="font-semibold text-slate-800">No sent requests</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Explore recommended matches and send free interest requests to start the connection!
              </p>
              <Link to="/matches" className="inline-block px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl">
                Browse Matches
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentInterests.map((interest) => {
                const receiver = interest.receiver;
                if (!receiver) return null;

                return (
                  <div
                    key={interest.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3.5">
                      <img
                        src={receiver.profilePhoto}
                        alt={receiver.fullName}
                        className="w-14 h-14 rounded-2xl object-cover border border-rose-200"
                      />
                      <div className="space-y-0.5">
                        <Link
                          to={`/profile/${receiver.id}`}
                          className="font-playfair text-base font-bold text-slate-900 hover:text-rose-600 transition"
                        >
                          {receiver.fullName}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {receiver.age} yrs • {receiver.profession} • {receiver.city}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Sent: {new Date(interest.sentAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right space-y-1.5">
                      {interest.status === 'accepted' ? (
                        <div className="space-y-1">
                          <span className="inline-block text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            Accepted 🎉
                          </span>
                          <div>
                            <Link
                              to="/messages"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Message</span>
                            </Link>
                          </div>
                        </div>
                      ) : interest.status === 'pending' ? (
                        <span className="inline-block text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                          Pending Response
                        </span>
                      ) : (
                        <span className="inline-block text-xs text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-full">
                          Declined
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'shortlist' ? (
        /* Shortlisted Profiles Tab */
        <div className="space-y-4">
          {shortlistedProfiles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Heart className="w-12 h-12 text-rose-300 mx-auto" />
              <h3 className="font-semibold text-slate-800">Your shortlist is empty</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Bookmark profiles while browsing so you and your family can evaluate them together later!
              </p>
              <Link to="/matches" className="inline-block px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl">
                Explore Matches
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shortlistedProfiles.map((p) => (
                <ProfileCard key={p.id} profile={p} onShortlistChange={loadData} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Profile Viewers Tab */
        <div className="space-y-4">
          {profileViewers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Eye className="w-12 h-12 text-rose-300 mx-auto" />
              <h3 className="font-semibold text-slate-800">No profile visits recorded yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                As your profile appears in search results and match recommendations, visitors will show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profileViewers.map((record) => {
                const viewer = record.viewer;
                if (!viewer) return null;

                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3.5">
                      <img
                        src={viewer.profilePhoto}
                        alt={viewer.fullName}
                        className="w-12 h-12 rounded-xl object-cover border border-rose-200"
                      />
                      <div>
                        <Link
                          to={`/profile/${viewer.id}`}
                          className="font-playfair text-sm font-bold text-slate-900 hover:text-rose-600 transition"
                        >
                          {viewer.fullName}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {viewer.age} yrs • {viewer.profession} • {viewer.city}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Viewed: {new Date(record.viewedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/profile/${viewer.id}`}
                      className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition"
                    >
                      View Back
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

