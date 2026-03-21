"use client";
import React from 'react';
import { SparklesIcon, ListIcon, ClockIcon, LightbulbIcon } from 'lucide-react';
import { motion } from 'framer-motion';
const actions = [
{
  id: 'summarize',
  label: 'Summarize',
  icon: SparklesIcon
},
{
  id: 'key-points',
  label: 'Key Points',
  icon: ListIcon
},
{
  id: 'timestamps',
  label: 'Timestamps',
  icon: ClockIcon
},
{
  id: 'explain',
  label: 'Explain',
  icon: LightbulbIcon
}];

export function QuickActions() {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10
      }}
      animate={{
        opacity: 1,
        y: 0
      }}
      transition={{
        delay: 0.8,
        duration: 0.5
      }}
      className="flex gap-2 overflow-x-auto no-scrollbar px-6 pb-4 pt-2">
      
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.id}
            whileHover={{
              scale: 1.03,
              backgroundColor: 'rgba(255,255,255,0.08)'
            }}
            whileTap={{
              scale: 0.97
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0a0a0a] border border-white/5 whitespace-nowrap transition-colors group">
            
            <Icon className="w-3.5 h-3.5 text-white/50 group-hover:text-accent-cyan transition-colors" />
            <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">
              {action.label}
            </span>
          </motion.button>);

      })}
    </motion.div>);

}