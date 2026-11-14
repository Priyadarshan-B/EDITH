import { create } from "zustand";
import { ChatMessage } from "../types";

interface ChatState {
  messages: ChatMessage[];
  isThinking: boolean;
  activeConversationId: string | null;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateLastMessageContent: (content: string) => void;
  setThinking: (thinking: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: "init-welcome",
      role: "assistant",
      content: "All systems online. EDITH protocol initialized. Standing by for instructions.",
      timestamp: Date.now(),
      modelUsed: "System Core",
    },
  ],
  isThinking: false,
  activeConversationId: null,
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
        },
      ],
    })),
  updateLastMessageContent: (content) =>
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content,
        };
      }
      return { messages: msgs };
    }),
  setThinking: (isThinking) => set({ isThinking }),
  clearMessages: () => set({ messages: [] }),
}));
