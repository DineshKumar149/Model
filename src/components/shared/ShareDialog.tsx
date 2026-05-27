import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export interface SharedPostData {
  type: "post" | "reel" | "story";
  post_id: string;
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  author_username: string;
  author_display_name: string;
  author_avatar: string;
  author_id: string;
  is_video: boolean;
}

interface ShareDialogProps {
  onClose: () => void;
  /** Legacy plain text sharing (falls back) */
  sharedContent?: string;
  /** New rich structured post data */
  sharedPost?: SharedPostData;
}

export default function ShareDialog({ onClose, sharedContent, sharedPost }: ShareDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, username")
        .neq("user_id", user.id)
        .limit(100);

      if (error) {
        console.error("Error fetching profiles:", error);
      } else {
        setProfiles(data || []);
      }
      setLoading(false);
    };

    fetchProfiles();
  }, [user]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedIds.size === 0 || !user) return;
    setSending(true);

    try {
      const promises = Array.from(selectedIds).map(async (recipientId) => {
        const { data: convId, error: convError } = await supabase.rpc("get_or_create_dm", {
          _other_user: recipientId,
        });

        if (convError || !convId) {
          console.error(`Error starting DM with ${recipientId}:`, convError);
          return;
        }

        if (sharedPost) {
          // Rich structured share
          await supabase.from("messages").insert({
            conversation_id: convId as string,
            user_id: user.id,
            content: JSON.stringify(sharedPost),
            media_type: "shared_post",
          });
        } else {
          // Legacy fallback
          await supabase.from("messages").insert({
            conversation_id: convId as string,
            user_id: user.id,
            content: sharedContent || "",
            media_type: "text",
          });
        }

        // Notification
        await supabase.from("notifications").insert({
          recipient_id: recipientId,
          sender_id: user.id,
          type: "chat_message",
          content: sharedPost
            ? `Shared a ${sharedPost.type}`
            : "Shared something with you",
          post_id: sharedPost ? sharedPost.post_id : undefined,
        });
      });

      await Promise.all(promises);
      toast({
        title: "Sent",
        description: `Successfully shared to ${selectedIds.size} ${
          selectedIds.size === 1 ? "user" : "users"
        }.`,
      });
      onClose();
    } catch (err) {
      console.error("Error sharing:", err);
      toast({
        title: "Error",
        description: "Something went wrong while sharing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const term = searchQuery.toLowerCase();
    const username = (p.username || "").toLowerCase();
    const displayName = (p.display_name || "").toLowerCase();
    return username.includes(term) || displayName.includes(term);
  });

  const getInitials = (profile: Profile) => {
    const name = profile.display_name || profile.username || "?";
    return name.slice(0, 2).toUpperCase();
  };


  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center select-none"
      style={{ zIndex: 999 }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#1c1c1e] border border-white/10 rounded-2xl flex flex-col text-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ maxHeight: "90vh", height: "480px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0">
          <div className="w-6" />
          <span className="font-bold text-base">Share</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/80" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2c2c2e] border-none rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-[#0095f6] transition-all"
            />
          </div>
        </div>

        {/* Profiles List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3.5 scrollbar-thin min-h-0" style={{ maxHeight: "280px" }}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center text-white/40 text-sm">
              <p className="font-semibold">No results found</p>
            </div>
          ) : (
            filteredProfiles.map((p) => {
              const isSelected = selectedIds.has(p.user_id);
              return (
                <div
                  key={p.user_id}
                  onClick={() => toggleSelect(p.user_id)}
                  className="flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-white/5">
                      <AvatarImage src={p.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback className="bg-neutral-800 text-white font-bold text-xs">
                        {getInitials(p)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">
                        {p.username || p.display_name || "User"}
                      </span>
                      <span className="text-xs text-white/50">
                        {p.display_name || p.username}
                      </span>
                    </div>
                  </div>

                  {/* Circular Checkbox */}
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-[#0095f6] border-[#0095f6] scale-105"
                        : "border-white/30 hover:border-white/50"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#1c1c1e] shrink-0">
          <button
            onClick={handleSend}
            disabled={selectedIds.size === 0 || sending}
            className="w-full bg-[#0095f6] hover:bg-[#1877f2] disabled:opacity-40 disabled:pointer-events-none text-white font-bold py-2.5 rounded-xl transition-all active:scale-98 flex items-center justify-center text-sm"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
