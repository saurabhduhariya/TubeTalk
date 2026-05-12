"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TubeTalkSidebar } from '../components/TubeTalkSidebar';
import { loadApiKeys } from '../components/SettingsModal';
import type { HistoryEntry } from '../components/ChatHistory';

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
const HISTORY_KEY = "tubetalk_history";

// ── Chat storage ──

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
        } catch { resolve([]); }
      });
    } else {
      try {
        const raw = localStorage.getItem(key);
        resolve(raw ? JSON.parse(raw) : []);
      } catch { resolve([]); }
    }
  });
}

function deleteChat(videoId: string) {
  const key = STORAGE_PREFIX + videoId;
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.remove(key);
  } else {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

// ── History registry ──

function saveHistory(entries: HistoryEntry[]) {
  const data = JSON.stringify(entries);
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ [HISTORY_KEY]: data });
  } else {
    try { localStorage.setItem(HISTORY_KEY, data); } catch { /* ignore */ }
  }
}

function loadHistory(): Promise<HistoryEntry[]> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(HISTORY_KEY, (result) => {
        try {
          resolve(result[HISTORY_KEY] ? JSON.parse(result[HISTORY_KEY] as string) : []);
        } catch { resolve([]); }
      });
    } else {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        resolve(raw ? JSON.parse(raw) : []);
      } catch { resolve([]); }
    }
  });
}

// ── Component ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [url, setUrl] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentVideoIdRef = useRef<string | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory().then(setHistoryEntries);
  }, []);

  // Fetch video title from YouTube (no API key needed)
  const fetchVideoTitle = useCallback(async (videoId: string): Promise<string> => {
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await res.json();
      return data.title || videoId;
    } catch {
      return videoId;
    }
  }, []);

  // Save chat + update history whenever chat changes
  useEffect(() => {
    const vid = currentVideoIdRef.current;
    if (vid && chat.length > 0) {
      saveChat(vid, chat);

      // Update history registry
      setHistoryEntries((prev) => {
        const existing = prev.find((e) => e.videoId === vid);
        if (existing) {
          const updated = prev.map((e) =>
            e.videoId === vid
              ? { ...e, messageCount: chat.length, lastActive: Date.now() }
              : e
          );
          saveHistory(updated);
          return updated;
        } else {
          // New entry — fetch title asynchronously
          const newEntry: HistoryEntry = { videoId: vid, messageCount: chat.length, lastActive: Date.now() };
          const updated = [...prev, newEntry];
          saveHistory(updated);

          // Fetch title in background and update
          fetchVideoTitle(vid).then((title) => {
            setHistoryEntries((curr) => {
              const withTitle = curr.map((e) =>
                e.videoId === vid ? { ...e, title } : e
              );
              saveHistory(withTitle);
              return withTitle;
            });
          });

          return updated;
        }
      });
    }
  }, [chat, fetchVideoTitle]);

  // Load saved chat when video URL changes
  const handleUrlChange = useCallback(async (newUrl: string) => {
    const newVideoId = getVideoId(newUrl);
    const oldVideoId = currentVideoIdRef.current;

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
      deleteChat(vid);
      // Remove from history
      setHistoryEntries((prev) => {
        const updated = prev.filter((e) => e.videoId !== vid);
        saveHistory(updated);
        return updated;
      });
    }
    setChat([]);
  }, []);

  // Select a video from history
  const selectVideo = useCallback(async (videoId: string) => {
    currentVideoIdRef.current = videoId;
    const savedChat = await loadChat(videoId);
    setChat(savedChat);
    setUrl(`https://www.youtube.com/watch?v=${videoId}`);
  }, []);

  // Delete a specific history entry
  const deleteHistoryEntry = useCallback((videoId: string) => {
    deleteChat(videoId);
    setHistoryEntries((prev) => {
      const updated = prev.filter((e) => e.videoId !== videoId);
      saveHistory(updated);
      return updated;
    });
    // If we're deleting the current video's chat, clear it
    if (currentVideoIdRef.current === videoId) {
      setChat([]);
    }
  }, []);

  // Auto-fetch the YouTube URL when the popup opens
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
        handleUrlChange("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      }
    };

    checkTab();

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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
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
        historyEntries={historyEntries}
        onSelectVideo={selectVideo}
        onDeleteHistory={deleteHistoryEntry}
      />
    </main>
  );
}