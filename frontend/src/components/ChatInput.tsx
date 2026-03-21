"use client";
import React, { useState } from 'react';
import { SendIcon, MicIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  question: string;
  setQuestion: (val: string) => void;
  askQuestion: () => void;
  loading: boolean;
  url: string;
}

export function ChatInput({ question, setQuestion, askQuestion, loading, url }: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="px-6 pb-6 pt-2 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent">
      <motion.div
        animate={{
          borderColor: isFocused ?
          'rgba(0, 212, 255, 0.3)' :
          'rgba(255, 255, 255, 0.08)',
          boxShadow: isFocused ?
          '0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 10px rgba(0, 212, 255, 0.05)' :
          '0 4px 20px rgba(0,0,0,0.2)'
        }}
        className="relative flex items-end gap-2 p-2 bg-[#0a0a0a] rounded-2xl border transition-colors duration-300">
        
        <button className="p-2.5 text-white/40 hover:text-white/80 transition-colors rounded-xl hover:bg-white/5 mb-0.5 disabled:opacity-50">
          <MicIcon className="w-5 h-5" />
        </button>

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
          className="flex-1 bg-transparent border-none outline-none text-white/90 placeholder:text-white/30 resize-none min-h-[44px] max-h-[120px] py-3 text-[15px] custom-scrollbar disabled:opacity-50"
          rows={1} />
        
        <motion.button
          onClick={askQuestion}
          disabled={!url || loading || !question.trim()}
          whileHover={{
            scale: 1.05
          }}
          whileTap={{
            scale: 0.95
          }}
          className={`p-2.5 rounded-xl flex items-center justify-center mb-0.5 transition-all duration-300 ${question.trim() && url && !loading ? 'bg-gradient-to-br from-accent-cyan to-accent-purple text-white shadow-[0_0_15px_rgba(0,212,255,0.4)] cursor-pointer' : 'bg-white/5 text-white/30 cursor-not-allowed opacity-50'}`}>
          <SendIcon className="w-5 h-5 ml-0.5" />
        </motion.button>
      </motion.div>
      <div className="text-center mt-3">
        <span className="text-[10px] text-white/20 font-medium tracking-wider uppercase">
          TubeTalk AI • Beta
        </span>
      </div>
    </div>);
}