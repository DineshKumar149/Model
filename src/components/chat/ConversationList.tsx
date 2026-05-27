import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ChevronDown, Edit } from "lucide-react";
import { isAdminUser } from "@/lib/admin";
import { useChatUnread } from "@/hooks/use-chat-unread";
import UserProfileModal from "@/components/shared/UserProfileModal";
import NewMessageModal from "./NewMessageModal";
import MessageRequestsPanel from "./MessageRequestsPanel";

interface ConvRow {
  id: string;
  type: "group" | "dm";
  name: string | null;
  avatar_url?: string | null;
  other?: { user_id: string; display_name: string | null; avatar_url: string | null } | null;
  lastMessage?: string | null;
  lastAt?: string | null;
}

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
}

const ConversationList = ({ activeId, onSelect }: Props) => {
  const { user } = useAuth();
  const { unread } = useChatUnread();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);
    const ids = (parts ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) { setConvs([]); return; }

    const { data: cs } = await supabase
      .from("conversations")
      .select("id, type, name, avatar_url, is_request")
      .in("id", ids);

    // Only show non-request conversations in main list
    const visibleCs = (cs ?? []).filter((c: any) => !c.is_request);

    const dmIds = visibleCs.filter((c) => c.type === "dm").map((c) => c.id);
    let dmOthers: Record<string, any> = {};
    if (dmIds.length) {
      const { data: dmParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", dmIds)
        .neq("user_id", user.id);
      const otherIds = [...new Set((dmParts ?? []).map((p) => p.user_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, username")
        .in("user_id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p]));
      (dmParts ?? []).forEach((p) => { dmOthers[p.conversation_id] = profMap[p.user_id]; });
    }

    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("conversation_id, content, media_type, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });
    const lastMap: Record<string, any> = {};
    (lastMsgs ?? []).forEach((m) => {
      if (!lastMap[m.conversation_id]) lastMap[m.conversation_id] = m;
    });

    const rows: ConvRow[] = visibleCs.map((c: any) => ({
      id: c.id,
      type: c.type as "group" | "dm",
      name: c.name,
      avatar_url: c.avatar_url,
      other: c.type === "dm" ? dmOthers[c.id] ?? null : null,
      lastMessage:
        lastMap[c.id]?.media_type === "text"
          ? lastMap[c.id]?.content
          : lastMap[c.id]?.media_type
          ? `📎 ${lastMap[c.id].media_type}`
          : null,
      lastAt: lastMap[c.id]?.created_at ?? null,
    }));
    rows.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    setConvs(rows);
  };

  // Real presence tracking
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("global-presence", {
      config: { presence: { key: user.id } },
    });
    ch
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<{ user_id: string }>();
        const ids = new Set(Object.keys(state));
        setOnlineUsers(ids);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        setOnlineUsers((prev) => new Set([...prev, key]));
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });
    presenceChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // If requests panel is open, show it instead
  if (requestsOpen) {
    return (
      <MessageRequestsPanel
        onClose={() => setRequestsOpen(false)}
        onAccept={(convId) => {
          setRequestsOpen(false);
          onSelect(convId);
        }}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col h-full bg-background border-r border-border/50">
        {/* Header */}
        <div className="flex flex-col pt-6 pb-2 px-5 border-b border-border/50">
          <div className="flex items-center justify-between mb-6">
            <button className="flex items-center gap-2 text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
              {user?.user_metadata?.username || user?.email?.split("@")[0] || "Messages"}
              <ChevronDown className="w-5 h-5 mt-1 text-muted-foreground" />
            </button>
            <button
              onClick={() => setNewMsgOpen(true)}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
              aria-label="New message"
            >
              <Edit className="w-[22px] h-[22px] text-foreground" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 mb-1 px-1">
            <span className="font-bold text-[15px] text-foreground">Messages</span>
            <button
              onClick={() => setRequestsOpen(true)}
              className="font-bold text-[14px] text-primary hover:text-primary/80 transition-colors"
            >
              Requests
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {convs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Edit className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">No messages yet</p>
              <p className="text-[13px] text-muted-foreground">
                Tap the compose icon to start a conversation
              </p>
            </div>
          ) : (
            convs.map((c) => {
              const title =
                c.type === "group"
                  ? c.name ?? "Group"
                  : c.other?.display_name ?? c.other?.username ?? "Direct Message";
              const isActive = c.id === activeId;
              const isOnline =
                c.type === "dm" && c.other?.user_id
                  ? onlineUsers.has(c.other.user_id)
                  : false;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`w-full flex items-center gap-4 py-3 px-5 hover:bg-secondary/40 text-left transition-colors ${
                    isActive ? "bg-secondary/40" : ""
                  }`}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12 border border-border/50">
                      {c.type === "group" ? (
                        <>
                          {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                          <AvatarFallback className="bg-secondary text-primary font-bold">
                            <Users className="w-5 h-5" />
                          </AvatarFallback>
                        </>
                      ) : (
                        <>
                          {c.other?.avatar_url && <AvatarImage src={c.other.avatar_url} />}
                          <AvatarFallback className="bg-secondary text-primary font-bold">
                            {(c.other?.display_name ?? "?").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="font-bold text-[15px] truncate">{title}</div>
                      <div className="text-[11px] text-muted-foreground font-medium whitespace-nowrap ml-2">
                        {c.lastAt
                          ? new Date(c.lastAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-[13px] text-muted-foreground truncate w-[160px] font-medium">
                        {c.lastMessage ?? "No messages yet"}
                      </div>
                      {(unread[c.id] ?? 0) > 0 && !isActive && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                          {unread[c.id] > 99 ? "99+" : unread[c.id]}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* New Message Modal */}
      <NewMessageModal
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        onSelectConv={(id) => {
          setNewMsgOpen(false);
          onSelect(id);
          load();
        }}
      />

      {/* Profile Modal */}
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </>
  );
};

export default ConversationList;
