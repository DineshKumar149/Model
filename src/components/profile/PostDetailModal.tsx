import { useState, useEffect, useRef, useCallback } from "react";
import { X, Heart, Bookmark, ChevronLeft, ChevronRight, Send, Music, Trash2, Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AllLikesModal from "@/components/profile/AllLikesModal";
import { isAdminUser } from "@/lib/admin";
import { formatDistanceToNow } from "date-fns";

const CustomVideoPlayer = ({ src, className }: { src: string; className?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem("atome_video_muted") === "true";
  });
  const [showPlayIndicator, setShowPlayIndicator] = useState<"play" | "pause" | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const playPromise = videoRef.current?.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        setVideoPlaying(false);
      });
    }
  }, []);

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

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMute = !isMuted;
    setIsMuted(newMute);
    localStorage.setItem("atome_video_muted", String(newMute));
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black group/player select-none">
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        className={`w-full h-full cursor-pointer object-contain ${className}`}
        onClick={togglePlayPause}
      />

      {/* Video Mute Toggle bottom right */}
      <button
        onClick={toggleMute}
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
    </div>
  );
};

interface PostDetailModalProps {
  post: any;
  authorProfile: any;
  onClose: () => void;
}


const PostDetailModal = ({ post, authorProfile, onClose }: PostDetailModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isAdminUser(user?.email);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeRecordId, setLikeRecordId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAllLikes, setShowAllLikes] = useState(false);
  const [recentLiker, setRecentLiker] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Whether this viewer can see like count
  const canSeeLikes = !post.hide_likes || (user && user.id === post.user_id);
  const commentsDisabled = !!post.turn_off_commenting;

  const mediaStr = post.media_url || post.image_url || "";
  const imageList: string[] = post.image_urls && post.image_urls.length > 0
    ? post.image_urls
    : typeof mediaStr === "string" && mediaStr.includes(",")
    ? mediaStr.split(",").map((s: string) => s.trim()).filter(Boolean)
    : typeof mediaStr === "string" && mediaStr
    ? [mediaStr]
    : [];

  const displayName =
    authorProfile?.display_name ||
    authorProfile?.email?.split("@")[0] ||
    "User";
  const authorAvatar = authorProfile?.avatar_url || "";
  const authorInitials = displayName.slice(0, 2).toUpperCase();

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("id, content, created_at, user_id")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map((c) => c.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, username")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      setComments(
        data.map((c) => {
          const p = profileMap.get(c.user_id);
          return {
            id: c.id,
            text: c.content,
            userId: c.user_id,
            userName: p?.display_name || p?.username || "User",
            userAvatar: p?.avatar_url || "",
            createdAt: c.created_at,
          };
        })
      );
    } else {
      setComments([]);
    }
  }, [post.id]);

  useEffect(() => {
    const loadLikes = async () => {
      const { count } = await supabase
        .from("post_likes")
        .select("id", { count: "exact" })
        .eq("post_id", post.id);
      setLikesCount(count || 0);

      if (user) {
        const { data: userLike } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", post.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (userLike) {
          setLiked(true);
          setLikeRecordId(userLike.id);
        }
        const saved = user.user_metadata?.saved_posts || [];
        setIsSaved(saved.includes(post.id));
      }

      const { data: recentLikes } = await supabase
        .from("post_likes")
        .select("user_id")
        .eq("post_id", post.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentLikes && recentLikes.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("user_id", recentLikes[0].user_id)
          .maybeSingle();
        setRecentLiker(profile);
      }
    };

    loadLikes();
    loadComments();
  }, [post.id, user, loadComments]);

  useEffect(() => {
    const ch = supabase
      .channel(`post-detail-comments-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${post.id}` }, () => {
        loadComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [post.id, loadComments]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikesCount((p) => p - 1);
      if (likeRecordId) {
        await supabase.from("post_likes").delete().eq("id", likeRecordId);
        setLikeRecordId(null);
        if (post.user_id !== user.id) {
          await supabase.from("notifications").delete().eq("recipient_id", post.user_id).eq("sender_id", user.id).eq("type", "like").eq("post_id", post.id);
        }
      }
    } else {
      setLiked(true);
      setLikesCount((p) => p + 1);
      const { data } = await supabase
        .from("post_likes")
        .insert({ post_id: post.id, user_id: user.id })
        .select()
        .single();
      if (data) {
        setLikeRecordId(data.id);
        if (post.user_id !== user.id) {
          await supabase.from("notifications").insert({
            recipient_id: post.user_id,
            sender_id: user.id,
            type: "like",
            content: post.id,
            post_id: post.id,
          });
        }
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const currentSaved = user.user_metadata?.saved_posts || [];
    let newSaved: string[];
    if (isSaved) {
      newSaved = currentSaved.filter((id: string) => id !== post.id);
      setIsSaved(false);
    } else {
      newSaved = [...currentSaved, post.id];
      setIsSaved(true);
    }
    await supabase.auth.updateUser({ data: { saved_posts: newSaved } });
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;
    const text = commentText.trim();
    setCommentText("");
    const tempId = Date.now().toString();
    setComments((prev) => [
      ...prev,
      {
        id: tempId,
        text,
        userId: user.id,
        userName: user.user_metadata?.display_name || user.email?.split("@")[0] || "User",
        userAvatar: user.user_metadata?.avatar_url || "",
        createdAt: new Date().toISOString(),
      },
    ]);
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: post.id, user_id: user.id, content: text })
      .select()
      .single();
    if (!error && data) {
      setComments((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: data.id } : c)));
      if (post.user_id !== user.id) {
        await supabase.from("notifications").insert({
          recipient_id: post.user_id,
          sender_id: user.id,
          type: "comment",
          content: text,
          post_id: post.id,
        });
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const commentToDelete = comments.find(c => c.id === commentId);
    await supabase.from("post_comments").delete().eq("id", commentId);
    if (commentToDelete && post?.user_id !== user?.id) {
      await supabase.from("notifications").delete()
        .eq("recipient_id", post?.user_id)
        .eq("sender_id", user?.id)
        .eq("type", "comment")
        .eq("post_id", post?.id)
        .eq("content", commentToDelete.content);
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const formatTime = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <>
      {showAllLikes && (
        <AllLikesModal postId={post.id} onClose={() => setShowAllLikes(false)} />
      )}

      <div
        className="fixed inset-0 z-[250] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div
          className="relative z-10 w-full max-w-4xl h-[92vh] md:h-[min(650px,92vh)] flex flex-col md:flex-row rounded-[28px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-250 bg-white dark:bg-black"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-full md:w-1/2 h-[45%] md:h-full bg-black shrink-0 relative flex items-center justify-center overflow-hidden">
            {imageList.length > 1 ? (
              /* Carousel with left/right navigation */
              <div className="w-full h-full relative flex items-center justify-center">
                {/* Current media */}
                {post.media_type === "video" ? (
                  <CustomVideoPlayer
                    src={imageList[currentImageIndex]}
                    className="w-full h-full"
                  />
                ) : (
                  <img
                    src={imageList[currentImageIndex]}
                    alt={post.alt_text || post.caption || `Post media ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                )}

                {/* Left arrow */}
                {currentImageIndex > 0 && (
                  <button
                    onClick={() => setCurrentImageIndex((i) => i - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {/* Right arrow */}
                {currentImageIndex < imageList.length - 1 && (
                  <button
                    onClick={() => setCurrentImageIndex((i) => i + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}

                {/* Slide indicator */}
                <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                  {currentImageIndex + 1}/{imageList.length}
                </div>

                {/* Dot indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {imageList.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === currentImageIndex ? "bg-white scale-125" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              imageList.length > 0 && (
                post.media_type === "video" ? (
                  <CustomVideoPlayer
                    src={imageList[0]}
                    className="w-full h-full"
                  />
                ) : (
                  <img
                    src={imageList[0]}
                    alt={post.alt_text || post.caption || "Post"}
                    className="w-full h-full object-contain"
                  />
                )
              )
            )}
          </div>

          <div className="w-full md:w-1/2 h-[55%] md:h-full bg-white dark:bg-black text-black dark:text-white flex flex-col border-t md:border-t-0 md:border-l border-border/40 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0 bg-white dark:bg-black">
              <Avatar
                className="w-9 h-9 ring-2 ring-background cursor-pointer"
                onClick={() => { navigate(`/profile/${post.user_id}`); onClose(); }}
              >
                <AvatarImage src={authorAvatar} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold text-sm">
                  {authorInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span
                  className="text-sm font-bold cursor-pointer hover:underline decoration-primary text-black dark:text-white"
                  onClick={() => { navigate(`/profile/${post.user_id}`); onClose(); }}
                >
                  {displayName}
                </span>
                {post.music_title && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium mt-0.5">
                    <Music className="w-3 h-3 text-primary" /> {post.music_title}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin bg-white dark:bg-black">
              {post.caption && post.caption.trim() && (
                <div className="flex gap-3 items-start">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={authorAvatar} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold text-xs">
                      {authorInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug text-black dark:text-white">
                      <span className="font-bold mr-2 text-black dark:text-white">{displayName}</span>
                      {post.caption}
                    </p>
                  </div>
                </div>
              )}

              {post.turn_off_commenting ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground h-full">
                  <p className="text-sm font-medium text-black dark:text-white">Comments are turned off.</p>
                </div>
              ) : (
                <>
                  {comments.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <p className="text-sm font-medium text-black dark:text-white">No comments yet.</p>
                      <p className="text-xs mt-0.5">Be the first to comment!</p>
                    </div>
                  )}

                  {comments.map((comment) => {
                    const cInitials = comment.userName.slice(0, 2).toUpperCase();
                    const canDelete = isAdmin || user?.id === comment.userId;
                    return (
                      <div key={comment.id} className="flex gap-2.5 items-start group">
                        <Avatar
                          className="w-8 h-8 shrink-0 ring-1 ring-border/50 cursor-pointer"
                          onClick={() => { navigate(`/profile/${comment.userId}`); onClose(); }}
                        >
                          <AvatarImage src={comment.userAvatar} className="object-cover" />
                          <AvatarFallback className="bg-secondary text-foreground font-bold text-xs">
                            {cInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] leading-snug text-black dark:text-white">
                            <span
                              className="font-bold mr-1.5 cursor-pointer hover:underline text-black dark:text-white"
                              onClick={() => { navigate(`/profile/${comment.userId}`); onClose(); }}
                            >
                              {comment.userName}
                            </span>
                            {comment.text}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-semibold">
                            <span>{formatTime(comment.createdAt)}</span>
                            <button
                              className="hover:text-black dark:hover:text-white transition-colors"
                              onClick={() => {
                                setCommentText(`@${comment.userName} `);
                                commentInputRef.current?.focus();
                              }}
                            >
                              Reply
                            </button>
                            {canDelete && (
                              <button
                                className="hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={commentsEndRef} />
                </>
              )}
            </div>

            <div className="border-t border-border/40 px-4 pt-3 pb-2 shrink-0 bg-white dark:bg-black">
              <div className="flex items-center justify-between mb-2">
                <button onClick={handleLike} className="hover:opacity-70 transition-transform active:scale-90">
                  <Heart
                    className={`w-7 h-7 transition-all duration-300 ${liked ? "fill-red-500 text-red-500 scale-110" : "text-black dark:text-white"}`}
                  />
                </button>
                <button onClick={handleSave} className="hover:opacity-70 transition-transform active:scale-90">
                  <Bookmark
                    className={`w-7 h-7 transition-all duration-300 ${isSaved ? "fill-black dark:fill-white text-black dark:text-white scale-110" : "text-black dark:text-white"}`}
                  />
                </button>
              </div>

              {likesCount > 0 && canSeeLikes && (
                <div className="text-[13px] font-semibold text-black dark:text-white mb-1">
                  {recentLiker ? (
                    <>
                      Liked by{" "}
                      <span className="font-bold">{recentLiker.display_name || recentLiker.username || "someone"}</span>
                      {likesCount > 1 && (
                        <>
                          {" "}and{" "}
                          <button
                            onClick={() => setShowAllLikes(true)}
                            className="font-bold hover:underline"
                          >
                            {likesCount - 1} {likesCount - 1 === 1 ? "other" : "others"}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => setShowAllLikes(true)}
                      className="font-bold hover:underline"
                    >
                      {likesCount} {likesCount === 1 ? "like" : "likes"}
                    </button>
                  )}
                </div>
              )}

              {!commentsDisabled && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex-1 relative flex items-center">
                      <Input
                        ref={commentInputRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                        placeholder="Add a comment…"
                        className="border-none bg-zinc-100 dark:bg-zinc-900 shadow-none focus-visible:ring-0 rounded-xl h-9 text-sm font-medium pl-3 pr-10 text-black dark:text-white w-full"
                      />
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="absolute right-3 text-muted-foreground hover:text-foreground select-none cursor-pointer p-0.5"
                      >
                        <svg aria-label="Emoji" className="fill-current text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-150" height="16" viewBox="0 0 24 24" width="16">
                          <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm0-22c-5.514 0-10 4.486-10 10s4.486 10 10 10 10-4.486 10-10-4.486-10-10-10z" />
                          <path d="M12 18c-2.9 0-4.5-1.7-4.5-1.7a1 1 0 0 1 1.4-1.4s1.1 1.1 3.1 1.1 3.1-1.1 3.1-1.1a1 1 0 1 1 1.4 1.4S14.9 18 12 18z" />
                          <circle cx="8.5" cy="9.5" r="1.5" />
                          <circle cx="15.5" cy="9.5" r="1.5" />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      className="text-primary font-bold text-sm hover:text-primary/80 disabled:opacity-40 transition-colors px-2 shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  {showEmojiPicker && (
                    <div className="p-2 rounded-xl flex gap-1.5 flex-wrap items-center justify-center border shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-150 mt-1 bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      {["😀", "😂", "❤️", "😍", "👍", "🔥", "👏", "🎉", "😢", "😮", "🙌", "✨", "💯", "🙏"].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setCommentText((prev) => prev + emoji);
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
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PostDetailModal;
