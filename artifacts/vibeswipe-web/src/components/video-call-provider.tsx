import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import {
  getGetMatchesQueryKey,
  useGetMatches,
} from "@workspace/api-client-react";
import { io, type Socket } from "socket.io-client";
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff } from "lucide-react";

type CallRole = "caller" | "callee";
type CallStatus = "incoming" | "calling" | "connecting" | "connected" | "error";
type CallState = {
  matchId: string;
  role: CallRole;
  status: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  microphoneMuted: boolean;
  cameraDisabled: boolean;
  error?: string;
};
type AckResult = { ok: boolean; error?: string };
type CallContextValue = { startCall: (matchId: string) => Promise<void> };

const CallContext = createContext<CallContextValue | null>(null);
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function emitAck(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<AckResult> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(
      () => resolve({ ok: false, error: "The call server did not respond." }),
      10_000,
    );
    socket.emit(event, payload, (result: AckResult) => {
      window.clearTimeout(timeout);
      resolve(result);
    });
  });
}

export function useVideoCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) throw new Error("useVideoCall must be used inside VideoCallProvider");
  return context;
}

export function VideoCallProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const matches = useGetMatches({
    query: {
      enabled: Boolean(isLoaded && isSignedIn),
      queryKey: getGetMatchesQueryKey(),
      staleTime: 20_000,
    },
  });
  const [call, setCall] = useState<CallState | null>(null);
  const callRef = useRef<CallState | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

  const updateCall = useCallback(
    (next: CallState | null | ((current: CallState | null) => CallState | null)) => {
      setCall((current) => {
        const updated = typeof next === "function" ? next(current) : next;
        callRef.current = updated;
        return updated;
      });
    },
    [],
  );
  const hasCallForMatch = useCallback(
    (matchId: string) => callRef.current?.matchId === matchId,
    [],
  );

  const releaseMedia = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    for (const track of remoteStreamRef.current?.getTracks() ?? []) track.stop();
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingIceRef.current = [];
  }, []);

  const closeCall = useCallback(() => {
    releaseMedia();
    updateCall(null);
  }, [releaseMedia, updateCall]);

  const failCall = useCallback(
    (matchId: string, error: string) => {
      socketRef.current?.emit("call:end", { matchId });
      releaseMedia();
      updateCall((current) =>
        current?.matchId === matchId
          ? {
              ...current,
              status: "error",
              localStream: null,
              remoteStream: null,
              error,
            }
          : current,
      );
    },
    [releaseMedia, updateCall],
  );

  const createPeer = useCallback(
    (matchId: string): RTCPeerConnection => {
      const localStream = localStreamRef.current;
      const socket = socketRef.current;
      if (!localStream || !socket) throw new Error("Camera and microphone are not ready.");

      const peer = new RTCPeerConnection({ iceServers: iceServersRef.current });
      peerRef.current = peer;
      for (const track of localStream.getTracks()) peer.addTrack(track, localStream);

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("call:ice", { matchId, candidate: event.candidate.toJSON() });
        }
      };
      peer.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        remoteStreamRef.current = stream;
        updateCall((current) =>
          current?.matchId === matchId
            ? { ...current, remoteStream: stream, status: "connected" }
            : current,
        );
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          updateCall((current) =>
            current?.matchId === matchId ? { ...current, status: "connected" } : current,
          );
        } else if (peer.connectionState === "failed" || peer.connectionState === "closed") {
          if (peer.connectionState === "failed") {
            failCall(matchId, "The video connection was interrupted. End the call and try again.");
          }
        }
      };
      return peer;
    },
    [failCall, updateCall],
  );

  const startCall = useCallback(
    async (matchId: string) => {
      if (callRef.current) return;
      const socket = socketRef.current;
      if (!socket?.connected) {
        updateCall({
          matchId,
          role: "caller",
          status: "error",
          localStream: null,
          remoteStream: null,
          microphoneMuted: false,
          cameraDisabled: false,
          error: "Connect to the internet and try the call again.",
        });
        return;
      }

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser cannot access a camera and microphone.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        });
        localStreamRef.current = stream;
        updateCall({
          matchId,
          role: "caller",
          status: "calling",
          localStream: stream,
          remoteStream: null,
          microphoneMuted: false,
          cameraDisabled: false,
        });

        const result = await emitAck(socket, "call:start", { matchId });
        if (!hasCallForMatch(matchId)) {
          if (result.ok) socket.emit("call:end", { matchId });
          return;
        }
        if (!result.ok) {
          releaseMedia();
          updateCall({
            matchId,
            role: "caller",
            status: "error",
            localStream: null,
            remoteStream: null,
            microphoneMuted: false,
            cameraDisabled: false,
            error: result.error ?? "The call could not be started.",
          });
        }
      } catch (error) {
        releaseMedia();
        updateCall({
          matchId,
          role: "caller",
          status: "error",
          localStream: null,
          remoteStream: null,
          microphoneMuted: false,
          cameraDisabled: false,
          error:
            error instanceof DOMException && error.name === "NotAllowedError"
              ? "Allow camera and microphone access to make a video call."
              : error instanceof Error
                ? error.message
                : "The call could not be started.",
        });
      }
    },
    [hasCallForMatch, releaseMedia, updateCall],
  );

  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    const socket = socketRef.current;
    if (!current || current.role !== "callee" || current.status !== "incoming" || !socket?.connected) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser cannot access a camera and microphone.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
      });
      localStreamRef.current = stream;
      updateCall({ ...current, status: "connecting", localStream: stream });
      createPeer(current.matchId);

      const accepted = await emitAck(socket, "call:accept", { matchId: current.matchId });
      if (!hasCallForMatch(current.matchId)) {
        if (accepted.ok) socket.emit("call:end", { matchId: current.matchId });
        return;
      }
      if (!accepted.ok) {
        failCall(current.matchId, accepted.error ?? "This call is no longer available.");
        return;
      }
      const ready = await emitAck(socket, "call:ready", { matchId: current.matchId });
      if (!ready.ok) failCall(current.matchId, ready.error ?? "The call could not connect.");
    } catch (error) {
      socket.emit("call:decline", { matchId: current.matchId });
      failCall(
        current.matchId,
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Allow camera and microphone access to answer the call."
          : error instanceof Error
            ? error.message
            : "The call could not be answered.",
      );
    }
  }, [createPeer, failCall, hasCallForMatch, updateCall]);

  const declineCall = useCallback(() => {
    const current = callRef.current;
    if (current?.role === "callee" && current.status === "incoming") {
      socketRef.current?.emit("call:decline", { matchId: current.matchId });
    }
    closeCall();
  }, [closeCall]);

  const endCall = useCallback(() => {
    const current = callRef.current;
    if (current) socketRef.current?.emit("call:end", { matchId: current.matchId });
    closeCall();
  }, [closeCall]);

  const toggleMicrophone = useCallback(() => {
    const current = callRef.current;
    const stream = localStreamRef.current;
    if (!current || !stream) return;
    const microphoneMuted = !current.microphoneMuted;
    for (const track of stream.getAudioTracks()) track.enabled = !microphoneMuted;
    updateCall({ ...current, microphoneMuted });
  }, [updateCall]);

  const toggleCamera = useCallback(() => {
    const current = callRef.current;
    const stream = localStreamRef.current;
    if (!current || !stream) return;
    const cameraDisabled = !current.cameraDisabled;
    for (const track of stream.getVideoTracks()) track.enabled = !cameraDisabled;
    updateCall({ ...current, cameraDisabled });
  }, [updateCall]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      closeCall();
      return;
    }

    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      auth: (callback) => {
        void getToken()
          .then((token) => callback({ token: token ?? "" }))
          .catch(() => callback({ token: "" }));
      },
      reconnection: true,
      timeout: 12_000,
    });
    socketRef.current = socket;

    socket.on("call:config", (config: { iceServers?: RTCIceServer[] }) => {
      if (Array.isArray(config?.iceServers) && config.iceServers.length) {
        iceServersRef.current = config.iceServers;
      }
    });
    socket.on("call:incoming", ({ matchId }: { matchId: string }) => {
      if (!callRef.current) {
        updateCall({
          matchId,
          role: "callee",
          status: "incoming",
          localStream: null,
          remoteStream: null,
          microphoneMuted: false,
          cameraDisabled: false,
        });
      }
    });
    socket.on("call:accepted", ({ matchId }: { matchId: string }) => {
      updateCall((current) =>
        current?.matchId === matchId && current.role === "caller"
          ? { ...current, status: "connecting" }
          : current,
      );
    });
    socket.on("call:ready", async ({ matchId }: { matchId: string }) => {
      const current = callRef.current;
      if (!current || current.matchId !== matchId || current.role !== "caller") return;
      try {
        const peer = createPeer(matchId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const result = await emitAck(socket, "call:offer", {
          matchId,
          description: { type: "offer", sdp: offer.sdp ?? "" },
        });
        if (!result.ok) failCall(matchId, result.error ?? "The call could not connect.");
      } catch {
        failCall(matchId, "The call could not connect. End it and try again.");
      }
    });
    socket.on("call:offer", async ({ matchId, description }: { matchId: string; description: RTCSessionDescriptionInit }) => {
      const current = callRef.current;
      const peer = peerRef.current;
      if (!current || current.matchId !== matchId || current.role !== "callee" || !peer) return;
      try {
        await peer.setRemoteDescription(description);
        for (const candidate of pendingIceRef.current.splice(0)) {
          await peer.addIceCandidate(candidate);
        }
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        const result = await emitAck(socket, "call:answer", {
          matchId,
          description: { type: "answer", sdp: answer.sdp ?? "" },
        });
        if (!result.ok) failCall(matchId, result.error ?? "The call could not connect.");
      } catch {
        failCall(matchId, "The call could not connect. End it and try again.");
      }
    });
    socket.on("call:answer", async ({ matchId, description }: { matchId: string; description: RTCSessionDescriptionInit }) => {
      const current = callRef.current;
      const peer = peerRef.current;
      if (!current || current.matchId !== matchId || current.role !== "caller" || !peer) return;
      try {
        await peer.setRemoteDescription(description);
        for (const candidate of pendingIceRef.current.splice(0)) {
          await peer.addIceCandidate(candidate);
        }
      } catch {
        failCall(matchId, "The call could not connect. End it and try again.");
      }
    });
    socket.on("call:ice", async ({ matchId, candidate }: { matchId: string; candidate: RTCIceCandidateInit }) => {
      const current = callRef.current;
      const peer = peerRef.current;
      if (!current || current.matchId !== matchId || !peer) return;
      if (!peer.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // Ignore a stale candidate; the call can recover using later candidates.
      }
    });
    socket.on("call:ended", ({ matchId }: { matchId: string }) => {
      if (callRef.current?.matchId === matchId) closeCall();
    });
    socket.on("disconnect", () => {
      const current = callRef.current;
      if (current && current.status !== "incoming" && current.status !== "error") {
        failCall(current.matchId, "The call connection was lost. Please call again.");
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      closeCall();
    };
  }, [
    closeCall,
    createPeer,
    failCall,
    getToken,
    isLoaded,
    isSignedIn,
    updateCall,
  ]);

  useEffect(() => {
    if (!call || call.status === "incoming" || call.status === "error") return;
    const heartbeat = window.setInterval(() => {
      socketRef.current?.emit("call:heartbeat", { matchId: call.matchId });
    }, 8_000);
    return () => window.clearInterval(heartbeat);
  }, [call?.matchId, call?.status]);

  const remoteName =
    matches.data?.find((item) => item.id === call?.matchId)?.profile.name ?? "Your match";

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}
      {call ? (
        <VideoCallOverlay
          call={call}
          name={remoteName}
          onAccept={() => void acceptCall()}
          onDecline={declineCall}
          onEnd={endCall}
          onToggleMicrophone={toggleMicrophone}
          onToggleCamera={toggleCamera}
        />
      ) : null}
    </CallContext.Provider>
  );
}

