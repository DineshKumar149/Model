import { useState, useEffect } from "react";
import { X, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectConv: (id: string) => void;
}

export default function NewMessageModal({ open, onClose, onSelectConv }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserProfile[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setSelected([]);
    setSearch("");
    supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .neq("user_id", user.id)
      .then(({ data }) => setUsers(data ?? []));
  }, [open, user?.id]);

  if (!open) return null;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.display_name ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q)
    );
  });

  const isSelected = (uid: string) => selected.some((s) => s.user_id === uid);

  const toggleUser = (u: UserProfile) => {
    setSelected((prev) =>
      prev.some((s) => s.user_id === u.user_id)
        ? prev.filter((s) => s.user_id !== u.user_id)
        : [...prev, u]
    );
  };

  const removeChip = (uid: string) => {
    setSelected((prev) => prev.filter((s) => s.user_id !== uid));
  };

  const handleChat = async () => {
    if (!user || selected.length === 0) return;
    setCreating(true);
    try {
      if (selected.length === 1) {
        const { data, error } = await supabase.rpc("get_or_create_dm", {
          _other_user: selected[0].user_id,
        });
        if (error) throw error;
        onSelectConv(data as string);
      } else {
        const autoName = selected
          .map((u) => u.username || u.display_name || "User")
          .join(", ");
        const { data: conv, error } = await supabase
          .from("conversations")
          .insert({ type: "group", name: autoName, created_by: user.id })
          .select("id")
          .single();
        if (error || !conv) throw error ?? new Error("Failed to create group");
        const rows = [user.id, ...selected.map((u) => u.user_id)].map((uid) => ({
          conversation_id: conv.id,
          user_id: uid,
        }));
        await supabase.from("conversation_participants").insert(rows);
        toast({ title: `Group '${autoName}' created` });
        onSelectConv(conv.id);
      }
      onClose();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-[448px] mx-4 bg-[#262626] rounded-[16px] overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: "min(560px, 90vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <span className="text-white font-bold text-[15px]">New message</span>
          <div className="w-8" />
        </div>

        {/* To: field with chips */}
        <div className="flex items-start gap-2 px-4 py-3 border-b border-white/10 flex-wrap min-h-[52px]">
          <span className="text-white/60 text-[13px] font-medium mt-1 shrink-0">To:</span>
          <div className="flex flex-wrap gap-1.5 flex-1">
            {selected.map((u) => (
              <div
                key={u.user_id}
                className="flex items-center gap-1 bg-[#3d5af1]/20 text-[#4f6ef7] text-[12px] font-medium rounded-full px-2.5 py-1 border border-[#4f6ef7]/30"
              >
                <span>{u.username || u.display_name || "User"}</span>
                <button
                  onClick={() => removeChip(u.user_id)}
                  className="ml-0.5 text-[#4f6ef7]/70 hover:text-[#4f6ef7] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <input
              type="text"
              placeholder={selected.length === 0 ? "Search..." : ""}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-white text-[13px] outline-none placeholder-white/30 flex-1 min-w-[80px]"
              autoFocus
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <Search className="w-8 h-8 mb-2" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            filtered.map((u) => {
              const sel = isSelected(u.user_id);
              return (
                <button
                  key={u.user_id}
                  onClick={() => toggleUser(u)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <Avatar className="w-11 h-11 shrink-0">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                    <AvatarFallback className="bg-neutral-700 text-white font-bold text-sm">
                      {(u.display_name ?? u.username ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-white font-semibold text-[14px] truncate">
                      {u.display_name || u.username || "User"}
                    </div>
                    {u.username && (
                      <div className="text-white/50 text-[12px] truncate">{u.username}</div>
                    )}
                  </div>
                  {/* Circle checkbox */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      sel
                        ? "bg-[#4f6ef7] border-[#4f6ef7]"
                        : "border-white/40 bg-transparent"
                    }`}
                  >
                    {sel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Chat button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleChat}
            disabled={selected.length === 0 || creating}
            className="w-full py-3 rounded-xl text-white font-bold text-[15px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                selected.length > 0
                  ? "linear-gradient(135deg, #4f6ef7, #6b47f5)"
                  : "rgba(79,110,247,0.3)",
            }}
          >
            {creating ? "Creating..." : "Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
