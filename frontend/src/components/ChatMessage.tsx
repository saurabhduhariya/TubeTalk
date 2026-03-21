"use client";
import React from 'react';
import { BotIcon } from 'lucide-react';
import { motion } from 'framer-motion';
interface ChatMessageProps {
  role: 'bot' | 'user';
  text: string;
  time: string;
}
export function ChatMessage({ role, text, time }: ChatMessageProps) {
  const isBot = role === 'bot';
  // Basic markdown parser for bold text
  const renderText = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>);

      }
      // Handle newlines
      return (
        <span key={i}>
          {part.split('\n').map((line, j) =>
          <span key={j}>
              {line}
              {j < part.split('\n').length - 1 && <br />}
            </span>
          )}
        </span>);

    });
  };
  return (
    <motion.div
      variants={{
        hidden: {
          opacity: 0,
          y: 20
        },
        visible: {
          opacity: 1,
          y: 0
        }
      }}
      className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'} mb-6`}>
      
      <div
        className={`flex max-w-[85%] gap-3 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>

        <div className={`flex flex-col w-full ${isBot ? 'items-start' : 'items-end'}`}>
          <div
            className={`
              ${isBot ? 'py-1 pl-4 bg-transparent border-l-2 border-l-accent-cyan/80' : 'px-4 py-3 bg-white/5 border border-white/5 rounded-2xl rounded-tr-sm'}
            `}>
            
            <p className="text-[15px] leading-relaxed text-white/90">
              {renderText(text)}
            </p>
          </div>
          <span className="text-[11px] text-white/30 mt-1.5 px-1 font-medium tracking-wide">
            {time}
          </span>
        </div>
      </div>
    </motion.div>);

}