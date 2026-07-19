"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquareText,
  Send,
  X,
  Loader2,
  Sparkles,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string | null;
  date: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  // Tool call logs
  activeTool?: string;
  // Confirmation logs
  confirmRequired?: {
    action: string;
    transaction: Transaction;
  };
  confirmState?: "pending" | "approved" | "cancelled";
}

let messageCounter = 0;
function generateUniqueId(): string {
  messageCounter += 1;
  return `msg-${messageCounter}-${Date.now()}`;
}

function parseMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";

  const processInline = (lineText: string, keyPrefix: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    const inlineMatches = Array.from(lineText.matchAll(regex));

    inlineMatches.forEach((m, matchIndex) => {
      const matchText = m[0];
      const matchStart = m.index ?? 0;

      if (matchStart > lastIndex) {
        parts.push(
          <span key={`${keyPrefix}-text-${matchIndex}`}>
            {lineText.substring(lastIndex, matchStart)}
          </span>
        );
      }

      if (matchText.startsWith("**") && matchText.endsWith("**")) {
        parts.push(
          <strong key={`${keyPrefix}-bold-${matchIndex}`} className="font-bold text-foreground">
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
        parts.push(
          <code key={`${keyPrefix}-code-${matchIndex}`} className="px-1 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-[10px] font-mono border border-border">
            {matchText.slice(1, -1)}
          </code>
        );
      }

      lastIndex = matchStart + matchText.length;
    });

    if (lastIndex < lineText.length) {
      parts.push(
        <span key={`${keyPrefix}-text-end`}>
          {lineText.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : lineText;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check code block
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <pre key={`codeblock-${i}`} className="p-3 my-2 rounded-lg bg-stone-900 text-stone-100 dark:bg-stone-950 font-mono text-[10px] overflow-x-auto border border-border/10">
            {codeBlockLang && (
              <div className="text-[9px] text-stone-500 uppercase font-sans mb-1.5 border-b border-stone-800 pb-1">
                {codeBlockLang}
              </div>
            )}
            <code>{codeBlockContent.join("\n")}</code>
          </pre>
        );
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = "";
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.trim().substring(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Check headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h5 key={`h5-${i}`} className="text-xs font-bold text-foreground mt-3 mb-1">
          {processInline(trimmed.substring(4), `h5-${i}`)}
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-bold text-foreground mt-4 mb-1">
          {processInline(trimmed.substring(3), `h4-${i}`)}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-bold text-foreground mt-4 mb-2">
          {processInline(trimmed.substring(2), `h3-${i}`)}
        </h3>
      );
      continue;
    }

    // Check bullets
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={`bullet-${i}`} className="list-disc ml-4 pl-0.5 text-stone-600 dark:text-stone-300 my-0.5">
          {processInline(trimmed.replace(/^[-*]\s+/, ""), `bullet-${i}`)}
        </li>
      );
      continue;
    }

    // Check numbered
    if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <li key={`numbered-${i}`} className="list-decimal ml-4 pl-0.5 text-stone-600 dark:text-stone-300 my-0.5">
          {processInline(trimmed.replace(/^\d+\.\s+/, ""), `numbered-${i}`)}
        </li>
      );
      continue;
    }

    // Horizontal rule
    if (trimmed === "---") {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-border" />);
      continue;
    }

    // Empty lines (spacing)
    if (trimmed === "") {
      elements.push(<div key={`space-${i}`} className="h-1.5" />);
      continue;
    }

    // Default paragraph
    elements.push(
      <p key={`p-${i}`} className="text-stone-700 dark:text-stone-200">
        {processInline(line, `p-${i}`)}
      </p>
    );
  }

  // Handle case where code block was not closed
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key="codeblock-unclosed" className="p-3 my-2 rounded-lg bg-stone-900 text-stone-100 dark:bg-stone-950 font-mono text-[10px] overflow-x-auto border border-border/10">
        <code>{codeBlockContent.join("\n")}</code>
      </pre>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

