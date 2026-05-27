import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Heart, Loader2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "@/components/shared/ThemeProvider";
import PostDetailModal from "@/components/profile/PostDetailModal";

interface Profile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  is_private: boolean;
}

interface Notification {
  id: string;
  type: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  post_id?: string;
  content?: string;
  sender?: Profile;
  recipient?: Profile;
  post?: { id: string; image_url: string };
}

interface FollowRequest {
  id: string;
  follower_id: string;
  following_id: string;
  status: string;
  follower?: Profile;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [followersSet, setFollowersSet] = useState<Set<string>>(new Set());
  const [myFollowsMap, setMyFollowsMap] = useState<Record<string, string>>({});
  const [filterTab, setFilterTab] = useState<"All" | "Following" | "Comments" | "Follows" | "Likes">("All");
  const [suggestedUsers, setSuggestedUsers] = useState<Profile[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedPostAuthor, setSelectedPostAuthor] = useState<any>(null);

  const reloadNotifications = useCallback(async () => {
    if (!user) return;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString();

    const { data: follows } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .eq("status", "following");
    
    const followingIds = follows ? follows.map(f => f.following_id) : [];

    let query = supabase.from("notifications")
      .select("*, sender:profiles!sender_id(display_name, avatar_url, username, is_private), recipient:profiles!recipient_id(display_name, avatar_url, username, is_private), post:posts(id, image_url)")
      .gt("created_at", threeMonthsAgoStr)
      .neq("type", "view_feed")
      .neq("type", "chat_message")
      .order("created_at", { ascending: false })
      .limit(200);

    query = query.eq("recipient_id", user.id);

    const { data: notifs } = await query;

    const { data: reqs } = await supabase.from("user_follows")
      .select("*, follower:profiles!user_follows_follower_id_fkey(display_name, avatar_url, username, is_private)")
      .eq("following_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    
    const reqsList = (reqs as unknown as FollowRequest[]) || [];
    const pendingSenderIds = new Set(reqsList.map(r => r.follower_id));
    const seenFollowSenders = new Set<string>();

    const filteredNotifs = ((notifs as unknown as Notification[]) || []).filter((n) => {
      if (n.sender_id === user.id && n.recipient_id === user.id) return false;
      const isFollowType = n.type === "follow" || n.type === "follow_accept";
      if (isFollowType && n.recipient_id === user.id) {
        if (pendingSenderIds.has(n.sender_id)) return false;
        if (seenFollowSenders.has(n.sender_id)) return false;
        seenFollowSenders.add(n.sender_id);
      }
      return true;
    });

    setNotifications(filteredNotifs);
    setFollowRequests(reqsList);
  }, [user]);

  const handleOpenPost = async (postId: string, senderProfile: any) => {
    if (!postId) return;
    const { data: postData } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();
      
    if (postData) {
      const { data: authorData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", postData.user_id)
        .maybeSingle();

      setSelectedPost(postData);
      setSelectedPostAuthor(authorData || senderProfile);
    }
  };

  const loadAllData = useCallback(async () => {
    if (!user) return;
    setLoadingNotifs(true);
    
    const reloadPromise = reloadNotifications();

    const [
      { data: follows },
      { data: followers },
      { data: myFollows }
    ] = await Promise.all([
      supabase.from("user_follows").select("following_id").eq("follower_id", user.id),
      supabase.from("user_follows").select("follower_id").eq("following_id", user.id).eq("status", "following"),
      supabase.from("user_follows").select("following_id, status").eq("follower_id", user.id)
    ]);

    const followingIds = follows ? follows.map(f => f.following_id) : [];
    followingIds.push(user.id);

    const { data: suggestions } = await supabase
      .from("profiles")
      .select("*")
      .not("user_id", "in", `(${followingIds.map(id => `"${id}"`).join(",")})`)
      .limit(10);
    
    setSuggestedUsers((suggestions as unknown as Profile[]) || []);
    setFollowersSet(new Set((followers || []).map(f => f.follower_id)));

    const map: Record<string, string> = {};
    (myFollows || []).forEach(f => {
      map[f.following_id] = f.status;
    });
    setMyFollowsMap(map);

    await reloadPromise;
    setLoadingNotifs(false);
    
    supabase.from("notifications").update({ is_read: true }).eq("recipient_id", user.id).eq("is_read", false);
  }, [user, reloadNotifications]);

  useEffect(() => {
    if (!isOpen || !user) return;
    loadAllData();

    const ch = supabase
      .channel(`mobile-notif-${user.id}-${Math.random().toString(36).substr(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        reloadNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_follows" }, () => {
        reloadNotifications();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(ch); };
  }, [isOpen, user, loadAllData, reloadNotifications]);

  const handleNotificationFollowToggle = async (senderId: string, isPrivate: boolean) => {
    if (!user) return;
    const currentStatus = myFollowsMap[senderId];
    
    if (currentStatus === "following" || currentStatus === "pending") {
      await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", senderId);
      setMyFollowsMap(prev => {
        const copy = { ...prev };
        delete copy[senderId];
        return copy;
      });
    } else {
      const newStatus = isPrivate ? "pending" : "following";
      await supabase.from("user_follows").insert({ follower_id: user.id, following_id: senderId, status: newStatus });
      setMyFollowsMap(prev => ({ ...prev, [senderId]: newStatus }));
      
      await supabase.from("notifications").insert({
        recipient_id: senderId,
        sender_id: user.id,
        type: "follow"
      });
    }
  };

  const handleAcceptRequest = async (followerId: string) => {
    if (!user) return;
    await supabase.from("user_follows").update({ status: "following" }).eq("follower_id", followerId).eq("following_id", user.id);
    await supabase.from("notifications").insert({ recipient_id: followerId, sender_id: user.id, type: "follow_accept" });
    setFollowRequests(prev => prev.filter(r => r.follower_id !== followerId));
    reloadNotifications();
  };

  const handleRejectRequest = async (followerId: string) => {
    if (!user) return;
    await supabase.from("user_follows").delete().eq("follower_id", followerId).eq("following_id", user.id);
    setFollowRequests(prev => prev.filter(r => r.follower_id !== followerId));
  };

  const formatNotifTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days >= 7) {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    if (days > 0) return `${days}d`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  const groupNotificationsByTime = (items: Notification[]) => {
    const now = new Date();
    const groups: Record<string, Notification[]> = {
      "Today": [],
      "This week": [],
      "This month": [],
      "Older": []
    };
    
    items.forEach(item => {
      const d = new Date(item.created_at);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diffDays < 1) {
        groups["Today"].push(item);
      } else if (diffDays < 7) {
        groups["This week"].push(item);
      } else if (diffDays < 30) {
        groups["This month"].push(item);
      } else {
        groups["Older"].push(item);
      }
    });
    
    return Object.fromEntries(Object.entries(groups).filter(([_, val]) => val.length > 0));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200" />

      <div
        className={`relative w-full max-w-sm h-full border-l shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300 ${
          isDark ? "bg-black border-white/10" : "bg-white border-neutral-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex flex-col h-full w-full ${isDark ? "bg-black" : "bg-white"}`}>
          <div className="flex items-center justify-between px-5 pt-6 pb-4">
            <h2 className={`text-[22px] font-bold ${isDark ? "text-white" : "text-black"}`}>
              Notifications
            </h2>
            <button 
              onClick={onClose} 
              className="bg-transparent border-none cursor-pointer flex items-center justify-center w-7 h-7"
            >
              <X className={`w-5 h-5 ${isDark ? "text-white" : "text-black"}`} />
            </button>
          </div>

          <div className="flex gap-2 px-5 pb-4 overflow-x-auto flex-nowrap whitespace-nowrap no-scrollbar scrollbar-none">
            {(["All", "Following", "Comments", "Follows", "Likes"] as const).map(tab => {
              const isActive = filterTab === tab;
              const labels = {
                All: "All",
                Following: "People you follow",
                Comments: "Comments",
                Follows: "Follows",
                Likes: "Likes"
              };
              
              return (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-[14px] py-[6px] rounded-full text-[13px] font-semibold whitespace-nowrap transition-all duration-120 ${
                    isActive 
                      ? isDark 
                        ? "bg-[#262626] text-white border-transparent" 
                        : "bg-[#f0f0f0] text-black border-transparent"
                      : isDark
                        ? "bg-transparent text-[#a3a3a3] border-[#262626] border hover:text-white"
                        : "bg-transparent text-[#737373] border-[#dbdbdb] border hover:text-black"
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 pb-5">
            {loadingNotifs ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 text-[#737373] animate-spin" />
              </div>
            ) : (
              <>
                {(filterTab === "All" || filterTab === "Follows") && followRequests.length > 0 && (
                  <div className={`border-b pb-4 mb-4 ${isDark ? "border-[#1c1c1e]" : "border-[#dbdbdb]"}`}>
                    <p className="text-[13px] font-bold text-[#737373] mb-3 uppercase tracking-wide">
                      Follow Requests
                    </p>
                    <div className="flex flex-col gap-3">
                      {followRequests.map(req => (
                        <div key={req.id} className="flex items-center gap-3 py-0.5">
                          <Link to={`/profile/${req.follower_id}`} onClick={onClose} className="flex flex-shrink-0">
                            <Avatar className={`w-11 h-11 ring-1 ${isDark ? "ring-neutral-800" : "ring-neutral-200"}`}>
                              <AvatarImage src={req.follower?.avatar_url || ""} className="object-cover" />
                              <AvatarFallback className="bg-neutral-800 font-bold text-white text-sm">
                                {(req.follower?.display_name || "U")[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link 
                              to={`/profile/${req.follower_id}`} 
                              onClick={onClose} 
                              className={`font-bold text-[13px] no-underline hover:underline truncate block ${isDark ? "text-white" : "text-black"}`}
                            >
                              {req.follower?.username || req.follower?.display_name || "Someone"}
                            </Link>
                            <p className="text-xs text-[#a3a3a3] mt-[1px]">Requested to follow you</p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleAcceptRequest(req.follower_id)}
                              className="w-[90px] h-8 flex items-center justify-center bg-[#0095f6] text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleRejectRequest(req.follower_id)}
                              className={`w-[90px] h-8 flex items-center justify-center border-none rounded-lg text-[13px] font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${
                                isDark ? "bg-[#363636] text-white" : "bg-[#f0f0f0] text-black"
                              }`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {notifications.length === 0 && followRequests.length === 0 ? (
                  <div className="flex flex-col items-center py-8 px-4 text-center text-[#737373]">
                    <div className={`flex items-center justify-center w-[62px] h-[62px] rounded-full border-2 mb-4 ${isDark ? "border-white" : "border-black"}`}>
                      <Heart className={`w-7 h-7 ${isDark ? "text-white" : "text-black"}`} />
                    </div>
                    <p className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-black"}`}>
                      Activity On Your Posts
                    </p>
                    <p className="text-[13px] text-[#737373] leading-relaxed mb-8">
                      When someone likes or comments on one of your posts, you'll see it here.
                    </p>

                    {suggestedUsers.length > 0 && (
                      <div className="w-full">
                        <h3 className={`text-[15px] font-bold self-start w-full text-left mb-4 ${isDark ? "text-white" : "text-black"}`}>
                          Suggested for you
                        </h3>
                        <div className="flex flex-col gap-3.5 w-full">
                          {suggestedUsers.map(profile => {
                            const isFollowing = myFollowsMap[profile.user_id] === "following";
                            const isPending = myFollowsMap[profile.user_id] === "pending";

                            return (
                              <div key={profile.user_id} className="flex items-center gap-3 w-full">
                                <Link to={`/profile/${profile.user_id}`} onClick={onClose} className="flex flex-shrink-0">
                                  <Avatar className={`w-11 h-11 ring-1 ${isDark ? "ring-neutral-800" : "ring-neutral-200"}`}>
                                    <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback className="bg-neutral-800 font-bold text-white text-sm">
                                      {(profile.display_name || profile.username || "U")[0]?.toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </Link>

                                <div className="flex-1 min-w-0 text-left">
                                  <Link 
                                    to={`/profile/${profile.user_id}`} 
                                    onClick={onClose} 
                                    className={`font-bold text-[13px] no-underline hover:underline truncate block ${isDark ? "text-white" : "text-black"}`}
                                  >
                                    {profile.username || "user"}
                                  </Link>
                                  <p className="text-xs text-[#737373] truncate">
                                    {profile.display_name || "Suggested for you"}
                                  </p>
                                </div>

                                <button
                                  onClick={() => handleNotificationFollowToggle(profile.user_id, profile.is_private)}
                                  className={`w-[98px] h-8 flex items-center justify-center rounded-lg text-[13px] font-semibold cursor-pointer border-none transition-all duration-120 flex-shrink-0 hover:scale-[1.02] active:scale-[0.98] ${
                                    isFollowing || isPending 
                                      ? isDark ? "bg-[#363636] text-white" : "bg-[#f0f0f0] text-black"
                                      : "bg-[#0095f6] text-white"
                                  }`}
                                >
                                  {isFollowing ? "Following" : isPending ? "Requested" : "Follow"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {Object.entries(
                      groupNotificationsByTime(
                        notifications.filter(n => {
                          if (filterTab === "Comments") return n.type === "comment" || n.type === "mention";
                          if (filterTab === "Follows") return (n.type === "follow" || n.type === "follow_accept") && n.recipient_id === user.id;
                          if (filterTab === "Following") return n.recipient_id !== user.id || myFollowsMap[n.sender_id] === "following";
                          if (filterTab === "Likes") return n.type === "like" || n.type === "post_like" || n.type === "like_post" || n.type === "story_like";
                          return true;
                        })
                      )
                    ).map(([groupTitle, items]) => (
                      <div key={groupTitle} className="mb-5">
                        <h3 className={`text-base font-bold mb-3 ${isDark ? "text-white" : "text-black"}`}>
                          {groupTitle}
                        </h3>
                        <div className="flex flex-col gap-3">
                          {items.map(notif => {
                            const isFollowingActivity = notif.recipient_id !== user?.id;
                            const targetUserId = isFollowingActivity ? notif.recipient_id : notif.sender_id;
                            const targetProfile = isFollowingActivity ? notif.recipient : notif.sender;

                            const isFollowing = myFollowsMap[targetUserId] === "following";
                            const isPending = myFollowsMap[targetUserId] === "pending";
                            const followsMe = followersSet.has(targetUserId);
                            const isPrivate = targetProfile?.is_private ?? false;
                            const isFollowRequestPending = followRequests.some(r => r.follower_id === targetUserId);

                            return (
                              <div 
                                key={notif.id} 
                                onClick={() => {
                                  if (notif.post_id) {
                                    handleOpenPost(notif.post_id, targetProfile);
                                  }
                                }}
                                className={`flex items-center gap-3 px-2 py-1.5 rounded-lg ${
                                  notif.post_id 
                                    ? `cursor-pointer ${isDark ? "hover:bg-neutral-900/40" : "hover:bg-neutral-50"}` 
                                    : "cursor-default"
                                }`}
                              >
                                <Link 
                                  to={`/profile/${notif.sender_id}`} 
                                  onClick={(e) => { e.stopPropagation(); onClose(); }} 
                                  className="flex flex-shrink-0"
                                >
                                  <Avatar className={`w-11 h-11 ring-1 ${isDark ? "ring-neutral-800" : "ring-neutral-200"}`}>
                                    <AvatarImage src={notif.sender?.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback className="bg-neutral-800 font-bold text-white text-sm">
                                      {(notif.sender?.display_name || "U")[0]?.toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </Link>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[14px] leading-relaxed ${isDark ? "text-white" : "text-black"}`}>
                                    {notif.post_id ? (
                                      <span onClick={(e) => { e.stopPropagation(); handleOpenPost(notif.post_id, notif.sender); }} className="hover:opacity-80 cursor-pointer">
                                        <Link 
                                          to={`/profile/${notif.sender_id}`} 
                                          onClick={(e) => { e.stopPropagation(); onClose(); }} 
                                          className={`font-semibold mr-1 no-underline hover:underline ${isDark ? "text-white" : "text-black"}`}
                                        >
                                          {notif.sender?.username || notif.sender?.display_name || "Someone"}
                                        </Link>
                                        {(notif.type === "like" || notif.type === "post_like" || notif.type === "like_post") && "liked your post."}
                                        {notif.type === "story_like" && "liked your story."}
                                        {notif.type === "comment" && "commented on your post."}
                                        {notif.type === "mention" && `mentioned you in a comment: ${notif.content || ""}`}
                                        {notif.type === "share" && "shared your post."}
                                        {notif.type === "save" && "saved your post."}
                                      </span>
                                    ) : (
                                      <span>
                                        <Link 
                                          to={`/profile/${notif.sender_id}`} 
                                          onClick={(e) => { e.stopPropagation(); onClose(); }} 
                                          className={`font-semibold mr-1 no-underline hover:underline ${isDark ? "text-white" : "text-black"}`}
                                        >
                                          {notif.sender?.username || notif.sender?.display_name || "Someone"}
                                        </Link>
                                        {(notif.type === "like" || notif.type === "post_like" || notif.type === "like_post") && "liked your post."}
                                        {notif.type === "story_like" && "liked your story."}
                                        {notif.type === "comment" && "commented on your post."}
                                        {(notif.type === "follow" || notif.type === "follow_accept") && "started following you."}
                                        {notif.type === "mention" && `mentioned you in a comment: ${notif.content || ""}`}
                                        {notif.type === "share" && "shared your post."}
                                        {notif.type === "save" && "saved your post."}
                                      </span>
                                    )}
                                    <span className="text-[#737373] ml-1.5 text-[14px]">
                                      {formatNotifTime(notif.created_at)}
                                    </span>
                                  </p>
                                </div>
                                {(notif.type === "follow" || notif.type === "follow_accept") && targetUserId !== user?.id && (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    {isFollowRequestPending ? (
                                      <div className="flex gap-1.5 flex-shrink-0">
                                        <button
                                          onClick={() => handleAcceptRequest(targetUserId)}
                                          className="w-[90px] h-8 flex items-center justify-center bg-[#0095f6] text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={() => handleRejectRequest(targetUserId)}
                                          className={`w-[90px] h-8 flex items-center justify-center border-none rounded-lg text-[13px] font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${
                                            isDark ? "bg-[#363636] text-white" : "bg-[#f0f0f0] text-black"
                                          }`}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleNotificationFollowToggle(targetUserId, isPrivate)}
                                        className={`w-[98px] h-8 flex items-center justify-center rounded-lg text-[13px] font-semibold cursor-pointer border-none transition-all duration-120 flex-shrink-0 hover:scale-[1.02] active:scale-[0.98] ${
                                          isFollowing || isPending 
                                            ? isDark ? "bg-[#363636] text-white" : "bg-[#f0f0f0] text-black"
                                            : "bg-[#0095f6] text-white"
                                        }`}
                                      >
                                        {isFollowing ? "Following" : isPending ? "Requested" : followsMe ? "Follow Back" : "Follow"}
                                      </button>
                                    )}
                                  </div>
                                )}

                                {notif.post?.image_url && (
                                  <div className={`flex flex-shrink-0 w-10 h-10 rounded overflow-hidden border ${isDark ? "border-[#262626]" : "border-[#dbdbdb]"}`}>
                                    {notif.post.image_url.toLowerCase().includes(".mp4") ? (
                                      <video src={notif.post.image_url} muted playsInline autoPlay loop className="w-full h-full object-cover" />
                                    ) : (
                                      <img src={notif.post.image_url} alt="Post thumbnail" className="w-full h-full object-cover" />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          authorProfile={selectedPostAuthor}
          onClose={() => {
            setSelectedPost(null);
            setSelectedPostAuthor(null);
          }}
        />
      )}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
    </div>
  );
}
