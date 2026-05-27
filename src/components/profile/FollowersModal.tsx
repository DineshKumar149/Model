import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface FollowersModalProps {
  profileId: string;
  mode: "followers" | "following";
  onClose: () => void;
}

const FollowersModal = ({ profileId, mode, onClose }: FollowersModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStates, setFollowStates] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    let userIds: string[] = [];

    if (mode === "followers") {
      const { data } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("following_id", profileId)
        .eq("status", "following");
      userIds = (data || []).map((r) => r.follower_id);
    } else {
      const { data } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", profileId)
        .eq("status", "following");
      userIds = (data || []).map((r) => r.following_id);
    }

    if (userIds.length === 0) { setUsers([]); setLoading(false); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, username, is_verified, is_private")
      .in("user_id", userIds);

    setUsers(profiles || []);

    if (user) {
      const { data: myFollows } = await supabase
        .from("user_follows")
        .select("following_id, status")
        .eq("follower_id", user.id)
        .in("following_id", userIds);
      const map: Record<string, string> = {};
      (myFollows || []).forEach((f) => { map[f.following_id] = f.status; });
      setFollowStates(map);
    }

    setLoading(false);
  }, [profileId, mode, user]);

  useEffect(() => { load(); }, [load]);

  const handleToggleFollow = async (targetId: string, isPrivate: boolean) => {
    if (!user) return;
    const currentStatus = followStates[targetId];
    if (currentStatus === "following" || currentStatus === "pending") {
      await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      setFollowStates((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
    } else {
      const newStatus = isPrivate ? "pending" : "following";
      await supabase.from("user_follows").insert({ follower_id: user.id, following_id: targetId, status: newStatus });
      setFollowStates((prev) => ({ ...prev, [targetId]: newStatus }));
      
      await supabase.from("notifications").insert({
        recipient_id: targetId,
        sender_id: user.id,
        type: "follow",
      });
    }
  };

  const handleRemoveFollower = async (followerId: string) => {
    if (!user) return;
    await supabase.from("user_follows").delete().eq("follower_id", followerId).eq("following_id", user.id);
    setUsers((prev) => prev.filter(p => p.user_id !== followerId));
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm max-h-[80vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
            <h3 className="text-base font-bold text-foreground capitalize">{mode}</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/60 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-thin">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm font-medium">
                {mode === "followers" ? "No followers yet" : "Not following anyone"}
              </div>
            ) : (
              users.map((profile) => {
                const name = profile.display_name || "User";
                const initials = name.slice(0, 2).toUpperCase();
                const isSelf = user?.id === profile.user_id;
                const currentStatus = followStates[profile.user_id];
                const isFollowingOrRequested = !!currentStatus;

                return (
                  <div key={profile.user_id} className="flex items-center gap-3 py-2.5 px-1 rounded-2xl hover:bg-secondary/30 transition-colors">
                    <Avatar
                      className="w-11 h-11 ring-2 ring-background shadow cursor-pointer shrink-0"
                      onClick={() => { navigate(`/profile/${profile.user_id}`); onClose(); }}
                    >
                      <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { navigate(`/profile/${profile.user_id}`); onClose(); }}>
                      <p className="text-sm font-bold text-foreground truncate">{name}</p>
                      {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
                    </div>

                    {!isSelf && user && (
                      <div className="flex gap-2">
                        {mode === "followers" && profileId === user.id && (
                          <button
                            onClick={() => handleRemoveFollower(profile.user_id)}
                            className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border border-border/60 text-foreground bg-transparent hover:bg-secondary/40"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleFollow(profile.user_id, !!profile.is_private)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            isFollowingOrRequested
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
                      </div>
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

export default FollowersModal;
