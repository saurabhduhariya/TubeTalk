"use client";

import { useState, useEffect, useRef } from "react";

type Message = { role: "user" | "bot"; text: string };

export default function Home() {
  const [url, setUrl] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // 2. Auto-scroll to the bottom of the chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  const askQuestion = async () => {
    if (!question.trim() || !url.includes("youtube.com/watch")) return;

    const userMsg: Message = { role: "user", text: question };
    setChat((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, question }),
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
    <main className="flex flex-col h-screen p-4 bg-slate-900 text-slate-200">
      {/* Header */}
      <header className="pb-3 mb-3 border-b border-slate-700 flex justify-between items-center">
        <h1 className="text-lg font-bold text-emerald-400">YT Chatbot</h1>
        <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400">
          {url ? "Connected" : "Waiting for video..."}
        </span>
      </header>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] p-3 rounded-lg text-sm leading-relaxed ${
              msg.role === "user" 
                ? "bg-emerald-600 text-white rounded-br-none" 
                : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-400 border border-slate-700 p-3 rounded-lg rounded-bl-none text-sm animate-pulse">
              Analyzing transcript...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="mt-4 pt-3 border-t border-slate-700 flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && askQuestion()}
          placeholder="Ask something..."
          disabled={!url || loading}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
        />
        <button
          onClick={askQuestion}
          disabled={!url || loading || !question.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          ↵
        </button>
      </div>
    </main>
  );
}