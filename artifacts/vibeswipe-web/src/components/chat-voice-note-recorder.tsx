import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MAX_VOICE_NOTE_BYTES, getGetMatchesQueryKey, getGetMessagesQueryKey,
  useRequestChatMediaUpload, useSendMessage, type MediaUploadInputContentType, type Message,
} from "@workspace/api-client-react";
import { VoiceNoteRecorder } from "./voice-note-recorder";

export function ChatVoiceNoteRecorder({ matchId, disabled, onActiveChange }: {
  matchId: string; disabled: boolean; onActiveChange: (active: boolean) => void;
}) {
  const requestUpload = useRequestChatMediaUpload();
  const send = useSendMessage();
  const cache = useQueryClient();
  const uploaded = useRef<{ file: File; reference: string } | null>(null);
  async function sendVoice(file: File, duration: number) {
    if (!file.size || file.size > MAX_VOICE_NOTE_BYTES) throw new Error("Voice notes have no time cutoff, but files must be smaller than 500 MB.");
    let reference = uploaded.current?.file === file ? uploaded.current.reference : undefined;
    if (!reference) {
      const contentType: MediaUploadInputContentType = file.type === "audio/wav" ? "audio/wav" : "audio/mp4";
      const result = await requestUpload.mutateAsync({ matchId, data: { name: file.name, size: file.size, contentType, mediaType: "audio" } });
      const response = await fetch(result.uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!response.ok) throw new Error("The voice note upload failed. Your recording is kept here—tap Retry.");
      reference = result.mediaReference;
      uploaded.current = { file, reference };
    }
    const message = await send.mutateAsync({ matchId, data: { mediaReference: reference, mediaType: "audio", mediaDuration: duration } });
    cache.setQueryData<Message[]>(getGetMessagesQueryKey(matchId), previous => previous?.some(item => item.id === message.id) ? previous : [message, ...(previous ?? [])]);
    void cache.invalidateQueries({ queryKey: getGetMessagesQueryKey(matchId) });
    void cache.invalidateQueries({ queryKey: getGetMatchesQueryKey() });
    uploaded.current = null;
  }
  return <VoiceNoteRecorder disabled={disabled} onSend={sendVoice} onActiveChange={active => {
    if (!active) uploaded.current = null;
    onActiveChange(active);
  }}/>;
}