function VideoCallOverlay({
  call,
  name,
  onAccept,
  onDecline,
  onEnd,
  onToggleMicrophone,
  onToggleCamera,
}: {
  call: CallState;
  name: string;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
}) {
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideo.current) {
      localVideo.current.srcObject = call.localStream;
      if (call.localStream) void localVideo.current.play().catch(() => undefined);
    }
  }, [call.localStream]);
  useEffect(() => {
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = call.remoteStream;
      if (call.remoteStream) void remoteVideo.current.play().catch(() => undefined);
    }
  }, [call.remoteStream]);

  const message =
    call.error ??
    (call.status === "incoming"
      ? `${name} is calling`
      : call.status === "calling"
        ? `Calling ${name}…`
        : call.status === "connected"
          ? name
          : "Connecting…");

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-[#0b0b0f] text-white"
      data-testid="video-call-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Video call with ${name}`}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#15131a]">
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={`${name}'s video`}
          data-testid="video-call-remote-feed"
        />
        {!call.remoteStream ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-3xl font-semibold">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <p className="text-lg font-semibold">{message}</p>
            {!call.error && <p className="text-sm text-white/65">Your camera stays private until the other person answers.</p>}
          </div>
        ) : null}
        {call.localStream ? (
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            className="absolute right-4 top-4 aspect-[3/4] w-[min(28vw,150px)] rounded-2xl border border-white/40 bg-black object-cover shadow-xl"
            aria-label="Your video preview"
            data-testid="video-call-local-feed"
          />
        ) : null}
        <button type="button" onClick={onDecline} className="absolute left-4 top-4 rounded-full bg-black/45 p-3" aria-label="Close call window" data-testid="button-call-close">
          <PhoneOff size={18} />
        </button>
        <p className="absolute bottom-5 left-5 max-w-[70%] truncate text-lg font-semibold drop-shadow">{message}</p>
      </div>
      <div className="flex min-h-[104px] items-center justify-center gap-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
        {call.status === "incoming" ? (
          <>
            <button type="button" onClick={onDecline} className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600" aria-label="Decline video call" data-testid="button-call-decline">
              <PhoneOff size={22} />
            </button>
            <button type="button" onClick={onAccept} className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500" aria-label="Answer video call" data-testid="button-call-accept">
              <Phone size={22} />
            </button>
          </>
        ) : call.status === "error" ? (
          <>
            <p role="alert" className="max-w-sm text-center text-sm text-white/80">{call.error}</p>
            <button type="button" onClick={onEnd} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rose-600" aria-label="Close call" data-testid="button-call-end">
              <PhoneOff size={22} />
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onToggleMicrophone} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15" aria-label={call.microphoneMuted ? "Unmute microphone" : "Mute microphone"} data-testid="button-call-microphone">
              {call.microphoneMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button type="button" onClick={onEnd} className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600" aria-label="End video call" data-testid="button-call-end">
              <PhoneOff size={22} />
            </button>
            <button type="button" onClick={onToggleCamera} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15" aria-label={call.cameraDisabled ? "Turn camera on" : "Turn camera off"} data-testid="button-call-camera">
              {call.cameraDisabled ? <CameraOff size={20} /> : <Camera size={20} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
