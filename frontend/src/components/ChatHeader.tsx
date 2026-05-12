"use client";
import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, SettingsIcon, Trash2Icon, HistoryIcon, SunIcon, MoonIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { SettingsModal } from './SettingsModal';

const THEME_KEY = 'tubetalk_theme';

function loadTheme(): string {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    // For extension — set synchronously from localStorage fallback, then async update
    try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch { return 'dark'; }
  }
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch { return 'dark'; }
}

function saveTheme(theme: string) {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ [THEME_KEY]: theme });
  }
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
}

interface ChatHeaderProps {
  url: string;
  clearChat: () => void;
  onToggleHistory: () => void;
}

export function ChatHeader({ url, clearChat, onToggleHistory }: ChatHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  // Load theme on mount
  useEffect(() => {
    const saved = loadTheme();
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    saveTheme(next);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-6 py-4 z-10"
        style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => window.close()}
            className="p-1 rounded-full transition-colors cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}>
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-accent-cyan to-accent-purple">
            TubeTalk
          </h1>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
            className={`w-2 h-2 rounded-full ${url ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
        </div>

        <div className="flex items-center gap-1">

          <button 
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="p-1.5 rounded-full transition-colors cursor-pointer"
            style={{ color: 'var(--text-muted)' }}>
            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button 
            onClick={onToggleHistory}
            title="Chat history"
            className="p-1.5 rounded-full transition-colors cursor-pointer"
            style={{ color: 'var(--text-muted)' }}>
            <HistoryIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={clearChat}
            title="Clear chat"
            className="p-1.5 rounded-full hover:bg-red-500/10 transition-colors cursor-pointer"
            style={{ color: 'var(--text-muted)' }}>
            <Trash2Icon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="p-1.5 rounded-full transition-colors cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}>
            <SettingsIcon className="w-4.5 h-4.5" />
          </button>
        </div>
      </motion.div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}