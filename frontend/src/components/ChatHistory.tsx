"use client";
import React from 'react';
import { XIcon, Trash2Icon, MessageSquareIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface HistoryEntry {
  videoId: string;
  title?: string;
  messageCount: number;
  lastActive: number; // timestamp
}

interface ChatHistoryProps {
  isOpen: boolean;
  entries: HistoryEntry[];
  onSelect: (videoId: string) => void;
  onDelete: (videoId: string) => void;
  onClose: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ChatHistory({ isOpen, entries, onSelect, onDelete, onClose }: ChatHistoryProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-30 flex flex-col overflow-hidden"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <MessageSquareIcon className="w-5 h-5 text-accent-cyan" />
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Chat History</h2>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {entries.length} video{entries.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <MessageSquareIcon className="w-10 h-10" style={{ color: 'var(--text-faint)' }} />
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  No chat history yet.<br />
                  Start chatting with a video!
                </p>
              </div>
            ) : (
              entries
                .sort((a, b) => b.lastActive - a.lastActive)
                .map((entry) => (
                  <motion.div
                    key={entry.videoId}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-colors"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                    onClick={() => onSelect(entry.videoId)}
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 w-20 h-12 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <img
                        src={`https://img.youtube.com/vi/${entry.videoId}/mqdefault.jpg`}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {entry.title || entry.videoId}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {entry.messageCount} msg{entry.messageCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>•</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {timeAgo(entry.lastActive)}
                        </span>
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(entry.videoId);
                      }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete chat"
                    >
                      <Trash2Icon className="w-3.5 h-3.5 hover:text-red-400" />
                    </button>
                  </motion.div>
                ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
