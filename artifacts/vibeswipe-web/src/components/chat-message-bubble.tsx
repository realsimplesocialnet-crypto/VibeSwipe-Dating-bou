import type { ReactNode } from "react";
import { Check, CheckCheck, ChevronDown, Clock3 } from "lucide-react";
import type { Message } from "@workspace/api-client-react";
import { ChatMediaMessage, useMediaThumbnail } from "./chat-media-message";
import { ChatAudioMessage } from "./chat-audio-message";

export const STORY_REPLY_PREFIX = "Replied to your story: ";

/** Splits legacy and verified story replies into context + the actual reply text. */
export function storyReplyParts(message: Pick<Message, "content" | "storyReply">): { isStoryReply: boolean; text: string } {
  const prefixed = message.content.startsWith(STORY_REPLY_PREFIX);
  if (!message.storyReply && !prefixed) return { isStoryReply: false, text: message.content };
  return { isStoryReply: true, text: prefixed ? message.content.slice(STORY_REPLY_PREFIX.length) : message.content };
}

function StoryQuote({ message, mine, myId, partnerName }: { message: Message; mine: boolean; myId?: string; partnerName: string }) {
  const story = message.storyReply;
  const visual = story?.available && story.mediaReference ? story.mediaReference : null;
  const thumb = useMediaThumbnail(visual, !!visual);
  const ownStory = story ? story.storyOwnerId === myId : !mine;
  const title = mine ? (ownStory ? "You replied to your story" : `You replied to ${partnerName}’s story`) : (ownStory ? "Replied to your story" : `Replied to ${partnerName}’s story`);
  return <div className={`mb-1 flex min-w-[170px] items-stretch gap-2 overflow-hidden rounded-[8px] border-l-[3px] ${mine ? "border-white/80 bg-black/15" : "border-[var(--chat-accent)] bg-[hsl(var(--chat-soft))]"}`} data-testid={`story-reply-quote-${message.id}`}>
    <span className="min-w-0 flex-1 py-1.5 pl-2">
      <span className={`block truncate text-[12px] font-bold ${mine ? "text-white" : "text-[var(--chat-accent)]"}`}>{title}</span>
      <span className="block truncate text-[12px] opacity-75">{story?.available ? (story.mediaType === "video" ? "Video story" : story.mediaType === "image" ? "Photo story" : "Text story") : "Story no longer available"}</span>
    </span>
    {story?.available && (visual
      ? <span className="h-12 w-9 shrink-0 bg-black/20">{thumb.url && <img src={thumb.url} alt="Story preview" className="h-full w-full object-cover"/>}</span>
      : <span className="h-12 w-9 shrink-0" style={{ background: story.backgroundColor ?? "#614777" }}/>)}
  </div>;
}

export function ChatMessageBubble({ message, mine, myId, partnerName, groupedWithPrevious, avatar, mediaUrl, renderText, onActions }: {
  message: Message;
  mine: boolean;
  myId?: string;
  partnerName: string;
  groupedWithPrevious: boolean;
  avatar: ReactNode;
  mediaUrl: (reference: string) => string;
  renderText: (text: string) => ReactNode;
  onActions: () => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const visual = !message.deletedForEveryone && (message.mediaType === "image" || message.mediaType === "video") && !!message.mediaReference;
  const audio = !message.deletedForEveryone && message.mediaType === "audio" && !!message.mediaReference;
  const { isStoryReply, text } = storyReplyParts(message);
  const meta = <span className={`inline-flex items-center gap-0.5 whitespace-nowrap text-[10.5px] leading-none ${visual && !text ? "rounded-full bg-black/45 px-1.5 py-1 text-white" : "opacity-70"}`}>
    {time}
    {mine && (message.id.startsWith("pending-") ? <Clock3 size={12}/> : message.isRead ? <CheckCheck size={14} aria-label="Read"/> : <Check size={14} aria-label="Sent"/>)}
  </span>;
  const shell = mine
    ? "bg-[var(--chat-accent)] text-white"
    : "bg-[hsl(var(--chat-card))] text-[hsl(var(--chat-fg))] shadow-[0_1px_1.5px_hsl(330_25%_30%/.13)]";
  const corner = groupedWithPrevious ? "" : mine ? "rounded-tr-[4px]" : "rounded-tl-[4px]";
  return <div className={`group flex ${mine ? "justify-end" : "justify-start"} ${groupedWithPrevious ? "mt-[3px]" : "mt-2"}`} data-testid={`message-${message.id}`}
    onContextMenu={event => { event.preventDefault(); onActions(); }}>
    <div className={`relative max-w-[82%] rounded-[12px] ${corner} ${shell} ${visual || audio ? "p-1" : "px-2.5 py-[5px]"} text-[15px] leading-[1.34] md:max-w-[62%]`}>
      {message.deletedForEveryone
        ? <span className="italic opacity-70">This message was deleted.<span className="ml-2 inline-block align-baseline">{meta}</span></span>
        : <>
          {isStoryReply && <StoryQuote message={message} mine={mine} myId={myId} partnerName={partnerName}/>}
          {visual && <div className="relative">
            <ChatMediaMessage reference={message.mediaReference!} fullUrl={mediaUrl(message.mediaReference!)} type={message.mediaType as "image" | "video"}/>
            {!text && <span className="pointer-events-none absolute bottom-1.5 right-1.5">{meta}</span>}
          </div>}
          {audio && <div className="px-1">
            <ChatAudioMessage url={mediaUrl(message.mediaReference!)} duration={message.mediaDuration} avatar={avatar} mine={mine}/>
            {!text && <div className="-mt-1 flex justify-end pr-0.5">{meta}</div>}
          </div>}
          {text && <div className={`whitespace-pre-wrap break-words ${visual || audio ? "px-1.5 pb-0.5 pt-1" : ""}`}>
            {renderText(text)}
            <span className="float-right ml-2 mt-[7px] select-none">{meta}</span>
          </div>}
        </>}
      <button type="button" onClick={onActions} aria-label="Message options" data-testid={`button-delete-message-${message.id}`}
        className={`absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full group-hover:flex focus-visible:flex ${mine ? "bg-[var(--chat-accent)] text-white" : "bg-[hsl(var(--chat-card))]"}`}><ChevronDown size={16}/></button>
    </div>
  </div>;
}
