import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Bell, Heart, MessageSquare, UserPlus, Check, X, ShieldAlert, ArrowRight, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CustomToast {
  id: string;
  type: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatar: string;
  description: string;
  actionUrl: string;
  postThumbnail: string | null;
  postIsVideo: boolean;
  isRequest: boolean; // is pending follow request
  followBackStatus: "none" | "following" | "pending"; // our follow status towards them
  isSenderPrivate: boolean;
  isActioned: boolean;
  actionResult?: string;
  duration: number; // remaining duration in ms
  paused: boolean;
}

export default function NotificationObserver() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<CustomToast[]>([]);
  const timeoutsRef = useRef<Record<string, { timerId: any; startTime: number; remaining: number }>>({});

  useEffect(() => {
    if (!user) return;

    // Listen to inserts on the notifications table for this user
    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const notification = payload.new as any;
          
          // Don't show toast if user is the sender
          if (notification.sender_id === user.id) return;

          // Fetch sender profile to show their avatar, display name, username, and private status
          const { data: sender } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url, is_private")
            .eq("user_id", notification.sender_id)
            .maybeSingle();

          const senderName = sender?.display_name || sender?.username || "Someone";
          const senderUsername = sender?.username || "user";
          const senderAvatar = sender?.avatar_url || "";
          const isSenderPrivate = !!sender?.is_private;

          let description = "";
          let actionUrl = "";
          let postThumbnail: string | null = null;
          let postIsVideo = false;
          let isRequest = false;
          let followBackStatus: "none" | "following" | "pending" = "none";

          // Fetch post thumbnail if post_id is provided
          if (notification.post_id) {
            const { data: post } = await supabase
              .from("posts")
              .select("image_url, media_type")
              .eq("id", notification.post_id)
              .maybeSingle();
            if (post) {
              postThumbnail = post.image_url;
              postIsVideo = post.media_type === "video";
            }
          }

          // Contextual analysis of notification type
          switch (notification.type) {
            case "follow":
              // Check if there is a pending request from this user to us (means they requested, so it's a follow request)
              const { data: pendingReq } = await supabase
                .from("user_follows")
                .select("status")
                .eq("follower_id", notification.sender_id)
                .eq("following_id", user.id)
                .eq("status", "pending")
                .maybeSingle();

              if (pendingReq) {
                isRequest = true;
                description = "requested to follow you.";
                actionUrl = "/activity"; // Redirect to activity to manage
              } else {
                description = "started following you.";
                actionUrl = `/profile/${notification.sender_id}`;
              }

              // Check our follow status towards the sender (to see if we can "Follow Back")
              const { data: myFollow } = await supabase
                .from("user_follows")
                .select("status")
                .eq("follower_id", user.id)
                .eq("following_id", notification.sender_id)
                .maybeSingle();

              if (myFollow) {
                followBackStatus = myFollow.status as any; // "following" | "pending"
              }
              break;

            case "like":
              description = "liked your post.";
              actionUrl = `/gallery`; // Routes to gallery/post
              break;

            case "comment":
              description = `commented: "${notification.content || ""}"`;
              actionUrl = `/gallery`;
              break;

            case "follow_accept":
              description = "accepted your follow request.";
              actionUrl = `/profile/${notification.sender_id}`;
              break;

            case "chat_message":
              description = `sent you a message: "${notification.content || ""}"`;
              actionUrl = `/chat`;
              break;

            case "share":
              description = "shared a post with you.";
              actionUrl = `/chat`;
              break;

            case "save":
              description = "saved your post.";
              actionUrl = `/profile`;
              break;

            default:
              description = notification.content || "sent you a notification.";
              actionUrl = `/gallery`;
          }

          const toastId = notification.id || Math.random().toString(36).substring(2, 9);
          const newToast: CustomToast = {
            id: toastId,
            type: notification.type,
            senderId: notification.sender_id,
            senderName,
            senderUsername,
            senderAvatar,
            description,
            actionUrl,
            postThumbnail,
            postIsVideo,
            isRequest,
            followBackStatus,
            isSenderPrivate,
            isActioned: false,
            duration: 5000,
            paused: false,
          };

          setToasts((prev) => [newToast, ...prev].slice(0, 3)); // Display up to 3 toasts concurrently
          startToastTimer(toastId, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Clean up timers
      Object.values(timeoutsRef.current).forEach((t) => clearTimeout(t.timerId));
    };
  }, [user]);

  const startToastTimer = (id: string, duration: number) => {
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id].timerId);
    }
    const timerId = setTimeout(() => {
      dismissToast(id);
    }, duration);

    timeoutsRef.current[id] = {
      timerId,
      startTime: Date.now(),
      remaining: duration,
    };
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id].timerId);
      delete timeoutsRef.current[id];
    }
  };

  const pauseToastTimer = (id: string) => {
    const timer = timeoutsRef.current[id];
    if (!timer) return;

    clearTimeout(timer.timerId);
    const elapsed = Date.now() - timer.startTime;
    timer.remaining = Math.max(0, timer.remaining - elapsed);

    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, paused: true } : t))
    );
  };

  const resumeToastTimer = (id: string) => {
    const timer = timeoutsRef.current[id];
    if (!timer) return;

    timer.startTime = Date.now();
    timer.timerId = setTimeout(() => {
      dismissToast(id);
    }, timer.remaining);

    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, paused: false } : t))
    );
  };

  // Direct Button actions on the toast banner in real-time
  const handleConfirmRequest = async (e: React.MouseEvent, toast: CustomToast) => {
    e.stopPropagation();
    if (!user) return;

    setToasts((prev) =>
      prev.map((t) =>
        t.id === toast.id
          ? { ...t, isActioned: true, actionResult: "Confirmed" }
          : t
      )
    );

    // Perform database operations in real-time
    await supabase
      .from("user_follows")
      .update({ status: "following" })
      .eq("follower_id", toast.senderId)
      .eq("following_id", user.id);

    await supabase.from("notifications").insert({
      recipient_id: toast.senderId,
      sender_id: user.id,
      type: "follow_accept",
    });

    // Auto dismiss after 1.5 seconds when action completes
    startToastTimer(toast.id, 1500);
  };

  const handleDeleteRequest = async (e: React.MouseEvent, toast: CustomToast) => {
    e.stopPropagation();
    if (!user) return;

    setToasts((prev) =>
      prev.map((t) =>
        t.id === toast.id
          ? { ...t, isActioned: true, actionResult: "Deleted" }
          : t
      )
    );

    await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", toast.senderId)
      .eq("following_id", user.id);

    // Auto dismiss after 1.2 seconds when deletion completes
    startToastTimer(toast.id, 1200);
  };

  const handleFollowBack = async (e: React.MouseEvent, toast: CustomToast) => {
    e.stopPropagation();
    if (!user) return;

    const newStatus = toast.isSenderPrivate ? "pending" : "following";
    
    setToasts((prev) =>
      prev.map((t) =>
        t.id === toast.id
          ? {
              ...t,
              followBackStatus: newStatus as any,
              isActioned: true,
              actionResult: newStatus === "pending" ? "Requested" : "Following",
            }
          : t
      )
    );

    await supabase.from("user_follows").insert({
      follower_id: user.id,
      following_id: toast.senderId,
      status: newStatus,
    });

    await supabase.from("notifications").insert({
      recipient_id: toast.senderId,
      sender_id: user.id,
      type: "follow",
    });

    // Auto dismiss after 1.8 seconds when action completes
    startToastTimer(toast.id, 1800);
  };

  const handleToastClick = (toast: CustomToast) => {
    dismissToast(toast.id);
    navigate(toast.actionUrl);
  };

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        .atome-toast-container {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: calc(100vw - 32px);
          max-width: 420px;
          pointer-events: none;
        }
        .atome-toast-card {
          pointer-events: auto;
          background: rgba(18, 18, 18, 0.85);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 12px 14px;
          color: #ffffff;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          animation: slideDownBounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .atome-toast-card:hover {
          transform: scale(1.02);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .atome-toast-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, #f99f1b 0%, #d82b7e 50%, #833ab4 100%);
          border-bottom-left-radius: 20px;
          border-bottom-right-radius: 20px;
          width: 100%;
          transform-origin: left;
        }
        .animate-progress-shrink {
          animation: shrinkProgress 5s linear forwards;
        }
        .animate-progress-paused {
          animation-play-state: paused;
        }
        @keyframes slideDownBounce {
          from {
            transform: translate(0, -40px) scale(0.85);
            opacity: 0;
          }
          to {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
        }
        @keyframes shrinkProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
 
      <div className="atome-toast-container">
        {toasts.map((toast) => {
          const initials = toast.senderName.slice(0, 2).toUpperCase();
          const showFollowBtn =
            (toast.type === "follow" || toast.type === "follow_accept") &&
            toast.followBackStatus === "none" &&
            !toast.isRequest;
 
          return (
            <div
              key={toast.id}
              className="atome-toast-card relative overflow-hidden"
              onClick={() => handleToastClick(toast)}
              onMouseEnter={() => pauseToastTimer(toast.id)}
              onMouseLeave={() => resumeToastTimer(toast.id)}
            >
              {/* Progress dismiss bar */}
              <div
                className={`atome-toast-progress ${
                  toast.paused ? "animate-progress-paused" : "animate-progress-shrink"
                }`}
                style={{
                  animationDuration: `${timeoutsRef.current[toast.id]?.remaining || 5000}ms`,
                }}
              />

              {/* Sender details on left */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-[#f99f1b] via-[#d82b7e] to-[#833ab4]">
                    <Avatar className="w-10 h-10 border-2 border-black">
                      <AvatarImage src={toast.senderAvatar} className="object-cover" />
                      <AvatarFallback className="bg-neutral-800 text-white text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0095f6] border-2 border-black rounded-full flex items-center justify-center">
                    {toast.type === "like" && <Heart className="w-2.5 h-2.5 fill-white text-white" />}
                    {toast.type === "comment" && <MessageSquare className="w-2.5 h-2.5 text-white fill-white" />}
                    {(toast.type === "follow" || toast.type === "follow_accept") && <UserPlus className="w-2.5 h-2.5 text-white" />}
                    {toast.type === "chat_message" && <MessageSquare className="w-2.5 h-2.5 text-white" />}
                    {toast.type === "share" && <ArrowRight className="w-2.5 h-2.5 text-white" />}
                    {toast.type === "save" && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                </div>

                <div className="flex flex-col min-w-0 pt-0.5">
                  <span className="text-[13px] font-extrabold text-white leading-tight truncate">
                    {toast.senderUsername}
                  </span>
                  <span className="text-[12px] text-neutral-300 leading-snug font-medium line-clamp-2">
                    {toast.description}
                  </span>
                </div>
              </div>

              {/* Action buttons or preview image on right */}
              <div className="flex items-center gap-2 shrink-0 interactive-zone">
                {/* 1. Follow Requests banner action buttons */}
                {toast.isRequest && !toast.isActioned && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => handleConfirmRequest(e, toast)}
                      className="px-3 py-1.5 rounded-lg bg-[#0095f6] text-white text-[11px] font-bold shadow-md hover:bg-[#1877f2] active:scale-95 transition-all"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={(e) => handleDeleteRequest(e, toast)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 text-white text-[11px] font-bold border border-white/5 hover:bg-neutral-700 active:scale-95 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                )}

                {/* 2. Follow back button */}
                {showFollowBtn && !toast.isActioned && (
                  <button
                    onClick={(e) => handleFollowBack(e, toast)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0095f6] text-white text-[11px] font-bold hover:bg-[#1877f2] active:scale-95 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <UserPlus className="w-3 h-3" /> Follow Back
                  </button>
                )}

                {/* 3. Action Complete Status text inside banner */}
                {toast.isActioned && toast.actionResult && (
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold flex items-center gap-1 border border-white/5 animate-pulse">
                    <Check className="w-3 h-3 text-green-400" /> {toast.actionResult}
                  </span>
                )}

                {/* 4. Post Thumbnail (far right) */}
                {toast.postThumbnail && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 relative bg-neutral-900 group">
                    {toast.postIsVideo ? (
                      <>
                        <video
                          src={toast.postThumbnail}
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        <Video className="w-3 h-3 text-white absolute bottom-1 right-1 drop-shadow-md" />
                      </>
                    ) : (
                      <img
                        src={toast.postThumbnail}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                )}

                {/* 5. Generic Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissToast(toast.id);
                  }}
                  className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
