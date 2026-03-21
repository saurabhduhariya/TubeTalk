"use client";
import React, { Children, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickActions } from './QuickActions';
import { TypingIndicator } from './TypingIndicator';

interface Message {
  role: 'bot' | 'user';
  text: string;
}

interface TubeTalkSidebarProps {
  chat: Message[];
  loading: boolean;
  question: string;
  setQuestion: (val: string) => void;
  askQuestion: () => void;
  url: string;
}

export function TubeTalkSidebar({ chat, loading, question, setQuestion, askQuestion, url }: TubeTalkSidebarProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, loading]);

  return (
    <motion.div
      initial={{ x: -420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 25,
        opacity: { duration: 0.4 }
      }}
      className="w-full sm:w-[420px] h-screen flex flex-col bg-[#050505] border-r border-white/5 shadow-[20px_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
      
      {/* Subtle background glow effects removed for purely dark aesthetic */}

      <ChatHeader url={url} />

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pb-2 relative z-10 flex flex-col">
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.15, delayChildren: 0.2 }
            }
          }}
          initial="hidden"
          animate="visible"
          className="flex flex-col">
          
          {chat.length === 0 && (
             <ChatMessage role="bot" text="Hey! 👋 I'm TubeTalk. I've analyzed this video. Ask me anything about it!" time={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
          )}

          {chat.map((msg, index) =>
            <ChatMessage
              key={index}
              role={msg.role}
              text={msg.text}
              time={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
          )}

          {loading && (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              className="flex items-end gap-3 mb-6">
              
              <div className="flex-shrink-0 mb-1">
                <div className="w-8 h-8 rounded-full bg-glass-gradient border border-glass-border flex items-center justify-center shadow-[0_0_15px_rgba(0,212,255,0.1)]">
                  <div className="w-4 h-4 text-accent-cyan flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
                  </div>
                </div>
              </div>
              <TypingIndicator />
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </motion.div>
      </div>

      <div className="relative z-10">
        <QuickActions />
        <ChatInput 
          question={question}
          setQuestion={setQuestion}
          askQuestion={askQuestion}
          loading={loading}
          url={url}
        />
      </div>
    </motion.div>
  );
}