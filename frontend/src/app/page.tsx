"use client";

import { useState, useEffect } from "react";
import { TubeTalkSidebar } from '../components/TubeTalkSidebar';

type Message = { role: "user" | "bot"; text: string };

export default function Home() {
  const [url, setUrl] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Auto-fetch the YouTube URL when the popup opens
  useEffect(() => {
    const checkTab = () => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const currentUrl = tabs[0]?.url || tabs[0]?.pendingUrl || "";
          if (currentUrl.includes("youtube.com/watch")) {
            setUrl(currentUrl);
            setChat([]); // clear warning if any
          } else {
            setUrl("");
            setChat([{ role: "bot", text: "Please open a YouTube video to start chatting." }]);
          }
        });
      } else {
        // Fallback for testing in a normal browser window (npm run dev)
        setUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
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
  }, []);

  const askQuestion = async (overrideQuestion?: string) => {
    const q = typeof overrideQuestion === 'string' ? overrideQuestion : question;
    if (!q.trim() || !url.includes("youtube.com/watch")) return;

    const userMsg: Message = { role: "user", text: q };
    setChat((prev) => [...prev, userMsg]);
    if (typeof overrideQuestion !== 'string') setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, question: q }),
      });

      if (!response.ok) throw new Error("Backend error");

      const data = await response.json();
      setChat((prev) => [...prev, { role: "bot", text: data.answer }]);
    } catch (error) {
      setChat((prev) => [...prev, { role: "bot", text: "Error: Is your Python FastAPI server running on port 8000?" }]);
    } finally {
      setLoading(false);
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
        url={url}
      />
    </main>
  );
}