export function ChatAssistant() {
  const router = useRouter();
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamContentRef = useRef("");
  const confirmDataRef = useRef<{ action: string; transaction: Transaction } | null>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, thinkingStatus]);

  // Starter prompts
  const starterPrompts = [
    "What is my current balance?",
    "Show my recent transactions",
    "How much have I spent on Groceries?",
    "Set a budget of $500 for Food",
  ];

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsgId = generateUniqueId();
    const assistantMsgId = generateUniqueId();

    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: text,
    };

    const newAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages([...updatedMessages, newAssistantMessage]);
    setInputValue("");
    setLoading(true);
    setThinkingStatus("Thinking...");
    
    // Reset mutable stream refs
    streamContentRef.current = "";
    confirmDataRef.current = null;

    try {
      // Map frontend messages into backend format (role, content)
      const chatPayload = {
        messages: updatedMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chatPayload),
      });

      if (!response.ok) {
        throw new Error(`Failed to contact agent: status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Empty response body from chat proxy");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        // Maintain trailing incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(cleanLine.substring(6));

            if (event.type === "tool_call") {
              // Convert snake_case tools to a friendly visual status
              const toolName = event.name.replace(/_/g, " ");
              setThinkingStatus(`Running tool: ${toolName}...`);
            } else if (event.type === "text") {
              streamContentRef.current += event.content;
              setThinkingStatus(null);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: streamContentRef.current }
                    : msg
                )
              );
            } else if (event.type === "confirm_required") {
              confirmDataRef.current = {
                action: event.action,
                transaction: event.transaction,
              };
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        confirmRequired: confirmDataRef.current || undefined,
                        confirmState: "pending",
                      }
                    : msg
                )
              );
            } else if (event.type === "error") {
              throw new Error(event.message);
            } else if (event.type === "done") {
              setThinkingStatus(null);
            }
          } catch (err) {
            console.error("Error parsing SSE line:", err);
          }
        }
      }
    } catch (error) {
      console.error("Chat streaming error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Sorry, I encountered an error communicating with the financial agent.";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: errorMessage,
                isError: true,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
      setThinkingStatus(null);
    }
  };

  const handleApproveDelete = async (messageId: string, transactionId: string) => {
    // Optimistically update confirmation state
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, confirmState: "approved" } : msg
      )
    );

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;

      // Refresh page routes to reflect structural updates instantly
      router.refresh();

      // Trigger automatic conversational update
      await handleSend(
        "I have approved and deleted the transaction as requested."
      );
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      alert("Failed to delete transaction database row.");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, confirmState: "pending" } : msg
        )
      );
    }
  };

  const handleCancelDelete = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, confirmState: "cancelled" } : msg
      )
    );

    // Conversational turn cancellation update
    handleSend("Cancel the deletion.");
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg border border-border cursor-pointer relative"
        >
          {isOpen ? (
            <X className="h-5 w-5 stroke-[2]" />
          ) : (
            <>
              <MessageSquareText className="h-5 w-5 stroke-[2]" />
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-sage border-2 border-background animate-pulse" />
            </>
          )}
        </motion.button>
      </div>

      {/* Slide-over Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-stone-900/30 backdrop-blur-xs z-40"
            />

            {/* Chat Container Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-96 max-w-full bg-card border-l border-border shadow-2xl flex flex-col z-50 text-foreground"
            >
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-stone-50 dark:bg-stone-900/30">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-border">
                    <Sparkles className="h-4 w-4 text-foreground stroke-[1.5]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight">AI Assistant</h3>
                    <p className="text-[10px] text-sage font-semibold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                      Active Financial Agent
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer text-foreground"
                >
                  <X className="h-4.5 w-4.5 stroke-[1.5]" />
                </button>
              </div>

              {/* Message Feed Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-6 pt-12">
                    <div className="h-12 w-12 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-border flex items-center justify-center">
                      <HelpCircle className="h-6 w-6 text-stone-400 stroke-[1.5]" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-sm">Ask anything about your budget</h4>
                      <p className="text-xs text-stone-400 max-w-[240px] leading-relaxed">
                        I can list transactions, compute monthly expenses, update budgets, or set category limits.
                      </p>
                    </div>

                    {/* Starter prompts grid */}
                    <div className="w-full space-y-2 pt-4">
                      {starterPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSend(prompt)}
                          className="w-full text-left px-3 py-2 text-xs border border-border rounded-lg bg-card hover:bg-stone-50 dark:hover:bg-stone-900/50 transition-colors flex items-center justify-between group cursor-pointer text-stone-600 dark:text-stone-300"
                        >
                          <span>{prompt}</span>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isUser = msg.role === "user";
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isUser ? "items-end" : "items-start"
                          }`}
                        >
                          {/* Chat Bubble */}
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed border ${
                              isUser
                                ? "bg-foreground text-background border-transparent font-medium whitespace-pre-wrap"
                                : msg.isError
                                ? "bg-rust-light border-rust/10 text-rust whitespace-pre-wrap"
                                : "bg-stone-50 dark:bg-stone-900/40 border-border text-foreground"
                            }`}
                          >
                            {msg.content ? (
                              isUser ? (
                                msg.content
                              ) : (
                                parseMarkdown(msg.content)
                              )
                            ) : (
                              <div className="flex items-center gap-1.5 text-stone-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Typing...</span>
                              </div>
                            )}
                          </div>

                          {/* Delete Confirmation Card Attachment */}
                          {!isUser && msg.confirmRequired && (
                            <div className="mt-3 w-full max-w-[85%] bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                              <div className="flex items-start gap-2.5">
                                <div className="p-1.5 rounded-lg bg-rust-light border border-rust/10 text-rust">
                                  <AlertTriangle className="h-4 w-4 stroke-[1.5]" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-foreground">
                                    Approve Transaction Deletion
                                  </p>
                                  <p className="text-[10px] text-stone-400">
                                    This action will permanently remove the record from your account.
                                  </p>
                                </div>
                              </div>

                              {/* Transaction Ledger Item */}
                              <div className="bg-stone-50 dark:bg-stone-900/30 border border-border rounded-lg p-2.5 flex items-center justify-between text-xs">
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground truncate">
                                    {msg.confirmRequired.transaction.description ||
                                      msg.confirmRequired.transaction.category}
                                  </p>
                                  <p className="text-[10px] text-stone-400 mt-0.5">
                                    {msg.confirmRequired.transaction.date} • {msg.confirmRequired.transaction.category}
                                  </p>
                                </div>
                                <span
                                  className={`font-bold flex items-center gap-0.5 shrink-0 ${
                                    msg.confirmRequired.transaction.type === "expense"
                                      ? "text-rust"
                                      : "text-sage"
                                  }`}
                                >
                                  {msg.confirmRequired.transaction.type === "expense" ? (
                                    <TrendingDown className="h-3 w-3 shrink-0" />
                                  ) : (
                                    <TrendingUp className="h-3 w-3 shrink-0" />
                                  )}
                                  {formatCurrency(msg.confirmRequired.transaction.amount)}
                                </span>
                              </div>

                              {/* Action buttons based on confirmation state */}
                              {msg.confirmState === "pending" && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      handleApproveDelete(
                                        msg.id,
                                        msg.confirmRequired!.transaction.id
                                      )
                                    }
                                    className="flex-1 bg-rust text-white dark:text-stone-900 font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer hover:opacity-90 transition-opacity"
                                  >
                                    <Trash2 className="h-3 w-3 stroke-[2]" />
                                    <span>Approve Delete</span>
                                  </button>
                                  <button
                                    onClick={() => handleCancelDelete(msg.id)}
                                    className="flex-1 bg-transparent hover:bg-stone-100 dark:hover:bg-stone-800 border border-border text-stone-600 dark:text-stone-300 font-bold py-1.5 px-3 rounded-lg text-[10px] cursor-pointer transition-colors"
                                  >
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              )}

                              {msg.confirmState === "approved" && (
                                <div className="flex items-center gap-1 text-[10px] text-sage font-bold py-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Deletion Approved & Completed</span>
                                </div>
                              )}

                              {msg.confirmState === "cancelled" && (
                                <div className="flex items-center gap-1 text-[10px] text-stone-400 font-bold py-1">
                                  <X className="h-3.5 w-3.5" />
                                  <span>Deletion Cancelled</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Thinking status line */}
                    {thinkingStatus && (
                      <div className="flex items-center gap-2 text-stone-400 text-xs pl-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="italic">{thinkingStatus}</span>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input Footer Form */}
              <div className="p-4 border-t border-border bg-stone-50 dark:bg-stone-900/30">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend(inputValue);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    disabled={loading}
                    placeholder="Ask about budgets or ledger..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1 bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 px-3 text-xs outline-none transition-all placeholder:text-stone-400 text-foreground"
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputValue.trim()}
                    className="h-8.5 w-8.5 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    <Send className="h-3.5 w-3.5 stroke-[2]" />
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
