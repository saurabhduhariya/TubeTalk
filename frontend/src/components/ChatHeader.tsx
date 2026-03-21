"use client";
import React from 'react';
import { ChevronLeftIcon, SettingsIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export function ChatHeader({ url }: { url: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between px-6 py-4 border-b border-glass-border bg-[#050505] z-10">
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => window.close()}
          className="p-1.5 rounded-full hover:bg-glass-hover transition-colors text-white/70 hover:text-white cursor-pointer">
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            TubeTalk
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-glass border border-glass-border shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
            className={`w-2 h-2 rounded-full ${url ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
          
          <span className="text-xs font-medium text-white/80">{url ? "Connected" : "Waiting for video"}</span>
        </div>
        <button className="p-1.5 rounded-full hover:bg-glass-hover transition-colors text-white/70 hover:text-white cursor-pointer">
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}