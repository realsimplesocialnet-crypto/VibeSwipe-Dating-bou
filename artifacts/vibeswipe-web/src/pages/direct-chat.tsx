import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDirectChatMessagesQueryKey, getGetDirectChatsQueryKey,
  useGetDirectChatMessages, useGetDirectChats, useGetMyProfile,
  useMarkDirectChatRead, useSendDirectChatMessage,
} from "@workspace/api-client-react";
import { ArrowLeft, LoaderCircle, SendHorizontal } from "lucide-react";
import { chatViewportFrame } from "@/lib/chat-viewport";

export default function DirectChatPage() {
  const { conversationId = "" } = useParams<{ conversationId: string }>();
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const me = useGetMyProfile();
  const conversations = useGetDirectChats({ query: { queryKey: getGetDirectChatsQueryKey(), refetchInterval: 5000 } });
  const conversation = conversations.data?.find((item) => item.id === conversationId);
  const params = { conversationId, limit: 50 };
  const key = getGetDirectChatMessagesQueryKey(params);
  const messages = useGetDirectChatMessages(params, { query: { queryKey: key, enabled: Boolean(conversationId), refetchInterval: 5000 } });
  const markRead = useMarkDirectChatRead();
  const send = useSendDirectChatMessage();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const messageList = useRef<HTMLDivElement>(null);
  const chatSurfaceRef = useRef<HTMLElement>(null);
  const stickToLatest = useRef(true);
  const initialChatViewport = useRef(chatViewportFrame(
    window.visualViewport?.height ?? window.innerHeight,
    window.visualViewport?.offsetTop ?? 0,
    window.innerHeight,
    false,
  )).current;
  const fullChatHeight = useRef(window.visualViewport?.height ?? window.innerHeight);
  const sending = send.isPending;

  useEffect(() => {
    const viewport = window.visualViewport;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    let measureFrame = 0;
    const measure = () => {
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement
        && (focused.tagName === "TEXTAREA" || focused.tagName === "INPUT" || focused.isContentEditable);
      const height = viewport?.height ?? window.innerHeight;
      const frame = chatViewportFrame(height, viewport?.offsetTop ?? 0, Math.max(fullChatHeight.current, window.innerHeight), editing);
      if (!editing) fullChatHeight.current = height;
      const surface = chatSurfaceRef.current;
      if (surface) {
        surface.style.top = `calc(${frame.top}px + var(--install-banner-height, 0px))`;
        surface.style.height = `calc(${frame.height}px - var(--install-banner-height, 0px))`;
        surface.dataset.keyboardOpen = String(frame.keyboardOpen);
        const composer = surface.querySelector<HTMLElement>('[data-testid="direct-chat-composer"]');
        if (composer) composer.style.paddingBottom = frame.keyboardOpen ? "0px" : "max(env(safe-area-inset-bottom), 8px)";
      }
    };
    const queueMeasure = () => {
      if (measureFrame) return;
      measureFrame = window.requestAnimationFrame(() => {
        measureFrame = 0;
        measure();
      });
    };
    queueMeasure();
    viewport?.addEventListener("resize", queueMeasure);
    viewport?.addEventListener("scroll", queueMeasure);
    window.addEventListener("resize", queueMeasure);
    document.addEventListener("focusin", queueMeasure);
    document.addEventListener("focusout", queueMeasure);
    return () => {
      if (measureFrame) window.cancelAnimationFrame(measureFrame);
      viewport?.removeEventListener("resize", queueMeasure);
      viewport?.removeEventListener("scroll", queueMeasure);
      window.removeEventListener("resize", queueMeasure);
      document.removeEventListener("focusin", queueMeasure);
      document.removeEventListener("focusout", queueMeasure);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (!conversationId || !messages.data) return;
    void markRead.mutateAsync({ conversationId }).then(() => {
      void client.invalidateQueries({ queryKey: getGetDirectChatsQueryKey() });
    }).catch(() => undefined);
  }, [conversationId, messages.dataUpdatedAt]);
  useLayoutEffect(() => {
    if (stickToLatest.current && messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight;
  }, [messages.data?.items.length]);
  function handleMessagesScroll() {
    const list = messageList.current;
    if (!list) return;
    stickToLatest.current = list.scrollHeight - list.clientHeight - list.scrollTop < 80;
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sending || !conversationId) return;
    setError("");
    try {
      await send.mutateAsync({ data: { conversationId, content } });
      setDraft("");
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: getGetDirectChatsQueryKey() }),
      ]);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      setError(message || "Message didn’t send. Check your connection and try again.");
    }
  }

  return <main ref={chatSurfaceRef} className="fixed inset-x-0 z-40 flex min-h-0 w-full flex-col overflow-hidden bg-background text-foreground" style={{ top: `calc(${initialChatViewport.top}px + var(--install-banner-height, 0px))`, height: `calc(${initialChatViewport.height}px - var(--install-banner-height, 0px))` }} data-testid="page-direct-chat">
    <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 pt-[max(env(safe-area-inset-top),12px)] pb-3">
      <button type="button" onClick={() => setLocation("/messages")} aria-label="Back to chats" className="flex h-10 w-10 items-center justify-center rounded-full text-primary"><ArrowLeft size={21}/></button>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-bold text-primary">{conversation?.profile.name?.slice(0,1) ?? "?"}</span>
      <div className="min-w-0 flex-1"><h1 className="truncate text-[15px] font-bold">{conversation?.profile.name ?? "Conversation"}</h1><p className="text-xs text-muted-foreground">Direct message</p></div>
    </header>
    {messages.isError ? <div className="m-4 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">Messages could not load. <button type="button" onClick={()=>void messages.refetch()} className="font-bold underline">Try again</button></div> : null}
    <div ref={messageList} onScroll={handleMessagesScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4" data-testid="direct-chat-messages">
      {messages.isLoading ? <LoaderCircle className="mx-auto mt-8 animate-spin text-primary"/> : !messages.data?.items.length ? <p className="m-auto text-center text-sm text-muted-foreground">Start the conversation with a message.</p> : messages.data.items.map((message) => {
        const own = message.senderId === me.data?.id;
        return <div key={message.id} className={`mb-2 max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${own ? "ml-auto rounded-br-md bg-primary text-primary-foreground" : "mr-auto rounded-bl-md bg-card"}`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <time className={`mt-1 block text-right text-[10px] ${own ? "text-primary-foreground/70" : "text-muted-foreground"}`} dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{own && message.readAt ? " · Seen" : ""}</time>
        </div>;
      })}
    </div>
    {error && <p role="alert" className="px-4 pb-1 text-xs text-destructive">{error}</p>}
    <form data-testid="direct-chat-composer" onSubmit={(event)=>void submit(event)} className="flex shrink-0 items-end gap-2 border-t border-border bg-background px-3 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
      <textarea value={draft} onChange={(event)=>setDraft(event.target.value)} maxLength={2000} rows={1} placeholder="Message" aria-label="Message" data-testid="input-direct-message" className="max-h-28 min-h-11 flex-1 resize-none rounded-full border border-border bg-card px-4 py-3 text-[16px] leading-5 outline-none focus:border-primary"/>
      <button type="submit" disabled={!draft.trim()||sending} aria-label="Send message" data-testid="button-send-direct-message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">{sending?<LoaderCircle size={18} className="animate-spin"/>:<SendHorizontal size={19}/>}</button>
    </form>
    {!conversation && conversations.isError && <p className="sr-only">Could not load conversation details.</p>}
  </main>;
}
