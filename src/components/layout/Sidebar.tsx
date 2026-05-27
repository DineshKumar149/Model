import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/shared/ThemeProvider";
import { useChatUnread } from "@/hooks/use-chat-unread";
import {
  Home, Search, Heart, Plus, Menu, Settings as SettingsIcon,
  LogOut, Loader2, PlaySquare, Send, ChevronLeft, Moon,
  Activity, Bookmark, AlertCircle, UserCircle2, X, Sliders
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SwitchAccountModal from "@/components/shared/SwitchAccountModal";
import ReportProblemModal from "@/components/shared/ReportProblemModal";
import PostDetailModal from "@/components/profile/PostDetailModal";

interface SidebarProps {
  onOpenCreate: () => void;
}

const COLLAPSED_W = 72;
const EXPANDED_W = 245;

type Panel = "none" | "search" | "notifications";
type MoreState = "closed" | "main" | "appearance";

const Sidebar = ({ onOpenCreate }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { total: unreadTotal } = useChatUnread();

  const [isHovered, setIsHovered] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>("none");
  const [moreState, setMoreState] = useState<MoreState>("closed");
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [profileData, setProfileData] = useState<any>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isSwitchAccountOpen, setIsSwitchAccountOpen] = useState(false);
  const [isReportProblemOpen, setIsReportProblemOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [followersSet, setFollowersSet] = useState<Set<string>>(new Set());
  const [myFollowsMap, setMyFollowsMap] = useState<Record<string, string>>({});
  const [filterTab, setFilterTab] = useState<"All" | "Following" | "Comments" | "Follows" | "Likes">("All");
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedPostAuthor, setSelectedPostAuthor] = useState<any>(null);

  // Dark mode derived
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const expanded = isHovered || activePanel !== "none";

  const fetchUnreadNotifsCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setUnreadNotifsCount(count || 0);
  };

  useEffect(() => {
    if (!user) return;
    fetchUnreadNotifsCount();
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfileData(data);
    };
    fetchProfile();
    const ch = supabase
      .channel(`sidebar-notif-${user.id}-${Math.random().toString(36).substr(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` }, () => {
        fetchUnreadNotifsCount();
        if (activePanel === "notifications") reloadNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_follows", filter: `following_id=eq.${user.id}` }, () => {
        if (activePanel === "notifications") reloadNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  useEffect(() => {
    if (activePanel !== "search" || !searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const q = `%${searchQuery.trim()}%`;
      const { data } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url")
        .or(`display_name.ilike.${q},username.ilike.${q}`).neq("user_id", user?.id || "").limit(10);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activePanel, user]);

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

  const reloadNotifications = async () => {
    if (!user) return;
    const { data: notifs } = await supabase.from("notifications")
      .select("*, sender:profiles!sender_id(display_name, avatar_url, username, is_private), post:posts(id, image_url)")
      .eq("recipient_id", user.id)
      .neq("type", "view_feed")
      .neq("type", "chat_message")
      .order("created_at", { ascending: false })
      .limit(60);

    const { data: reqs } = await supabase.from("user_follows")
      .select("*, follower:profiles!user_follows_follower_id_fkey(display_name, avatar_url, username, is_private)")
      .eq("following_id", user.id).eq("status", "pending").order("created_at", { ascending: false });
    
    const reqsList = reqs || [];
    const pendingSenderIds = new Set(reqsList.map(r => r.follower_id));
    const seenFollowSenders = new Set<string>();

    const filteredNotifs = (notifs || []).filter((n: any) => {
      const isFollowType = n.type === "follow" || n.type === "follow_accept";
      if (isFollowType) {
        if (pendingSenderIds.has(n.sender_id)) return false;
        if (seenFollowSenders.has(n.sender_id)) return false;
        seenFollowSenders.add(n.sender_id);
      }
      return true;
    });

    setNotifications(filteredNotifs);
    setFollowRequests(reqsList);

    // Fetch Suggested Users
    const { data: follows } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id);
    const followingIds = follows ? follows.map(f => f.following_id) : [];
    followingIds.push(user.id);

    const { data: suggestions } = await supabase
      .from("profiles")
      .select("*")
      .not("user_id", "in", `(${followingIds.map(id => `"${id}"`).join(",")})`)
      .limit(10);
    setSuggestedUsers(suggestions || []);
  };

  const handleNotificationFollowToggle = async (senderId: string, isPrivate: boolean) => {
    if (!user) return;
    const currentStatus = myFollowsMap[senderId];
    
    if (currentStatus === "following") {
      await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", senderId);
      setMyFollowsMap(prev => {
        const copy = { ...prev };
        delete copy[senderId];
        return copy;
      });
    } else if (currentStatus === "pending") {
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

  const groupNotificationsByTime = (items: any[]) => {
    const now = new Date();
    const groups: Record<string, any[]> = {
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

  useEffect(() => {
    if (activePanel !== "notifications" || !user) return;
    const load = async () => {
      setLoadingNotifs(true);
      const { data: notifs } = await supabase.from("notifications")
        .select("*, sender:profiles!sender_id(display_name, avatar_url, username, is_private), post:posts(id, image_url)")
        .eq("recipient_id", user.id)
        .neq("type", "view_feed")
        .neq("type", "chat_message")
        .order("created_at", { ascending: false })
        .limit(60);

      const { data: reqs } = await supabase.from("user_follows")
        .select("*, follower:profiles!user_follows_follower_id_fkey(display_name, avatar_url, username, is_private)")
        .eq("following_id", user.id).eq("status", "pending").order("created_at", { ascending: false });
      
      const reqsList = reqs || [];
      const pendingSenderIds = new Set(reqsList.map(r => r.follower_id));
      const seenFollowSenders = new Set<string>();

      const filteredNotifs = (notifs || []).filter((n: any) => {
        const isFollowType = n.type === "follow" || n.type === "follow_accept";
        if (isFollowType) {
          if (pendingSenderIds.has(n.sender_id)) return false;
          if (seenFollowSenders.has(n.sender_id)) return false;
          seenFollowSenders.add(n.sender_id);
        }
        return true;
      });

      setNotifications(filteredNotifs);
      setFollowRequests(reqsList);

      // Fetch Suggested Users
      const { data: follows } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const followingIds = follows ? follows.map(f => f.following_id) : [];
      followingIds.push(user.id);

      const { data: suggestions } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", `(${followingIds.map(id => `"${id}"`).join(",")})`)
        .limit(10);
      setSuggestedUsers(suggestions || []);

      const { data: followers } = await supabase.from("user_follows")
        .select("follower_id")
        .eq("following_id", user.id)
        .eq("status", "following");
      setFollowersSet(new Set((followers || []).map(f => f.follower_id)));

      const { data: myFollows } = await supabase.from("user_follows")
        .select("following_id, status")
        .eq("follower_id", user.id);
      
      const map: Record<string, string> = {};
      (myFollows || []).forEach(f => {
        map[f.following_id] = f.status;
      });
      setMyFollowsMap(map);

      setLoadingNotifs(false);
      
      await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", user.id).eq("is_read", false);
    };
    load();
  }, [activePanel, user]);
  const handleSignOut = async () => {
    setLoggingOut(true);
    setMoreState("closed");
    await signOut();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const displayName = profileData?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profileData?.avatar_url || user?.user_metadata?.avatar_url || "";

  const navItems = [
    { id: "home",          to: "/gallery",  label: "Home",          icon: Home,       active: isActive("/gallery") },
    { id: "reels",         to: "/reels",    label: "Reels",         icon: PlaySquare, active: isActive("/reels") },
    { id: "messages",      to: "/chat",     label: "Messages",      icon: Send,       active: isActive("/chat"), badge: unreadTotal },
    { id: "search",        action: () => { setActivePanel(p => p === "search" ? "none" : "search"); setMoreState("closed"); },
                                            label: "Search",        icon: Search,     active: activePanel === "search" },
    { id: "notifications", action: () => { 
        setActivePanel(p => p === "notifications" ? "none" : "notifications"); 
        setMoreState("closed"); 
        setUnreadNotifsCount(0);
        if (user) {
          supabase.from("notifications").update({ is_read: true }).eq("recipient_id", user.id).eq("is_read", false);
        }
      },
      label: "Notifications", icon: Heart, active: activePanel === "notifications", badge: unreadNotifsCount },
    { id: "create",        action: () => { onOpenCreate(); setMoreState("closed"); }, label: "Create", icon: Plus, active: false },
    { id: "profile",       to: "/profile",  label: "Profile",       isAvatar: true,   active: isActive("/profile") },
  ];

  const labelStyle = (show: boolean): React.CSSProperties => ({
    fontSize: 16, lineHeight: "20px",
    color: isDark ? "#fff" : "#000",
    whiteSpace: "nowrap", overflow: "hidden",
    opacity: show ? 1 : 0, maxWidth: show ? 160 : 0,
    transitionProperty: "opacity, max-width", transitionDuration: "220ms", transitionTimingFunction: "ease",
    userSelect: "none",
  });

  const ItemInner = ({ item, isItemActive }: { item: any; isItemActive: boolean }) => {
    const Icon = item.icon as any;
    return (
      <div
        style={{
          display: "flex", alignItems: "center", width: "100%", minHeight: 48, borderRadius: 12,
          padding: expanded ? "0 12px" : "0", gap: expanded ? 16 : 0,
          justifyContent: expanded ? "flex-start" : "center",
          background: isItemActive && expanded ? (isDark ? "#1a1a1a" : "#f0f0f0") : "transparent",
          transition: "background 150ms ease, padding 220ms ease", cursor: "pointer",
        }}
        className={isDark ? "hover:bg-[#1a1a1a]" : "hover:bg-[#f0f0f0]"}
      >
        <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {item.isAvatar ? (
            <Avatar style={{ width: 26, height: 26 }} className={`ring-2 transition-all ${isItemActive ? (isDark ? "ring-white" : "ring-black") : "ring-transparent"}`}>
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-neutral-700 text-white font-bold text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          ) : (
            <Icon style={{ width: 24, height: 24, color: isDark ? "#fff" : "#000" }} strokeWidth={isItemActive ? 2.5 : 2} />
          )}
          {(item.badge || 0) > 0 && (
            <span style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9999, border: "1.5px solid #000", padding: "0 2px" }}>
              {(item.badge || 0) > 9 ? "9+" : item.badge}
            </span>
          )}
        </div>
        <span style={{ ...labelStyle(expanded), fontWeight: isItemActive ? 700 : 400 }}>
          {item.isAvatar ? "Profile" : item.label}
        </span>
      </div>
    );
  };

  const renderNavItem = (item: any) => {
    const isItemActive = item.active;
    const cls = "w-full outline-none bg-transparent border-0 p-0 block";
    if (item.action) {
      return <button key={item.id} onClick={item.action} className={cls}><ItemInner item={item} isItemActive={isItemActive} /></button>;
    }
    return (
      <Link key={item.id} to={item.to!} onClick={() => { setActivePanel("none"); setMoreState("closed"); }} className={cls}>
        <ItemInner item={item} isItemActive={isItemActive} />
      </Link>
    );
  };

  // ── More menu popup ──
  const MorePopup = () => (
    <div
      style={{
        position: "fixed",
        bottom: 72,
        left: 12,
        width: 266,
        background: isDark ? "#262626" : "#ffffff",
        borderRadius: 16,
        zIndex: 200,
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        animation: "fadeScaleUp 0.18s ease forwards",
      }}
    >
      {moreState === "main" && (
        <>
          {/* Group 1: Settings, Activity, Saved, Appearance, Report */}
          <div style={{ padding: "8px 0" }}>
            {[
              { label: "Settings", icon: SettingsIcon, action: () => { navigate("/settings"); setMoreState("closed"); } },
              { label: "Your activity", icon: Activity, action: () => { navigate("/activity"); setMoreState("closed"); } },
              { label: "Saved", icon: Bookmark, action: () => { navigate("/profile"); setMoreState("closed"); } },
              { label: "Switch appearance", icon: Moon, action: () => setMoreState("appearance"), chevron: true },
              { label: "Report a problem", icon: AlertCircle, action: () => { setIsReportProblemOpen(true); setMoreState("closed"); } },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "14px 16px", background: "transparent", border: "none",
                  cursor: "pointer", color: isDark ? "#fff" : "#000",
                }}
                className={isDark ? "hover:bg-[#363636] transition-colors" : "hover:bg-[#f0f0f0] transition-colors"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <item.icon style={{ width: 18, height: 18, color: isDark ? "#fff" : "#000" }} strokeWidth={1.8} />
                  <span style={{ fontSize: 15, fontWeight: 400 }}>{item.label}</span>
                </div>
                {item.chevron && <ChevronLeft style={{ width: 16, height: 16, color: "#737373", transform: "rotate(180deg)" }} />}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: isDark ? "#363636" : "#e5e5e5", margin: "0 8px" }} />

          {/* Switch accounts */}
          <div style={{ padding: "8px 0" }}>
            <button
              onClick={() => { setIsSwitchAccountOpen(true); setMoreState("closed"); }}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", color: isDark ? "#fff" : "#000" }}
              className={isDark ? "hover:bg-[#363636] transition-colors" : "hover:bg-[#f0f0f0] transition-colors"}
            >
              <UserCircle2 style={{ width: 18, height: 18, color: isDark ? "#fff" : "#000" }} strokeWidth={1.8} />
              <span style={{ fontSize: 15, fontWeight: 400 }}>Switch accounts</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: isDark ? "#363636" : "#e5e5e5", margin: "0 8px" }} />

          {/* Log out */}
          <div style={{ padding: "8px 0" }}>
            <button
              onClick={handleSignOut}
              disabled={loggingOut}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", color: isDark ? "#fff" : "#000" }}
              className={isDark ? "hover:bg-[#363636] transition-colors" : "hover:bg-[#f0f0f0] transition-colors"}
            >
              {loggingOut
                ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                : <LogOut style={{ width: 18, height: 18 }} strokeWidth={1.8} />
              }
              <span style={{ fontSize: 15, fontWeight: 400 }}>Log out</span>
            </button>
          </div>
        </>
      )}

      {moreState === "appearance" && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: isDark ? "1px solid #363636" : "1px solid #e5e5e5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setMoreState("main")} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                <ChevronLeft style={{ width: 20, height: 20, color: isDark ? "#fff" : "#000" }} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? "#fff" : "#000" }}>Switch appearance</span>
            </div>
            <Moon style={{ width: 20, height: 20, color: isDark ? "#fff" : "#000" }} strokeWidth={1.8} />
          </div>

          {/* Dark mode toggle */}
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, color: isDark ? "#fff" : "#000", fontWeight: 400 }}>Dark mode</span>
              {/* Toggle switch */}
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                style={{
                  width: 50, height: 28, borderRadius: 14,
                  background: isDark ? "#0095f6" : "#333",
                  border: "none", cursor: "pointer", position: "relative",
                  transition: "background 250ms ease", flexShrink: 0,
                  outline: "none",
                }}
              >
                <div style={{
                  position: "absolute", top: 3,
                  left: isDark ? 25 : 3,
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#fff",
                  transition: "left 250ms ease",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeScaleUp {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );

  return (
    <>
      {/* ══════════════ SIDEBAR ══════════════ */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 60,
          width: expanded ? EXPANDED_W : COLLAPSED_W,
          transition: "width 250ms cubic-bezier(0.2,0,0,1), transform 250ms cubic-bezier(0.2,0,0,1)",
          transform: activePanel === "notifications" ? "translateX(-100%)" : "translateX(0)",
          background: isDark ? "#000" : "#fff",
          borderRight: isDark ? "1px solid #1a1a1a" : "1px solid #e5e5e5",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Logo at top */}
        <div style={{ padding: "20px 12px 0", flexShrink: 0 }}>
          <Link
            to="/gallery"
            onClick={() => { setActivePanel("none"); setMoreState("closed"); }}
            style={{
              display: "flex", alignItems: "center", minHeight: 48, borderRadius: 12,
              padding: expanded ? "0 12px" : "0", gap: expanded ? 16 : 0,
              justifyContent: expanded ? "flex-start" : "center",
              transition: "padding 220ms ease", textDecoration: "none",
            }}
            className={isDark ? "hover:bg-[#1a1a1a]" : "hover:bg-[#f0f0f0]"}
          >
            <img src="/logo.png" alt="Logo"
              style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span style={{
              ...labelStyle(expanded), fontSize: 22, fontWeight: 700,
              fontFamily: "'Billabong','Dancing Script',cursive,sans-serif", letterSpacing: "0.5px",
            }}>Atome</span>
          </Link>
        </div>

        {/* Top spacer */}
        <div style={{ flex: 1 }} />

        {/* Nav Items — vertically centred */}
        <nav style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
          {navItems.map(renderNavItem)}
        </nav>

        {/* Bottom spacer */}
        <div style={{ flex: 1 }} />

        {/* More button */}
        <div style={{ padding: "0 12px 28px", flexShrink: 0 }}>
          <button
            onClick={() => setMoreState(s => s === "closed" ? "main" : "closed")}
            style={{
              display: "flex", alignItems: "center", width: "100%", minHeight: 48, borderRadius: 12,
              padding: expanded ? "0 12px" : "0", gap: expanded ? 16 : 0,
              justifyContent: expanded ? "flex-start" : "center",
              background: "transparent", border: "none", outline: "none", cursor: "pointer",
              transition: "padding 220ms ease",
            }}
            className={isDark ? "hover:bg-[#1a1a1a]" : "hover:bg-[#f0f0f0]"}
          >
            <div style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Menu style={{ width: 24, height: 24, color: isDark ? "#fff" : "#000" }} strokeWidth={moreState !== "closed" ? 2.5 : 2} />
            </div>
            <span style={{ ...labelStyle(expanded), fontWeight: moreState !== "closed" ? 700 : 400 }}>More</span>
          </button>
        </div>
      </div>

      {/* More popup */}
      {moreState !== "closed" && <MorePopup />}

      {/* Click-outside overlay for More */}
      {moreState !== "closed" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setMoreState("closed")} />
      )}

      {/* ══════════════ SLIDING PANELS ══════════════ */}
      <div
        style={{
          position: "fixed", top: 0, bottom: 0,
          left: activePanel === "notifications" ? "8px" : (expanded ? EXPANDED_W : COLLAPSED_W),
          width: activePanel === "notifications" ? 390 : 350, zIndex: 50, background: isDark ? "#000" : "#fff",
          borderRight: isDark ? "1px solid #1a1a1a" : "1px solid #e5e5e5",
          boxShadow: activePanel !== "none" ? (isDark ? "8px 0 32px rgba(0,0,0,0.6)" : "8px 0 24px rgba(0,0,0,0.1)") : "none",
          transform: activePanel !== "none" ? "translateX(0)" : "translateX(-100%)",
          transition: "left 250ms cubic-bezier(0.2,0,0,1), transform 250ms cubic-bezier(0.2,0,0,1), width 250ms cubic-bezier(0.2,0,0,1)",
        }}
      >
        {/* Search Panel */}
        {activePanel === "search" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "32px 24px 16px" }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: isDark ? "#fff" : "#000", marginBottom: 24 }}>Search</h2>
              <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#737373" }} />
                <Input autoFocus placeholder="Search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className={`pl-10 h-10 rounded-xl text-sm focus-visible:ring-0 ${isDark ? "text-white placeholder:text-neutral-400" : "text-black placeholder:text-neutral-500"}`}
                  style={{ background: isDark ? "#262626" : "#f0f0f0", border: "none" }} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ padding: "0 16px" }}>
              {searching
                ? <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Loader2 style={{ width: 24, height: 24, color: "#737373" }} className="animate-spin" /></div>
                : searchResults.length > 0
                  ? searchResults.map(res => (
                    <Link key={res.user_id} to={`/profile/${res.user_id}`} onClick={() => setActivePanel("none")}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, textDecoration: "none" }}
                      className="hover:bg-[#1a1a1a] transition-colors">
                      <Avatar style={{ width: 44, height: 44, flexShrink: 0 }}>
                        <AvatarImage src={res.avatar_url || ""} className="object-cover" />
                        <AvatarFallback className="bg-neutral-700 font-bold text-white">{(res.display_name || "U")[0]}</AvatarFallback>
                      </Avatar>
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }} className="truncate">{res.display_name}</span>
                        {res.username && <span style={{ fontSize: 12, color: "#737373" }}>@{res.username}</span>}
                      </div>
                    </Link>
                  ))
                  : <p style={{ textAlign: "center", padding: 32, color: "#737373", fontSize: 14 }}>
                      {searchQuery.trim() ? "No results found." : "Search for users above"}
                    </p>
              }
            </div>
          </div>
        )}

        {/* Notifications Panel */}
        {activePanel === "notifications" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", background: isDark ? "#000" : "#fff" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 24px 16px" }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: isDark ? "#fff" : "#000" }}>Notifications</h2>
              <button 
                onClick={() => setActivePanel("none")} 
                style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}
              >
                <X style={{ width: 20, height: 20, color: isDark ? "#fff" : "#000" }} />
              </button>
            </div>

            {/* Filter Pills scrollbar */}
            <div style={{ display: "flex", gap: 8, padding: "0 24px 16px", overflowX: "auto", flexWrap: "nowrap", whiteSpace: "nowrap", msOverflowStyle: "none", scrollbarWidth: "none" }} className="no-scrollbar scrollbar-none">
              {(["All", "Following", "Likes", "Comments", "Follows"] as const).map(tab => {
                const isActive = filterTab === tab;
                const labels = {
                  All: "All",
                  Following: "People you follow",
                  Likes: "Likes",
                  Comments: "Comments",
                  Follows: "Follows"
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 600,
                      background: isActive ? (isDark ? "#262626" : "#f0f0f0") : "transparent",
                      color: isActive ? (isDark ? "#fff" : "#000") : (isDark ? "#a3a3a3" : "#737373"),
                      border: isActive ? "1px solid transparent" : (isDark ? "1px solid #262626" : "1px solid #dbdbdb"),
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 120ms ease"
                    }}
                    className={isDark ? "hover:text-white" : "hover:text-black"}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ padding: "0 24px 20px" }}>
              {loadingNotifs ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                  <Loader2 style={{ width: 24, height: 24, color: "#737373" }} className="animate-spin" />
                </div>
              ) : (
                <>
                  {/* Follow Requests Section (Private accounts) */}
                  {(filterTab === "All" || filterTab === "Follows") && followRequests.length > 0 && (
                    <div style={{ borderBottom: isDark ? "1px solid #1c1c1e" : "1px solid #dbdbdb", paddingBottom: 16, marginBottom: 16 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#737373", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Follow Requests</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {followRequests.map(req => (
                          <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 0" }}>
                            <Link to={`/profile/${req.follower_id}`} onClick={() => setActivePanel("none")} style={{ display: "flex", flexShrink: 0 }}>
                              <Avatar style={{ width: 44, height: 44 }} className={`ring-1 ${isDark ? "ring-neutral-800" : "ring-neutral-200"}`}>
                                <AvatarImage src={req.follower?.avatar_url || ""} className="object-cover" />
                                <AvatarFallback className="bg-neutral-800 font-bold text-white text-sm">
                                  {(req.follower?.display_name || "U")[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </Link>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Link to={`/profile/${req.follower_id}`} onClick={() => setActivePanel("none")} style={{ fontWeight: 700, color: isDark ? "#fff" : "#000", fontSize: 13, textDecoration: "none" }} className="hover:underline truncate block">
                                {req.follower?.username || req.follower?.display_name || "Someone"}
                              </Link>
                              <p style={{ fontSize: 12, color: "#a3a3a3", marginTop: 1 }}>Requested to follow you</p>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <button
                                onClick={() => handleAcceptRequest(req.follower_id)}
                                style={{ width: 90, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#0095f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                className="hover:scale-[1.02] active:scale-[0.98] transition-transform"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.follower_id)}
                                style={{ width: 90, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: isDark ? "#363636" : "#f0f0f0", color: isDark ? "#fff" : "#000", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                className="hover:scale-[1.02] active:scale-[0.98] transition-transform"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state check */}
                  {notifications.length === 0 && followRequests.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", textAlign: "center", color: "#737373" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 62, height: 62, borderRadius: "50%", border: isDark ? "2px solid #fff" : "2px solid #000", marginBottom: 16 }}>
                        <Heart style={{ width: 28, height: 28, color: isDark ? "#fff" : "#000" }} />
                      </div>
                      <p style={{ fontSize: 20, fontWeight: 700, color: isDark ? "#fff" : "#000", marginBottom: 8 }}>Activity On Your Posts</p>
                      <p style={{ fontSize: 13, color: "#737373", lineHeight: 1.4, marginBottom: 32 }}>When someone likes or comments on one of your posts, you'll see it here.</p>

                      {/* Suggested for you */}
                      {suggestedUsers.length > 0 && (
                        <div style={{ width: "100%" }}>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: isDark ? "#fff" : "#000", alignSelf: "flex-start", width: "100%", textAlign: "left", marginBottom: 16 }}>Suggested for you</h3>
                          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
                            {suggestedUsers.map(profile => {
                              const isFollowing = myFollowsMap[profile.user_id] === "following";
                              const isPending = myFollowsMap[profile.user_id] === "pending";

                              return (
                                <div key={profile.user_id} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                                  {/* Avatar */}
                                  <Link to={`/profile/${profile.user_id}`} onClick={() => setActivePanel("none")} style={{ display: "flex", flexShrink: 0 }}>
                                    <Avatar style={{ width: 44, height: 44 }} className={`ring-1 ${isDark ? "ring-neutral-800" : "ring-neutral-200"}`}>
                                      <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                                      <AvatarFallback className="bg-neutral-800 font-bold text-white text-sm">
                                        {(profile.display_name || profile.username || "U")[0]?.toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </Link>

                                  {/* Username & Subtext */}
                                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                                    <Link to={`/profile/${profile.user_id}`} onClick={() => setActivePanel("none")} style={{ fontWeight: 700, color: isDark ? "#fff" : "#000", fontSize: 13, textDecoration: "none" }} className="hover:underline truncate block">
                                      {profile.username || "user"}
                                    </Link>
                                    <p style={{ fontSize: 12, color: "#737373" }} className="truncate">
                                      {profile.display_name || "Suggested for you"}
                                    </p>
                                  </div>

                                  {/* Follow Button */}
                                  <button
                                    onClick={() => handleNotificationFollowToggle(profile.user_id, profile.is_private)}
                                    style={{
                                      width: 98,
                                      height: 32,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      borderRadius: 8,
                                      fontSize: 13,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      border: "none",
                                      transition: "all 120ms ease",
                                      background: isFollowing || isPending ? (isDark ? "#363636" : "#f0f0f0") : "#0095f6",
                                      color: isFollowing || isPending ? (isDark ? "#fff" : "#000") : "#fff",
                                      flexShrink: 0
                                    }}
                                    className="hover:scale-[1.02] active:scale-[0.98]"
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
                      {/* Standard Notifications (Grouped by Time) */}
                      {Object.entries(
                        groupNotificationsByTime(
                          notifications.filter(n => {
                            if (filterTab === "Comments") return n.type === "comment" || n.type === "mention";
                            if (filterTab === "Likes") return n.type === "like" || n.type === "post_like" || n.type === "like_post" || n.type === "story_like";
                            if (filterTab === "Follows") return n.type === "follow" || n.type === "follow_accept";
                            if (filterTab === "Following") return myFollowsMap[n.sender_id] === "following";
                            return true;
                          })
                        )
                      ).map(([groupTitle, items]) => (
                        <div key={groupTitle} style={{ marginBottom: 20 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: isDark ? "#fff" : "#000", marginBottom: 12 }}>{groupTitle}</h3>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {items.map(notif => {
                              const isFollowing = myFollowsMap[notif.sender_id] === "following";
                              const isPending = myFollowsMap[notif.sender_id] === "pending";
                              const followsMe = followersSet.has(notif.sender_id);
                              const isPrivate = notif.sender?.is_private;
                              const isFollowRequestPending = followRequests.some(r => r.follower_id === notif.sender_id);

                              return (
                                <div key={notif.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 0" }}>
                                  {/* Avatar */}
                                  <Link to={`/profile/${notif.sender_id}`} onClick={() => setActivePanel("none")} style={{ display: "flex", flexShrink: 0 }}>
                                    <Avatar style={{ width: 44, height: 44 }} className={`ring-1 ${isDark ? "ring-neutral-800" : "ring-neutral-200"}`}>
                                      <AvatarImage src={notif.sender?.avatar_url || ""} className="object-cover" />
                                      <AvatarFallback className="bg-neutral-800 font-bold text-white text-sm">
                                        {(notif.sender?.display_name || "U")[0]?.toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </Link>

                                  {/* Text snippet */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 14, color: isDark ? "#fff" : "#000", lineHeight: 1.4 }}>
                                      <Link to={`/profile/${notif.sender_id}`} onClick={() => setActivePanel("none")} style={{ fontWeight: 600, color: isDark ? "#fff" : "#000", marginRight: 4, textDecoration: "none" }} className="hover:underline">
                                        {notif.sender?.username || notif.sender?.display_name || "Someone"}
                                      </Link>
                                      {/* Wrap action text in a click handler to the post if applicable */}
                                      {notif.post?.id ? (
                                        <span onClick={() => handleOpenPost(notif.post?.id, notif.sender)} className="hover:opacity-80 cursor-pointer">
                                          {(notif.type === "like" || notif.type === "post_like" || notif.type === "like_post") && "liked your post."}
                                          {notif.type === "story_like" && "liked your story."}
                                          {notif.type === "comment" && "commented on your post."}
                                          {notif.type === "mention" && `mentioned you in a comment: ${notif.content || ""}`}
                                          {notif.type === "share" && "shared your post."}
                                          {notif.type === "save" && "saved your post."}
                                        </span>
                                      ) : (
                                        <span>
                                          {(notif.type === "like" || notif.type === "post_like" || notif.type === "like_post") && "liked your post."}
                                          {notif.type === "story_like" && "liked your story."}
                                          {notif.type === "comment" && "commented on your post."}
                                          {(notif.type === "follow" || notif.type === "follow_accept") && "started following you."}
                                          {notif.type === "mention" && `mentioned you in a comment: ${notif.content || ""}`}
                                          {notif.type === "share" && "shared your post."}
                                          {notif.type === "save" && "saved your post."}
                                        </span>
                                      )}
                                      <span style={{ color: "#737373", marginLeft: 6, fontSize: 14 }}>
                                        {formatNotifTime(notif.created_at)}
                                      </span>
                                    </p>
                                  </div>

                                  {/* Follow action buttons on right */}
                                  {(notif.type === "follow" || notif.type === "follow_accept") && notif.sender_id !== user?.id && (
                                    isFollowRequestPending ? (
                                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                        <button
                                          onClick={() => handleAcceptRequest(notif.sender_id)}
                                          style={{ width: 90, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#0095f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                          className="hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={() => handleRejectRequest(notif.sender_id)}
                                          style={{ width: 90, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: isDark ? "#363636" : "#f0f0f0", color: isDark ? "#fff" : "#000", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                                          className="hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleNotificationFollowToggle(notif.sender_id, isPrivate)}
                                        style={{
                                          width: 98,
                                          height: 32,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          borderRadius: 8,
                                          fontSize: 13,
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          border: "none",
                                          transition: "all 120ms ease",
                                          background: isFollowing || isPending ? (isDark ? "#363636" : "#f0f0f0") : "#0095f6",
                                          color: isFollowing || isPending ? (isDark ? "#fff" : "#000") : "#fff",
                                          flexShrink: 0
                                        }}
                                        className="hover:scale-[1.02] active:scale-[0.98]"
                                      >
                                        {isFollowing ? "Following" : isPending ? "Requested" : followsMe ? "Follow Back" : "Follow"}
                                      </button>
                                    )
                                  )}

                                  {/* Post Thumbnail on Far Right */}
                                  {notif.post?.image_url && (
                                    <div onClick={() => handleOpenPost(notif.post.id, notif.sender)} style={{ cursor: "pointer", display: "flex", flexShrink: 0, width: 44, height: 44, borderRadius: 4, overflow: "hidden", border: isDark ? "1px solid #262626" : "1px solid #dbdbdb" }}>
                                      {notif.post.image_url.toLowerCase().includes(".mp4") ? (
                                        <video src={notif.post.image_url} muted playsInline autoPlay loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      ) : (
                                        <img src={notif.post.image_url} alt="Post thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
        )}
      </div>

      {/* Overlay to close panels */}
      {activePanel !== "none" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setActivePanel("none")} />
      )}

      {/* Switch Account Modal */}
      <SwitchAccountModal 
        isOpen={isSwitchAccountOpen} 
        onClose={() => setIsSwitchAccountOpen(false)} 
      />

      {/* Report Problem Modal */}
      <ReportProblemModal 
        isOpen={isReportProblemOpen} 
        onClose={() => setIsReportProblemOpen(false)} 
      />

      {/* Post Detail Modal Overlay */}
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
    </>
  );
};

export default Sidebar;
