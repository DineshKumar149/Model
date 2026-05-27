import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface RequestConv {
  id: string;
  other: { user_id: string; display_name: string | null; avatar_url: string | null } | null;
  lastMessage: string | null;
  lastAt: string | null;
}

interface Props {
  onClose: () => void;
  onAccept: (convId: string) => void;
}

export default function MessageRequestsPanel({ onClose, onAccept }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RequestConv[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get conversations marked as requests (is_request = true or non-followers)
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      const ids = (parts ?? []).map((p) => p.conversation_id);
      if (!ids.length) { setRequests([]); setLoading(false); return; }

      const { data: cs } = await supabase
        .from("conversations")
        .select("id, type, is_request")
        .in("id", ids)
        .eq("type", "dm")
        .eq("is_request", true);

      if (!cs?.length) { setRequests([]); setLoading(false); return; }

      const convIds = cs.map((c) => c.id);
      const { data: dmParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds)
        .neq("user_id", user.id);

      const otherIds = [...new Set((dmParts ?? []).map((p) => p.user_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p]));

      const dmOthers: Record<string, any> = {};
      (dmParts ?? []).forEach((p) => { dmOthers[p.conversation_id] = profMap[p.user_id]; });

      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("conversation_id, content, media_type, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });

      const lastMap: Record<string, any> = {};
      (lastMsgs ?? []).forEach((m) => { if (!lastMap[m.conversation_id]) lastMap[m.conversation_id] = m; });

      setRequests(cs.map((c) => ({
        id: c.id,
        other: dmOthers[c.id] ?? null,
        lastMessage: lastMap[c.id]?.media_type === "text" ? lastMap[c.id]?.content : lastMap[c.id]?.media_type ? `📎 ${lastMap[c.id].media_type}` : null,
        lastAt: lastMap[c.id]?.created_at ?? null,
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, [user?.id]);

  const handleAccept = async (conv: RequestConv) => {
    await supabase.from("conversations").update({ is_request: false }).eq("id", conv.id);
    toast({ title: "Request accepted" });
    loadRequests();
    onAccept(conv.id);
  };

  const handleIgnore = async (conv: RequestConv) => {
    await supabase.from("conversation_participants").delete().eq("conversation_id", conv.id).eq("user_id", user!.id);
    toast({ title: "Request ignored" });
    loadRequests();
  };

  const handleDeleteAll = async () => {
    for (const r of requests) {
      await supabase.from("conversation_participants").delete().eq("conversation_id", r.id).eq("user_id", user!.id);
    }
    toast({ title: "All requests deleted" });
    setRequests([]);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-border/40">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="text-foreground font-bold text-[17px]">Message requests</span>
      </div>

      {/* Hidden Requests row */}
      <button className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/40 transition-colors border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center">
            <UserX className="w-5 h-5 text-muted-foreground" />
          </div>
          <span className="font-semibold text-[14px] text-foreground">Hidden Requests</span>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Info text */}
      {requests.length > 0 && (
        <p className="px-4 py-3 text-[13px] text-primary font-medium">
          Chats will appear here after you send or receive a message.
        </p>
      )}

      {/* Request list or empty state */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center mb-5">
              <UserX className="w-8 h-8 text-muted-foreground/60" />
            </div>
            <h3 className="font-bold text-[17px] text-foreground mb-2">Message requests</h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[280px]">
              These messages are from people you've restricted or don't follow. They won't know you viewed their request until you allow them to message you.
            </p>
          </div>
        ) : (
          <div className="py-2">
            {requests.map((r) => (
              <div key={r.id} className="px-4 py-3 border-b border-border/20">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="w-12 h-12">
                    {r.other?.avatar_url && <AvatarImage src={r.other.avatar_url} />}
                    <AvatarFallback className="bg-secondary text-foreground font-bold">
                      {(r.other?.display_name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] text-foreground">{r.other?.display_name ?? "User"}</div>
                    {r.lastMessage && (
                      <div className="text-[12px] text-muted-foreground truncate mt-0.5">{r.lastMessage}</div>
                    )}
                  </div>
                  {r.lastAt && (
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(r.lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(r)}
                    className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold hover:bg-primary/90 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleIgnore(r)}
                    className="flex-1 py-2 rounded-xl bg-secondary text-foreground text-[13px] font-bold hover:bg-secondary/70 transition-colors"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete all */}
      <div className="p-4 border-t border-border/30">
        <button
          onClick={handleDeleteAll}
          className="text-red-500 text-[13px] font-semibold hover:text-red-400 transition-colors"
        >
          Delete all {requests.length}
        </button>
      </div>
    </div>
  );
}
