"use client";
import { useState, useRef, useEffect } from "react";
import api from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "你好！我是 NutriAgent，你的 AI 营养管理助手。\n\n我可以帮你：\n- 记录饮食并分析热量\n- 回答营养问题\n- 推荐个性化食谱\n\n试试说：\"我中午吃了黄焖鸡米饭\" 或 \"推荐一顿减脂晚餐\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");

    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMsg,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const res = await api.post("/chat/", { message: userMsg });
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: res.data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "抱歉，出现了错误。请检查网络连接和 API 配置后重试。",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    "今天吃了多少热量",
    "推荐一顿减脂晚餐",
    "减脂期间主食怎么选",
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold">AI 营养师</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-green-500 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => { setInput(action); }}
                className="bg-white border border-green-200 text-green-700 px-3 py-1.5 rounded-full text-xs hover:bg-green-50 transition"
              >
                {action}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t px-4 py-3">
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="输入你的问题..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-green-600 disabled:opacity-50 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
