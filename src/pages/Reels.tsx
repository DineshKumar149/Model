import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Volume2, VolumeX, ArrowUp, ArrowDown, Bookmark, MoreHorizontal, X, ArrowLeft, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ShareDialog from "@/components/shared/ShareDialog";
import { useTheme } from "@/components/shared/ThemeProvider";
import { formatDistanceToNow } from "date-fns";
import { isAdminUser } from "@/lib/admin";
import AllLikesModal from "@/components/profile/AllLikesModal";


interface Profile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at?: string;
}

interface Reel {
  id: string;
  user_id: string;
  image_url: string; // The video URL
  caption: string | null;
  likes_count: number;
  created_at: string;
  hide_likes?: boolean;
  turn_off_commenting?: boolean;
  music_title?: string | null;
  authorProfile?: Profile | null;
}

const ReelItem = ({
  reel,
  currentUser,
  isMuted,
  toggleMute,
  isActive,
}: {
  reel: Reel;
  currentUser: any;
  isMuted: boolean;
  toggleMute: () => void;
  isActive: boolean;
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.likes_count || 0);
  const [likeRecordId, setLikeRecordId] = useState<string | null>(null);

  const [isSaved, setIsSaved] = useState(false);
  const [followStatus, setFollowStatus] = useState<"following" | "pending" | "none">("none");

  // Comments state
  const [comments, setComments] = useState<any[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Modals & Popups
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsView, setOptionsView] = useState<"menu" | "share_to" | "about_account">("menu");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [showAllLikes, setShowAllLikes] = useState(false);
  const [recentLiker, setRecentLiker] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [showPlayIndicator, setShowPlayIndicator] = useState<"play" | "pause" | null>(null);
  const isAdmin = isAdminUser(currentUser?.email);
  const canSeeLikes = !reel.hide_likes || (currentUser && currentUser.id === reel.user_id);
  const commentsDisabled = !!reel.turn_off_commenting;

  // Play/pause and mute effects
  useEffect(() => {
    if (isActive) {
      videoRef.current?.play().catch(() => {});
      setVideoPlaying(true);
    } else {
      videoRef.current?.pause();
      setVideoPlaying(false);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Load likes, saved posts, and follow relationship
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser || !reel.user_id) return;

      // 1. Likes
      const { count } = await supabase
        .from("post_likes")
        .select("id", { count: "exact" })
        .eq("post_id", reel.id);
      setLikesCount(count || 0);

      const { data: userLike } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", reel.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (userLike) {
        setLiked(true);
        setLikeRecordId(userLike.id);
      }

      // 2. Saved
      const saved = currentUser.user_metadata?.saved_posts || [];
      setIsSaved(saved.includes(reel.id));

      // 3. Follow status
      const { data: follow } = await supabase
        .from("user_follows")
        .select("status")
        .eq("follower_id", currentUser.id)
        .eq("following_id", reel.user_id)
        .maybeSingle();
      
      if (follow) {
        setFollowStatus(follow.status as "following" | "pending");
      } else {
        setFollowStatus("none");
      }

      // 4. Recent liker
      const { data: recentLikes } = await supabase
        .from("post_likes")
        .select("user_id")
        .eq("post_id", reel.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentLikes && recentLikes.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("user_id", recentLikes[0].user_id)
          .maybeSingle();
        setRecentLiker(profile);
      } else {
        setRecentLiker(null);
      }
    };

    loadData();
  }, [reel.id, reel.user_id, currentUser]);

  // Load and subscribe to comments in real-time
  const loadComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("post_comments")
        .select("id, post_id, user_id, content, created_at")
        .eq("post_id", reel.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = Array.from(new Set(data.map((c) => c.user_id)));
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url, email")
          .in("user_id", userIds);
        
        if (profileError) throw profileError;
        
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
        
        const mappedComments = data.map((c) => {
          const p = profileMap.get(c.user_id);
          return {
            id: c.id,
            post_id: c.post_id,
            user_id: c.user_id,
            content: c.content,
            created_at: c.created_at,
            profiles: p ? {
              user_id: p.user_id,
              display_name: p.display_name,
              username: p.username || p.display_name || p.email?.split("@")[0] || "user",
              avatar_url: p.avatar_url
            } : null
          };
        });
        
        setComments(mappedComments);
      } else {
        setComments([]);
      }
    } catch (err: any) {
      console.error("Error loading comments:", err.message);
    }
  }, [reel.id]);

  useEffect(() => {
    loadComments();

    const channel = supabase
      .channel(`reel-comments-${reel.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${reel.id}` },
        () => loadComments()
      )
      .subscribe();

    const profilesChannel = supabase
      .channel(`reel-commenter-profiles-${reel.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => loadComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profilesChannel);
    };
  }, [reel.id, loadComments]);

  const handleLike = async () => {
    if (!currentUser) return;
    if (liked) {
      setLiked(false);
      setLikesCount((prev) => prev - 1);
      if (likeRecordId) {
        await supabase.from("post_likes").delete().eq("id", likeRecordId);
        setLikeRecordId(null);
        if (reel.user_id !== currentUser.id) {
          await supabase.from("notifications").delete().eq("recipient_id", reel.user_id).eq("sender_id", currentUser.id).eq("type", "like").eq("post_id", reel.id);
        }
      }
    } else {
      setLiked(true);
      setLikesCount((prev) => prev + 1);
      const { data } = await supabase
        .from("post_likes")
        .insert({ post_id: reel.id, user_id: currentUser.id })
        .select()
        .single();
      if (data) {
        setLikeRecordId(data.id);
        if (reel.user_id !== currentUser.id) {
          await supabase.from("notifications").insert({
            recipient_id: reel.user_id,
            sender_id: currentUser.id,
            type: "like",
            content: reel.id,
            post_id: reel.id,
          });
        }
      }
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    const currentSaved = currentUser.user_metadata?.saved_posts || [];
    let newSaved;

    if (isSaved) {
      newSaved = currentSaved.filter((id: string) => id !== reel.id);
      setIsSaved(false);
      toast({ title: "Removed from saved" });
    } else {
      newSaved = [...currentSaved, reel.id];
      setIsSaved(true);
      toast({ title: "Saved to your profile" });
    }

    await supabase.auth.updateUser({ data: { saved_posts: newSaved } });
  };

  const handleToggleFollow = async () => {
    if (!currentUser || !reel.user_id) return;

    if (followStatus === "following") {
      setFollowStatus("none");
      await supabase.from("user_follows").delete().eq("follower_id", currentUser.id).eq("following_id", reel.user_id);
      toast({ title: "Unfollowed successfully" });
    } else if (followStatus === "pending") {
      setFollowStatus("none");
      await supabase.from("user_follows").delete().eq("follower_id", currentUser.id).eq("following_id", reel.user_id);
      toast({ title: "Follow request cancelled" });
    } else {
      // Fetch privacy
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_private")
        .eq("user_id", reel.user_id)
        .maybeSingle();

      const isPrivate = profile?.is_private || false;
      const newStatus = isPrivate ? "pending" : "following";
      setFollowStatus(newStatus);

      const { error } = await supabase
        .from("user_follows")
        .insert({ follower_id: currentUser.id, following_id: reel.user_id, status: newStatus });

      if (error) {
        setFollowStatus("none");
        toast({ title: "Failed to follow", variant: "destructive" });
      } else {
        await supabase.from("notifications").insert({
          recipient_id: reel.user_id,
          sender_id: currentUser.id,
          type: "follow",
        });
        toast({
          title: newStatus === "pending" ? "Follow Request Sent" : "Following",
          description: newStatus === "pending" ? "Waiting for approval." : `You are now following ${displayName}.`,
        });
      }
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser || postingComment) return;
    setPostingComment(true);

    try {
      const { error } = await supabase.from("post_comments").insert({
        post_id: reel.id,
        user_id: currentUser.id,
        content: newComment.trim(),
      });

      if (error) throw error;
      setNewComment("");

      if (reel.user_id !== currentUser.id) {
        await supabase.from("notifications").insert({
          recipient_id: reel.user_id,
          sender_id: currentUser.id,
          type: "comment",
          content: newComment.trim(),
          post_id: reel.id,
        });
      }
    } catch (err: any) {
      toast({ title: "Error posting comment", description: err.message, variant: "destructive" });
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const commentToDelete = comments.find((c) => c.id === commentId);
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
      
      if (commentToDelete && reel.user_id !== currentUser.id) {
         await supabase.from("notifications").delete()
           .eq("recipient_id", reel.user_id)
           .eq("sender_id", currentUser.id)
           .eq("type", "comment")
           .eq("post_id", reel.id)
           .eq("content", commentToDelete.content);
      }
      
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({ title: "Comment deleted" });
    } catch (err: any) {
      toast({ title: "Error deleting comment", description: err.message, variant: "destructive" });
    }
  };

  const formatTime = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return "";
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoPlaying) {
      videoRef.current.pause();
      setVideoPlaying(false);
      setShowPlayIndicator("pause");
    } else {
      videoRef.current.play().catch(() => {});
      setVideoPlaying(true);
      setShowPlayIndicator("play");
    }
    setTimeout(() => setShowPlayIndicator(null), 500);
  };

  const shareToPlatform = (platform: string) => {
    const url = `${window.location.origin}/profile/${reel.user_id}`;
    if (platform === "threads") {
      window.open(`https://threads.net/intent/post?text=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "whatsapp") {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard!" });
    }
    setOptionsOpen(false);
  };

  const getInitials = (profile: Profile | null | undefined) => {
    if (!profile) return "U";
    const name = profile.username || profile.display_name || "User";
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = reel.authorProfile?.username || reel.authorProfile?.display_name || "User";
  const authorAvatar = reel.authorProfile?.avatar_url || "";
  const joinedDate = reel.authorProfile?.created_at
    ? new Date(reel.authorProfile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "April 2021";

  return (
    <div className={`w-full h-full flex items-center justify-center ${isDark ? "bg-[#000]" : "bg-[#fafafa]"} relative select-none`}>
      {showAllLikes && (
        <AllLikesModal postId={reel.id} onClose={() => setShowAllLikes(false)} />
      )}
      {/*
        Layout: Video Card centered + Action Icons to the right.
        Comments/Options panels overlay as floating panels positioned to the right of the video.
      */}
      <div className="flex items-end justify-center relative h-[calc(100vh-20px)] max-h-none w-full max-w-[950px] px-4 transition-all duration-300">
        
        {/* 1. Main Video Container */}
        <div className={`relative w-[500px] md:w-[600px] h-full bg-black overflow-hidden border ${isDark ? "border-neutral-800" : "border-neutral-200"} shadow-2xl flex items-center justify-center group/player rounded-2xl`}>
          <video
            ref={videoRef}
            src={reel.image_url}
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover cursor-pointer select-none"
            onClick={togglePlayPause}
          />

          {/* Video Mute Toggle bottom right */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="absolute bottom-4 right-4 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-20 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Play/Pause state center overlay */}
          {showPlayIndicator && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none z-20">
              <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white scale-110 transition-all duration-300">
                {showPlayIndicator === "play" ? (
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <rect x="5" y="4" width="4" height="16" />
                    <rect x="15" y="4" width="4" height="16" />
                  </svg>
                )}
              </div>
            </div>
          )}

          {/* Left overlapping info (Tapping avatar/username navigates to profile) */}
          <div className="absolute bottom-4 left-4 right-12 z-10 flex flex-col gap-2 text-left pointer-events-auto">
            <div className="flex items-center gap-2">
              <Avatar 
                className="w-8 h-8 ring-1 ring-white/10 shadow-md cursor-pointer hover:opacity-90"
                onClick={() => navigate(`/profile/${reel.user_id}`)}
              >
                <AvatarImage src={authorAvatar} className="object-cover" />
                <AvatarFallback className="bg-neutral-800 text-white font-bold text-[10px]">
                  {getInitials(reel.authorProfile)}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1 min-w-0">
                <span 
                  className="text-white font-bold text-xs hover:underline cursor-pointer truncate"
                  onClick={() => navigate(`/profile/${reel.user_id}`)}
                >
                  {displayName}
                </span>
                <span className="text-white/60 text-[9px] select-none">•</span>
                {currentUser && currentUser.id !== reel.user_id && (
                  <button
                    onClick={handleToggleFollow}
                    className={`text-[10px] font-bold transition-all cursor-pointer ${
                      followStatus === "following"
                        ? "text-white/70 hover:text-white"
                        : followStatus === "pending"
                        ? "text-white/50"
                        : "text-[#0095f6] hover:text-[#1877f2]"
                    }`}
                  >
                    {followStatus === "following" ? "Following" : followStatus === "pending" ? "Requested" : "Follow"}
                  </button>
                )}
              </div>
            </div>

            {reel.caption && (
              <p className="text-white/95 text-[11px] drop-shadow-md leading-relaxed pr-2 font-medium line-clamp-3 select-text">
                {reel.caption}
              </p>
            )}

            {/* Music title overlay */}
            {reel.music_title && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }}>
                  <svg className="w-2 h-2 text-white fill-white" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="2" fill="none" /></svg>
                </div>
                <span className="text-white text-[10px] font-semibold drop-shadow-md truncate max-w-[160px]">
                  {reel.music_title}
                </span>
              </div>
            )}
          </div>

          {/* Bottom edge shadow overlay */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-0" />
        </div>

        {/* 2. Floating Comments Panel — overlaid to the right of the video card */}
        {commentsOpen && (
          <div className={`absolute left-[calc(50%+260px)] md:left-[calc(50%+315px)] bottom-0 w-[300px] md:w-[340px] h-full ${isDark ? "bg-[#1c1c1e] text-white border-white/10" : "bg-white text-black border-neutral-200"} border rounded-2xl z-30 flex flex-col animate-in slide-in-from-right duration-250 text-left shadow-2xl`}>
            {/* Header */}
            <div className={`flex flex-col px-4 pt-4 pb-3 border-b ${isDark ? "border-white/10" : "border-neutral-200"}`}>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCommentsOpen(false)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"} transition-colors cursor-pointer`}
                >
                  <X className={`w-4 h-4 ${isDark ? "text-white/80" : "text-neutral-600"}`} />
                </button>
                <span className="font-bold text-sm">Comments</span>
                <div className="w-8" /> {/* spacer */}
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 text-center">All thoughts on this memory</p>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4.5 scrollbar-thin">
              {comments.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-full text-center ${isDark ? "text-white/40" : "text-neutral-400"}`}>
                  <MessageCircle className={`w-10 h-10 ${isDark ? "text-white/20" : "text-neutral-200"} mb-2`} />
                  <p className="font-semibold text-xs">No comments yet</p>
                  <p className="text-[10px] mt-0.5">Start the conversation</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const canDelete = isAdmin || currentUser?.id === comment.user_id;
                  const cInitials = (comment.profiles?.username || "user").slice(0, 2).toUpperCase();
                  return (
                    <div key={comment.id} className="flex gap-3 items-start select-text text-left group">
                      <Avatar 
                        className={`w-8 h-8 shrink-0 ring-1 ring-border/50 cursor-pointer hover:opacity-90`}
                        onClick={() => {
                          setCommentsOpen(false);
                          navigate(`/profile/${comment.user_id}`);
                        }}
                      >
                        <AvatarImage src={comment.profiles?.avatar_url || ""} className="object-cover" />
                        <AvatarFallback className="text-[10px] bg-secondary font-semibold">
                          {(comment.profiles?.display_name || comment.profiles?.username || "U").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <span className={`text-[13px] leading-snug break-words ${isDark ? "text-white/90" : "text-foreground/90"}`}>
                            <span 
                              className="font-bold mr-2 hover:underline cursor-pointer text-foreground dark:text-white"
                              onClick={() => {
                                      setCommentsOpen(false);
                                      navigate(`/profile/${comment.user_id}`);
                              }}
                            >
                              {comment.profiles?.display_name || comment.profiles?.username || "user"}
                            </span>
                            {comment.content}
                          </span>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-3.5 mt-1 text-[11px] text-muted-foreground font-semibold tracking-wide">
                          <span>{new Date(comment.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
                          <button 
                            className="hover:text-foreground dark:hover:text-white transition-colors cursor-pointer"
                            onClick={() => {
                              setNewComment(`@${comment.profiles?.username || comment.profiles?.display_name || "user"} `);
                              commentInputRef.current?.focus();
                            }}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Likes section (just like Feed/Home) */}
            <div className={`px-4 py-3 border-t ${isDark ? "border-white/10 bg-[#1c1c1e]" : "border-neutral-200 bg-white"} shrink-0`}>
              <div className="flex items-center justify-between mb-2">
                <button onClick={handleLike} className="hover:opacity-70 transition-transform active:scale-90 cursor-pointer">
                  <Heart
                    className={`w-6 h-6 transition-all duration-300 ${liked ? "fill-red-500 text-red-500 scale-110" : (isDark ? "text-white" : "text-black")}`}
                  />
                </button>
                <button onClick={handleSave} className="hover:opacity-70 transition-transform active:scale-90 cursor-pointer">
                  <Bookmark
                    className={`w-6 h-6 transition-all duration-300 ${isSaved ? (isDark ? "fill-white text-white" : "fill-black text-black") : (isDark ? "text-white" : "text-black")}`}
                  />
                </button>
              </div>
              {likesCount > 0 && (
                <div className="text-[12px] font-semibold mb-1">
                  {recentLiker ? (
                    <>
                      Liked by{" "}
                      <span className="font-bold">{recentLiker.display_name || recentLiker.username || "someone"}</span>
                      {likesCount > 1 && (
                        <>
                          {" "}and{" "}
                          <button
                            onClick={() => setShowAllLikes(true)}
                            className="font-bold hover:underline cursor-pointer"
                          >
                            {likesCount - 1} {likesCount - 1 === 1 ? "other" : "others"}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => setShowAllLikes(true)}
                      className="font-bold hover:underline cursor-pointer"
                    >
                      {likesCount} {likesCount === 1 ? "like" : "likes"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Add comment entry box */}
            <div className={`p-4 border-t ${isDark ? "border-white/10 bg-[#1c1c1e]" : "border-neutral-200 bg-white"} flex flex-col gap-2 shrink-0`}>
              <div className="flex items-center gap-2.5 w-full">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={currentUser?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback className="bg-neutral-800 text-white font-bold text-xs">
                    {currentUser?.email?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 relative flex items-center">
                  <input
                    ref={commentInputRef}
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    className={`w-full ${isDark ? "bg-[#2c2c2e] text-white placeholder-white/40" : "bg-neutral-100 text-black placeholder-neutral-400"} border-none rounded-full py-2 pl-4 pr-10 text-xs focus:outline-none`}
                  />
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`absolute right-3 ${isDark ? "text-white/50 hover:text-white" : "text-neutral-400 hover:text-black"} select-none cursor-pointer p-0.5`}
                  >
                    <svg aria-label="Emoji" className="fill-current" height="16" viewBox="0 0 24 24" width="16">
                      <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm0-22c-5.514 0-10 4.486-10 10s4.486 10 10 10 10-4.486 10-10-4.486-10-10-10z" />
                      <path d="M12 18c-2.9 0-4.5-1.7-4.5-1.7a1 1 0 0 1 1.4-1.4s1.1 1.1 3.1 1.1 3.1-1.1 3.1-1.1a1 1 0 1 1 1.4 1.4S14.9 18 12 18z" />
                      <circle cx="8.5" cy="9.5" r="1.5" />
                      <circle cx="15.5" cy="9.5" r="1.5" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || postingComment}
                  className="text-xs font-bold text-[#0095f6] hover:text-[#1877f2] disabled:opacity-40 transition-colors cursor-pointer px-1.5 shrink-0"
                >
                  Post
                </button>
              </div>
              {showEmojiPicker && (
                <div className={`p-2 rounded-xl flex gap-1.5 flex-wrap items-center justify-center border shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-150 mt-1 ${isDark ? "bg-[#2c2c2e] border-white/10" : "bg-neutral-50 border-neutral-200"}`}>
                  {["😀", "😂", "❤️", "😍", "👍", "🔥", "👏", "🎉", "😢", "😮", "🙌", "✨", "💯", "🙏"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setNewComment((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                        commentInputRef.current?.focus();
                      }}
                      className="hover:scale-125 active:scale-95 transition-transform p-1 text-sm md:text-base cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Floating 3-dot Options Panel — centered on screen with backdrop */}
        {optionsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOptionsOpen(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" />
            
            {/* Modal Box */}
            <div 
              className={`relative w-[280px] md:w-[320px] h-fit max-h-[85vh] ${isDark ? "bg-[#262626] border-white/10 text-white" : "bg-white border-neutral-200 text-black"} border rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* View 1: Main Menu */}
              {optionsView === "menu" && (
                <div className="flex flex-col text-xs md:text-sm">
                  <button
                    onClick={() => {
                      setOptionsOpen(false);
                      toast({ title: "Report Submitted", description: "Thank you for reporting this reel." });
                    }}
                    className={`py-3.5 px-4 border-b ${isDark ? "border-white/10 hover:bg-white/5 active:bg-white/10" : "border-neutral-200 hover:bg-black/5 active:bg-black/10"} text-center font-bold text-red-500 transition-colors cursor-pointer`}
                  >
                    Report
                  </button>
                  <button
                    onClick={() => {
                      setOptionsOpen(false);
                      toast({ title: "Navigation", description: "Navigated to post." });
                    }}
                    className={`py-3.5 px-4 border-b ${isDark ? "border-white/10 hover:bg-white/5 active:bg-white/10" : "border-neutral-200 hover:bg-black/5 active:bg-black/10"} text-center transition-colors cursor-pointer`}
                  >
                    Go to post
                  </button>
                  <button
                    onClick={() => setOptionsView("share_to")}
                    className={`py-3.5 px-4 border-b ${isDark ? "border-white/10 hover:bg-white/5 active:bg-white/10" : "border-neutral-200 hover:bg-black/5 active:bg-black/10"} text-center transition-colors cursor-pointer`}
                  >
                    Share to...
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/profile/${reel.user_id}`);
                      toast({ title: "Copied", description: "Reel link copied!" });
                      setOptionsOpen(false);
                    }}
                    className={`py-3.5 px-4 border-b ${isDark ? "border-white/10 hover:bg-white/5 active:bg-white/10" : "border-neutral-200 hover:bg-black/5 active:bg-black/10"} text-center transition-colors cursor-pointer`}
                  >
                    Copy link
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`<iframe src="${reel.image_url}" width="400" height="700"></iframe>`);
                      toast({ title: "Copied", description: "Embed code copied!" });
                      setOptionsOpen(false);
                    }}
                    className={`py-3.5 px-4 border-b ${isDark ? "border-white/10 hover:bg-white/5 active:bg-white/10" : "border-neutral-200 hover:bg-black/5 active:bg-black/10"} text-center transition-colors cursor-pointer`}
                  >
                    Embed
                  </button>
                  <button
                    onClick={() => setOptionsView("about_account")}
                    className={`py-3.5 px-4 border-b ${isDark ? "border-white/10 hover:bg-white/5 active:bg-white/10" : "border-neutral-200 hover:bg-black/5 active:bg-black/10"} text-center transition-colors cursor-pointer`}
                  >
                    About this account
                  </button>
                  <button
                    onClick={() => setOptionsOpen(false)}
                    className={`py-3.5 px-4 text-center ${isDark ? "text-white/60 hover:bg-white/5 active:bg-white/10" : "text-neutral-500 hover:bg-black/5 active:bg-black/10"} transition-colors cursor-pointer`}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* View 2: Share to Platforms */}
              {optionsView === "share_to" && (
                <div className="flex flex-col">
                  <div className={`flex items-center justify-between px-4 py-3.5 border-b ${isDark ? "border-white/10" : "border-neutral-200"} text-sm font-semibold`}>
                    <button onClick={() => setOptionsView("menu")} className={`${isDark ? "text-white/60 hover:text-white" : "text-neutral-500 hover:text-black"} cursor-pointer`}>←</button>
                    <span>Share to...</span>
                    <div className="w-4" />
                  </div>
                  <div className="flex flex-col text-xs md:text-sm overflow-y-auto max-h-[260px] py-1">
                    {["threads", "facebook", "whatsapp", "twitter", "link"].map((p) => (
                      <button key={p} onClick={() => shareToPlatform(p)} className={`flex items-center gap-3 px-4 py-2.5 border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-neutral-200 hover:bg-black/5"} transition-colors text-left cursor-pointer capitalize`}>
                        {p === "link" ? "🔗 Copy link" : `Share to ${p.charAt(0).toUpperCase() + p.slice(1)}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* View 3: About this Account */}
              {optionsView === "about_account" && (
                <div className="flex flex-col py-2 px-4">
                  <div className={`text-center font-bold text-sm border-b ${isDark ? "border-white/10" : "border-neutral-200"} pb-3 pt-1`}>About this account</div>
                  <div className="flex flex-col items-center justify-center py-4">
                    <Avatar className={`w-12 h-12 ring-2 ${isDark ? "ring-white/15" : "ring-neutral-250"}`}>
                      <AvatarImage src={authorAvatar} className="object-cover" />
                      <AvatarFallback className="bg-neutral-800 text-white font-bold text-xs">{getInitials(reel.authorProfile)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-xs mt-2">{displayName}</span>
                    <span className={"text-[9px] " + (isDark ? "text-white/50" : "text-neutral-500") + " text-center mt-1 px-2 leading-normal"}>
                      To help keep our community authentic, we're showing information about profiles on Atome.
                    </span>
                  </div>
                  <div className={"space-y-3 text-[10px] text-left py-3 border-t border-b " + (isDark ? "border-white/10" : "border-neutral-200")}>
                    <div className="flex items-start gap-2.5">
                      <span className={isDark ? "text-white/60" : "text-neutral-500"}>📅</span>
                      <div><p className="font-semibold">Date joined</p><p className={"text-[9px] mt-0.5 " + (isDark ? "text-white/50" : "text-neutral-500")}>{joinedDate}</p></div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className={isDark ? "text-white/60" : "text-neutral-500"}>📍</span>
                      <div><p className="font-semibold">Account based in</p><p className={"text-[9px] mt-0.5 " + (isDark ? "text-white/50" : "text-neutral-500")}>India</p></div>
                    </div>
                  </div>
                  <button onClick={() => setOptionsOpen(false)} className={"w-full " + (isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-black/5 hover:bg-black/10 text-black") + " font-bold py-2 rounded-lg text-[10px] mt-3 transition-colors cursor-pointer"}>Close</button>
                </div>
              )}
            </div>
          </div>
        )}



        {/* 4. Right side action icons column */}
        <div className={`flex flex-col items-center gap-4.5 ml-3 ${isDark ? "text-white" : "text-black"} z-10 select-none pb-2`}>
          {/* Like */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={handleLike}
              className={`p-2.5 rounded-full ${isDark ? "hover:bg-neutral-900/60" : "hover:bg-neutral-200/60"} transition-all active:scale-90 cursor-pointer`}
            >
              <Heart
                className={`w-6 h-6 transition-colors ${
                  liked ? "fill-red-500 text-red-500" : (isDark ? "text-white" : "text-black")
                }`}
              />
            </button>
            {canSeeLikes && (
              <span className={`text-[10px] font-semibold ${isDark ? "text-white/90" : "text-black/90"}`}>
                {likesCount > 0 ? likesCount : "Likes"}
              </span>
            )}
          </div>

          {/* Comment */}
          {!commentsDisabled && (
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => {
                  setOptionsOpen(false); // close options if comments opens
                  setCommentsOpen(!commentsOpen);
                }}
                className={`p-2.5 rounded-full ${isDark ? "hover:bg-neutral-900/60" : "hover:bg-neutral-200/60"} transition-all active:scale-90 cursor-pointer`}
              >
                <MessageCircle className={`w-6 h-6 ${isDark ? "text-white" : "text-black"}`} />
              </button>
              <span className={`text-[10px] font-semibold ${isDark ? "text-white/90" : "text-black/90"}`}>{comments.length}</span>
            </div>
          )}

          {/* Share (Paper Plane to open direct ShareDialog - No share count text) */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => setShareDialogOpen(true)}
              className={`p-2.5 rounded-full ${isDark ? "hover:bg-neutral-900/60" : "hover:bg-neutral-200/60"} transition-all active:scale-90 cursor-pointer`}
            >
              <svg
                aria-label="Share"
                className={isDark ? "text-white fill-current" : "text-black fill-current"}
                height="22"
                viewBox="0 0 24 24"
                width="22"
              >
                <line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083" />
                <polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className={`p-2.5 rounded-full ${isDark ? "hover:bg-neutral-900/60" : "hover:bg-neutral-200/60"} transition-all active:scale-90 cursor-pointer`}
          >
            <Bookmark className={`w-6 h-6 ${isSaved ? (isDark ? "fill-white text-white" : "fill-black text-black") : (isDark ? "text-white" : "text-black")}`} />
          </button>

          {/* 3-Dots Menu */}
          <button
            onClick={() => {
              setCommentsOpen(false); // close comments if options opens
              setOptionsOpen(!optionsOpen);
              setOptionsView("menu");
            }}
            className={`p-2.5 rounded-full ${isDark ? "hover:bg-neutral-900/60" : "hover:bg-neutral-200/60"} transition-all active:scale-90 cursor-pointer`}
          >
            <MoreHorizontal className={`w-6 h-6 ${isDark ? "text-white" : "text-black"}`} />
          </button>

          {/* Audio small square picture */}
          <div className="w-8 h-8 rounded-md overflow-hidden border border-white/20 scale-95 shadow-md flex-shrink-0 bg-neutral-900">
            {authorAvatar ? (
              <img src={authorAvatar} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-[9px] font-bold text-white">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Direct ShareDialog popup */}
      {shareDialogOpen && (
        <ShareDialog
          onClose={() => setShareDialogOpen(false)}
          sharedPost={{
            type: "reel",
            post_id: reel.id,
            media_url: reel.image_url,
            caption: reel.caption || "",
            author_username: reel.authorProfile?.username || displayName,
            author_display_name: reel.authorProfile?.display_name || displayName,
            author_avatar: reel.authorProfile?.avatar_url || "",
            author_id: reel.user_id,
            is_video: true,
          }}
        />
      )}
    </div>
  );
};

export default function Reels() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // Default is UNMUTED

  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const fetchReels = async () => {
      try {
        const { data: follows } = await supabase
          .from("user_follows")
          .select("following_id")
          .eq("follower_id", user?.id || "")
          .eq("status", "following");
        const followingIds = follows ? follows.map(f => f.following_id) : [];

        const { data: blocks } = await supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${user?.id || ""},blocked_id.eq.${user?.id || ""}`);
        const blockedIds = blocks ? blocks.map(b => b.blocker_id === user?.id ? b.blocked_id : b.blocker_id) : [];

        const { data: posts, error } = await supabase
          .from("posts")
          .select("*")
          .eq("media_type", "video")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (posts && posts.length > 0) {
          const authorIds = Array.from(new Set(posts.map((p) => p.user_id)));
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, username, avatar_url, created_at, is_private")
            .in("user_id", authorIds);

          const profileMap = new Map(
            (profiles || []).map((p) => [p.user_id, p as Profile])
          );

          const visiblePosts = posts.filter(post => {
            if (blockedIds.includes(post.user_id)) return false;
            if (post.user_id === user?.id) return true;
            const profile = profileMap.get(post.user_id);
            if (profile?.is_private) {
              return followingIds.includes(post.user_id);
            }
            return true;
          });

          setReels(
            visiblePosts.map((post) => ({
              ...post,
              authorProfile: profileMap.get(post.user_id) || null,
            }))
          );
        }
      } catch (err: any) {
        toast({
          title: "Error fetching reels",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchReels();
  }, [toast]);

  const handleScrollDetect = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeReelIndex && index >= 0 && index < reels.length) {
      setActiveReelIndex(index);
    }
  };

  const scrollReel = (index: number) => {
    if (!containerRef.current || index < 0 || index >= reels.length) return;
    const height = containerRef.current.clientHeight;
    containerRef.current.scrollTo({
      top: index * height,
      behavior: "smooth",
    });
    setActiveReelIndex(index);
  };

  const toggleMute = () => setIsMuted((prev) => !prev);

  if (loading) {
    return (
      <AppLayout>
        <div className="h-screen w-full flex items-center justify-center bg-black">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={`h-screen w-full ${isDark ? "bg-black text-white" : "bg-white text-black"} flex items-center justify-center relative overflow-hidden select-none`}>
        
        {/* Floating Back Arrow for mobile navigation */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-neutral-900/50 hover:bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center text-white transition-all z-40 md:hidden cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Far Right Up/Down Chevrons for page scroll */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-40 hidden md:flex">
          <button
            onClick={() => scrollReel(activeReelIndex - 1)}
            disabled={activeReelIndex === 0}
            className="w-10 h-10 rounded-full bg-[#1c1c1e]/60 border border-white/10 hover:bg-[#2c2c2e]/80 disabled:opacity-30 flex items-center justify-center text-white transition-all cursor-pointer shadow-md"
          >
            <ArrowUp className="w-4.5 h-4.5" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => scrollReel(activeReelIndex + 1)}
            disabled={activeReelIndex === reels.length - 1}
            className="w-10 h-10 rounded-full bg-[#1c1c1e]/60 border border-white/10 hover:bg-[#2c2c2e]/80 disabled:opacity-30 flex items-center justify-center text-white transition-all cursor-pointer shadow-md"
          >
            <ArrowDown className="w-4.5 h-4.5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Reels snapping scroll container */}
        <div
          ref={containerRef}
          onScroll={handleScrollDetect}
          className="h-full w-full flex flex-col overflow-y-scroll snap-y snap-mandatory scrollbar-none relative items-center justify-start"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {reels.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-white/50 text-sm">
              <p className="text-base font-bold">No Reels Available</p>
              <p className="text-xs mt-1">Upload mp4/video posts to populate the Reels feed.</p>
            </div>
          ) : (
            reels.map((reel, idx) => (
              <div
                key={reel.id}
                ref={(el) => (reelRefs.current[idx] = el)}
                className="w-full h-full flex-shrink-0 snap-start flex items-center justify-center"
              >
                <ReelItem
                  reel={reel}
                  currentUser={user}
                  isMuted={isMuted}
                  toggleMute={toggleMute}
                  isActive={idx === activeReelIndex}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
