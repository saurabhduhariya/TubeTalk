"use client";
import React from 'react';
import { motion } from 'framer-motion';
export function TypingIndicator() {
  const dotVariants = {
    initial: {
      y: 0,
      opacity: 0.5
    },
    animate: {
      y: -4,
      opacity: 1
    }
  };
  const transition = {
    duration: 0.5,
    repeat: Infinity,
    repeatType: 'reverse' as const,
    ease: 'easeInOut' as const
  };
  return (
    <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-tl-sm w-fit" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
      {[0, 1, 2].map((index) =>
      <motion.div
        key={index}
        className="w-1.5 h-1.5 rounded-full bg-accent-cyan"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{
          ...transition,
          delay: index * 0.15
        }} />

      )}
    </div>);

}