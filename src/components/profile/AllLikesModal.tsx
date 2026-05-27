import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface AllLikesModalProps {
  postId: string;
  onClose: () => void;
}

const AllLikesModal = ({ postId, onClose }: AllLikesModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [likes, setLikes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStates, setFollowStates] = useState<Record<string, string>>({});

  const loadLikes = useCallback(async () => {
    setLoading(true);
    const { data: likeRows } = await supabase
      .from("post_likes")
      .select("user_id, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (!likeRows || likeRows.length === 0) {
      setLikes([]);
      setLoading(false);
      return;
    }

    const userIds = likeRows.map((l) => l.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, username, is_private")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    const enriched = likeRows.map((l) => ({
      userId: l.user_id,
      createdAt: l.created_at,
      ...(profileMap.get(l.user_id) || {}),
    }));

    setLikes(enriched);

    if (user) {
      const { data: followRows } = await supabase
        .from("user_follows")
        .select("following_id, status")
        .eq("follower_id", user.id)
        .in("following_id", userIds);

      const followedSet: Record<string, string> = {};
      (followRows || []).forEach((f) => {
        followedSet[f.following_id] = f.status;
      });
      setFollowStates(followedSet);
    }

    setLoading(false);
  }, [postId, user]);

  useEffect(() => {
    loadLikes();
  }, [loadLikes]);

  const handleToggleFollow = async (targetUserId: string, isPrivate: boolean) => {
    if (!user) return;
    const currentStatus = followStates[targetUserId];

    if (currentStatus === "following" || currentStatus === "pending") {
      await supabase
        .from("user_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);
      setFollowStates((prev) => {
        const copy = { ...prev };
        delete copy[targetUserId];
        return copy;
      });
    } else {
      const newStatus = isPrivate ? "pending" : "following";
      await supabase
        .from("user_follows")
        .insert({ follower_id: user.id, following_id: targetUserId, status: newStatus });
      setFollowStates((prev) => ({ ...prev, [targetUserId]: newStatus }));
      
      await supabase.from("notifications").insert({
        recipient_id: targetUserId,
        sender_id: user.id,
        type: "follow",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <h3 className="text-base font-bold text-foreground">Likes</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/60 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : likes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm font-medium">
                No likes yet
              </div>
            ) : (
              likes.map((like) => {
                const displayName = like.display_name || "User";
                const initials = displayName.slice(0, 2).toUpperCase();
                const isOwnProfile = user?.id === like.userId;
                const currentStatus = followStates[like.userId];

                return (
                  <div
                    key={like.userId}
                    className="flex items-center gap-3 py-2.5 px-1 rounded-2xl hover:bg-secondary/30 transition-colors"
                  >
                    <Avatar
                      className="w-11 h-11 ring-2 ring-background shadow cursor-pointer shrink-0"
                      onClick={() => { navigate(`/profile/${like.userId}`); onClose(); }}
                    >
                      <AvatarImage src={like.avatar_url || ""} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => { navigate(`/profile/${like.userId}`); onClose(); }}
                    >
                      <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                      {like.username && (
                        <p className="text-xs text-muted-foreground">@{like.username}</p>
                      )}
                    </div>

                    {!isOwnProfile && user && (
                      <button
                        onClick={() => handleToggleFollow(like.userId, !!like.is_private)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                          currentStatus
                            ? "border border-border/60 text-foreground bg-transparent hover:bg-secondary/40"
                            : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-sm"
                        }`}
                      >
                        {currentStatus === "following"
                          ? "Following"
                          : currentStatus === "pending"
                            ? "Requested"
                            : "Follow"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllLikesModal;
