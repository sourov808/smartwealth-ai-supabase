"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquareText, X, Loader2 } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { drawerSpring, scrim } from "@/lib/motion";
import { MessageContent } from "@/components/dashboard/chat/message-content";
import { ConfirmCard } from "@/components/dashboard/chat/confirm-card";
import { ChatInput } from "@/components/dashboard/chat/chat-input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ToolTrail, type ToolActivity } from "@/components/dashboard/chat/tool-trail";

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
  /** The agent's tool calls for this reply, in order. Rendered by ToolTrail. */
  activities?: ToolActivity[];
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

export function ChatAssistant() {
  const router = useRouter();
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);

  const { confirm, dialog } = useConfirm();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamContentRef = useRef("");
  const confirmDataRef = useRef<{ action: string; transaction: Transaction } | null>(null);
  // Mirrors the activity list held in message state. The SSE loop needs the
  // current value synchronously between events, which a state read cannot give
  // it inside the same tick.
  const activitiesRef = useRef<ToolActivity[]>([]);

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

  /**
   * Stops every spinner in a reply's trail.
   *
   * Called on `done` and again in `finally`, because a stream that dies
   * mid-tool never sends `done` — and a tool entry left in the `running` state
   * spins forever, which reads as "still working" long after the request is
   * dead.
   */
  const settleActivities = (messageId: string) => {
    if (!activitiesRef.current.some((a) => a.state === "running")) return;

    activitiesRef.current = activitiesRef.current.map((a) =>
      a.state === "running" ? { ...a, state: "done" as const } : a
    );

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, activities: activitiesRef.current } : msg
      )
    );
  };

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
    activitiesRef.current = [];

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
              // Each call closes out the previous one and appends its own entry,
              // so the reply carries a complete record of what ran rather than
              // just whatever happened to be last.
              const toolName = event.name.replace(/_/g, " ");

              activitiesRef.current = [
                ...activitiesRef.current.map((a) =>
                  a.state === "running" ? { ...a, state: "done" as const } : a
                ),
                {
                  id: `${assistantMsgId}-tool-${activitiesRef.current.length}`,
                  label: toolName,
                  state: "running" as const,
                },
              ];

              setThinkingStatus(null);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, activities: activitiesRef.current }
                    : msg
                )
              );
            } else if (event.type === "text") {
              streamContentRef.current += event.content;
              setThinkingStatus(null);

              // Text means every tool has returned; nothing should still spin.
              activitiesRef.current = activitiesRef.current.map((a) =>
                a.state === "running" ? { ...a, state: "done" as const } : a
              );

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: streamContentRef.current,
                        activities: activitiesRef.current,
                      }
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
              settleActivities(assistantMsgId);
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
      // Covers the abort/error paths, where `done` never arrives.
      settleActivities(assistantMsgId);
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
      await confirm({
        title: "Could not delete",
        description:
          "The transaction was not removed. The confirmation is still open, so you can try again.",
        mode: "notice",
      });
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
          transition={drawerSpring}
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-ink text-paper"
        >
          {isOpen ? (
            <X className="h-5 w-5" strokeWidth={2} />
          ) : (
            <>
              <MessageSquareText className="h-5 w-5" strokeWidth={2} />
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-paper bg-pos" />
            </>
          )}
        </motion.button>
      </div>

      {/* Slide-over Drawer Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay — flat scrim, no blur */}
            <motion.div
              variants={scrim}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-ink/25"
            />

            {/* Chat Container Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={drawerSpring}
              className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-full flex-col border-l border-rule bg-paper text-ink sm:w-96"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-rule px-5 py-4">
                <div>
                  <h3 className="display text-lg leading-tight text-ink">AI Assistant</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                    <span className="h-1.5 w-1.5 rounded-full bg-pos" />
                    Active Financial Agent
                  </p>
                </div>
                <IconButton variant="quiet" onClick={() => setIsOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </IconButton>
              </div>

              {/* Message Feed Area */}
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="px-5">
                    <Empty
                      title="Ask anything about your budget"
                      description="I can list transactions, compute monthly expenses, update budgets, or set category limits."
                    />
                    {/* Starter prompts */}
                    <div className="flex flex-col gap-2 pb-6">
                      {starterPrompts.map((prompt) => (
                        <Button
                          key={prompt}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSend(prompt)}
                          className="justify-start text-left"
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-rule">
                    {messages.map((msg) => {
                      const isUser = msg.role === "user";
                      return (
                        <div
                          key={msg.id}
                          className={`px-5 py-4 ${isUser ? "bg-paper-sunken" : ""}`}
                        >
                          <p className="eyebrow mb-1.5 text-ink-faint">
                            {isUser ? "you" : "assistant"}
                          </p>

                          {!isUser && msg.activities && (
                            <ToolTrail activities={msg.activities} />
                          )}

                          <div
                            className={`text-xs leading-relaxed ${
                              isUser
                                ? "whitespace-pre-wrap text-ink"
                                : msg.isError
                                  ? "whitespace-pre-wrap text-neg"
                                  : "text-ink"
                            }`}
                          >
                            {msg.content ? (
                              isUser ? (
                                msg.content
                              ) : (
                                <MessageContent content={msg.content} />
                              )
                            ) : (
                              // Only when there is nothing else to look at. Once
                              // the trail is showing, it already says the agent
                              // is working, and two spinners read as two jobs.
                              !msg.activities?.length && (
                                <div className="flex items-center gap-1.5 text-ink-faint">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Thinking…</span>
                                </div>
                              )
                            )}
                          </div>

                          {/* Delete Confirmation Card Attachment */}
                          {!isUser && msg.confirmRequired && (
                            <ConfirmCard
                              transaction={msg.confirmRequired.transaction}
                              confirmState={msg.confirmState}
                              onApprove={() =>
                                handleApproveDelete(
                                  msg.id,
                                  msg.confirmRequired!.transaction.id
                                )
                              }
                              onCancel={() => handleCancelDelete(msg.id)}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Thinking status line */}
                    {thinkingStatus && (
                      <div className="flex items-center gap-2 px-5 py-3 text-xs text-ink-faint">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="italic">{thinkingStatus}</span>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input Footer Form */}
              <div className="border-t border-rule px-5 py-4">
                <ChatInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={() => handleSend(inputValue)}
                  disabled={loading}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {dialog}
    </>
  );
}
