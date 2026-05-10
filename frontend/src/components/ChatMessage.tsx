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

  // Markdown parser for bold, inline code, bullet lists, and newlines
  const renderText = (content: string) => {
    const lines = content.split('\n');

    return lines.map((line, lineIdx) => {
      const trimmed = line.trimStart();
      const isBullet = /^[-•*]\s/.test(trimmed);
      const isNumbered = /^\d+[.)]\s/.test(trimmed);

      const renderInline = (text: string) => {
        // Split on bold (**text**) and inline code (`text`)
        const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
        return parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-bold text-white">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={i}
                className="px-1.5 py-0.5 rounded bg-white/10 text-accent-cyan text-[13px] font-medium"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <span key={i}>{part}</span>;
        });
      };

      if (isBullet) {
        return (
          <div key={lineIdx} className="flex gap-2 items-start py-0.5">
            <span className="text-accent-cyan mt-0.5 text-xs select-none">●</span>
            <span className="flex-1">{renderInline(trimmed.replace(/^[-•*]\s/, ''))}</span>
          </div>
        );
      }

      if (isNumbered) {
        const num = trimmed.match(/^(\d+)[.)]\s/)?.[1];
        return (
          <div key={lineIdx} className="flex gap-2 items-start py-0.5">
            <span className="text-accent-cyan/80 text-xs font-bold mt-0.5 min-w-[16px] select-none">{num}.</span>
            <span className="flex-1">{renderInline(trimmed.replace(/^\d+[.)]\s/, ''))}</span>
          </div>
        );
      }

      if (line.trim() === '') {
        return <div key={lineIdx} className="h-2" />;
      }

      return (
        <span key={lineIdx}>
          {renderInline(line)}
          {lineIdx < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'} mb-5`}
    >
      <div
        className={`flex max-w-[88%] gap-3 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}
      >
        <div className={`flex flex-col w-full ${isBot ? 'items-start' : 'items-end'}`}>
          <div
            className={`
              ${
                isBot
                  ? 'px-4 py-3 bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] rounded-2xl rounded-tl-sm shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                  : 'px-4 py-3 bg-gradient-to-br from-accent-cyan/15 to-accent-purple/10 border border-accent-cyan/20 rounded-2xl rounded-tr-sm shadow-[0_4px_24px_rgba(0,212,255,0.08)]'
              }
            `}
          >
            <div className="text-[13px] leading-relaxed text-white/90">
              {renderText(text)}
            </div>
          </div>
          <span className="text-[10px] text-white/25 mt-1.5 px-1 font-medium tracking-wider">
            {time}
          </span>
        </div>
      </div>
    </motion.div>
  );
}