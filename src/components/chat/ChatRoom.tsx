import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic, Square, Send, Paperclip, Smile, Reply, Trash2, X, Users, Check, 
  CheckCheck, Info, Phone, Video, Music, Search, Ban, Edit2, BellOff, Bell,
  PhoneIncoming, PhoneOff, Image as ImageIcon, Volume2, MicOff, Grip, MoreHorizontal,
  PhoneMissed, Clock, Eye, EyeOff
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_EMAIL } from "@/lib/admin";
import GroupSettings from "./GroupSettings";
import UserProfileModal from "@/components/shared/UserProfileModal";
import CallScreen from "./CallScreen";

interface Msg {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: "text" | "image" | "video" | "voice" | "audio" | "gif" | "sticker" | "shared_post";
  reply_to_id: string | null;
  created_at: string;
  view_limit?: number;
  view_count?: number;
  viewer_ids?: string[];
}

interface Reaction { id: string; message_id: string; user_id: string; emoji: string; }
interface Profile { user_id: string; display_name: string | null; avatar_url: string | null; }
interface Read { message_id: string; user_id: string; }
interface PendingMedia { file: File; preview: string; type: "image" | "video" | "audio" | "voice"; }

const EMOJI_DB = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😮‍💨","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🫣","🤗","🫡","🤔","🫣","🤭","🫢","🤫","🤥","😶","😶‍🌫️","😐","😑","😬","🫠","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","😵‍💫","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾",
  "👋","🤚","🖐","✋","🖖","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👣","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀","👁","👅","👄","💋","🩸",
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷","🕸","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🕊","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿","🦔",
  "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕️","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽","🥣","🥡","🥢","🧂",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝"
];

