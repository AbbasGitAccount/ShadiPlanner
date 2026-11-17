import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Send,
  MessageCircle,
  ShieldCheck,
  Phone,
  Sparkles,
  Search,
  CheckCheck,
  Clock,
  UserCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { ConversationSummary, ChatMessage } from '../types';
import { useAuth } from '../context/AuthContext';

export const MessagesPage: React.FC = () => {
  const { user, profile: currentUserProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(searchParams.get('profile'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [threadError, setThreadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [threadLoading, setThreadLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const selectedRef = useRef(selectedPartnerId);
  const sendRevision = useRef(0);
  selectedRef.current = selectedPartnerId;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
      setConversationError('');
      setSelectedPartnerId(current => current || data[0]?.partnerId || null);
    } catch (err) {
      setConversationError(err instanceof Error ? err.message : 'Could not load conversations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConversations();
    const timer = window.setInterval(() => void fetchConversations(), 10000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    const requested = searchParams.get('profile');
    if (requested) setSelectedPartnerId(requested);
  }, [searchParams]);

  const loadThread = async () => {
    if (!selectedPartnerId) return;
    setThreadLoading(true);
    const revision = sendRevision.current;
    try {
      const data = await api.getMessages(selectedPartnerId);
      if (revision === sendRevision.current) {
        setMessages(data);
        setThreadError('');
      }
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : 'Could not load messages.');
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setMessages([]); setThreadError(''); setSendError(''); setNewMessage('');
    if (!selectedPartnerId) return;
    setThreadLoading(true);
    const refresh = async () => {
      const revision = sendRevision.current;
      try {
        const data = await api.getMessages(selectedPartnerId);
        if (active && revision === sendRevision.current) { setMessages(data); setThreadError(''); }
      } catch (error) { if (active) setThreadError(error instanceof Error ? error.message : 'Could not load messages.'); }
      finally { if (active) setThreadLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedPartnerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !selectedPartnerId || !newMessage.trim()) return;

    setSending(true);
    sendRevision.current++;
    const draft = newMessage;
    const content = draft.trim();
    const partnerId = selectedPartnerId;
    setSendError('');

    try {
      const sentMsg = await api.sendMessage(partnerId, content);
      if (selectedRef.current === partnerId) {
        setMessages(prev => prev.some(message => message.id === sentMsg.id) ? prev : [...prev, sentMsg]);
        setNewMessage(current => current === draft ? '' : current);
      }
      void fetchConversations();
    } catch (err) {
      if (selectedRef.current === partnerId) setSendError(err instanceof Error ? err.message : 'Could not send your message. Please try again.');
    } finally {
      sendRevision.current++;
      setSending(false);
    }
  };

  const selectedConversation = conversations.find((c) => c.partnerId === selectedPartnerId);
  const activePartner = selectedConversation?.partner;
  const administrator = user?.role === 'admin';
  const adminComposer = administrator && !activePartner?.isAdministrator;
  const adminThread = administrator || !!activePartner?.isAdministrator;
  const shownConversations = conversations.filter(conversation => `${conversation.partner.fullName} ${conversation.partner.city || ''}`.toLowerCase().includes(filter.trim().toLowerCase()));

  const icebreakers = adminThread ? (adminComposer ? ['Hello, please review the details in your profile.', 'Could you update the missing information in your biodata?'] : ['I need help with my profile.', 'I have updated my profile details.']) : [
    'How was your work week?',
    'What do you enjoy doing during relaxed weekends?',
    'Would your family and you be open for a phone call?',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-3xl border border-rose-100 shadow-xl overflow-hidden h-[750px] flex flex-col md:flex-row">
        {/* Left Column: Conversation List */}
        <div className="w-full md:w-80 lg:w-96 max-h-72 md:max-h-none border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h2 className="font-playfair text-xl font-bold text-slate-900 flex items-center justify-between">
              <span>Conversations</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full">
                {conversations.length} {administrator ? 'Profiles' : 'Chats'}
              </span>
            </h2>
            {administrator && <p className="mt-2 text-xs text-slate-500">Message any approved or pending profile. No matrimonial profile or connection is required for administrators.</p>}
            <label htmlFor="conversation-search" className="sr-only">Search conversations</label>
            <input id="conversation-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder={administrator ? 'Find a profile by name or city' : 'Search conversations'} className="mt-3 w-full p-2.5 rounded-xl border border-slate-300 text-xs" />
            {conversationError && <p role="alert" className="mt-2 text-xs text-rose-700">{conversationError} <button onClick={() => void fetchConversations()} className="underline">Try again</button></p>}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading chats...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <MessageCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">No active chats yet</p>
                <p className="text-[11px] text-slate-400">
                  {administrator ? 'Profiles will appear here when members register.' : 'Accepted connections and messages from administrators will appear here, including while your profile awaits approval.'}
                </p>
                <Link
                  to={administrator ? '/admin' : '/matches'}
                  className="inline-block text-xs font-semibold text-rose-600 hover:underline pt-2"
                >
                  {administrator ? 'Open profile review' : 'Browse Matches'}
                </Link>
              </div>
            ) : (
              shownConversations.map((conv) => {
                const isSelected = conv.partnerId === selectedPartnerId;
                const partner = conv.partner;

                return (
                  <button
                    key={conv.partnerId}
                    disabled={sending}
                    onClick={() => setSelectedPartnerId(conv.partnerId)}
                    className={`w-full text-left p-4 flex items-start space-x-3 transition ${
                      isSelected ? 'bg-rose-50/80 border-r-4 border-rose-600' : 'hover:bg-white'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={partner.profilePhoto}
                        alt={partner.fullName}
                        className="w-12 h-12 rounded-2xl object-cover border border-rose-200"
                      />
                      {partner.isVerified && (
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5">
                          <ShieldCheck className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {partner.fullName}
                        </h4>
                        {conv.unreadCount > 0 && <span className="rounded-full bg-rose-600 text-white text-[10px] px-1.5 ml-1" aria-label={`${conv.unreadCount} unread messages`}>{conv.unreadCount}</span>}
                        {conv.lastMessage && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {conv.lastMessage ? conv.lastMessage.content : administrator ? 'Send a message to this profile.' : 'Connection accepted. Say hello.'}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-rose-700 font-medium">
                        <span>{partner.isAdministrator ? 'Administrator' : administrator ? (partner.isVerified ? 'Approved profile' : 'Pending approval') : partner.profession}</span>
                        {partner.city && <span>{partner.city}</span>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Window */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-white">
          {activePartner ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={activePartner.profilePhoto}
                    alt={activePartner.fullName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-rose-300"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-playfair font-bold text-base text-slate-900">
                        {activePartner.fullName}
                      </h3>
                      {activePartner.isVerified && (
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {activePartner.isAdministrator ? 'Administrator · Profile support' : administrator ? (activePartner.isVerified ? 'Approved profile' : 'Pending approval · Admin messaging allowed') : `${activePartner.age} yrs · ${activePartner.profession} · ${activePartner.city}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!activePartner.isAdministrator && <Link
                    to={`/profile/${activePartner.id}`}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    View Biodata
                  </Link>}
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
                {/* Safe Matrimonial Intro Notice */}
                <div className="bg-amber-50/80 border border-amber-200 text-amber-900 text-xs p-3 rounded-2xl text-center max-w-lg mx-auto flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {adminComposer ? `Administrator conversation with ${activePartner.fullName}. Messages are allowed before and after approval.` : activePartner.isAdministrator ? 'This is an administrator conversation. You can reply even while your profile is awaiting approval.' : `You are connected with ${activePartner.fullName}. Keep conversations respectful.`}
                  </span>
                </div>

                {threadLoading && <p role="status" className="text-xs text-slate-500 text-center">Loading messages...</p>}
                {threadError && (
                  <div role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 max-w-md mx-auto text-center flex items-center justify-center gap-2">
                    <span>{threadError}</span>
                    <button
                      type="button"
                      onClick={() => void loadThread()}
                      className="underline font-semibold hover:text-rose-900 ml-1 cursor-pointer"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMine = msg.senderId === currentUserProfile?.id || administrator && msg.senderId === `admin:${user?.id}`;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isMine
                            ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-br-none'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 px-1">
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMine && <CheckCheck className={`w-3 h-3 ${msg.isRead ? 'text-emerald-500' : 'text-slate-400'}`} aria-label={msg.isRead ? 'Read' : 'Sent'} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Icebreakers suggestions */}
              <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center space-x-2 overflow-x-auto">
                <span className="text-[11px] font-semibold text-slate-400 shrink-0">Icebreakers:</span>
                {icebreakers.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setNewMessage(prompt)}
                    className="shrink-0 text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-full border border-slate-200 transition"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>

              {/* Text Input Footer */}
              <div className="p-4 border-t border-slate-200 bg-white">
                {sendError && <p role="alert" className="text-xs text-rose-700 mb-2">{sendError}</p>}
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                  <input
                    type="text"
                    maxLength={4000}
                    disabled={sending || threadLoading}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={activePartner.isAdministrator ? 'Reply to the administrator...' : `Message ${activePartner.fullName.split(' ')[0]}...`}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                  />
                  <button
                    type="submit"
                    disabled={sending || threadLoading || !newMessage.trim()}
                    aria-label="Send message"
                    className="p-2.5 bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-2xl shadow-md shadow-rose-200 hover:shadow-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-3xl text-rose-500">
                💬
              </div>
              <h3 className="font-playfair text-xl font-bold text-slate-800">
                Select a conversation
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {administrator ? 'Choose any profile from the list to start a conversation, whether approved or pending.' : 'Choose a connected member or administrator from the list to open your conversation.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

