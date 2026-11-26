import { create } from "zustand";
import { ChatMessage } from "../types";
import { ConversationItem } from "../api/client";

interface ChatState {
  messages: ChatMessage[];
  conversations: ConversationItem[];
  activeConversationId: string | null;
  isStreaming: boolean;
  activeModel: string;
  setConversations: (conversations: ConversationItem[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => string;
  appendStreamToken: (token: string) => void;
  finishStreaming: () => void;
  setActiveModel: (model: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  activeModel: "gemma4:e2b",

  setConversations: (conversations) => set({ conversations }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
  setMessages: (messages) => set({ messages }),

  addMessage: (msg) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id,
          timestamp: Date.now(),
        },
      ],
    }));
    return id;
  },

  appendStreamToken: (token: string) =>
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length === 0) return state;

      const lastIndex = msgs.length - 1;
      const lastMsg = msgs[lastIndex];

      if (lastMsg.role === "assistant") {
        msgs[lastIndex] = {
          ...lastMsg,
          content: lastMsg.content + token,
          isStreaming: true,
        };
      }
      return { messages: msgs, isStreaming: true };
    }),

  finishStreaming: () =>
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          isStreaming: false,
        };
      }
      return { messages: msgs, isStreaming: false };
    }),

  setActiveModel: (activeModel) => set({ activeModel }),
  clearMessages: () => set({ messages: [], activeConversationId: null }),
}));
