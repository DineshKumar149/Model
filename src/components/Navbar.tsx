import { useState, useEffect, useRef } from "react";
import { Menu, X, Settings as SettingsIcon, Bell, Home, Compass, MessageCircle, User, Plus, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/admin";
import { useChatUnread } from "@/hooks/use-chat-unread";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import NotificationPanel from "@/components/shared/NotificationPanel";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user?.email);
  const { total: unreadTotal } = useChatUnread();
  const [profileData, setProfileData] = useState<any>(null);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUnreadNotifs = async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setUnreadNotifsCount(count || 0);
  };

  const openNotifications = async () => {
    setIsNotifOpen(true);
    setUnreadNotifsCount(0);
    if (user) {
      await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", user.id).eq("is_read", false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, username")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfileData(data);
    };
    fetchProfile();
    fetchUnreadNotifs();

    const ch = supabase
      .channel(`navbar-notif-${user.id}-${Math.random().toString(36).substr(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` }, fetchUnreadNotifs)
      .subscribe();

    const profileCh = supabase
      .channel(`navbar-profile-${user.id}-${Math.random().toString(36).substr(2, 9)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, (payload) => {
        setProfileData(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(profileCh);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const q = `%${searchQuery.trim()}%`;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .or(`display_name.ilike.${q},username.ilike.${q}`)
        .neq("user_id", user?.id || "")
        .limit(6);
      setSearchResults(data || []);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, user?.id]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayName = profileData?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profileData?.avatar_url || user?.user_metadata?.avatar_url;
  const initials = displayName.slice(0, 2).toUpperCase();

  const navLinks = [
    { to: "/gallery", label: "Home", icon: Home },
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/chat", label: "Chat", icon: MessageCircle, badge: unreadTotal },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: SettingsIcon, badge: 0 }] : []),
  ];

  const bottomNavItems = [
    { to: "/gallery", icon: Home, label: "Home" },
    { to: "/explore", icon: Compass, label: "Explore" },
    { to: "/chat", icon: MessageCircle, label: "Chat", badge: unreadTotal },
    { action: "notif", icon: Bell, label: "Activity", badge: unreadNotifsCount },
    { to: "/profile", icon: User, label: "Profile" },
  ];

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <>
      <nav className="sticky top-0 z-50 glass-nav px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link to="/gallery" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <span className="text-white font-black text-sm">A</span>
            </div>
            <span className="text-lg font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent hidden sm:block">
              Atome
            </span>
          </Link>

          <div className="hidden md:flex flex-1 max-w-sm mx-4 relative" ref={searchRef}>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                placeholder="Search people..."
                className="w-full h-9 pl-9 pr-4 rounded-2xl bg-secondary/60 border border-border/40 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-all"
              />
            </div>
            {showSearch && searchQuery.trim() && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/50 rounded-2xl shadow-xl z-50 overflow-hidden animate-slide-down">
                {searchResults.map((profile) => {
                  const name = profile.display_name || "User";
                  return (
                    <button
                      key={profile.user_id}
                      onClick={() => { navigate(`/profile/${profile.user_id}`); setShowSearch(false); setSearchQuery(""); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold text-xs">
                          {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{name}</p>
                        {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={() => { navigate(`/explore?q=${encodeURIComponent(searchQuery)}`); setShowSearch(false); setSearchQuery(""); }}
                  className="w-full px-4 py-2.5 text-xs font-bold text-primary hover:bg-accent/50 transition-colors text-left border-t border-border/40"
                >
                  See all results for &ldquo;{searchQuery}&rdquo; →
                </button>
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    active ? "nav-link-active bg-primary/8 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:block">{link.label}</span>
                  {(link.badge || 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-background">
                      {(link.badge || 0) > 9 ? "9+" : link.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {user && (
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border/40">
                <button
                  onClick={openNotifications}
                  className={`relative p-2 rounded-xl transition-colors ${isNotifOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unreadNotifsCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-1 ring-background animate-pulse">
                      {unreadNotifsCount > 9 ? "9+" : unreadNotifsCount}
                    </span>
                  )}
                </button>
                <Link
                  to="/settings"
                  className={`p-2 rounded-xl transition-colors ${isActive("/settings") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
                >
                  <SettingsIcon className="w-4.5 h-4.5" />
                </Link>
                <Link to="/profile" className="flex items-center gap-2 ml-1 px-2 py-1.5 rounded-xl hover:bg-secondary/60 transition-colors">
                  <Avatar className="w-7 h-7 ring-2 ring-primary/20">
                    {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-black">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold text-foreground max-w-[90px] truncate hidden lg:block">{displayName}</span>
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button onClick={() => navigate("/explore")} className="p-2 rounded-xl text-muted-foreground hover:bg-secondary">
              <Search className="w-5 h-5" />
            </button>
            {user && (
              <button onClick={openNotifications} className="relative p-2 rounded-xl text-muted-foreground hover:bg-secondary">
                <Bell className="w-5 h-5" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-1 ring-background animate-pulse">
                    {unreadNotifsCount > 9 ? "9+" : unreadNotifsCount}
                  </span>
                )}
              </button>
            )}
            <button onClick={() => setOpen(!open)} className="p-2 rounded-xl text-foreground hover:bg-secondary">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden mt-2 flex flex-col gap-1 pb-3 border-t border-border/30 pt-3 animate-slide-down">
            {user && (
              <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors">
                <Avatar className="w-9 h-9 ring-2 ring-primary/20">
                  {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-black">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-foreground">{displayName}</p>
                  {profileData?.username && <p className="text-xs text-muted-foreground">@{profileData.username}</p>}
                </div>
              </Link>
            )}
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isActive(link.to) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <span className="flex items-center gap-2.5"><Icon className="w-4.5 h-4.5" />{link.label}</span>
                  {(link.badge || 0) > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white px-1">
                      {(link.badge || 0) > 9 ? "9+" : link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
              <SettingsIcon className="w-4.5 h-4.5" /> Settings
            </Link>
          </div>
        )}
      </nav>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bottom-nav md:hidden px-2 py-1">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {bottomNavItems.map((item, idx) => {
            const Icon = item.icon;
            const active = item.to ? isActive(item.to) : false;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (item.action === "notif") { openNotifications(); }
                  else if (item.to) navigate(item.to);
                }}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all duration-200 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${active ? "bg-primary/12" : ""}`}>
                  <Icon className={`w-5.5 h-5.5 transition-all ${active ? "scale-110" : ""}`} />
                  {(item.badge || 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white px-0.5 ring-1 ring-background">
                      {(item.badge || 0) > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-bold tracking-wide ${active ? "text-primary" : ""}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <NotificationPanel isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </>
  );
};

export default Navbar;
