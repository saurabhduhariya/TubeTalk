"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TubeTalkSidebar } from '../components/TubeTalkSidebar';
import { loadApiKeys } from '../components/SettingsModal';

type Message = { role: "user" | "bot"; text: string };

// ── Storage helpers (chrome.storage.local for extension, localStorage for dev) ──

function getVideoId(videoUrl: string): string | null {
  try {
    const u = new URL(videoUrl);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

const STORAGE_PREFIX = "tubetalk_chat_";

function saveChat(videoId: string, messages: Message[]) {
  const key = STORAGE_PREFIX + videoId;
  const data = JSON.stringify(messages);

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ [key]: data });
  } else {
    try { localStorage.setItem(key, data); } catch { /* quota exceeded */ }
  }
}

function loadChat(videoId: string): Promise<Message[]> {
  const key = STORAGE_PREFIX + videoId;

  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(key, (result) => {
        try {
          resolve(result[key] ? JSON.parse(result[key] as string) : []);
        } catch {
          resolve([]);
        }
      });
    } else {
      try {
        const raw = localStorage.getItem(key);
        resolve(raw ? JSON.parse(raw) : []);
      } catch {
        resolve([]);
      }
    }
  });
}

// ── Component ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [url, setUrl] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentVideoIdRef = useRef<string | null>(null);

  // Save chat to storage whenever it changes
  useEffect(() => {
    const vid = currentVideoIdRef.current;
    if (vid && chat.length > 0) {
      saveChat(vid, chat);
    }
  }, [chat]);

  // Load saved chat when video URL changes
  const handleUrlChange = useCallback(async (newUrl: string) => {
    const newVideoId = getVideoId(newUrl);
    const oldVideoId = currentVideoIdRef.current;

    // Only reload if we switched to a different video
    if (newVideoId && newVideoId !== oldVideoId) {
      currentVideoIdRef.current = newVideoId;
      const savedChat = await loadChat(newVideoId);
      setChat(savedChat);
    }

    setUrl(newUrl);
  }, []);

  // Clear chat for the current video
  const clearChat = useCallback(() => {
    const vid = currentVideoIdRef.current;
    if (vid) {
      const key = STORAGE_PREFIX + vid;
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.remove(key);
      } else {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
    }
    setChat([]);
  }, []);

  // 1. Auto-fetch the YouTube URL when the popup opens
  useEffect(() => {
    const checkTab = () => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const currentUrl = tabs[0]?.url || tabs[0]?.pendingUrl || "";
          if (currentUrl.includes("youtube.com/watch")) {
            handleUrlChange(currentUrl);
          } else {
            setUrl("");
            currentVideoIdRef.current = null;
            setChat([{ role: "bot", text: "Please open a YouTube video to start chatting." }]);
          }
        });
      } else {
        // Fallback for testing in a normal browser window (npm run dev)
        handleUrlChange("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      }
    };

    checkTab();

    // Listen for tab updates in case the user navigates while the popup is open
    if (typeof chrome !== "undefined" && chrome.tabs) {
      const listener = (tabId: number, changeInfo: any, tab: any) => {
        if (tab.active) checkTab();
      };
      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.onActivated.addListener(checkTab);
      return () => {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.onActivated.removeListener(checkTab);
      };
    }
  }, [handleUrlChange]);

  const askQuestion = async (overrideQuestion?: string) => {
    const q = typeof overrideQuestion === 'string' ? overrideQuestion : question;
    if (!q.trim() || !url.includes("youtube.com/watch")) return;

    const userMsg: Message = { role: "user", text: q };
    setChat((prev) => [...prev, userMsg]);
    if (typeof overrideQuestion !== 'string') setQuestion("");
    setLoading(true);

    // Create a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Load user API keys from storage and send as headers
      const userKeys = await loadApiKeys();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      for (const [key, value] of Object.entries(userKeys)) {
        if (value) headers[`X-Api-Key-${key}`] = value;
      }

      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ url, question: q }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Backend error");

      const data = await response.json();
      setChat((prev) => [...prev, { role: "bot", text: data.answer }]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setChat((prev) => [...prev, { role: "bot", text: "⏹ Response stopped by user." }]);
      } else {
        setChat((prev) => [...prev, { role: "bot", text: "Error: Is your Python FastAPI server running on port 8000?" }]);
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  return (
    <main className="w-full h-full flex overflow-hidden">
      <TubeTalkSidebar 
        chat={chat}
        loading={loading}
        question={question}
        setQuestion={setQuestion}
        askQuestion={askQuestion}
        stopGeneration={stopGeneration}
        clearChat={clearChat}
        url={url}
      />
    </main>
  );
}