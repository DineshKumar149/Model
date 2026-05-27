import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useTheme } from "@/components/shared/ThemeProvider";
import {
  ArrowLeftRight,
  Images,
  CalendarClock,
  Heart,
  MessageCircle,
  Repeat2,
  BookmarkCheck,
  Star,
  ChevronRight,
  Phone,
  Lock,
  Globe,
  Link as LinkIcon,
  FileEdit,
  SlidersHorizontal,
} from "lucide-react";

type Section = "interactions" | "photos" | "history";
type InteractionTab = "likes" | "comments" | "reposts";
type PhotoTab = "posts" | "reels" | "highlights";

export default function Activity() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [section, setSection] = useState<Section>("interactions");
  const [interactionTab, setInteractionTab] = useState<InteractionTab>("likes");
  const [photoTab, setPhotoTab] = useState<PhotoTab>("posts");

  // Data
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [myComments, setMyComments] = useState<any[]>([]);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [accountHistory, setAccountHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch liked posts
  useEffect(() => {
    if (!user || section !== "interactions" || interactionTab !== "likes") return;
    setLoading(true);
    const fetch = async () => {
      const { data } = await supabase
        .from("post_likes")
        .select("*, post:posts(id, image_url, caption, created_at, user_id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setLikedPosts((data || []).filter((d: any) => d.post));
      setLoading(false);
    };
    fetch();
  }, [user, section, interactionTab]);

  // Fetch my comments
  useEffect(() => {
    if (!user || section !== "interactions" || interactionTab !== "comments") return;
    setLoading(true);
    const fetch = async () => {
      const { data } = await supabase
        .from("post_comments")
        .select("*, post:posts(id, image_url, caption)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setMyComments((data || []).filter((d: any) => d.post));
      setLoading(false);
    };
    fetch();
  }, [user, section, interactionTab]);

  // Fetch my posts
  useEffect(() => {
    if (!user || section !== "photos") return;
    setLoading(true);
    const fetch = async () => {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setMyPosts(data || []);
      setLoading(false);
    };
    fetch();
  }, [user, section]);

  // Build account history from notifications
  useEffect(() => {
    if (!user || section !== "history") return;
    setLoading(true);
    const fetch = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*, sender:profiles!sender_id(display_name, username)")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      setAccountHistory(data || []);
      setLoading(false);
    };
    fetch();
  }, [user, section]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const wks = Math.floor(days / 7);
    if (wks > 0) return `${wks}w`;
    if (days > 0) return `${days}d`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  const groupByTime = (items: any[]) => {
    const now = new Date();
    const groups: Record<string, any[]> = {};
    items.forEach(item => {
      const d = new Date(item.created_at);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      let group = "Older";
      if (diffDays < 30) group = "This month";
      if (diffDays < 7) group = "This week";
      if (diffDays < 1) group = "Today";
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  };

  const historyIcon = (type: string) => {
    if (type === "like") return <Heart size={18} className="text-neutral-400" />;
    if (type === "comment") return <MessageCircle size={18} className="text-neutral-400" />;
    if (type === "follow") return <Globe size={18} className="text-neutral-400" />;
    if (type === "follow_accept") return <Lock size={18} className="text-neutral-400" />;
    return <FileEdit size={18} className="text-neutral-400" />;
  };

  const historyText = (n: any) => {
    if (n.type === "like") return <><span className={`font-bold ${isDark ? "text-white" : "text-black"}`}>{n.sender?.username || n.sender?.display_name || "Someone"}</span><span className={isDark ? "text-neutral-300" : "text-neutral-700"}> liked your post.</span></>;
    if (n.type === "comment") return <><span className={`font-bold ${isDark ? "text-white" : "text-black"}`}>{n.sender?.username || n.sender?.display_name || "Someone"}</span><span className={isDark ? "text-neutral-300" : "text-neutral-700"}> commented on your post.</span></>;
    if (n.type === "follow") return <><span className={`font-bold ${isDark ? "text-white" : "text-black"}`}>{n.sender?.username || n.sender?.display_name || "Someone"}</span><span className={isDark ? "text-neutral-300" : "text-neutral-700"}> started following you.</span></>;
    if (n.type === "follow_accept") return <><span className={`font-bold ${isDark ? "text-white" : "text-black"}`}>{n.sender?.username || n.sender?.display_name || "Someone"}</span><span className={isDark ? "text-neutral-300" : "text-neutral-700"}> accepted your follow request.</span></>;
    return <span className={isDark ? "text-neutral-300" : "text-neutral-700"}>{n.content || n.type}</span>;
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
      {/* LEFT PANEL */}
      <div style={{ width: 300, borderRight: isDark ? "1px solid #262626" : "1px solid #e5e5e5", flexShrink: 0, padding: "32px 0 0", display: "flex", flexDirection: "column" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, padding: "0 24px 24px", color: isDark ? "#fff" : "#000" }}>Your activity</h2>

        {/* Interactions */}
        <button
          onClick={() => setSection("interactions")}
          style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 24px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
        >
          <ArrowLeftRight size={22} color={section === "interactions" ? (isDark ? "#e0e0e0" : "#000") : "#888"} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: section === "interactions" ? "#4db3ff" : (isDark ? "#fff" : "#000"), marginBottom: 2 }}>Interactions</p>
            <p style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>Review and delete likes, comments, and your other interactions.</p>
          </div>
        </button>

        {/* Photos and videos */}
        <button
          onClick={() => setSection("photos")}
          style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 24px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
        >
          <Images size={22} color={section === "photos" ? (isDark ? "#e0e0e0" : "#000") : "#888"} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: section === "photos" ? "#4db3ff" : (isDark ? "#fff" : "#000"), marginBottom: 2 }}>Photos and videos</p>
            <p style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>View, archive or delete photos and videos you've shared.</p>
          </div>
        </button>

        {/* Account history */}
        <button
          onClick={() => setSection("history")}
          style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 24px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
        >
          <CalendarClock size={22} color={section === "history" ? (isDark ? "#e0e0e0" : "#000") : "#888"} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: section === "history" ? "#4db3ff" : (isDark ? "#fff" : "#000"), marginBottom: 2 }}>Account history</p>
            <p style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>Review changes you've made to your account since you created it.</p>
          </div>
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── INTERACTIONS ── */}
        {section === "interactions" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: isDark ? "1px solid #262626" : "1px solid #e5e5e5", padding: "0 24px" }}>
              {(["likes", "comments", "reposts"] as InteractionTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setInteractionTab(tab)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "14px 16px",
                    fontSize: 13, fontWeight: 600,
                    color: interactionTab === tab ? (isDark ? "#fff" : "#000") : (isDark ? "#737373" : "#8e8e8e"),
                    borderBottom: interactionTab === tab ? `2px solid ${isDark ? "#fff" : "#000"}` : "2px solid transparent",
                    background: "transparent", border: "none", borderBottomStyle: "solid",
                    borderBottomWidth: 2,
                    borderBottomColor: interactionTab === tab ? (isDark ? "#fff" : "#000") : "transparent",
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px"
                  }}
                >
                  {tab === "likes" && <Heart size={14} />}
                  {tab === "comments" && <MessageCircle size={14} />}
                  {tab === "reposts" && <Repeat2 size={14} />}
                  {tab}
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderBottom: isDark ? "1px solid #262626" : "1px solid #e5e5e5" }}>
              <button style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#000", background: "transparent", border: "none", cursor: "pointer" }}>Newest to oldest</button>
              <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#000", background: isDark ? "#262626" : "#f0f0f0", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                <SlidersHorizontal size={14} /> Sort &amp; filter
              </button>
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {loading ? (
                <div style={{ display: "flex", justifycontent: "center", padding: 64 }}>
                  <div style={{ width: 32, height: 32, border: "3px solid #333", borderTopColor: isDark ? "#fff" : "#000", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : (
                <>
                  {interactionTab === "likes" && (
                    likedPosts.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 64, color: "#737373" }}>
                        <Heart size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
                        <p style={{ fontSize: 15, fontWeight: 600 }}>No liked posts yet</p>
                        <p style={{ fontSize: 13, marginTop: 4 }}>Posts you like will appear here.</p>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
                        {likedPosts.map(like => (
                          <Link key={like.id} to={`/gallery`} style={{ aspectRatio: "1", display: "block", position: "relative", background: isDark ? "#1a1a1a" : "#f5f5f5" }}>
                            {like.post?.image_url ? (
                              <img src={like.post.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifycontent: "center", background: isDark ? "#262626" : "#f0f0f0" }}>
                                <Heart size={24} style={{ opacity: 0.3 }} />
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )
                  )}

                  {interactionTab === "comments" && (
                    myComments.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 64, color: "#737373" }}>
                        <MessageCircle size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
                        <p style={{ fontSize: 15, fontWeight: 600 }}>No comments yet</p>
                        <p style={{ fontSize: 13, marginTop: 4 }}>Comments you've made will appear here.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {myComments.map(c => (
                          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: isDark ? "1px solid #1a1a1a" : "1px solid #e5e5e5" }}>
                            <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: isDark ? "#262626" : "#f0f0f0", flexShrink: 0 }}>
                              {c.post?.image_url && <img src={c.post.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, color: isDark ? "#fff" : "#000", fontWeight: 500, marginBottom: 2 }}>{c.content}</p>
                              <p style={{ fontSize: 12, color: "#737373" }}>{c.post?.caption?.slice(0, 40) || "Post"}</p>
                            </div>
                            <span style={{ fontSize: 12, color: "#737373", flexShrink: 0 }}>{timeAgo(c.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {interactionTab === "reposts" && (
                    <div style={{ textAlign: "center", padding: 64, color: "#737373" }}>
                      <Repeat2 size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
                      <p style={{ fontSize: 15, fontWeight: 600 }}>No reposts yet</p>
                      <p style={{ fontSize: 13, marginTop: 4 }}>Posts you've reposted will appear here.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── PHOTOS AND VIDEOS ── */}
        {section === "photos" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: isDark ? "1px solid #262626" : "1px solid #e5e5e5", padding: "0 24px" }}>
              {(["posts", "reels", "highlights"] as PhotoTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPhotoTab(tab)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "14px 16px", fontSize: 13, fontWeight: 600,
                    color: photoTab === tab ? (isDark ? "#fff" : "#000") : (isDark ? "#737373" : "#8e8e8e"),
                    borderBottomWidth: 2, borderBottomStyle: "solid",
                    borderBottomColor: photoTab === tab ? (isDark ? "#fff" : "#000") : "transparent",
                    background: "transparent", border: "none",
                    borderBottom: photoTab === tab ? `2px solid ${isDark ? "#fff" : "#000"}` : "2px solid transparent",
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px"
                  } as React.CSSProperties}
                >
                  {tab === "posts" && <Images size={14} />}
                  {tab === "reels" && <Repeat2 size={14} />}
                  {tab === "highlights" && <BookmarkCheck size={14} />}
                  {tab}
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: isDark ? "1px solid #262626" : "1px solid #e5e5e5" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <button style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#000", background: "transparent", border: "none", cursor: "pointer" }}>Newest to oldest</button>
                <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#000", background: isDark ? "#262626" : "#f0f0f0", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                  <SlidersHorizontal size={14} /> Sort &amp; filter
                </button>
              </div>
              <button style={{ fontSize: 13, fontWeight: 600, color: "#4db3ff", background: "transparent", border: "none", cursor: "pointer" }}>Select</button>
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: 3 }}>
              {loading ? (
                <div style={{ display: "flex", justifycontent: "center", padding: 64 }}>
                  <div style={{ width: 32, height: 32, border: "3px solid #333", borderTopColor: isDark ? "#fff" : "#000", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : myPosts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 64, color: "#737373" }}>
                  <Images size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
                  <p style={{ fontSize: 15, fontWeight: 600 }}>No {photoTab} yet</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Your {photoTab} will appear here.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
                  {myPosts.map(post => (
                    <div key={post.id} style={{ aspectRatio: "1", position: "relative", background: isDark ? "#1a1a1a" : "#f5f5f5", cursor: "pointer" }}>
                      {post.image_url ? (
                        <img src={post.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifycontent: "center", background: isDark ? "#262626" : "#f0f0f0" }}>
                          <Images size={24} style={{ opacity: 0.3 }} />
                        </div>
                      )}
                      <div style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, background: "rgba(0,0,0,0.5)", border: "2px solid rgba(255,255,255,0.8)", borderRadius: 3 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ACCOUNT HISTORY ── */}
        {section === "history" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "32px 24px 16px", borderBottom: isDark ? "1px solid #262626" : "1px solid #e5e5e5", textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: isDark ? "#fff" : "#000", marginBottom: 4 }}>About account history</p>
              <p style={{ fontSize: 13, color: "#737373" }}>Review changes you've made to your account since you created it.</p>
            </div>

            {/* Filter bar */}
            <div style={{ display: "flex", gap: 12, padding: "14px 24px", borderBottom: isDark ? "1px solid #262626" : "1px solid #e5e5e5" }}>
              <button style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#000", background: "transparent", border: "none", cursor: "pointer" }}>Newest to oldest</button>
              <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: isDark ? "#fff" : "#000", background: isDark ? "#262626" : "#f0f0f0", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                <SlidersHorizontal size={14} /> Sort &amp; filter
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <div style={{ display: "flex", justifycontent: "center", padding: 64 }}>
                  <div style={{ width: 32, height: 32, border: "3px solid #333", borderTopColor: isDark ? "#fff" : "#000", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : accountHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: 64, color: "#737373" }}>
                  <CalendarClock size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
                  <p style={{ fontSize: 15, fontWeight: 600 }}>No history yet</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Account changes will appear here.</p>
                </div>
              ) : (
                Object.entries(groupByTime(accountHistory)).map(([group, items]) => (
                  <div key={group}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#fff" : "#000", padding: "16px 24px 8px", background: isDark ? "#111" : "#f9f9f9" }}>{group}</p>
                    {items.map((n: any) => (
                      <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 24px", borderBottom: isDark ? "1px solid #1a1a1a" : "1px solid #e5e5e5", cursor: "pointer" }}
                        className={`${isDark ? "hover:bg-[#111]" : "hover:bg-[#f5f5f5]"} transition-colors`}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: isDark ? "#262626" : "#f0f0f0", display: "flex", alignItems: "center", justifycontent: "center", flexShrink: 0 }}>
                          {historyIcon(n.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, lineHeight: 1.4 }}>{historyText(n)}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: "#737373" }}>{timeAgo(n.created_at)}</span>
                          <ChevronRight size={16} color="#737373" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
