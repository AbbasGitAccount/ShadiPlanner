import React, { useState } from 'react';
import { X, Send, Heart, Sparkles } from 'lucide-react';
import { MatrimonialProfile } from '../types';

interface QuickConnectModalProps {
  targetProfile: MatrimonialProfile;
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}

export const QuickConnectModal: React.FC<QuickConnectModalProps> = ({
  targetProfile,
  isOpen,
  onClose,
  onSend,
}) => {
  const defaultNote = `Namaste ${targetProfile.fullName}, I went through your profile on ShadiPlanner and found our values and preferences aligned. I would be honored to connect and take conversations forward.`;
  const [message, setMessage] = useState(defaultNote);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const quickTemplates = [
    `Namaste! I admired your education and background. Would love to introduce myself and connect.`,
    `Hello! Our family backgrounds and life outlook seem deeply compatible. Looking forward to speaking!`,
    `Hi! We share a passion for similar goals and culture. Let us connect and start a conversation.`,
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSend(message);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-rose-100 overflow-hidden transform transition-all animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-rose-200 fill-rose-200" />
            <h3 className="font-playfair text-lg font-bold">Express Interest</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Target mini info */}
          <div className="flex items-center space-x-3.5 bg-rose-50/70 p-3 rounded-xl border border-rose-100 mb-4">
            <img
              src={targetProfile.profilePhoto}
              alt={targetProfile.fullName}
              className="w-14 h-14 rounded-full object-cover border-2 border-rose-300"
            />
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">{targetProfile.fullName}</h4>
              <p className="text-xs text-slate-500">
                {targetProfile.age} yrs • {targetProfile.heightFormatted.split('(')[0]} • {targetProfile.profession}
              </p>
              <p className="text-[11px] text-rose-700 font-medium">{targetProfile.city}, {targetProfile.state}</p>
            </div>
          </div>

          {/* Quick suggestions */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Quick Note Suggestions:
            </label>
            <div className="space-y-1.5">
              {quickTemplates.map((template, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessage(template)}
                  className="w-full text-left p-2 rounded-lg text-xs bg-slate-50 hover:bg-rose-50/80 border border-slate-200 text-slate-700 hover:text-rose-800 transition"
                >
                  "{template}"
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Personalized Message (Included with connection request)
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 text-xs text-slate-800 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none leading-relaxed"
              placeholder="Write a polite and respectful message..."
            />

            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-amber-600 shadow-md shadow-rose-200 hover:shadow-lg transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending Request...' : 'Send Free Interest'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

