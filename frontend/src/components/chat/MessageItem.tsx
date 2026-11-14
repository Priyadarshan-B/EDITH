import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Check, Copy, User } from "lucide-react";
import { ChatMessage } from "../../types";

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === "user";
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex w-full mb-6 ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex gap-3 max-w-[85%] lg:max-w-[78%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 rounded-xl bg-hudBlue/20 border border-hudBlue flex items-center justify-center text-hudBlue shadow-[0_0_12px_rgba(0,114,255,0.4)]">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-hudCyan/20 border border-hudCyan flex items-center justify-center text-hudCyan shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <Bot className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Message Content Bubble */}
        <div className="flex flex-col">
          {/* Header Tag */}
          <div className={`flex items-center gap-2 mb-1.5 px-1 ${isUser ? "justify-end" : "justify-start"}`}>
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-400">
              {isUser ? "OPERATOR" : "E.D.I.T.H."}
            </span>
            {message.modelUsed && !isUser && (
              <span className="text-[10px] font-mono text-hudCyan/80 px-1.5 py-0.2 rounded border border-hudCyan/30 bg-hudCyan/10">
                {message.modelUsed}
              </span>
            )}
            <span className="text-[10px] font-mono text-slate-500">{formattedTime}</span>
          </div>

          {/* Text Container with Markdown */}
          <div
            className={`p-4 rounded-2xl text-sm leading-relaxed backdrop-blur-xl border transition-all ${
              isUser
                ? "bg-slate-900/90 border-hudBlue/50 text-slate-100 shadow-[0_0_15px_rgba(0,114,255,0.15)] rounded-tr-none"
                : "bg-card/90 border-border/80 text-slate-200 shadow-hud rounded-tl-none"
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap font-sans">{message.content}</div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none text-slate-200 font-sans">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ inline, className, children }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const language = match ? match[1] : "";
                      const codeText = String(children).replace(/\n$/, "");
                      const codeIndex = Math.random();

                      if (!inline && language) {
                        return (
                          <div className="my-3 rounded-xl overflow-hidden border border-border/80 bg-black/60 shadow-inner">
                            {/* Code Header Bar */}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-border/60 text-xs font-mono text-slate-400">
                              <span className="text-hudCyan uppercase text-[11px]">{language}</span>
                              <button
                                onClick={() => handleCopy(codeText, codeIndex)}
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 transition-colors text-[11px] cursor-pointer"
                              >
                                {copiedCodeIndex === codeIndex ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            {/* Code Content */}
                            <pre className="p-3 text-xs font-mono overflow-x-auto text-slate-100 bg-transparent m-0">
                              <code>{children}</code>
                            </pre>
                          </div>
                        );
                      }
                      return (
                        <code className="bg-slate-800/80 text-hudCyan px-1.5 py-0.5 rounded font-mono text-xs border border-slate-700">
                          {children}
                        </code>
                      );
                    },
                    p({ children }) {
                      return <p className="mb-2 last:mb-0">{children}</p>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>;
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>

                {/* Blinking streaming cursor */}
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-hudCyan animate-pulse align-middle" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
