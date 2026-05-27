import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Link, Twitter, Facebook, Instagram, Trash2, ChevronLeft, ChevronRight, X, Music, Volume2, VolumeX } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import UserProfileModal from "@/components/shared/UserProfileModal";
import ShareDialog from "@/components/shared/ShareDialog";
import { isAdminUser } from "@/lib/admin";
import { AudioPreviewer } from "@/lib/music";

const FeedPostItem = ({ item, currentUser }: { item: any; currentUser: any }) => {
  const { toast } = useToast();
  const [isDeleted, setIsDeleted] = useState(false);
  const isAdmin = isAdminUser(currentUser?.email);

  const commentInputRef = useRef<HTMLInputElement>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(item.likes_count || 0);
  const [likeRecordId, setLikeRecordId] = useState<string | null>(null);

  const [sharesCount, setSharesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [modalCommentText, setModalCommentText] = useState("");
  const modalInputRef = useRef<HTMLInputElement>(null);
  const [showModalEmojiPicker, setShowModalEmojiPicker] = useState(false);

  // Custom Video Player & Share Dialog States
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [showPlayIndicator, setShowPlayIndicator] = useState<"play" | "pause" | null>(null);
  const feedVideoRef = useRef<HTMLVideoElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Sync carousel scroll position when index changes via arrow buttons
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: currentImageIndex * el.offsetWidth, behavior: "smooth" });
  }, [currentImageIndex]);

  const audioPlayerRef = useRef<AudioPreviewer | null>(null);
  useEffect(() => {
    audioPlayerRef.current = new AudioPreviewer();
    return () => audioPlayerRef.current?.stop();
  }, []);

  useEffect(() => {
    if (item.media_type === "image" && item.music_url) {
      if (videoPlaying && !videoMuted) {
        audioPlayerRef.current?.play(item.music_url, 0);
      } else {
        audioPlayerRef.current?.stop();
      }
    }
  }, [videoPlaying, videoMuted, item.media_type, item.music_url]);

  useEffect(() => {
    if (item.media_type !== "video" || !feedVideoRef.current) return;
    if (videoPlaying) {
      feedVideoRef.current.play().catch(() => {});
    } else {
      feedVideoRef.current.pause();
    }
  }, [videoPlaying, item.media_type]);

  const togglePlayPause = () => {
    if (!feedVideoRef.current) return;
    const isPlaying = !videoPlaying;
    setVideoPlaying(isPlaying);
    setShowPlayIndicator(isPlaying ? "play" : "pause");
    setTimeout(() => setShowPlayIndicator(null), 500);
  };

  // Load uploader's author profile and keep it in sync in real-time
  useEffect(() => {
    if (!item.user_id) return;
    const loadAuthor = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, email")
        .eq("user_id", item.user_id)
        .maybeSingle();
      if (data) setAuthorProfile(data);
    };
    loadAuthor();

    // Subscribe to profile changes of the author of this post
    const ch = supabase
      .channel(`profile-${item.user_id}-${item.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${item.user_id}` }, (payload) => {
        setAuthorProfile(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [item.user_id]);

  useEffect(() => {
    const checkSaved = async () => {
      if (!currentUser) return;
      const saved = currentUser.user_metadata?.saved_posts || [];
      setIsSaved(saved.includes(item.id));
    };
    checkSaved();
  }, [currentUser, item.id]);

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("id, content, created_at, user_id")
      .eq("post_id", item.id)
      .order("created_at", { ascending: true });
    if (data) {
      if (data.length > 0) {
        const userIds = Array.from(new Set(data.map((c) => c.user_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, email")
          .in("user_id", userIds);
        const profileMap = new Map();
        profiles?.forEach((p) => profileMap.set(p.user_id, p));

        setComments(
          data.map((c) => {
            const p = profileMap.get(c.user_id);
            const isCommentAdmin = p?.email?.toLowerCase() === "s73590363@gmail.com";
            return {
              id: c.id,
              text: c.content,
              userId: c.user_id,
              userName: p?.display_name || (isCommentAdmin ? "Admin" : p?.email?.split("@")[0] || "User"),
              userAvatar: p?.avatar_url || "",
              time: new Date(c.created_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
                timeStyle: "short",
              }),
            };
          })
        );
      } else {
        setComments([]);
      }
    }
  }, [item.id]);

  useEffect(() => {
    const loadLikes = async () => {
      if (!currentUser) return;
      const { count } = await supabase
        .from("post_likes")
        .select("id", { count: "exact" })
        .eq("post_id", item.id);
      setLikesCount(count || 0);

      const { data: userLike } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", item.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (userLike) {
        setLiked(true);
        setLikeRecordId(userLike.id);
      }
    };

    loadLikes();
    loadComments();
  }, [item.id, currentUser, loadComments]);

  // Subscribe to real-time comment and profile updates for commenters
  useEffect(() => {
    const commentsCh = supabase
      .channel(`post-comments-${item.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${item.id}` }, () => {
        loadComments();
      })
      .subscribe();

    // Also subscribe to changes in the profiles table to update commenter names/avatars in real-time
    const profilesCh = supabase
      .channel(`post-commenter-profiles-${item.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        loadComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(commentsCh);
      supabase.removeChannel(profilesCh);
    };
  }, [item.id, loadComments]);

  const handleLike = async () => {
    if (!currentUser) return;
    if (liked) {
      setLiked(false);
      setLikesCount((prev: number) => prev - 1);
      if (likeRecordId) {
        await supabase.from("post_likes").delete().eq("id", likeRecordId);
        setLikeRecordId(null);
        if (item.user_id !== currentUser.id) {
          await supabase.from("notifications").delete().eq("recipient_id", item.user_id).eq("sender_id", currentUser.id).eq("type", "like").eq("post_id", item.id);
        }
      }
    } else {
      setLiked(true);
      setLikesCount((prev: number) => prev + 1);
      const { data } = await supabase
        .from("post_likes")
        .insert({ post_id: item.id, user_id: currentUser.id })
        .select()
        .single();
      if (data) {
        setLikeRecordId(data.id);
        if (item.user_id !== currentUser.id) {
          await supabase.from("notifications").insert({
            recipient_id: item.user_id,
            sender_id: currentUser.id,
            type: "like",
            content: item.id,
            post_id: item.id
          });
        }
      }
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUser) return;

    const text = commentText.trim();
    setCommentText("");

    const tempId = Date.now().toString();
    const isCommenterAdmin = currentUser.email?.toLowerCase() === "s73590363@gmail.com";
    setComments((prev) => [
      ...prev,
      {
        id: tempId,
        text,
        userId: currentUser.id,
        userName:
          currentUser.user_metadata?.display_name ||
          (isCommenterAdmin ? "Admin" : currentUser.email?.split("@")[0] || "User"),
        userAvatar: currentUser.user_metadata?.avatar_url || "",
        time: "Just now",
      },
    ]);

    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: item.id, user_id: currentUser.id, content: text })
      .select()
      .single();

    if (!error && data) {
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, id: data.id } : c))
      );
      if (item.user_id !== currentUser.id) {
        await supabase.from("notifications").insert({
          recipient_id: item.user_id,
          sender_id: currentUser.id,
          type: "comment",
          content: text,
          post_id: item.id
        });
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const commentToDelete = comments.find(c => c.id === commentId);
    const { error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId);
    if (!error) {
      if (commentToDelete && item.user_id !== currentUser.id) {
        await supabase.from("notifications").delete()
          .eq("recipient_id", item.user_id)
          .eq("sender_id", currentUser.id)
          .eq("type", "comment")
          .eq("post_id", item.id)
          .eq("content", commentToDelete.text);
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({ title: "Comment deleted" });
    } else {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    }
  };

  const handleModalAddComment = async () => {
    if (!modalCommentText.trim() || !currentUser) return;

    const text = modalCommentText.trim();
    setModalCommentText("");

    const tempId = Date.now().toString();
    const isCommenterAdmin = currentUser.email?.toLowerCase() === "s73590363@gmail.com";
    setComments((prev) => [
      ...prev,
      {
        id: tempId,
        text,
        userId: currentUser.id,
        userName:
          currentUser.user_metadata?.display_name ||
          (isCommenterAdmin ? "Admin" : currentUser.email?.split("@")[0] || "User"),
        userAvatar: currentUser.user_metadata?.avatar_url || "",
        time: "Just now",
      },
    ]);

    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: item.id, user_id: currentUser.id, content: text })
      .select()
      .single();

    if (!error && data) {
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, id: data.id } : c))
      );
      if (item.user_id !== currentUser.id) {
        await supabase.from("notifications").insert({
          recipient_id: item.user_id,
          sender_id: currentUser.id,
          type: "comment",
          content: text,
          post_id: item.id
        });
      }
    }
  };

  const shareUrl = async (platform: string) => {
    setSharesCount((s) => s + 1);
    const url = window.location.href;
    if (platform === "whatsapp") {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "atome") {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied for Atome!" });
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard!" });
    }

    if (currentUser && item.user_id !== currentUser.id) {
      await supabase.from("notifications").insert({
        recipient_id: item.user_id,
        sender_id: currentUser.id,
        type: "share",
        content: platform,
        post_id: item.id
      });
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    const currentSaved = currentUser.user_metadata?.saved_posts || [];
    let newSaved;

    if (isSaved) {
      newSaved = currentSaved.filter((id: string) => id !== item.id);
      setIsSaved(false);
      toast({ title: "Removed from saved photos" });
    } else {
      newSaved = [...currentSaved, item.id];
      setIsSaved(true);
      toast({ title: "Saved to your profile" });
      
      if (item.user_id !== currentUser.id) {
        await supabase.from("notifications").insert({
          recipient_id: item.user_id,
          sender_id: currentUser.id,
          type: "save",
          content: item.id,
          post_id: item.id
        });
      }
    }

    await supabase.auth.updateUser({ data: { saved_posts: newSaved } });
  };

  const handleDeletePost = async () => {
    const isOwner = currentUser?.id === item.user_id;
    if (!isAdmin && !isOwner) {
      toast({ title: "Unauthorized", description: "You can only delete your own posts.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("posts").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Error deleting post", variant: "destructive" });
    } else {
      setIsDeleted(true);
      toast({ title: "Post deleted successfully" });
    }
  };

  const navigate = useNavigate();
  const goToProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const isFileName = (str: string | null | undefined) => {
    if (!str) return false;
    return /\.(jpg|jpeg|png|gif|mp4|mov|avi|webp)$/i.test(str) || str.includes("image_") || str.includes("file_") || str.startsWith("http://") || str.startsWith("https://");
  };

  if (isDeleted) return null;

  const isPostAuthorAdmin = authorProfile?.email?.toLowerCase() === "s73590363@gmail.com";
  const authorName =
    authorProfile?.display_name ||
    (isPostAuthorAdmin ? "Admin" : authorProfile?.email?.split("@")[0] || "User");
  const authorAvatar = authorProfile?.avatar_url || "";

  const imageList: string[] =
    item.image_urls && item.image_urls.length > 0
      ? item.image_urls
      : item.image_url
      ? [item.image_url]
      : [];

  const isCarousel = imageList.length > 1;

  const postDate = new Date(item.created_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      {modalUserId && (
        <UserProfileModal userId={modalUserId} onClose={() => setModalUserId(null)} />
      )}
      <div className="feed-post-card post-card mb-0 flex flex-col bg-background relative group bw-hover-gradient border-none overflow-hidden rounded-xl md:rounded-xl">
        <div className="post-header-mobile flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3.5">
            <Avatar
              className="w-10 h-10 ring-2 ring-background shadow-sm cursor-pointer hover:opacity-90"
              onClick={() => goToProfile(item.user_id)}
            >
              <AvatarImage src={authorAvatar} />
              <AvatarFallback className="bg-foreground text-background font-semibold">
                {authorName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span
                className="text-[15px] font-bold tracking-tight cursor-pointer hover:text-muted-foreground transition-colors font-display"
                onClick={() => goToProfile(item.user_id)}
              >
                {authorName}
              </span>
              <span className="text-xs text-muted-foreground/80 font-semibold flex items-center gap-2">
                {postDate}
                {item.music_title && (
                  <span className="flex items-center gap-1 text-primary">
                    • <Music className="w-3 h-3" /> {item.music_title}
                  </span>
                )}
              </span>
            </div>
          </div>
          {(isAdmin || currentUser?.id === item.user_id) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary/80 h-9 w-9">
                  <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-background border-border/50 rounded-xl">
                <DropdownMenuItem
                  onClick={handleDeletePost}
                  className="cursor-pointer text-destructive focus:text-destructive gap-2 font-medium"
                >
                  <Trash2 className="w-4 h-4" /> Delete Post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary/80 h-9 w-9">
              <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
            </Button>
          )}
        </div>

        <div className="post-media-mobile w-full bg-black/5 flex items-center justify-center overflow-hidden relative group">
          {item.media_type === "video" ? (
            <div
              className="relative w-full h-auto cursor-pointer select-none"
              onClick={togglePlayPause}
            >
              <video
                ref={feedVideoRef}
                src={item.image_url}
                className="w-full h-auto object-cover max-h-[700px]"
                loop
                playsInline
                autoPlay
                muted={videoMuted}
              />

              {/* Mute/Unmute Icon Overlay in Bottom Right Corner */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoMuted(!videoMuted);
                }}
                className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-20"
              >
                {videoMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
              </button>

              {/* Play/Pause brief indicator overlay */}
              {showPlayIndicator && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none z-10">
                  <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white scale-110 transition-all duration-300">
                    {showPlayIndicator === "play" ? (
                      <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                        <rect x="5" y="4" width="4" height="16" />
                        <rect x="15" y="4" width="4" height="16" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : isCarousel ? (
            <>
              {/* Scroll-snap horizontal carousel strip */}
              <div
                ref={carouselRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const idx = Math.round(el.scrollLeft / el.offsetWidth);
                  if (idx !== currentImageIndex) setCurrentImageIndex(idx);
                }}
                className="flex overflow-x-auto snap-x snap-mandatory w-full"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {imageList.map((src, idx) => (
                  <div
                    key={idx}
                    className="snap-center flex-shrink-0 w-full"
                    onDoubleClick={handleLike}
                  >
                    <img
                      src={src}
                      alt={`Photo ${idx + 1}`}
                      draggable={false}
                      className="w-full h-auto object-cover max-h-[700px] select-none"
                    />
                  </div>
                ))}
              </div>

              {/* Prev / Next arrow buttons */}
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 pointer-events-none">
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-7 h-7 rounded-full bg-black/40 text-white hover:bg-black/60 active:scale-95 border-0 shadow-md flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none pointer-events-auto"
                  onClick={() => setCurrentImageIndex((i) => Math.max(0, i - 1))}
                  disabled={currentImageIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-7 h-7 rounded-full bg-black/40 text-white hover:bg-black/60 active:scale-95 border-0 shadow-md flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none pointer-events-auto"
                  onClick={() => setCurrentImageIndex((i) => Math.min(imageList.length - 1, i + 1))}
                  disabled={currentImageIndex === imageList.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Dot indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/25 px-2.5 py-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                {imageList.map((_, idx) => (
                  <div
                    key={idx}
                    className={`rounded-full transition-all duration-300 ${
                      idx === currentImageIndex
                        ? "w-4 h-1.5 bg-white"
                        : "w-1.5 h-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>

              {/* Counter badge */}
              <div className="absolute top-3 right-3 bg-black/40 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm pointer-events-none">
                {currentImageIndex + 1} / {imageList.length}
              </div>

              {item.music_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); setVideoMuted(!videoMuted); }}
                  className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-20 pointer-events-auto"
                >
                  {videoMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
                </button>
              )}
            </>
          ) : (
            <div className="relative w-full h-auto cursor-pointer" onClick={item.music_url ? togglePlayPause : undefined}>
              <img
                src={item.image_url}
                alt="Post"
                onDoubleClick={handleLike}
                className="w-full h-auto object-cover max-h-[700px] transition-transform duration-700 group-hover:scale-[1.01]"
              />
              {item.music_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); setVideoMuted(!videoMuted); }}
                  className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-20 pointer-events-auto"
                >
                  {videoMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-5">
            <button onClick={handleLike} className="hover:opacity-70 transition-transform active:scale-90">
              <Heart
                className={`w-[26px] h-[26px] transition-all duration-300 ${
                  liked ? "fill-red-500 text-red-500 scale-110" : "text-foreground"
                }`}
              />
            </button>
            <button
              onClick={() => setShowCommentsModal(true)}
              className="hover:opacity-70 transition-transform active:scale-90 flex items-center gap-1.5"
            >
              <MessageCircle className="w-[26px] h-[26px] text-foreground" />
              {comments.length > 0 && (
                <span className="text-sm font-bold text-foreground">
                  {comments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShareDialogOpen(true)}
              className="hover:opacity-70 transition-transform active:scale-90"
            >
              <svg
                aria-label="Share Post"
                className="text-foreground fill-current"
                height="24"
                viewBox="0 0 24 24"
                width="24"
              >
                <line
                  fill="none"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  x1="22"
                  x2="9.218"
                  y1="3"
                  y2="10.083"
                ></line>
                <polygon
                  fill="none"
                  points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="2"
                ></polygon>
              </svg>
            </button>
          </div>
          <button onClick={handleSave} className="hover:opacity-70 transition-transform active:scale-90">
            <Bookmark
              className={`w-[26px] h-[26px] transition-all duration-300 ${
                isSaved ? "fill-foreground text-foreground scale-110" : "text-foreground"
              }`}
            />
          </button>
        </div>

        {sharesCount > 0 && (
          <div className="px-5 pb-2">
            <span className="text-[13px] text-muted-foreground font-medium">
              {sharesCount.toLocaleString()} shares
            </span>
          </div>
        )}

        {item.caption && item.caption.trim() && !isFileName(item.caption) && (
          <div className="px-5 pb-3">
            <span className="text-[14px] leading-relaxed text-foreground/90 font-body">
              {item.caption}
            </span>
          </div>
        )}


      </div>

      {/* Glassmorphic comments overlay modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white/80 dark:bg-black dark:text-white backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[32px] shadow-2xl p-6 w-full max-w-md flex flex-col h-[520px] max-h-[90vh] animate-in zoom-in-95 duration-200 relative">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-border/40">
              <div>
                <h3 className="text-lg font-bold text-foreground dark:text-white">Comments</h3>
                <p className="text-[10px] text-muted-foreground dark:text-white/60 font-medium">All thoughts on this memory</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 hover:bg-black/5"
                onClick={() => {
                  setShowCommentsModal(false);
                  setModalCommentText("");
                }}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-4 scrollbar-thin">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-bold">No comments yet</p>
                  <p className="text-xs mt-0.5">Be the first to share your thoughts!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 items-start">
                      <Avatar
                        className="w-8 h-8 shrink-0 ring-1 ring-border/50 cursor-pointer"
                        onClick={() => {
                          setShowCommentsModal(false);
                          goToProfile(comment.userId);
                        }}
                      >
                        <AvatarImage src={comment.userAvatar} />
                        <AvatarFallback className="text-[10px] bg-secondary font-semibold">
                          {comment.userName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[13px] leading-snug break-words text-foreground/90">
                            <span
                              className="font-bold mr-2 hover:underline decoration-primary cursor-pointer"
                              onClick={() => {
                                setShowCommentsModal(false);
                                goToProfile(comment.userId);
                              }}
                            >
                              {comment.userName}
                            </span>
                            {comment.text}
                          </span>
                          {(isAdmin || currentUser?.id === comment.userId) && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-3.5 mt-1 text-[11px] text-muted-foreground font-semibold tracking-wide">
                          <span>{comment.time}</span>
                          <button
                            onClick={() => {
                              setModalCommentText(`@${comment.userName} `);
                              modalInputRef.current?.focus();
                            }}
                            className="hover:text-foreground transition-colors"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input inside Modal */}
            {!item.turn_off_commenting ? (
              <div className="pt-3 border-t border-border/40 flex flex-col gap-2">
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="w-8 h-8 shrink-0 ring-1 ring-border/50">
                    <AvatarImage src={currentUser?.user_metadata?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-[11px]">
                      {(
                        currentUser?.user_metadata?.display_name ||
                        currentUser?.email ||
                        "U"
                      )
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 relative flex items-center">
                    <Input
                      ref={modalInputRef}
                      value={modalCommentText}
                      onChange={(e) => setModalCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleModalAddComment();
                        }
                      }}
                      placeholder="Write a comment..."
                      className="border-none bg-secondary/40 shadow-none focus-visible:ring-0 pl-3 pr-10 rounded-xl h-10 text-[14px] font-medium w-full"
                    />
                    <button
                      onClick={() => setShowModalEmojiPicker(!showModalEmojiPicker)}
                      className="absolute right-3 text-muted-foreground hover:text-foreground select-none cursor-pointer p-0.5"
                    >
                      <svg aria-label="Emoji" className="fill-current" height="16" viewBox="0 0 24 24" width="16">
                        <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm0-22c-5.514 0-10 4.486-10 10s4.486 10 10 10 10-4.486 10-10-4.486-10-10-10z" />
                        <path d="M12 18c-2.9 0-4.5-1.7-4.5-1.7a1 1 0 0 1 1.4-1.4s1.1 1.1 3.1 1.1 3.1-1.1 3.1-1.1a1 1 0 1 1 1.4 1.4S14.9 18 12 18z" />
                        <circle cx="8.5" cy="9.5" r="1.5" />
                        <circle cx="15.5" cy="9.5" r="1.5" />
                      </svg>
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleModalAddComment}
                    disabled={!modalCommentText.trim()}
                    className="text-primary font-bold tracking-wide hover:bg-primary/10 px-4 rounded-xl h-10 transition-colors"
                  >
                    Post
                  </Button>
                </div>
                {showModalEmojiPicker && (
                  <div className="p-2 rounded-xl flex gap-1.5 flex-wrap items-center justify-center border shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-150 mt-1 bg-secondary/35 border-border/40">
                    {["😀", "😂", "❤️", "😍", "👍", "🔥", "👏", "🎉", "😢", "😮", "🙌", "✨", "💯", "🙏"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setModalCommentText((prev) => prev + emoji);
                          setShowModalEmojiPicker(false);
                          modalInputRef.current?.focus();
                        }}
                        className="hover:scale-125 active:scale-95 transition-transform p-1 text-sm md:text-base cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-3 border-t border-border/40 text-center text-sm text-muted-foreground font-medium">
                Comments are turned off.
              </div>
            )}
          </div>
        </div>
      )}

      {shareDialogOpen && (
        <ShareDialog
          onClose={() => setShareDialogOpen(false)}
          sharedPost={{
            type: item.media_type === "video" ? "reel" : "post",
            post_id: item.id,
            media_url: item.image_url || "",
            caption: item.caption || "",
            author_username: authorProfile?.username || authorName,
            author_display_name: authorName,
            author_avatar: authorAvatar,
            author_id: item.user_id,
            is_video: item.media_type === "video",
          }}
        />
      )}
    </>
  );
};

export default FeedPostItem;
