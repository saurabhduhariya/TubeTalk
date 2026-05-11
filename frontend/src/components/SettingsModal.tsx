"use client";
import React, { useState, useEffect } from 'react';
import { XIcon, KeyIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, SaveIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_KEY_FIELDS = [
  { id: 'GROQ_API_KEY', label: 'Groq API Key', placeholder: 'gsk_...', required: true },
  { id: 'VOYAGE_API_KEY', label: 'Voyage AI API Key', placeholder: 'pa-...', required: true },
  { id: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', placeholder: 'sk-or-...', required: false },
];

const STORAGE_KEY = 'tubetalk_api_keys';

export type ApiKeys = Record<string, string>;

// ── Storage helpers ──

export function loadApiKeys(): Promise<ApiKeys> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        try {
          resolve(result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY] as string) : {});
        } catch {
          resolve({});
        }
      });
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    }
  });
}

function saveApiKeys(keys: ApiKeys) {
  const data = JSON.stringify(keys);
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ [STORAGE_KEY]: data });
  } else {
    try { localStorage.setItem(STORAGE_KEY, data); } catch { /* ignore */ }
  }
}

// ── Component ──

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [keys, setKeys] = useState<ApiKeys>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  // Load keys on mount
  useEffect(() => {
    if (isOpen) {
      loadApiKeys().then(setKeys);
      setSaved(false);
    }
  }, [isOpen]);

  const handleChange = (id: string, value: string) => {
    setKeys((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const toggleVisibility = (id: string) => {
    setVisibleFields((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = () => {
    // Only save non-empty keys
    const filtered: ApiKeys = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v.trim()) filtered[k] = v.trim();
    }
    saveApiKeys(filtered);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearAll = () => {
    setKeys({});
    saveApiKeys({});
    setSaved(false);
  };

  const filledCount = Object.values(keys).filter((v) => v.trim()).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-4 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] w-full max-w-md max-h-[85vh] overflow-hidden pointer-events-auto flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 border border-white/10 flex items-center justify-center">
                    <KeyIcon className="w-4 h-4 text-accent-cyan" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">API Keys</h2>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {filledCount}/{API_KEY_FIELDS.length} configured
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white cursor-pointer"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>


              {/* Fields */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-3">
                {API_KEY_FIELDS.map((field) => (
                  <div key={field.id}>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
                      {field.label}
                      {!field.required && (
                        <span className="text-[9px] text-white/30 normal-case tracking-normal font-normal">(optional)</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={visibleFields[field.id] ? 'text' : 'password'}
                        value={keys[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[12px] text-white/90 placeholder:text-white/20 outline-none focus:border-accent-cyan/40 focus:shadow-[0_0_12px_rgba(0,212,255,0.08)] transition-all duration-200 pr-10"
                      />
                      <button
                        onClick={() => toggleVisibility(field.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                      >
                        {visibleFields[field.id] ? (
                          <EyeOffIcon className="w-3.5 h-3.5" />
                        ) : (
                          <EyeIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3">
                <button
                  onClick={handleClearAll}
                  className="text-[11px] text-white/30 hover:text-red-400 transition-colors font-medium cursor-pointer"
                >
                  Clear all
                </button>
                <motion.button
                  onClick={handleSave}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-300 cursor-pointer ${
                    saved
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gradient-to-r from-accent-cyan to-accent-purple text-white shadow-[0_0_15px_rgba(0,212,255,0.3)]'
                  }`}
                >
                  {saved ? (
                    <>
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <SaveIcon className="w-3.5 h-3.5" />
                      Save Keys
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
