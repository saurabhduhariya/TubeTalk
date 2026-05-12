"use client";
import React from 'react';
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
              <strong key={i} className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={i}
                className="px-1.5 py-0.5 rounded text-accent-cyan text-[13px] font-medium"
                style={{ backgroundColor: 'var(--code-bg)' }}
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
            className={`px-4 py-3 ${isBot ? 'rounded-2xl rounded-tl-sm' : 'rounded-2xl rounded-tr-sm'}`}
            style={{
              background: isBot
                ? `linear-gradient(to bottom right, var(--bot-bubble-from), var(--bot-bubble-to))`
                : `linear-gradient(to bottom right, var(--user-bubble-from), var(--user-bubble-to))`,
              border: `1px solid ${isBot ? 'var(--bot-bubble-border)' : 'var(--user-bubble-border)'}`,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {renderText(text)}
            </div>
          </div>
          <span className="text-[10px] mt-1.5 px-1 font-medium tracking-wider" style={{ color: 'var(--text-faint)' }}>
            {time}
          </span>
        </div>
      </div>
    </motion.div>
  );
}