const MOCK_STICKERS = [
  { id: "s1", url: "https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif", tags: ["happy", "dance", "yay"] },
  { id: "s2", url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif", tags: ["sad", "cry", "tears"] },
  { id: "s3", url: "https://media.giphy.com/media/11tTNkNy1SdXGg/giphy.gif", tags: ["angry", "mad", "rage"] },
  { id: "s4", url: "https://media.giphy.com/media/xT0xeQ1ZUQ0lvz2HXy/giphy.gif", tags: ["love", "heart", "kiss"] },
  { id: "s5", url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif", tags: ["excited", "omg", "wow"] },
  { id: "s6", url: "https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif", tags: ["confused", "what", "huh"] },
  { id: "s7", url: "https://media.giphy.com/media/26n6WywJyh39n1pSp/giphy.gif", tags: ["laugh", "lol", "haha"] },
  { id: "s8", url: "https://media.giphy.com/media/3o6UB5RrlQuMfZp82Y/giphy.gif", tags: ["sleep", "tired", "bed"] },
];

const ChatRoom = ({ conversationId }: { conversationId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reads, setReads] = useState<Read[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [conv, setConv] = useState<{ type: string; name: string | null; avatar_url: string | null; wallpaper_url: string | null } | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Msg | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [voicePreview, setVoicePreview] = useState<{ blob: Blob, url: string } | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlockedByTarget, setIsBlockedByTarget] = useState(false);
  const [hasBlockedTarget, setHasBlockedTarget] = useState(false);
  const isBlocked = isBlockedByTarget || hasBlockedTarget;
  const [viewLimitOption, setViewLimitOption] = useState<0 | 1 | 2>(0);
  const [secureViewMessage, setSecureViewMessage] = useState<any | null>(null);
  const [nickname, setNickname] = useState("");
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nicknamePopoverOpen, setNicknamePopoverOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  // Per-conversation nickname, stored in localStorage (only visible to this user)
  const localNicknameKey = `nickname_${conversationId}_${user?.id}`;
  const [localNickname, setLocalNickname] = useState(() => localStorage.getItem(`nickname_${conversationId}_${user?.id}`) ?? "");
  const [isOnlinePresence, setIsOnlinePresence] = useState(false);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Other user's profile in DM
  const [otherUserProfile, setOtherUserProfile] = useState<{ user_id: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  
  const [emojiSearch, setEmojiSearch] = useState("");
  const [stickerSearch, setStickerSearch] = useState("");
  const [gifSearch, setGifSearch] = useState("");
  const [recentStickers, setRecentStickers] = useState<typeof MOCK_STICKERS>([]);
  const [realGifs, setRealGifs] = useState<any[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "incoming" | "connected">("idle");
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [incomingCallData, setIncomingCallData] = useState<{ from: string, type: "audio" | "video", offer: any } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callIdRef = useRef<string | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isCallRecording, setIsCallRecording] = useState(false);
  const [keypadDigits, setKeypadDigits] = useState("");
  const [videoUpgradeRequest, setVideoUpgradeRequest] = useState(false);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const callRecRef = useRef<MediaRecorder | null>(null);
  const callRecChunks = useRef<Blob[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [editGroupName, setEditGroupName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const groupAvatarRef = useRef<HTMLInputElement>(null);
  const groupWallpaperRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const mediaRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<number | null>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const rtcChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const loadProfiles = async (ids: string[]) => {
    const missing = ids.filter((id) => !profiles[id]);
    if (!missing.length) return;
    const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", missing);
    setProfiles((prev) => {
      const next = { ...prev };
      (data ?? []).forEach((p) => { next[p.user_id] = p; });
      return next;
    });
  };

  const loadConv = useCallback(async () => {
    const { data } = await supabase.from("conversations").select("type, name, avatar_url, wallpaper_url").eq("id", conversationId).maybeSingle();
    setConv(data as any);
    const { count } = await supabase.from("conversation_participants").select("user_id", { count: "exact", head: true }).eq("conversation_id", conversationId);
    setParticipantCount(count ?? 0);
  }, [conversationId]);

  const refreshGroupMembers = async () => {
    const { data } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", conversationId);
    if (data) {
        const ids = data.map(d => d.user_id);
        await loadProfiles(ids);
        setGroupMembers(ids);
    }
  };

  useEffect(() => {
    if (detailsOpen && conv?.type === "group") {
        refreshGroupMembers();
        setEditGroupName(conv?.name || "");
    }
  }, [detailsOpen, conv]);

  const markReads = async (msgs: Msg[]) => {
    if (!user) return;
    const mine = msgs.filter((m) => m.user_id !== user.id).map((m) => ({ message_id: m.id, user_id: user.id }));
    if (mine.length) {
      setReads((prev) => {
        const seen = new Set(prev.map((r) => `${r.message_id}:${r.user_id}`));
        const add = mine.filter((m) => !seen.has(`${m.message_id}:${m.user_id}`));
        return add.length ? [...prev, ...add] : prev;
      });
      await supabase.from("message_reads").upsert(mine, { onConflict: "message_id,user_id", ignoreDuplicates: true });
    }
    await supabase.from("conversation_participants").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", user.id);
  };

  const loadAll = useCallback(async () => {
    const { data: msgs } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(200);
    const list = (msgs ?? []) as Msg[];
    setMessages(list);
    const ids = [...new Set(list.map((m) => m.user_id))];
    if (ids.length) await loadProfiles(ids);
    const msgIds = list.map((m) => m.id);
    if (msgIds.length) {
      const [{ data: rxs }, { data: rds }] = await Promise.all([
        supabase.from("message_reactions").select("*").in("message_id", msgIds),
        supabase.from("message_reads").select("message_id, user_id").in("message_id", msgIds),
      ]);
      setReactions((rxs ?? []) as Reaction[]);
      setReads((rds ?? []) as Read[]);
      await loadProfiles([...new Set((rds ?? []).map((r) => r.user_id))]);
    } else {
      setReactions([]); setReads([]);
    }
    await markReads(list);
  }, [conversationId, user?.id]);

  const searchRealGifs = async (query: string) => {
    setGifSearch(query);
    if (!query) {
      setRealGifs([]);
      return;
    }
    try {
      const res = await fetch(`https://g.tenor.com/v1/search?q=${query}&key=LIVDSRZULELA&limit=12`);
      const data = await res.json();
      setRealGifs(data.results.map((g: any) => ({ id: g.id, url: g.media[0].gif.url })));
    } catch (err) {
      console.error(err);
    }
  };

  const loadCallHistory = useCallback(async () => {
    const { data } = await supabase
      .from("calls")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setCallHistory((data ?? []) as any[]);
  }, [conversationId]);

  const checkBlockRelations = async (targetId: string) => {
    if (!user || !targetId) return;
    try {
      const { data: block1 } = await supabase
        .from("user_blocks")
        .select("id")
        .eq("blocker_id", targetId)
        .eq("blocked_id", user.id)
        .maybeSingle();
      setIsBlockedByTarget(!!block1);

      const { data: block2 } = await supabase
        .from("user_blocks")
        .select("id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetId)
        .maybeSingle();
      setHasBlockedTarget(!!block2);
    } catch (err) {
      console.error("Error checking block relations:", err);
    }
  };

  const handleToggleBlock = async () => {
    if (!user || conv?.type === "group") return;
    const otherUserId = getOtherUserId();
    if (!otherUserId) return;

    if (hasBlockedTarget) {
      // Unblock
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", otherUserId);

      if (error) {
        toast({ title: "Failed to unblock user", variant: "destructive" });
      } else {
        setHasBlockedTarget(false);
        toast({ title: "User unblocked successfully!" });
      }
    } else {
      // Block
      const { error } = await supabase
        .from("user_blocks")
        .insert({
          blocker_id: user.id,
          blocked_id: otherUserId
        });

      if (error) {
        toast({ title: "Failed to block user", variant: "destructive" });
      } else {
        setHasBlockedTarget(true);
        toast({ title: "User blocked successfully!" });
      }
    }
  };

  const openSecureLightbox = async (msg: any) => {
    if (!user) return;

    // Senders can preview their own view-once media freely (no tracking)
    if (user.id === msg.user_id) {
      setSecureViewMessage(msg);
      return;
    }

    // Call the SECURITY DEFINER RPC — bypasses RLS so receiver can update viewer_ids
    const { data: result, error } = await supabase.rpc("mark_message_viewed", {
      p_message_id: msg.id,
    });

    if (error) {
      console.error("mark_message_viewed error:", error);
      return;
    }

    // Already used all views — don't open
    if (result?.already_viewed) return;

    // Build local update from RPC result
    const updateData: any = {
      view_count: result.view_count,
      viewer_ids: result.viewer_ids,
    };
    if (result.deleted) {
      updateData.media_url = null;
      updateData.content = result.content;
    }

    // Update local message state immediately
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...updateData } : m));

    // Show lightbox with original URL (still in memory, just not in DB)
    setSecureViewMessage({ ...msg, ...updateData, media_url: msg.media_url });

    // Purge file from Supabase Storage when view limit is reached
    if (result.deleted && msg.media_url) {
      try {
        const url = new URL(msg.media_url);
        const match = url.pathname.match(/\/object\/public\/(.+)/);
        if (match) {
          const [bucket, ...pathParts] = match[1].split("/");
          const filePath = pathParts.join("/");
          await supabase.storage.from(bucket).remove([filePath]);
        }
      } catch (e) {
        console.error("Storage delete error:", e);
      }
    }
  };

  const closeSecureLightbox = () => {
    // DB already updated in openSecureLightbox — just close the lightbox
    setSecureViewMessage(null);
  };

  const handleWebRTCSignal = async (payload: any) => {
    if (!user || payload.payload.to !== user.id) return;
    const { type, from, data, callType: incomingType, callId } = payload.payload;
    if (type === 'offer') {
      if (callId) callIdRef.current = callId;
      setIncomingCallData({ from, type: incomingType, offer: data });
      setCallStatus("incoming");
    } else if (type === 'answer') {
      if (peerConnection.current) await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data));
      setCallStatus("connected");
      callStartTimeRef.current = Date.now();
      callTimerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
      if (callIdRef.current) {
        await supabase.from("calls").update({ status: "answered", answered_at: new Date().toISOString() }).eq("id", callIdRef.current);
      }
    } else if (type === 'ice-candidate') {
      if (peerConnection.current) {
        try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(data)); } catch {}
      }
    } else if (type === 'end-call') {
      await saveCallRecord("ended-by-other");
      cleanupCall();
      toast({ title: "Call ended" });
    } else if (type === 'reject-call') {
      await saveCallRecord("rejected");
      cleanupCall();
      toast({ title: "Call rejected" });
    } else if (type === 'video-upgrade-request') {
      setVideoUpgradeRequest(true);
    } else if (type === 'video-upgrade-accept') {
      await upgradeToVideo();
    } else if (type === 'video-upgrade-reject') {
      toast({ title: "Video call declined", description: "Continuing audio call" });
    }
  };

  const setupWebRTC = async (type: "audio" | "video") => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
    localStream.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
      ]
    });
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      remoteStream.current = event.streams[0];
      if (type === "video" && remoteVideoRef.current) {
        (remoteVideoRef.current as HTMLVideoElement).srcObject = event.streams[0];
      } else {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && rtcChannel.current && user) {
        rtcChannel.current.send({
          type: 'broadcast', event: 'webrtc-signal',
          payload: { type: 'ice-candidate', from: user.id, to: getOtherUserId(), data: event.candidate }
        });
      }
    };
    peerConnection.current = pc;
    return pc;
  };

  const getOtherUserId = () => {
    if (otherUserProfile?.user_id) return otherUserProfile.user_id;
    const others = Object.keys(profiles).filter(id => id !== user?.id);
    return others[0] || "";
  };

  const saveCallRecord = async (endReason?: string) => {
    if (!callIdRef.current) return;
    const now = Date.now();
    const durationSecs = callStartTimeRef.current ? Math.floor((now - callStartTimeRef.current) / 1000) : 0;
    const finalStatus = endReason === "rejected" ? "rejected" : durationSecs > 0 ? "answered" : "missed";
    await supabase.from("calls").update({
      status: finalStatus,
      ended_at: new Date().toISOString(),
      duration_seconds: durationSecs,
    }).eq("id", callIdRef.current);
    await loadCallHistory();
  };

  const initiateCall = async (type: "audio" | "video") => {
    if (!user || conv?.type === "group") return;
    try {
      setCallType(type);
      setCallStatus("calling");
      setCallDuration(0);
      setIsMicMuted(false);
      setIsSpeakerOn(false);
      setIsVideoEnabled(true);
      setKeypadDigits("");
      const otherUserId = getOtherUserId();
      const { data: callRow } = await supabase.from("calls").insert({
        conversation_id: conversationId,
        caller_id: user.id,
        callee_id: otherUserId,
        call_type: type,
        status: "missed",
        started_at: new Date().toISOString(),
      }).select().single();
      if (callRow) callIdRef.current = callRow.id;
      const pc = await setupWebRTC(type);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (rtcChannel.current) {
        rtcChannel.current.send({
          type: 'broadcast', event: 'webrtc-signal',
          payload: { type: 'offer', from: user.id, to: otherUserId, data: offer, callType: type, callId: callRow?.id }
        });
      }
    } catch (err: any) {
      toast({ title: "Call failed", description: err.message, variant: "destructive" });
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!user || !incomingCallData) return;
    try {
      const type = incomingCallData.type;
      setCallType(type);
      setCallStatus("connected");
      setCallDuration(0);
      setIsMicMuted(false);
      setIsSpeakerOn(false);
      setIsVideoEnabled(true);
      callStartTimeRef.current = Date.now();
      callTimerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
      if (callIdRef.current) {
        await supabase.from("calls").update({ status: "answered", answered_at: new Date().toISOString() }).eq("id", callIdRef.current);
      }
      const pc = await setupWebRTC(type);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (rtcChannel.current) {
        rtcChannel.current.send({
          type: 'broadcast', event: 'webrtc-signal',
          payload: { type: 'answer', from: user.id, to: incomingCallData.from, data: answer }
        });
      }
    } catch (err: any) {
      toast({ title: "Failed to accept", description: err.message, variant: "destructive" });
      cleanupCall();
    }
  };

  const rejectCall = async () => {
    if (rtcChannel.current && user && incomingCallData) {
      rtcChannel.current.send({
        type: 'broadcast', event: 'webrtc-signal',
        payload: { type: 'reject-call', from: user.id, to: incomingCallData.from }
      });
    }
    if (callIdRef.current) {
      await supabase.from("calls").update({ status: "rejected", ended_at: new Date().toISOString(), duration_seconds: 0 }).eq("id", callIdRef.current);
      await loadCallHistory();
    }
    cleanupCall();
  };

  const endCall = async () => {
    if (isCallRecording) stopCallRecording();
    if (keypadDigits && conversationId && user) {
      await supabase.from("messages").insert({
        conversation_id: conversationId, user_id: user.id,
        content: `📞 Keypad: ${keypadDigits}`, media_type: "text",
      });
    }
    if (rtcChannel.current && user) {
      rtcChannel.current.send({
        type: 'broadcast', event: 'webrtc-signal',
        payload: { type: 'end-call', from: user.id, to: incomingCallData?.from || getOtherUserId() }
      });
    }
    await saveCallRecord();
    cleanupCall();
  };

  const cleanupCall = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    localStream.current?.getTracks().forEach(track => track.stop());
    peerConnection.current?.close();
    localStream.current = null;
    remoteStream.current = null;
    peerConnection.current = null;
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; remoteAudioRef.current = null; }
    setCallStatus("idle");
    setCallType(null);
    setIncomingCallData(null);
    setCallDuration(0);
    setIsMicMuted(false);
    setIsSpeakerOn(false);
    setIsVideoEnabled(true);
    setIsCallRecording(false);
    setVideoUpgradeRequest(false);
    callIdRef.current = null;
    callStartTimeRef.current = null;
    callTimerRef.current = null;
  };

  const toggleMic = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMicMuted(!track.enabled);
    }
  };

  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isSpeakerOn;
      setIsSpeakerOn(prev => !prev);
    } else {
      setIsSpeakerOn(prev => !prev);
    }
  };

  const toggleVideo = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoEnabled(!track.enabled ? false : true);
    }
  };

  const startCallRecording = () => {
    try {
      const tracks: MediaStreamTrack[] = [];
      if (localStream.current) tracks.push(...localStream.current.getTracks());
      if (remoteStream.current) tracks.push(...remoteStream.current.getTracks());
      if (tracks.length === 0) return;
      const combinedStream = new MediaStream(tracks);
      const rec = new MediaRecorder(combinedStream);
      callRecChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) callRecChunks.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(callRecChunks.current, { type: "audio/webm" });
        const url = await uploadFile(blob, "audio", "call-recording.webm");
        if (url && user) {
          await supabase.from("messages").insert({
            conversation_id: conversationId, user_id: user.id,
            media_url: url, media_type: "voice",
            content: "📼 Call Recording",
          });
          toast({ title: "Call recording saved to chat" });
        }
      };
      rec.start();
      callRecRef.current = rec;
      setIsCallRecording(true);
    } catch (err: any) {
      toast({ title: "Recording failed", description: err.message, variant: "destructive" });
    }
  };

  const stopCallRecording = () => {
    callRecRef.current?.stop();
    callRecRef.current = null;
    setIsCallRecording(false);
  };

  const toggleCallRecording = () => {
    if (isCallRecording) stopCallRecording();
    else startCallRecording();
  };

  const requestFaceTimeUpgrade = () => {
    if (!rtcChannel.current || !user) return;
    rtcChannel.current.send({
      type: 'broadcast', event: 'webrtc-signal',
      payload: { type: 'video-upgrade-request', from: user.id, to: getOtherUserId() }
    });
    toast({ title: "Video upgrade requested", description: "Waiting for the other person..." });
  };

  const upgradeToVideo = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoStream.getVideoTracks().forEach(track => {
        localStream.current?.addTrack(track);
        peerConnection.current?.addTrack(track, localStream.current!);
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream.current;
      setCallType("video");
    } catch (err: any) {
      toast({ title: "Video upgrade failed", description: err.message, variant: "destructive" });
    }
  };

  const acceptVideoUpgrade = async () => {
    if (rtcChannel.current && user) {
      rtcChannel.current.send({
        type: 'broadcast', event: 'webrtc-signal',
        payload: { type: 'video-upgrade-accept', from: user.id, to: getOtherUserId() }
      });
    }
    setVideoUpgradeRequest(false);
    await upgradeToVideo();
  };

  const rejectVideoUpgrade = () => {
    if (rtcChannel.current && user) {
      rtcChannel.current.send({
        type: 'broadcast', event: 'webrtc-signal',
        payload: { type: 'video-upgrade-reject', from: user.id, to: getOtherUserId() }
      });
    }
    setVideoUpgradeRequest(false);
  };

  const addKeypadDigit = (digit: string) => setKeypadDigits(prev => prev + digit);
  const clearKeypadDigits = () => setKeypadDigits("");

  useEffect(() => {
    loadConv();
    loadAll();
    // Load the other user's profile for DM header
    const loadOtherUser = async () => {
      if (!user) return;
      const { data: parts } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", conversationId).neq("user_id", user.id).limit(1).maybeSingle();
      if (parts?.user_id) {
        const { data: prof } = await supabase.from("profiles").select("user_id, display_name, avatar_url").eq("user_id", parts.user_id).maybeSingle();
        if (prof) setOtherUserProfile(prof);
        await checkBlockRelations(parts.user_id);
        // Track presence of the other user
        if (presenceRef.current) { supabase.removeChannel(presenceRef.current); }
        const presCh = supabase.channel("presence-chat", { config: { presence: { key: user.id } } });
        presCh
          .on("presence", { event: "sync" }, () => {
            const state = presCh.presenceState<{ user_id: string }>();
            setIsOnlinePresence(Object.keys(state).includes(parts.user_id));
          })
          .on("presence", { event: "join" }, ({ key }) => { if (key === parts.user_id) { setIsOnlinePresence(true); setLastSeen(null); } })
          .on("presence", { event: "leave" }, ({ key }) => { 
            if (key === parts.user_id) { 
              setIsOnlinePresence(false); 
              const now = new Date();
              setLastSeen(now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true, day: "2-digit", month: "short" })); 
            } 
          })
          .subscribe(async (status) => { if (status === "SUBSCRIBED") await presCh.track({ user_id: user.id }); });
        presenceRef.current = presCh;
      }
    };
    loadOtherUser();
    loadCallHistory();
    // Load local nickname from storage
    const stored = localStorage.getItem(`nickname_${conversationId}_${user?.id}`);
    if (stored) setLocalNickname(stored);
    const ch = supabase.channel(`conv-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, () => loadAll())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, () => loadConv())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` }, () => loadConv())
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `conversation_id=eq.${conversationId}` }, () => loadCallHistory())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_blocks" }, () => loadOtherUser())
      .on("postgres_changes", { event: "*", schema: "public", table: "typing_indicators", filter: `conversation_id=eq.${conversationId}` }, async () => {
        const { data } = await supabase.from("typing_indicators").select("user_id, updated_at").eq("conversation_id", conversationId).gt("updated_at", new Date(Date.now() - 5000).toISOString());
        setTypingUsers((data ?? []).map((t) => t.user_id).filter((id) => id !== user?.id));
      })
      .on("broadcast", { event: "webrtc-signal" }, handleWebRTCSignal)
      .subscribe();
    rtcChannel.current = ch;
    return () => { 
      supabase.removeChannel(ch);
      if (presenceRef.current) supabase.removeChannel(presenceRef.current);
      cleanupCall(); 
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [conversationId, loadAll, loadConv, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pendingMedia.length]);

  const broadcastTyping = async () => {
    if (!user) return;
    await supabase.from("typing_indicators").upsert({ conversation_id: conversationId, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "conversation_id,user_id" });
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(async () => {
      await supabase.from("typing_indicators").delete().eq("conversation_id", conversationId).eq("user_id", user.id);
    }, 3000);
  };

  const handleStageMedia = (e: React.ChangeEvent<HTMLInputElement>, mediaCategory: "media" | "audio") => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const newPending = files.map(file => {
      const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image";
      return { file, preview: URL.createObjectURL(file), type };
    });
    setPendingMedia(prev => [...prev, ...newPending as PendingMedia[]]);
  };

  const removePendingMedia = (index: number) => {
    setPendingMedia(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const uploadFile = async (file: File | Blob, kind: string, filename: string) => {
    if (!user) return null;
    const ext = filename.split(".").pop() || "bin";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
    return pub.publicUrl;
  };

  const executeSendMediaAndText = async () => {
    if (!user || isBlocked) return;
    const body = text.trim();
    const currentPending = [...pendingMedia];
    const currentReply = reply?.id ?? null;
    setText("");
    setPendingMedia([]);
    setReply(null);
    setIsUploading(true);
    setPopoverOpen(false);
    await supabase.from("typing_indicators").delete().eq("conversation_id", conversationId).eq("user_id", user.id);
    try {
      if (body) {
        await supabase.from("messages").insert({
          conversation_id: conversationId, user_id: user.id, content: body, media_type: "text", reply_to_id: currentReply,
        });
      }
      for (const item of currentPending) {
        const publicUrl = await uploadFile(item.file, item.type, item.file.name);
        if (publicUrl) {
          const limit = item.type === "image" ? viewLimitOption : 0;
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            user_id: user.id,
            media_url: publicUrl,
            media_type: item.type,
            reply_to_id: currentReply,
            view_limit: limit,
            view_count: 0,
            viewer_ids: []
          });
        }
      }
      // Notification
      if (conv?.type !== "group") {
        const otherId = getOtherUserId();
        if (otherId) {
          await supabase.from("notifications").insert({
            recipient_id: otherId,
            sender_id: user.id,
            type: "chat_message",
            content: body || (currentPending.length > 0 ? "Sent a file" : "")
          });
        }
      }
    } catch (error: any) {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setViewLimitOption(0);
    }
  };

  const sendVoicePreview = async () => {
    if (!user || !voicePreview || isBlocked) return;
    setIsUploading(true);
    try {
        const publicUrl = await uploadFile(voicePreview.blob, "voice", "voice.webm");
        if (publicUrl) {
          await supabase.from("messages").insert({
            conversation_id: conversationId, user_id: user.id, media_url: publicUrl, media_type: "voice", reply_to_id: reply?.id ?? null,
          });
        }
        // Notification
        if (conv?.type !== "group") {
          const otherId = getOtherUserId();
          if (otherId) {
            await supabase.from("notifications").insert({
              recipient_id: otherId,
              sender_id: user.id,
              type: "chat_message",
              content: "Sent a voice message"
            });
          }
        }
    } catch (error: any) {
        toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } finally {
        setIsUploading(false);
        setVoicePreview(null);
        setReply(null);
    }
  };

  const discardVoicePreview = () => setVoicePreview(null);

  const sendRichMediaInstant = async (url: string, type: "gif" | "sticker", id: string) => {
    if (!user || isBlocked) return;
    if (type === "sticker") {
      const stickerObj = MOCK_STICKERS.find(s => s.id === id);
      if (stickerObj) setRecentStickers(prev => [stickerObj, ...prev.filter(s => s.id !== id)].slice(0, 10));
    }
    setPopoverOpen(false);
    await supabase.from("messages").insert({
      conversation_id: conversationId, user_id: user.id, media_url: url, media_type: type, reply_to_id: reply?.id ?? null,
    });
    // Notification
    if (conv?.type !== "group") {
      const otherId = getOtherUserId();
      if (otherId) {
        await supabase.from("notifications").insert({
          recipient_id: otherId,
          sender_id: user.id,
          type: "chat_message",
          content: `Sent a ${type}`
        });
      }
    }
    setReply(null);
    setStickerSearch("");
    setGifSearch("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recChunks.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(recChunks.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setVoicePreview({ blob, url: URL.createObjectURL(blob) });
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setRecordTime(0);
      recordTimerRef.current = setInterval(() => setRecordTime(prev => prev + 1), 1000);
    } catch (err: any) {
      toast({ title: "Microphone error", description: err.message, variant: "destructive" });
    }
  };

  const stopRecording = () => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("messages").delete().eq("id", id);
    setConfirmDelete(null);
  };

  const executeClearChat = async () => {
    if (!user) return;
    try {
      await supabase.from("messages").delete().eq("conversation_id", conversationId);
      toast({ title: "Chat cleared successfully" });
      setDetailsOpen(false);
    } catch (error: any) {
      toast({ title: "Error clearing chat", description: error.message, variant: "destructive" });
    }
  };

  const savePermanentNickname = async () => {
    if (!user) return;
    try {
        await supabase.from("profiles").update({ display_name: nickname }).eq("user_id", user.id);
        setIsEditingNickname(false);
        setProfiles(prev => ({...prev, [user.id]: {...prev[user.id], display_name: nickname}}));
        toast({ title: "Nickname saved globally" });
    } catch (error: any) {
        toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    }
  };

  const handleGroupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "avatar_url" | "wallpaper_url") => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    toast({ title: "Uploading image..." });
    try {
        const ext = file.name.split(".").pop() || "png";
        const path = `group-${conversationId}/${field}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
        const { error: updateErr } = await supabase.from("conversations").update({ [field]: pub.publicUrl }).eq("id", conversationId);
        if (updateErr) throw updateErr;
        toast({ title: "Updated successfully" });
        loadConv();
    } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const updateGroupName = async () => {
    if (!editGroupName.trim()) return;
    await supabase.from("conversations").update({ name: editGroupName }).eq("id", conversationId);
    toast({ title: "Group name updated" });
    loadConv();
  };

  const addMemberToGroup = async () => {
    if (!newMemberName.trim()) return;
    const { data } = await supabase.from("profiles").select("user_id").ilike("display_name", newMemberName.trim()).limit(1).maybeSingle();
    if (data?.user_id) {
        await supabase.from("conversation_participants").insert({ conversation_id: conversationId, user_id: data.user_id });
        toast({ title: "Member added" });
        setNewMemberName("");
        refreshGroupMembers();
    } else {
        toast({ title: "User not found", description: "Check exact display name.", variant: "destructive" });
    }
  };

  const removeMemberFromGroup = async (uid: string) => {
    await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId).eq("user_id", uid);
    toast({ title: "Member removed" });
    refreshGroupMembers();
  };

  const deleteGroup = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to delete this group?")) return;
    try {
        const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
        if (error) throw error;
        toast({ title: "Group deleted successfully" });
        setDetailsOpen(false);
        window.location.href = "/chat";
    } catch (err: any) {
        toast({ title: "Failed to delete group", description: err.message, variant: "destructive" });
    }
  };

  const findMsg = (id: string | null) => id ? messages.find((m) => m.id === id) : null;
  // Header shows: localNickname (if set by this user for this chat) OR other user's DB name OR group name
  const headerTitle = conv?.type === "group"
    ? (conv.name ?? "Group")
    : (localNickname || otherUserProfile?.display_name || "Direct Message");
  // Header avatar: always use the other user's actual profile pic
  const headerAvatar = conv?.type === "group" ? conv?.avatar_url : otherUserProfile?.avatar_url;
  const filteredEmojis = EMOJI_DB.filter(e => emojiSearch === "" || e.includes(emojiSearch));
  const filteredStickers = MOCK_STICKERS.filter(s => stickerSearch === "" || s.tags.some(t => t.includes(stickerSearch.toLowerCase())));

  return (
    <div className="flex h-full bg-background relative overflow-hidden font-sans">
      {/* Main chat column */}
      <div className="flex flex-col flex-1 min-w-0 h-full relative">
      
      {callStatus !== "idle" && (
        callStatus === "incoming" ? (
          <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-2xl flex flex-col items-center justify-center text-white">
            <div className="bg-[#1c1c1e] text-white w-[340px] rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-white/10">
              <div className="flex flex-col items-center pt-10 pb-8 px-6">
                <div className={`mb-2 text-[13px] font-semibold tracking-widest uppercase ${incomingCallData?.type === "video" ? "text-blue-400" : "text-green-400"}`}>
                  {incomingCallData?.type === "video" ? "📹 Incoming Video Call" : "📞 Incoming Voice Call"}
                </div>
                <Avatar className="w-28 h-28 mb-5 ring-4 ring-white/10">
                  <AvatarImage src={profiles[incomingCallData?.from || ""]?.avatar_url || ""} />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-3xl font-bold">
                    {profiles[incomingCallData?.from || ""]?.display_name?.slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-[24px] font-semibold mb-1">{profiles[incomingCallData?.from || ""]?.display_name || "Unknown"}</h2>
                <p className="text-white/50 text-[15px] mb-10 animate-pulse">is calling you...</p>
                <div className="flex w-full gap-4">
                  <button className="flex-1 flex flex-col items-center gap-2" onClick={rejectCall}>
                    <div className="w-16 h-16 rounded-full bg-[#e63946] flex items-center justify-center shadow-[0_0_20px_rgba(230,57,70,0.4)]">
                      <PhoneOff className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-white/70 text-[13px] font-medium">Decline</span>
                  </button>
                  <button className="flex-1 flex flex-col items-center gap-2" onClick={acceptCall}>
                    <div className="w-16 h-16 rounded-full bg-[#2a9d8f] flex items-center justify-center shadow-[0_0_20px_rgba(42,157,143,0.4)] animate-bounce">
                      <Phone className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-white/70 text-[13px] font-medium">Accept</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <CallScreen
            callStatus={callStatus as "calling" | "connected"}
            callType={callType as "audio" | "video"}
            callerName={headerTitle}
            callerAvatar={headerAvatar || undefined}
            callDurationSeconds={callDuration}
            isMuted={isMicMuted}
            isSpeakerOn={isSpeakerOn}
            isVideoOn={isVideoEnabled}
            isRecording={isCallRecording}
            keypadTyped={keypadDigits}
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            onToggleMute={toggleMic}
            onToggleSpeaker={toggleSpeaker}
            onToggleVideo={toggleVideo}
            onToggleRecording={toggleCallRecording}
            onEndCall={endCall}
            onFaceTimeUpgrade={requestFaceTimeUpgrade}
            onKeypadDigit={addKeypadDigit}
            onClearKeypad={clearKeypadDigits}
            videoUpgradeRequest={videoUpgradeRequest}
            onAcceptVideoUpgrade={acceptVideoUpgrade}
            onRejectVideoUpgrade={rejectVideoUpgrade}
          />
        )
      )}

      <div className="flex items-center gap-4 py-4 px-6 border-b border-border/40 bg-background z-10 shadow-sm">
        <div className="flex-1 min-w-0 flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-[46px] h-[46px] border border-border/50 shadow-sm cursor-pointer hover:opacity-90 transition-opacity" onClick={() => {
              if (conv?.type !== "group") {
                if (otherUserProfile?.user_id) setProfileModalUserId(otherUserProfile.user_id);
              } else {
                setDetailsOpen(true);
              }
            }}>
              {headerAvatar && !isBlockedByTarget ? <AvatarImage src={headerAvatar} /> : <AvatarFallback><Users className="w-5 h-5" /></AvatarFallback>}
            </Avatar>
            {/* Real presence dot - only DM, only when actually online */}
            {conv?.type !== "group" && isOnlinePresence && !isBlockedByTarget && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
            )}
          </div>
          <div className="flex flex-col cursor-pointer" onClick={() => {
              if (conv?.type !== "group") {
                if (otherUserProfile?.user_id) setProfileModalUserId(otherUserProfile.user_id);
              } else {
                setDetailsOpen(true);
              }
          }}>
            <div className="font-bold text-[17px] truncate flex items-center gap-2">
              {headerTitle}
              {isMuted && <BellOff className="w-3.5 h-3.5 text-muted-foreground/70" />}
            </div>
            <div className={`text-[13px] font-medium truncate flex items-center gap-1.5 mt-0.5 ${typingUsers.length > 0 && !isBlockedByTarget ? 'text-primary' : isOnlinePresence && conv?.type !== 'group' && !isBlockedByTarget ? 'text-green-500' : 'text-muted-foreground'}`}>
              {typingUsers.length > 0 && !isBlockedByTarget
                ? <span className="animate-pulse">{typingUsers.map((id) => profiles[id]?.display_name ?? "Someone").join(", ")} is typing...</span>
                : conv?.type !== "group" && isOnlinePresence && !isBlockedByTarget ? <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>Online</> : conv?.type === "group" ? `${participantCount} members` : lastSeen && !isBlockedByTarget ? `Last seen ${lastSeen}` : "Last seen recently"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Button size="icon" variant="ghost" className={`h-10 w-10 rounded-full hover:bg-secondary ${searchOpen ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`} onClick={() => { setSearchOpen(o => !o); setSearchQuery(""); }}><Search className="w-5 h-5" /></Button>
          {conv?.type !== "group" && (
            <>
              <Button 
                size="icon" 
                variant="ghost" 
                className={`h-10 w-10 rounded-full hover:bg-secondary text-muted-foreground transition-all duration-200 ${isBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (isBlockedByTarget) {
                    toast({ title: "Call failed", description: "You cannot contact this user.", variant: "destructive" });
                  } else if (hasBlockedTarget) {
                    toast({ title: "Call failed", description: "Unblock this user to make calls.", variant: "destructive" });
                  } else {
                    initiateCall("audio");
                  }
                }}
              >
                <Phone className="w-[22px] h-[22px]" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className={`h-10 w-10 rounded-full hover:bg-secondary text-muted-foreground transition-all duration-200 ${isBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (isBlockedByTarget) {
                    toast({ title: "Call failed", description: "You cannot contact this user.", variant: "destructive" });
                  } else if (hasBlockedTarget) {
                    toast({ title: "Call failed", description: "Unblock this user to make calls.", variant: "destructive" });
                  } else {
                    initiateCall("video");
                  }
                }}
              >
                <Video className="w-[24px] h-[24px]" />
              </Button>
            </>
          )}
          {/* Info / Details icon */}
          <Button
            size="icon"
            variant="ghost"
            className={`h-10 w-10 rounded-full hover:bg-secondary ${detailsOpen ? 'text-foreground bg-secondary' : 'text-muted-foreground'}`}
            onClick={() => setDetailsOpen((o) => !o)}
          >
            <Info className="w-[22px] h-[22px]" />
          </Button>
        </div>
      </div>

      {searchOpen && (
        <div className="px-4 py-2.5 border-b border-border/40 bg-secondary/30 flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 h-9 border-none bg-transparent shadow-none focus-visible:ring-0 text-[14px] placeholder:text-muted-foreground"
          />
          {searchQuery && <span className="text-xs text-muted-foreground whitespace-nowrap">{messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase())).length} results</span>}
          <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5" style={conv?.wallpaper_url ? { backgroundImage: `url(${conv.wallpaper_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        {(() => {
          const filteredMsgs = (searchQuery ? messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase())) : messages);
          const callItems = callHistory.map(c => ({ ...c, _isCall: true, created_at: c.created_at }));
          const combined = [...filteredMsgs.map(m => ({ ...m, _isCall: false })), ...callItems]
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return combined.map((item) => {
            if ((item as any)._isCall) {
              const call = item as any;
              const isCaller = call.caller_id === user?.id;
              const isMe = isCaller;
              const fmtDur = (s: number) => s > 0 ? `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}` : "";
              const callTime = new Date(call.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
              return (
                <div key={`call-${call.id}`} className="flex justify-center">
                  <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-[13px] font-medium shadow-sm max-w-[280px] ${
                    call.status === "missed"
                      ? "bg-red-500/8 border-red-200/60 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
                      : call.status === "rejected"
                      ? "bg-orange-500/8 border-orange-200/60 text-orange-600 dark:bg-orange-500/10 dark:border-orange-500/20 dark:text-orange-400"
                      : "bg-green-500/8 border-green-200/60 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400"
                  }`}>
                    {call.status === "missed" ? (
                      <PhoneMissed className="w-4 h-4 shrink-0" />
                    ) : call.status === "rejected" ? (
                      <PhoneOff className="w-4 h-4 shrink-0" />
                    ) : call.call_type === "video" ? (
                      <Video className="w-4 h-4 shrink-0" />
                    ) : (
                      <Phone className="w-4 h-4 shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold">
                        {call.status === "missed"
                          ? `Missed ${call.call_type === "video" ? "Video" : "Voice"} Call`
                          : call.status === "rejected"
                          ? `Declined ${call.call_type === "video" ? "Video" : "Voice"} Call`
                          : `${call.call_type === "video" ? "Video" : "Voice"} Call`}
                      </span>
                      <span className="text-[11px] opacity-70 flex items-center gap-1.5">
                        {call.status === "answered" && call.duration_seconds > 0 && (
                          <><Clock className="w-3 h-3" />{fmtDur(call.duration_seconds)}</>
                        )}
                        <span>• {callTime}</span>
                        {call.status === "missed" && call.missed_count > 1 && (
                          <span className="bg-red-500 text-white rounded-full px-1.5 py-0 text-[10px] font-bold">×{call.missed_count}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            const m = item as typeof messages[0];
            const isMe = m.user_id === user?.id;
            const prof = profiles[m.user_id];
            const repliedTo = findMsg(m.reply_to_id);
            const canDelete = isMe || isAdmin;
            return (
            <div key={m.id} className={`flex gap-2.5 ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe && (
                <Avatar 
                  className="w-8 h-8 mt-auto shadow-sm cursor-pointer hover:opacity-80 transition-opacity hover:scale-105"
                  onClick={() => setProfileModalUserId(m.user_id)}
                >
                  {prof?.avatar_url && <AvatarImage src={prof.avatar_url} />}
                  <AvatarFallback className="text-[11px] font-semibold">{(prof?.display_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[75%] group flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <div 
                    className="text-[11px] text-muted-foreground mb-1 ml-1 font-medium cursor-pointer hover:underline decoration-primary"
                    onClick={() => setProfileModalUserId(m.user_id)}
                  >
                    {prof?.display_name ?? "Member"}
                  </div>
                )}
                
                {(() => {
                  // Single emoji only → big, no bubble
                  const isSingleEmoji = m.media_type === "text" && !!m.content && /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u.test(m.content.trim()) && m.content.trim().length <= 8;
                  const isRichMedia = m.media_type === "gif" || m.media_type === "sticker";
                  if (isSingleEmoji) {
                    return (
                      <div className="text-[56px] leading-none select-none" style={{background:'none',boxShadow:'none',padding:0}}>
                        {m.content}
                      </div>
                    );
                  }
                  if (isRichMedia && m.media_url) {
                    return (
                      <div style={{background:'none',boxShadow:'none',padding:0}}>
                        <img src={m.media_url} alt={m.media_type} className={m.media_type === "sticker" ? "w-36 h-36 object-contain drop-shadow-lg" : "rounded-2xl max-h-[250px] object-cover shadow-md"} />
                      </div>
                    );
                  }
                  // For images (photos)
                  if (m.media_type === "image") {
                    const isViewOnceOrTwice = m.view_limit && m.view_limit > 0;
                    if (isViewOnceOrTwice) {
                      const limit = m.view_limit || 1;
                      const viewerIds: string[] = Array.isArray(m.viewer_ids) ? m.viewer_ids : [];
                      const isSender = m.user_id === user?.id;

                      if (isSender) {
                        // Sender sees blurred preview with view count badge
                        const viewedCount = m.view_count || 0;
                        return (
                          <div
                            className="relative cursor-pointer"
                            onClick={() => openSecureLightbox(m)}
                          >
                            {m.media_url ? (
                              <div className="relative">
                                <img
                                  src={m.media_url}
                                  alt="view-once"
                                  className="rounded-2xl max-h-[220px] object-cover shadow-md"
                                  style={{ filter: "blur(6px)", userSelect: "none" }}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-2xl gap-1">
                                  <Eye className="w-6 h-6 text-white" />
                                  <span className="text-white text-[11px] font-bold text-center px-2">
                                    {limit === 1 ? "View Once" : "View Twice"}
                                    {viewedCount > 0 ? ` · Seen ${viewedCount}×` : " · Not yet viewed"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground text-[13px] font-semibold italic p-2.5 rounded-2xl border border-dashed border-border/40 select-none bg-transparent">
                                <EyeOff className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                {limit === 1 ? "One time viewed" : "Two times viewed"}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Receiver: check how many times THIS user has viewed (uses viewer_ids array)
                      const myViewCount = viewerIds.filter((id: string) => id === user?.id).length;
                      const fullyViewed = myViewCount >= limit || !m.media_url;

                      if (fullyViewed) {
                        return (
                          <div className="flex items-center gap-2 text-muted-foreground text-[13px] font-semibold italic p-2.5 rounded-2xl border border-dashed border-border/40 select-none bg-transparent">
                            <EyeOff className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                            {limit === 1 ? "One time viewed" : "Two times viewed"}
                          </div>
                        );
                      }

                      // Receiver can still view — show how many views left
                      const viewsRemaining = limit - myViewCount;
                      return (
                        <button
                          onClick={() => openSecureLightbox(m)}
                          className="flex items-center gap-2.5 bg-gradient-to-r from-red-500/10 to-pink-500/10 hover:from-red-500/15 hover:to-pink-500/15 border border-red-500/20 text-red-500 font-semibold px-4 py-3 rounded-2xl transition-all shadow-sm hover:scale-105 active:scale-95"
                        >
                          <Eye className="w-5 h-5 animate-pulse text-red-500 shrink-0" />
                          <span className="text-[13px]">
                            {limit === 1
                              ? "View Once · Tap to view"
                              : viewsRemaining === 2
                              ? "View Twice · 2 views left"
                              : "View Twice · 1 view left"}
                          </span>
                        </button>
                      );
                    }

                    // Regular Image (No background)
                    if (m.media_url) {
                      return (
                        <div className="p-0 shadow-none border-none bg-transparent" style={{background:'none',boxShadow:'none'}}>
                          <img src={m.media_url} alt="shared" className="rounded-2xl max-h-[300px] object-cover shadow-md hover:opacity-95 transition-opacity" />
                        </div>
                      );
                    }
                  }

                  // Shared post / reel / story card
                  if (m.media_type === "shared_post" && m.content) {
                    let postData: any = null;
                    try { postData = JSON.parse(m.content); } catch {}
                    if (postData) {
                      const isVideoPost = postData.is_video;
                      return (
                        <button
                          onClick={() => {
                            if (postData.type === "reel") {
                              window.location.href = "/reels";
                            } else if (postData.type === "story") {
                              window.location.href = "/";
                            } else {
                              window.location.href = `/profile/${postData.author_id}`;
                            }
                          }}
                          className="block text-left w-full max-w-[220px]"
                          style={{ background: "none", border: "none", padding: 0 }}
                        >
                          <div className="rounded-2xl overflow-hidden border border-border/30 shadow-lg bg-black/5" style={{ maxWidth: 220 }}>
                            {/* Thumbnail */}
                            <div className="relative" style={{ aspectRatio: "9/16", maxHeight: 320, overflow: "hidden" }}>
                              {isVideoPost ? (
                                <video
                                  src={postData.media_url}
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <img
                                  src={postData.media_url}
                                  alt="shared"
                                  className="w-full h-full object-cover"
                                />
                              )}
                              {/* Author overlay top */}
                              <div className="absolute top-0 left-0 right-0 flex items-center gap-1.5 p-2" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}>
                                {postData.author_avatar && (
                                  <img src={postData.author_avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/30" />
                                )}
                                <span className="text-white text-[11px] font-semibold truncate">
                                  @{postData.author_username}
                                </span>
                              </div>
                              {/* Play icon for videos */}
                              {isVideoPost && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                                  </div>
                                </div>
                              )}
                              {/* Caption at bottom */}
                              {postData.caption && (
                                <div className="absolute bottom-0 left-0 right-0 p-2" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }}>
                                  <p className="text-white text-[11px] line-clamp-2 leading-tight">{postData.caption}</p>
                                </div>
                              )}
                            </div>
                            {/* Footer bar */}
                            <div className="px-3 py-2 flex items-center justify-between bg-background border-t border-border/20">
                              <span className="text-[11px] font-bold text-muted-foreground capitalize">{postData.type}</span>
                              <span className="text-[11px] text-primary font-semibold">View →</span>
                            </div>
                          </div>
                        </button>
                      );
                    }
                    // Fallback if JSON parse fails
                    return (
                      <div className={`relative px-4 py-2.5 shadow-sm ${isMe ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm"}`}>
                        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</div>
                      </div>
                    );
                  }

                  // For voice notes (No background)
                  if (m.media_type === "voice" && m.media_url) {
                    return (
                      <div className="p-0 shadow-none border-none bg-transparent flex items-center" style={{background:'none',boxShadow:'none'}}>
                        <audio src={m.media_url} controls className="max-w-full h-11 drop-shadow-sm" />
                      </div>
                    );
                  }

                  return (
                    <div className={`relative px-4 py-2.5 shadow-sm ${isMe ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm"}`}>
                      {repliedTo && (
                        <div className="text-[12px] opacity-80 border-l-2 border-current pl-2.5 mb-2 truncate bg-black/5 p-1.5 rounded-r-md">
                          {repliedTo.content ?? `Attachment: ${repliedTo.media_type}`}
                        </div>
                      )}
                      {m.media_type === "text" && <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</div>}
                      {m.media_type === "video" && m.media_url && <video src={m.media_url} controls className="rounded-xl max-h-[300px] shadow-sm" />}
                      {m.media_type === "audio" && m.media_url && <audio src={m.media_url} controls className="max-w-full mt-1 h-11" />}
                    </div>
                  );
                })()}

                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {Object.entries(reactions.filter((r) => r.message_id === m.id).reduce((acc: Record<string, number>, r) => {
                    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc;
                  }, {})).map(([e, c]) => (
                    <button key={e} onClick={() => toggleReaction(m.id, e)} className="text-[12px] bg-secondary border border-border/50 rounded-full px-2.5 py-0.5 hover:bg-secondary/70 flex items-center gap-1.5 shadow-sm transition-transform hover:scale-105">
                      {e} <span className="font-semibold text-[11px]">{c}</span>
                    </button>
                  ))}
                </div>

                <div className={`flex gap-3 items-center mt-1 w-full ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Popover>
                      <PopoverTrigger asChild><button className="text-muted-foreground hover:text-foreground p-1"><Smile className="w-3.5 h-3.5" /></button></PopoverTrigger>
                      <PopoverContent className="w-[280px] p-2 flex flex-wrap gap-1 rounded-2xl shadow-xl border-border">
                        {EMOJI_DB.slice(0, 24).map((e) => (
                          <button key={e} onClick={() => toggleReaction(m.id, e)} className="text-xl hover:bg-secondary rounded-xl w-9 h-9 flex items-center justify-center transition-transform hover:scale-110">{e}</button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <button onClick={() => setReply(m)} className="text-muted-foreground hover:text-foreground p-1"><Reply className="w-3.5 h-3.5" /></button>
                    {canDelete && <button onClick={() => setConfirmDelete(m.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 flex items-center gap-1 font-medium">
                    {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: "Asia/Kolkata" })}
                    {isMe && reads.filter((r) => r.message_id === m.id && r.user_id !== user.id).length > 0 ? <CheckCheck className="w-[14px] h-[14px] text-blue-500" /> : isMe ? <Check className="w-[14px] h-[14px] opacity-50" /> : null}
                  </div>
                </div>
              </div>
            </div>
          );
        });
      })()}
      </div>

      <div className="bg-background border-t border-border/40 flex flex-col z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        {pendingMedia.length > 0 && (
          <div className="flex items-center gap-3 p-3 overflow-x-auto border-b border-border/40 bg-secondary/30">
            {pendingMedia.map((media, idx) => (
              <div key={idx} className="relative group shrink-0 rounded-xl overflow-hidden border border-border shadow-sm">
                {media.type === "image" && <img src={media.preview} alt="preview" className="h-16 w-16 object-cover" />}
                {media.type === "video" && <video src={media.preview} className="h-16 w-16 object-cover" />}
                {media.type === "audio" && <div className="h-16 w-16 bg-secondary flex items-center justify-center"><Music className="w-6 h-6 text-muted-foreground" /></div>}
                <button onClick={() => removePendingMedia(idx)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {voicePreview && (
            <div className="p-3 bg-secondary/40 border-b border-border/40 flex items-center gap-4">
                <div className="bg-primary text-primary-foreground p-2.5 rounded-full shadow-md"><Mic className="w-5 h-5" /></div>
                <div className="flex-1">
                    <audio src={voicePreview.url} controls className="h-10 w-full" />
                </div>
                <Button size="icon" variant="ghost" onClick={discardVoicePreview} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-5 h-5" /></Button>
                <Button size="icon" onClick={sendVoicePreview} disabled={isUploading} className="bg-primary text-primary-foreground rounded-full h-10 w-10 shadow-md hover:scale-105"><Send className="w-4 h-4 ml-0.5" /></Button>
            </div>
        )}

        {reply && (
          <div className="px-4 py-2.5 bg-secondary/40 flex items-center justify-between border-b border-border/40">
            <div className="flex flex-col overflow-hidden border-l-4 border-primary pl-3">
              <span className="text-[12px] font-bold text-primary mb-0.5 tracking-wide uppercase">Replying to</span>
              <span className="text-[13px] text-muted-foreground truncate">{reply.content ?? `Attachment: ${reply.media_type}`}</span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => setReply(null)}><X className="w-4 h-4" /></Button>
          </div>
        )}

        {/* Removed text banner as per user request to only show icon */}

        <div className="p-4 flex items-center gap-3 bg-background border-t-0">
          <input ref={mediaRef} type="file" accept="image/*,video/*" multiple onChange={(e) => handleStageMedia(e, "media")} className="hidden" />
          <input ref={audioRef} type="file" accept="audio/*" multiple onChange={(e) => handleStageMedia(e, "audio")} className="hidden" />
          
          <div className="flex-1 relative bg-secondary/50 rounded-[28px] flex items-center border border-border/30 transition-all duration-300 shadow-none px-2 h-[52px]">
            {!recording && !voicePreview && (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" className="rounded-full h-10 w-10 shrink-0 hover:bg-background/80" disabled={isBlocked}>
                      <Smile className="w-[22px] h-[22px] text-muted-foreground" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0 mb-3 shadow-2xl border-border/50 rounded-2xl overflow-hidden" side="top" align="start">
                    <Tabs defaultValue="emoji" className="w-full">
                    <TabsList className="w-full grid grid-cols-3 rounded-none border-b border-border/50 bg-secondary/80 p-0 h-12">
                        <TabsTrigger value="emoji" className="rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary">Emoji</TabsTrigger>
                        <TabsTrigger value="stickers" className="rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary">Stickers</TabsTrigger>
                        <TabsTrigger value="gifs" className="rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary">GIFs</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="emoji" className="p-3 h-80 overflow-y-auto bg-background m-0">
                        <div className="relative mb-3 sticky top-0 z-10 bg-background pb-2">
                        <Search className="w-4 h-4 absolute left-3 top-[14px] text-muted-foreground" />
                        <Input placeholder="Search emojis..." value={emojiSearch} onChange={e => setEmojiSearch(e.target.value)} className="h-10 pl-9 bg-secondary/50 border-none rounded-xl" />
                        </div>
                        <div className="grid grid-cols-8 gap-1.5">
                        {filteredEmojis.map(e => (
                            <button key={e} onClick={() => setText(prev => prev + e)} className="text-[28px] hover:bg-secondary rounded-xl p-1.5 text-center transition-transform hover:scale-110">{e}</button>
                        ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="stickers" className="p-3 h-80 overflow-y-auto bg-zinc-950/5 m-0">
                        <div className="relative mb-3 sticky top-0 z-10 bg-zinc-950/5 pb-2 backdrop-blur-md">
                        <Search className="w-4 h-4 absolute left-3 top-[14px] text-muted-foreground" />
                        <Input placeholder="Search stickers..." value={stickerSearch} onChange={e => setStickerSearch(e.target.value)} className="h-10 pl-9 bg-background border-none rounded-xl shadow-sm" />
                        </div>
                        {recentStickers.length > 0 && stickerSearch === "" && (
                        <div className="mb-5">
                            <span className="text-[11px] font-bold text-muted-foreground mb-2.5 block uppercase tracking-widest pl-1">Recent</span>
                            <div className="grid grid-cols-4 gap-3">
                            {recentStickers.map(s => (
                                <img key={`recent-${s.id}`} src={s.url} alt="sticker" onClick={() => sendRichMediaInstant(s.url, "sticker", s.id)} className="w-full aspect-square rounded-xl bg-background object-contain cursor-pointer hover:scale-110 transition-transform drop-shadow-sm p-1" />
                            ))}
                            </div>
                        </div>
                        )}
                        <div className="grid grid-cols-4 gap-3">
                        {filteredStickers.map(s => (
                            <img key={s.id} src={s.url} alt="sticker" onClick={() => sendRichMediaInstant(s.url, "sticker", s.id)} className="w-full aspect-square rounded-xl bg-background object-contain cursor-pointer hover:scale-110 transition-transform drop-shadow-sm p-1" />
                        ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="gifs" className="p-3 h-80 overflow-y-auto bg-background m-0">
                        <div className="relative mb-3 sticky top-0 z-10 bg-background pb-2">
                        <Search className="w-4 h-4 absolute left-3 top-[14px] text-muted-foreground" />
                        <Input placeholder="Search Tenor GIFs..." value={gifSearch} onChange={e => searchRealGifs(e.target.value)} className="h-10 pl-9 bg-secondary/50 border-none rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                        {realGifs.map(g => (
                            <img key={g.id} src={g.url} alt="gif" onClick={() => sendRichMediaInstant(g.url, "gif", g.id)} className="w-full h-32 rounded-xl bg-secondary object-cover cursor-pointer hover:opacity-80 transition-opacity shadow-sm" />
                        ))}
                        </div>
                    </TabsContent>
                    </Tabs>
                </PopoverContent>
                </Popover>
            )}

            {!recording && !voicePreview && (
              <Button type="button" size="icon" variant="ghost" className="rounded-full h-10 w-10 shrink-0 hover:bg-background/80" onClick={() => mediaRef.current?.click()} disabled={isBlocked}>
                <Paperclip className="w-[20px] h-[20px] text-muted-foreground" />
              </Button>
            )}

            {recording ? (
                <div className="flex-1 flex items-center gap-3 px-4 h-full">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                    <span className="text-sm font-medium animate-pulse text-red-500">{formatTime(recordTime)}</span>
                    <span className="text-sm text-muted-foreground ml-2">Recording Voice Note...</span>
                </div>
            ) : voicePreview ? (
                <div className="flex-1 flex items-center px-4 h-full">
                   <span className="text-sm text-muted-foreground italic">Preview ready to send</span>
                </div>
            ) : (
                <Input
                value={text}
                onChange={(e) => { setText(e.target.value); broadcastTyping(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); executeSendMediaAndText(); } }}
                placeholder={isBlockedByTarget ? "You cannot contact this user" : hasBlockedTarget ? "You blocked this chat" : "Type your message"}
                disabled={isBlocked}
                className="border-none bg-transparent shadow-none focus-visible:ring-0 h-full w-full text-[15px] px-3 font-medium placeholder:text-muted-foreground"
                />
            )}
          </div>

          <div className="flex gap-2">
            {voicePreview ? null : (
              <>
                {pendingMedia.length > 0 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (isBlocked) {
                        toast({ title: "Unavailable", description: "You cannot change view limits in a blocked chat.", variant: "destructive" });
                        return;
                      }
                      setViewLimitOption(prev => {
                        return prev === 0 ? 1 : prev === 1 ? 2 : 0;
                      });
                    }}
                    disabled={isBlocked}
                    className={`rounded-full h-[52px] w-[52px] shrink-0 transition-all duration-300 relative ${
                      viewLimitOption > 0 
                        ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] border border-red-500/20" 
                        : "bg-transparent hover:bg-secondary/80 text-muted-foreground"
                    }`}
                    title={viewLimitOption === 0 ? "Set View Once" : viewLimitOption === 1 ? "Set View Twice" : "Disable View Once/Twice"}
                  >
                    {viewLimitOption === 0 ? (
                      <EyeOff className="w-[24px] h-[24px]" />
                    ) : (
                      <div className="relative">
                        <Eye className="w-[24px] h-[24px]" />
                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-background shadow-sm">
                          {viewLimitOption}
                        </span>
                      </div>
                    )}
                  </Button>
                )}
                <Button 
                  type="button" 
                  size="icon" 
                  variant={recording ? "destructive" : "ghost"} 
                  onClick={recording ? stopRecording : startRecording} 
                  disabled={isBlocked} 
                  className={`rounded-full h-[52px] w-[52px] shrink-0 transition-all duration-300 ${recording ? "animate-pulse shadow-lg bg-red-500" : "bg-transparent hover:bg-secondary/80"}`}
                >
                  {recording ? <Square className="w-5 h-5 text-white" /> : <Mic className="w-[24px] h-[24px] text-muted-foreground" />}
                </Button>
              </>
            )}
            
            <Button 
              type="button" 
              size="icon" 
              onClick={executeSendMediaAndText} 
              disabled={isUploading || isBlocked || (!text.trim() && pendingMedia.length === 0)} 
              className="rounded-[20px] h-[52px] w-[64px] shrink-0 text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 border border-white/20 disabled:opacity-40 disabled:hover:scale-100"
              style={{
                background: (isUploading || isBlocked || (!text.trim() && pendingMedia.length === 0))
                  ? 'rgba(120,120,140,0.4)'
                  : 'linear-gradient(135deg, rgba(99,102,241,0.85) 0%, rgba(139,92,246,0.85) 100%)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: (!text.trim() && pendingMedia.length === 0) ? 'none' : '0 4px 20px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
              }}
            >
              <Send className="w-[18px] h-[18px]" />
            </Button>
          </div>
        </div>
      </div>
      </div>{/* end main chat column */}

      {/* Atome-style Details panel — slides in from right */}
      {detailsOpen && (
        <div className="w-72 shrink-0 border-l border-border/40 bg-background flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-200">
          {/* Details Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-border/40">
            <span className="font-bold text-[17px] text-foreground">Details</span>
          </div>

          {/* Mute messages */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/20">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-foreground" />
              <span className="text-[14px] font-medium text-foreground">Mute messages</span>
            </div>
            <Switch checked={isMuted} onCheckedChange={setIsMuted} className="data-[state=checked]:bg-primary" />
          </div>

          {/* Members */}
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Members</h3>
            {conv?.type === "group" ? (
              <div className="space-y-2">
                {groupMembers.map((uid) => {
                  const p = profiles[uid];
                  return (
                    <div key={uid} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={p?.avatar_url || ""} />
                          <AvatarFallback className="text-[11px] font-bold">{(p?.display_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-[14px] text-foreground">{p?.display_name || "User"}</div>
                        </div>
                      </div>
                      {isAdmin && uid !== user?.id && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeMemberFromGroup(uid)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : otherUserProfile ? (
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {otherUserProfile.avatar_url && <AvatarImage src={otherUserProfile.avatar_url} />}
                  <AvatarFallback className="text-[11px] font-bold">
                    {(otherUserProfile.display_name ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-[14px] text-foreground">{otherUserProfile.display_name || "User"}</div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Nicknames */}
          <button
            className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors border-t border-border/20"
            onClick={() => setIsEditingNickname((v) => !v)}
          >
            <span className="text-[14px] font-medium text-foreground">Nicknames</span>
          </button>
          {isEditingNickname && (
            <div className="px-4 pb-3">
              <div className="flex gap-2">
                <Input
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="Set nickname..."
                  className="h-9 text-sm rounded-xl"
                />
                <Button
                  size="sm"
                  className="h-9 px-3 rounded-xl"
                  disabled={nicknameInput.trim().length < 1}
                  onClick={() => {
                    localStorage.setItem(localNicknameKey, nicknameInput.trim());
                    setLocalNickname(nicknameInput.trim());
                    toast({ title: "Nickname saved" });
                    setIsEditingNickname(false);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Block */}
          {conv?.type !== "group" && (
            <button
              className="flex items-center px-4 py-3 hover:bg-secondary/40 transition-colors border-t border-border/20 w-full text-left"
              onClick={handleToggleBlock}
            >
              <span className="text-[14px] font-medium text-foreground">
                {hasBlockedTarget ? "Unblock" : "Block"}
              </span>
            </button>
          )}

          {/* Report */}
          <button
            className="flex items-center px-4 py-3 hover:bg-secondary/40 transition-colors border-t border-border/20 w-full text-left"
            onClick={() => toast({ title: "Report submitted", description: "Thank you for your report." })}
          >
            <span className="text-[14px] font-medium text-red-500">Report</span>
          </button>

          {/* Delete chat */}
          <button
            className="flex items-center px-4 py-3 hover:bg-secondary/40 transition-colors border-t border-border/20 w-full text-left"
            onClick={executeClearChat}
          >
            <span className="text-[14px] font-medium text-red-500">Delete chat</span>
          </button>
        </div>
      )}

      {/* OLD Dialog kept for AlertDialog below */}
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-border/50 shadow-2xl">
          <div className="bg-secondary/30 p-8 flex flex-col items-center justify-center border-b border-border/50">
             <Avatar className="w-28 h-28 border-4 border-background shadow-xl mb-4">
                {conv?.avatar_url ? <AvatarImage src={conv.avatar_url} /> : <AvatarFallback className="text-3xl"><Users /></AvatarFallback>}
             </Avatar>
             <h2 className="text-2xl font-bold tracking-tight">{headerTitle}</h2>
             <p className="text-muted-foreground font-medium mt-1">{conv?.type === "group" ? `${participantCount} participants` : "Direct Message"}</p>
          </div>
          
          <div className="px-6 py-6 space-y-6">
            
            {conv?.type === "group" && isAdmin && (
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm text-primary tracking-wide uppercase">Admin Controls</h3>
                    <div className="flex gap-2">
                        <Input value={editGroupName} onChange={e => setEditGroupName(e.target.value)} placeholder="New Group Name" className="bg-background"/>
                        <Button onClick={updateGroupName}>Save</Button>
                    </div>
                    <div className="flex gap-2">
                        <input type="file" ref={groupAvatarRef} className="hidden" accept="image/*" onChange={e => handleGroupImageUpload(e, "avatar_url")} />
                        <Button variant="secondary" className="flex-1 bg-background" onClick={() => groupAvatarRef.current?.click()}><ImageIcon className="w-4 h-4 mr-2"/> Icon</Button>
                        <input type="file" ref={groupWallpaperRef} className="hidden" accept="image/*" onChange={e => handleGroupImageUpload(e, "wallpaper_url")} />
                        <Button variant="secondary" className="flex-1 bg-background" onClick={() => groupWallpaperRef.current?.click()}><ImageIcon className="w-4 h-4 mr-2"/> Wallpaper</Button>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-primary/10">
                        <Input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="Display Name of User..." className="bg-background"/>
                        <Button onClick={addMemberToGroup}>Add Member</Button>
                    </div>
                    <div className="pt-3">
                        <Button variant="destructive" className="w-full" onClick={deleteGroup}>Delete Group</Button>
                    </div>
                </div>
            )}

            {conv?.type === "group" ? (
                <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pl-1">Members List</h3>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                        {groupMembers.map(uid => {
                            const p = profiles[uid];
                            return (
                                <div key={uid} className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary/40 transition-colors border border-transparent hover:border-border/50">
                                    <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { setDetailsOpen(false); setProfileModalUserId(uid); }}>
                                        <Avatar className="w-9 h-9 shadow-sm"><AvatarImage src={p?.avatar_url || ""} /><AvatarFallback>{(p?.display_name || "?").slice(0,2)}</AvatarFallback></Avatar>
                                        <span className="font-medium text-[15px] hover:underline decoration-primary">{p?.display_name || "Unknown User"}</span>
                                    </div>
                                    {isAdmin && uid !== user?.id && (
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeMemberFromGroup(uid)}><X className="w-4 h-4"/></Button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-full"><Bell className="w-5 h-5" /></div>
                  <div className="flex flex-col">
                    <span className="text-[15px] font-semibold">Mute Notifications</span>
                    <span className="text-[13px] text-muted-foreground">Silence all messages</span>
                  </div>
                </div>
                <Switch checked={isMuted} onCheckedChange={setIsMuted} className="data-[state=checked]:bg-primary" />
              </div>
            )}

            {conv?.type !== "group" && (
              <div className="p-3 rounded-2xl hover:bg-secondary/30 transition-colors space-y-3">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-full"><Edit2 className="w-5 h-5" /></div>
                  <div className="flex flex-col flex-1">
                      <span className="text-[15px] font-semibold">Global Nickname</span>
                      <span className="text-[13px] text-muted-foreground">{nickname || "Set a display name"}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setIsEditingNickname(!isEditingNickname)}>{isEditingNickname ? "Cancel" : "Edit"}</Button>
                </div>
                {isEditingNickname && (
                  <div className="flex gap-2 pl-[52px] pt-2">
                    <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Enter new name..." className="h-10 rounded-xl" />
                    <Button size="sm" onClick={savePermanentNickname} className="h-10 rounded-xl px-4">Save</Button>
                  </div>
                )}
              </div>
            )}

            {conv?.type !== "group" && (
              <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-destructive/5 transition-colors border border-transparent hover:border-destructive/20">
                <div className="flex items-center gap-4 text-destructive">
                  <div className="bg-destructive/10 p-3 rounded-full"><Ban className="w-5 h-5" /></div>
                  <div className="flex flex-col">
                    <span className="text-[15px] font-semibold">Block User</span>
                    <span className="text-[13px] opacity-80">Stop receiving messages</span>
                  </div>
                </div>
                <Switch checked={hasBlockedTarget} onCheckedChange={handleToggleBlock} className="data-[state=checked]:bg-destructive" />
              </div>
            )}

            <div className="pt-2">
              <Button variant="destructive" className="w-full h-12 rounded-xl flex items-center gap-2 text-[15px] font-semibold shadow-sm hover:shadow-md transition-shadow" onClick={() => executeClearChat()}>
                <Trash2 className="w-4 h-4" /> Delete Entire Chat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete message?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">This action is permanent and cannot be reversed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMessage(confirmDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-11">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* User Profile Modal */}
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
          onStartChat={(uid) => {
            setProfileModalUserId(null);
          }}
        />
      )}

      {secureViewMessage && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center select-none"
          onContextMenu={e => e.preventDefault()}
        >
          <style dangerouslySetInnerHTML={{__html: `
            body {
              -webkit-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
              user-select: none;
            }
            @media print {
              body { display: none; }
            }
          `}} />
          {/* Top Header Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent text-white">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-red-500 text-[11px] font-bold uppercase rounded-md tracking-wider animate-pulse">
                View {secureViewMessage.view_limit === 1 ? "Once" : "Twice"} Secure
              </span>
              <span className="text-sm text-zinc-400">Screenshots are restricted</span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10" onClick={closeSecureLightbox}>
              <X className="w-6 h-6" />
            </Button>
          </div>
          {/* Protected Image */}
          <div className="w-full h-full flex items-center justify-center p-4">
            <img 
              src={secureViewMessage.media_url || ""} 
              alt="secure" 
              className="max-w-full max-h-[85vh] rounded-xl object-contain pointer-events-none select-none shadow-2xl"
              style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
              onDragStart={e => e.preventDefault()}
            />
          </div>
          {/* Footer Warning */}
          <div className="absolute bottom-6 text-zinc-400 text-xs font-medium text-center px-6 leading-relaxed max-w-md">
            This image will be permanently deleted after you close this screen.
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoom;
