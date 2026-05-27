import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  PhoneOff, MicOff, Mic, Volume2, VolumeX, Video, VideoOff,
  Grip, MoreHorizontal, X, Radio, Download, Trash2, FlipHorizontal,
  Hash
} from "lucide-react";

interface CallScreenProps {
  callStatus: "calling" | "incoming" | "connected";
  callType: "audio" | "video";
  callerName: string;
  callerAvatar?: string;
  callDurationSeconds: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoOn: boolean;
  isRecording: boolean;
  keypadTyped: string;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | HTMLAudioElement>;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleVideo: () => void;
  onToggleRecording: () => void;
  onEndCall: () => void;
  onFaceTimeUpgrade: () => void;
  onKeypadDigit: (digit: string) => void;
  onClearKeypad: () => void;
  videoUpgradeRequest: boolean;
  onAcceptVideoUpgrade: () => void;
  onRejectVideoUpgrade: () => void;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const KEYPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const CallScreen = ({
  callStatus,
  callType,
  callerName,
  callerAvatar,
  callDurationSeconds,
  isMuted,
  isSpeakerOn,
  isVideoOn,
  isRecording,
  keypadTyped,
  localVideoRef,
  remoteVideoRef,
  onToggleMute,
  onToggleSpeaker,
  onToggleVideo,
  onToggleRecording,
  onEndCall,
  onFaceTimeUpgrade,
  onKeypadDigit,
  onClearKeypad,
  videoUpgradeRequest,
  onAcceptVideoUpgrade,
  onRejectVideoUpgrade,
}: CallScreenProps) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const statusLabel =
    callStatus === "calling"
      ? "Calling..."
      : callStatus === "connected"
      ? formatDuration(callDurationSeconds)
      : "Connecting...";

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden">
      {callType === "video" && callStatus === "connected" ? (
        <div className="absolute inset-0 bg-[#0a0a0a]">
          <video
            ref={remoteVideoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-28 right-4 w-28 h-40 bg-zinc-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />
      )}

      {videoUpgradeRequest && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-4 flex flex-col items-center gap-3 shadow-2xl w-[300px]">
          <Video className="w-8 h-8 text-blue-400" />
          <p className="text-white text-[15px] font-semibold text-center">
            {callerName} wants to switch to video call
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onRejectVideoUpgrade}
              className="flex-1 py-2 rounded-xl bg-white/10 text-white/80 font-semibold text-[14px] hover:bg-white/20 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={onAcceptVideoUpgrade}
              className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-semibold text-[14px] hover:bg-blue-600 transition-colors"
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {showKeypad && (
        <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center">
          <button
            onClick={() => setShowKeypad(false)}
            className="absolute top-6 right-6 text-white/60 hover:text-white"
          >
            <X className="w-7 h-7" />
          </button>
          <div className="text-white text-[28px] font-light tracking-widest mb-8 min-h-[40px]">
            {keypadTyped || <span className="text-white/30">—</span>}
          </div>
          <div className="grid grid-cols-3 gap-4 w-[280px]">
            {KEYPAD_KEYS.flat().map((key) => (
              <button
                key={key}
                onClick={() => onKeypadDigit(key)}
                className="w-[72px] h-[72px] rounded-full bg-white/10 hover:bg-white/25 active:scale-90 flex items-center justify-center mx-auto text-white text-[26px] font-light transition-all duration-150 border border-white/10"
              >
                {key === "#" ? <Hash className="w-6 h-6" /> : key}
              </button>
            ))}
          </div>
          {keypadTyped && (
            <button
              onClick={onClearKeypad}
              className="mt-6 text-white/50 hover:text-white text-[13px] font-medium"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {showMore && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#1c1c1e]/95 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl pb-8 pt-4 px-8">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
          <h3 className="text-white font-semibold text-[17px] mb-5">More options</h3>
          <button
            onClick={() => { onToggleRecording(); setShowMore(false); }}
            className={`w-full flex items-center gap-4 py-4 px-4 rounded-2xl transition-colors ${
              isRecording ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white"
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isRecording ? "bg-red-500/30" : "bg-white/10"}`}>
              <Radio className={`w-6 h-6 ${isRecording ? "text-red-400" : "text-white"}`} />
              {isRecording && (
                <span className="absolute w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse top-1 right-1" />
              )}
            </div>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-[15px]">{isRecording ? "Stop Recording" : "Start Recording"}</span>
              <span className="text-[12px] text-white/50">
                {isRecording ? "Recording in progress..." : "Record this call"}
              </span>
            </div>
          </button>
          <button
            onClick={() => setShowMore(false)}
            className="w-full mt-3 py-3 rounded-2xl bg-white/5 text-white/60 text-[15px] font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center w-full h-full px-8 pt-16">
        {callType === "audio" && (
          <div className="flex flex-col items-center mb-auto">
            <div className={`relative w-32 h-32 rounded-full mb-6 ${callStatus === "connected" ? "ring-4 ring-green-400/30 ring-offset-4 ring-offset-transparent" : "ring-2 ring-white/20"}`}>
              <Avatar className="w-32 h-32">
                <AvatarImage src={callerAvatar || ""} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-4xl font-bold">
                  {callerName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {callStatus === "connected" && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-[#16213e] rounded-full" />
              )}
            </div>
            <h2 className="text-white text-[30px] font-semibold tracking-tight mb-1">{callerName}</h2>
            <p className={`text-[17px] font-medium mb-16 ${callStatus === "connected" ? "text-green-400" : "text-white/60 animate-pulse"}`}>
              {statusLabel}
            </p>
          </div>
        )}

        {callType === "video" && callStatus === "connected" && (
          <div className="absolute top-8 left-0 right-0 flex flex-col items-center z-10 pointer-events-none">
            <p className="text-white text-[15px] font-semibold drop-shadow-lg">{callerName}</p>
            <p className="text-green-400 text-[13px] font-medium">{formatDuration(callDurationSeconds)}</p>
          </div>
        )}

        {callType === "video" && callStatus === "calling" && (
          <div className="flex flex-col items-center mb-auto">
            <Avatar className="w-28 h-28 mb-5">
              <AvatarImage src={callerAvatar || ""} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-3xl font-bold">
                {callerName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-white text-[28px] font-semibold mb-1">{callerName}</h2>
            <p className="text-white/60 text-[17px] animate-pulse">Video calling...</p>
          </div>
        )}

        <div className="mt-auto mb-12 w-full">
          {callType === "audio" ? (
            <div className="grid grid-cols-3 gap-x-6 gap-y-8 w-full max-w-[320px] mx-auto">
              <CallButton
                icon={isSpeakerOn ? <Volume2 className="w-7 h-7" /> : <VolumeX className="w-7 h-7" />}
                label={isSpeakerOn ? "Speaker On" : "Speaker"}
                active={isSpeakerOn}
                activeColor="bg-white text-[#1a1a2e]"
                onClick={onToggleSpeaker}
              />
              <CallButton
                icon={<Video className="w-7 h-7" />}
                label="FaceTime"
                onClick={onFaceTimeUpgrade}
                disabled={callStatus !== "connected"}
              />
              <CallButton
                icon={isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                label={isMuted ? "Unmute" : "Mute"}
                active={isMuted}
                activeColor="bg-white text-[#1a1a2e]"
                onClick={onToggleMute}
              />
              <CallButton
                icon={<MoreHorizontal className="w-7 h-7" />}
                label="More"
                onClick={() => setShowMore(true)}
              />
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={onEndCall}
                  className="w-[72px] h-[72px] rounded-full bg-[#e63946] hover:bg-[#c92a34] active:scale-90 flex items-center justify-center shadow-[0_0_24px_rgba(230,57,70,0.5)] transition-all"
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-white/70 text-[14px] font-medium">End</span>
              </div>
              <CallButton
                icon={<Grip className="w-7 h-7" />}
                label="Keypad"
                onClick={() => setShowKeypad(true)}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-5 w-full">
              <CallButton
                icon={isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                label={isMuted ? "Unmute" : "Mute"}
                active={isMuted}
                activeColor="bg-white text-[#0a0a0a]"
                onClick={onToggleMute}
                size="sm"
              />
              <CallButton
                icon={isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                label={isVideoOn ? "Camera On" : "Camera Off"}
                active={!isVideoOn}
                activeColor="bg-white text-[#0a0a0a]"
                onClick={onToggleVideo}
                size="sm"
              />
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={onEndCall}
                  className="w-[60px] h-[60px] rounded-full bg-[#e63946] hover:bg-[#c92a34] active:scale-90 flex items-center justify-center shadow-[0_0_24px_rgba(230,57,70,0.5)] transition-all"
                >
                  <PhoneOff className="w-6 h-6 text-white" />
                </button>
                <span className="text-white/70 text-[13px]">End</span>
              </div>
              <CallButton
                icon={isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                label="Speaker"
                active={isSpeakerOn}
                activeColor="bg-white text-[#0a0a0a]"
                onClick={onToggleSpeaker}
                size="sm"
              />
              <CallButton
                icon={<MoreHorizontal className="w-6 h-6" />}
                label="More"
                onClick={() => setShowMore(true)}
                size="sm"
              />
            </div>
          )}

          {isRecording && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-[13px] font-semibold">Recording</span>
            </div>
          )}

          {keypadTyped && !showKeypad && (
            <div className="mt-3 text-center text-white/60 text-[15px] font-mono tracking-widest">
              {keypadTyped}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CallButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

const CallButton = ({
  icon,
  label,
  onClick,
  active = false,
  activeColor = "bg-white/30",
  disabled = false,
  size = "md",
}: CallButtonProps) => {
  const btnSize = size === "sm" ? "w-[58px] h-[58px]" : "w-[72px] h-[72px]";
  const iconSize = size === "sm" ? "" : "";

  return (
    <div className="flex flex-col items-center gap-2.5">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${btnSize} rounded-full flex items-center justify-center transition-all duration-200 active:scale-90
          ${disabled ? "opacity-30 cursor-not-allowed" : ""}
          ${active ? activeColor : "bg-white/10 hover:bg-white/20 text-white"}
        `}
      >
        {icon}
      </button>
      <span className="text-white/70 text-[13px] font-medium">{label}</span>
    </div>
  );
};

export default CallScreen;
