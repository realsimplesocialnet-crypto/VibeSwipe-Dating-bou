import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/expo";
import {
  getGetMatchesQueryKey,
  useGetMatches,
} from "@workspace/api-client-react";
import { io, type Socket } from "socket.io-client";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CallRole = "caller" | "callee";
type CallStatus = "incoming" | "calling" | "connecting" | "connected" | "error";
type NativeRtcModule = typeof import("react-native-webrtc");
type NativeStream = Awaited<
  ReturnType<NativeRtcModule["mediaDevices"]["getUserMedia"]>
>;
type CallState = {
  matchId: string;
  role: CallRole;
  status: CallStatus;
  localStream: NativeStream | null;
  remoteStream: NativeStream | null;
  microphoneMuted: boolean;
  cameraDisabled: boolean;
  error?: string;
};
type AckResult = { ok: boolean; error?: string };
type CallContextValue = { startCall: (matchId: string) => Promise<void> };

const CallContext = createContext<CallContextValue | null>(null);
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function emitAck(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<AckResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(
      () => resolve({ ok: false, error: "The call server did not respond." }),
      10_000,
    );
    socket.emit(event, payload, (result: AckResult) => {
      clearTimeout(timeout);
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
  const insets = useSafeAreaInsets();
  const matches = useGetMatches({
    query: {
      enabled: Boolean(isLoaded && isSignedIn),
      queryKey: getGetMatchesQueryKey(),
      staleTime: 20_000,
    },
  });
  const [call, setCall] = useState<CallState | null>(null);
  const [NativeVideoView, setNativeVideoView] =
    useState<ComponentType<Record<string, unknown>> | null>(null);
  const callRef = useRef<CallState | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<InstanceType<NativeRtcModule["RTCPeerConnection"]> | null>(null);
  const rtcModuleRef = useRef<NativeRtcModule | null>(null);
  const localStreamRef = useRef<NativeStream | null>(null);
  const remoteStreamRef = useRef<NativeStream | null>(null);
  const pendingIceRef = useRef<unknown[]>([]);
  const iceServersRef = useRef(DEFAULT_ICE_SERVERS);

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

  const loadNativeRtc = useCallback(async () => {
    try {
      if (!rtcModuleRef.current) {
        rtcModuleRef.current = await import("react-native-webrtc");
        setNativeVideoView(() => rtcModuleRef.current!.RTCView as ComponentType<Record<string, unknown>>);
      }
      return rtcModuleRef.current;
    } catch {
      throw new Error(
        "Video calling needs the updated Myage app. Install the latest native build to call.",
      );
    }
  }, []);

  const createPeer = useCallback(
    async (matchId: string) => {
      const rtc = await loadNativeRtc();
      const localStream = localStreamRef.current;
      const socket = socketRef.current;
      if (!localStream || !socket) throw new Error("Camera and microphone are not ready.");

      const peer = new rtc.RTCPeerConnection({ iceServers: iceServersRef.current });
      peerRef.current = peer;
      for (const track of localStream.getTracks()) peer.addTrack(track, localStream);
      peer.onicecandidate = (event: any) => {
        const candidate = event.candidate;
        if (!candidate) return;
        socket.emit("call:ice", {
          matchId,
          candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            usernameFragment: candidate.usernameFragment,
          },
        });
      };
      peer.ontrack = (event: any) => {
        const stream = event.streams?.[0];
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
        } else if (peer.connectionState === "failed") {
          failCall(matchId, "The video connection was interrupted. End the call and try again.");
        }
      };
      return { peer, rtc };
    },
    [failCall, loadNativeRtc, updateCall],
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
        const rtc = await loadNativeRtc();
        const stream = await rtc.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: "user", width: 720, height: 1280 },
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
            error instanceof Error &&
            error.message.includes("updated Myage app")
              ? error.message
              : "Allow camera and microphone access to make a video call.",
        });
      }
    },
    [hasCallForMatch, loadNativeRtc, releaseMedia, updateCall],
  );

  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    const socket = socketRef.current;
    if (!current || current.role !== "callee" || current.status !== "incoming" || !socket?.connected) return;
    try {
      const rtc = await loadNativeRtc();
      const stream = await rtc.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user", width: 720, height: 1280 },
      });
      localStreamRef.current = stream;
      updateCall({ ...current, status: "connecting", localStream: stream });
      await createPeer(current.matchId);
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
        error instanceof Error && error.message.includes("updated Myage app")
          ? error.message
          : "Allow camera and microphone access to answer the call.",
      );
    }
  }, [createPeer, failCall, hasCallForMatch, loadNativeRtc, updateCall]);

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
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const socket = io(domain ? `https://${domain}` : undefined, {
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

    socket.on("call:config", (config: { iceServers?: typeof DEFAULT_ICE_SERVERS }) => {
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
    socket.on("call:answered_elsewhere", ({ matchId }: { matchId: string }) => {
      const current = callRef.current;
      if (current?.matchId === matchId && current.role === "callee" && current.status === "incoming") {
        closeCall();
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
        const { peer } = await createPeer(matchId);
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
    socket.on("call:offer", async ({ matchId, description }: { matchId: string; description: unknown }) => {
      const current = callRef.current;
      const peer = peerRef.current;
      if (!current || current.matchId !== matchId || current.role !== "callee" || !peer) return;
      try {
        const rtc = await loadNativeRtc();
        await peer.setRemoteDescription(new rtc.RTCSessionDescription(description as never));
        for (const candidate of pendingIceRef.current.splice(0)) {
          await peer.addIceCandidate(new rtc.RTCIceCandidate(candidate as never));
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
    socket.on("call:answer", async ({ matchId, description }: { matchId: string; description: unknown }) => {
      const current = callRef.current;
      const peer = peerRef.current;
      if (!current || current.matchId !== matchId || current.role !== "caller" || !peer) return;
      try {
        const rtc = await loadNativeRtc();
        await peer.setRemoteDescription(new rtc.RTCSessionDescription(description as never));
        for (const candidate of pendingIceRef.current.splice(0)) {
          await peer.addIceCandidate(new rtc.RTCIceCandidate(candidate as never));
        }
      } catch {
        failCall(matchId, "The call could not connect. End it and try again.");
      }
    });
    socket.on("call:ice", async ({ matchId, candidate }: { matchId: string; candidate: unknown }) => {
      const current = callRef.current;
      const peer = peerRef.current;
      if (!current || current.matchId !== matchId || !peer) return;
      if (!peer.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }
      try {
        const rtc = await loadNativeRtc();
        await peer.addIceCandidate(new rtc.RTCIceCandidate(candidate as never));
      } catch {
        // Ignore a stale candidate; later ICE candidates can still connect.
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
    loadNativeRtc,
    updateCall,
  ]);

  useEffect(() => {
    if (!call || call.status === "incoming" || call.status === "error") return;
    const heartbeat = setInterval(() => {
      socketRef.current?.emit("call:heartbeat", { matchId: call.matchId });
    }, 8_000);
    return () => clearInterval(heartbeat);
  }, [call?.matchId, call?.status]);

  const remoteName =
    matches.data?.find((item) => item.id === call?.matchId)?.profile.name ?? "Your match";
  const remoteUrl = call?.remoteStream?.toURL();
  const localUrl = call?.localStream?.toURL();
  const statusText =
    call?.error ??
    (call?.status === "incoming"
      ? `${remoteName} is calling`
      : call?.status === "calling"
        ? `Calling ${remoteName}…`
        : call?.status === "connected"
          ? remoteName
          : "Connecting…");

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}
      {call ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={call.status === "incoming" ? declineCall : endCall}
        >
          <View style={[styles.callScreen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]} testID="video-call-overlay">
            <View style={styles.remoteVideo}>
              {NativeVideoView && remoteUrl ? (
                <NativeVideoView
                  streamURL={remoteUrl}
                  style={StyleSheet.absoluteFill}
                  objectFit="cover"
                />
              ) : (
                <View style={styles.callPlaceholder}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{remoteName.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  {call.status !== "error" && call.status !== "incoming" ? <ActivityIndicator color="#fff" /> : null}
                  <Text style={styles.callStatus} accessibilityLiveRegion="polite">{statusText}</Text>
                </View>
              )}
              {NativeVideoView && localUrl ? (
                <View style={styles.localVideo}>
                  <NativeVideoView
                    streamURL={localUrl}
                    style={StyleSheet.absoluteFill}
                    objectFit="cover"
                    mirror
                  />
                </View>
              ) : null}
              <Text style={styles.nameLabel} numberOfLines={1}>{statusText}</Text>
            </View>
            {call.error ? <Text style={styles.callError} accessibilityRole="alert">{call.error}</Text> : null}
            <View style={styles.controls}>
              {call.status === "incoming" ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel="Decline video call" testID="button-call-decline" onPress={declineCall} style={[styles.controlButton, styles.decline]}>
                    <Feather name="phone-off" size={23} color="#fff" />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Answer video call" testID="button-call-accept" onPress={() => void acceptCall()} style={[styles.controlButton, styles.accept]}>
                    <Feather name="phone" size={23} color="#fff" />
                  </Pressable>
                </>
              ) : call.status === "error" ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Close call" testID="button-call-end" onPress={endCall} style={[styles.controlButton, styles.decline]}>
                  <Feather name="phone-off" size={23} color="#fff" />
                </Pressable>
              ) : (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel={call.microphoneMuted ? "Unmute microphone" : "Mute microphone"} testID="button-call-microphone" onPress={toggleMicrophone} style={styles.controlButton}>
                    <Feather name={call.microphoneMuted ? "mic-off" : "mic"} size={22} color="#fff" />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="End video call" testID="button-call-end" onPress={endCall} style={[styles.controlButton, styles.decline]}>
                    <Feather name="phone-off" size={23} color="#fff" />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={call.cameraDisabled ? "Turn camera on" : "Turn camera off"} testID="button-call-camera" onPress={toggleCamera} style={styles.controlButton}>
                    <Feather name={call.cameraDisabled ? "video-off" : "video"} size={22} color="#fff" />
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>
      ) : null}
    </CallContext.Provider>
  );
}

const styles = StyleSheet.create({
  callScreen: { flex: 1, justifyContent: "space-between", backgroundColor: "#0b0b0f" },
  remoteVideo: { flex: 1, overflow: "hidden", backgroundColor: "#15131a" },
  callPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 24 },
  avatar: { width: 88, height: 88, alignItems: "center", justifyContent: "center", borderRadius: 44, backgroundColor: "rgba(255,255,255,0.12)" },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  callStatus: { color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center" },
  localVideo: { position: "absolute", top: 16, right: 16, width: 104, height: 150, overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", backgroundColor: "#000" },
  nameLabel: { position: "absolute", bottom: 18, left: 18, maxWidth: "80%", color: "#fff", fontSize: 18, fontWeight: "700" },
  callError: { paddingHorizontal: 24, paddingTop: 16, color: "#fff", fontSize: 14, lineHeight: 20, textAlign: "center" },
  controls: { minHeight: 108, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22, paddingTop: 18, paddingBottom: 14 },
  controlButton: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: "rgba(255,255,255,0.16)" },
  decline: { backgroundColor: "#e34555" },
  accept: { backgroundColor: "#1fb978" },
});
