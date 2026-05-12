"use client";
import React, { useState } from 'react';
import { SendIcon, SquareIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  question: string;
  setQuestion: (val: string) => void;
  askQuestion: () => void;
  stopGeneration: () => void;
  loading: boolean;
  url: string;
}

export function ChatInput({ question, setQuestion, askQuestion, stopGeneration, loading, url }: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="px-6 pb-6 pt-2">
      <motion.div
        animate={{
          borderColor: isFocused ? 'var(--input-focus-border)' : 'var(--input-border)',
          boxShadow: isFocused ? 'var(--input-focus-shadow)' : 'var(--input-shadow)',
        }}
        className="relative flex items-end gap-2 p-2 rounded-2xl border transition-colors duration-300"
        style={{ backgroundColor: 'var(--input-bg)' }}>
        

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              askQuestion();
            }
          }}
          disabled={!url || loading}
          placeholder={url ? "Ask about this video..." : "Waiting for YouTube video..."}
          className="flex-1 bg-transparent border-none outline-none resize-none min-h-[44px] max-h-[120px] py-3 text-[15px] custom-scrollbar disabled:opacity-50"
          style={{ color: 'var(--text-primary)' }}
          rows={1} />
        
        {loading ? (
          <motion.button
            onClick={stopGeneration}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 rounded-xl flex items-center justify-center mb-0.5 transition-all duration-300 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] cursor-pointer"
          >
            <SquareIcon className="w-4 h-4 fill-current" />
          </motion.button>
        ) : (
          <motion.button
            onClick={askQuestion}
            disabled={!url || !question.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`p-2.5 rounded-xl flex items-center justify-center mb-0.5 transition-all duration-300 ${question.trim() && url ? 'bg-gradient-to-br from-accent-cyan to-accent-purple text-white shadow-[0_0_15px_rgba(0,212,255,0.4)] cursor-pointer' : 'bg-white/5 cursor-not-allowed opacity-50'}`}
            style={{ color: question.trim() && url ? undefined : 'var(--text-muted)' }}
          >
            <SendIcon className="w-5 h-5 ml-0.5" />
          </motion.button>
        )}
      </motion.div>
    </div>);
}