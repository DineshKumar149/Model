import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone, X, MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  userId: string;
  onClose: () => void;
  onStartChat?: (userId: string) => void;
}

const UserProfileModal = ({ userId, onClose, onStartChat }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isBlockedByTarget, setIsBlockedByTarget] = useState(false);
  const [hasBlockedTarget, setHasBlockedTarget] = useState(false);

  const checkBlockRelations = async () => {
    if (!user || userId === user.id) return;
    
    // Check if target user blocks us
    const { data: block1 } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", userId)
      .eq("blocked_id", user.id)
      .maybeSingle();
    setIsBlockedByTarget(!!block1);

    // Check if we block target user
    const { data: block2 } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", userId)
      .maybeSingle();
    setHasBlockedTarget(!!block2);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await checkBlockRelations();

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setProfile(data);
      setLoading(false);
    };
    if (userId) load();
  }, [userId, user]);

  useEffect(() => {
    if (!user || userId === user.id) return;

    const channel = supabase
      .channel(`modal-blocks-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_blocks",
        },
        () => {
          checkBlockRelations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, user]);

  const handleToggleBlock = async () => {
    if (!user || !userId) return;

    if (hasBlockedTarget) {
      // Unblock
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", userId);

      if (error) {
        toast({ title: "Failed to unblock user", variant: "destructive" });
      } else {
        setHasBlockedTarget(false);
        toast({ title: "User unblocked successfully!" });
      }
    } else {
      // Block
      const { error } = await supabase
        .from("user_blocks")
        .insert({
          blocker_id: user.id,
          blocked_id: userId
        });

      if (error) {
        toast({ title: "Failed to block user", variant: "destructive" });
      } else {
        setHasBlockedTarget(true);
        toast({ title: "User blocked successfully!" });
      }
    }
  };

  const initials = (profile?.display_name ?? "U").slice(0, 2).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal Card - Glassmorphism */}
      <div
        className="relative w-full max-w-sm z-10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/75 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden">
          
          {/* Header gradient */}
          <div className="h-24 bg-gradient-to-br from-indigo-400/60 via-purple-400/40 to-pink-400/30 relative">
            <button
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/30 backdrop-blur-sm transition-colors text-white"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 pb-6 -mt-12">
            {isBlockedByTarget ? (
              <>
                {/* Avatar fallback */}
                <div className="flex flex-col items-center">
                  <Avatar className="w-24 h-24 ring-4 ring-white shadow-xl mb-3">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-3xl font-bold">
                      ?
                    </AvatarFallback>
                  </Avatar>

                  <h2 className="text-xl font-extrabold text-foreground text-center leading-tight">
                    Profile Unavailable
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 text-center max-w-[240px]">
                    This account is private or restricts view.
                  </p>
                </div>

                {/* Toggle block action in fallback state */}
                {userId !== user?.id && (
                  <div className="mt-6 flex flex-col gap-2.5">
                    <Button
                      className={`w-full h-12 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        hasBlockedTarget
                          ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200/50"
                      }`}
                      onClick={handleToggleBlock}
                    >
                      {hasBlockedTarget ? "Unblock User" : "Block User"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Avatar */}
                <div className="flex flex-col items-center">
                  <Avatar className="w-24 h-24 ring-4 ring-white shadow-xl mb-3">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} className="object-cover" />}
                    <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-3xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <h2 className="text-xl font-extrabold text-foreground text-center leading-tight">
                    {profile?.display_name || "User"}
                  </h2>
                  
                  {profile?.email && (
                    <p className="text-sm text-muted-foreground mt-0.5 font-medium">{profile.email}</p>
                  )}
                </div>

                {/* Info Cards */}
                <div className="mt-5 space-y-2.5">
                  {profile?.email && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/50 dark:bg-white/10 rounded-2xl border border-white/40 dark:border-white/10 backdrop-blur-sm">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</span>
                        <span className="text-sm text-foreground font-semibold truncate">{profile.email}</span>
                      </div>
                    </div>
                  )}

                  {profile?.phone && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/50 dark:bg-white/10 rounded-2xl border border-white/40 dark:border-white/10 backdrop-blur-sm">
                      <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mobile</span>
                        <span className="text-sm text-foreground font-semibold">{profile.phone}</span>
                      </div>
                    </div>
                  )}

                  {!profile?.email && !profile?.phone && !loading && (
                    <div className="px-4 py-3 bg-white/30 rounded-2xl border border-white/30 text-center">
                      <span className="text-sm text-muted-foreground font-medium">No contact info added</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-col gap-2.5">
                  <Button
                    className="w-full h-12 rounded-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-200/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => { navigate(`/profile/${userId}`); onClose(); }}
                  >
                    <User className="w-4 h-4 mr-2" /> View Feed Profile
                  </Button>
                  {onStartChat && (
                    <Button
                      variant="outline"
                      className="w-full h-12 rounded-2xl font-bold border-border/60 hover:bg-secondary transition-all hover:scale-[1.02] active:scale-[0.98]"
                      onClick={() => { onStartChat(userId); onClose(); }}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" /> Send Message
                    </Button>
                  )}
                  {userId !== user?.id && (
                    <Button
                      className={`w-full h-12 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] mt-1 ${
                        hasBlockedTarget
                          ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200/50"
                      }`}
                      onClick={handleToggleBlock}
                    >
                      {hasBlockedTarget ? "Unblock User" : "Block User"}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
