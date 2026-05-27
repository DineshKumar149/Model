import { useState } from "react";
import { X, VolumeX, Volume2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FollowingPopupProps {
  targetUser: {
    id: string;
    display_name: string;
    username?: string;
    avatar_url?: string;
  };
  onClose: () => void;
  onUnfollow: () => void;
}

const FollowingPopup = ({ targetUser, onClose, onUnfollow }: FollowingPopupProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [muted, setMuted] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const displayName = targetUser.display_name || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleUnfollow = async () => {
    onUnfollow();
    onClose();
    toast({ title: `Unfollowed ${displayName}` });
  };

  const handleMute = () => {
    setMuted((v) => !v);
    toast({ title: muted ? `Unmuted ${displayName}` : `Muted ${displayName}` });
  };

  const handleFavorite = () => {
    setFavorited((v) => !v);
    toast({ title: favorited ? `Removed from favorites` : `Added to favorites` });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-xs animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[28px] shadow-2xl overflow-hidden">
          <div className="flex flex-col items-center pt-6 pb-4 px-5 gap-2">
            <Avatar className="w-16 h-16 ring-4 ring-white shadow-lg">
              <AvatarImage src={targetUser.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="font-bold text-base text-foreground">{displayName}</p>
            {targetUser.username && (
              <p className="text-sm text-muted-foreground">@{targetUser.username}</p>
            )}
          </div>

          <div className="px-4 pb-5 flex flex-col gap-2">
            <button
              onClick={handleMute}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-foreground border border-border/50 bg-secondary/30 hover:bg-secondary/60 transition-colors text-center"
            >
              {muted ? (
                <span className="flex items-center justify-center gap-2">
                  <Volume2 className="w-4 h-4" /> Unmute
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <VolumeX className="w-4 h-4" /> Mute
                </span>
              )}
            </button>

            <button
              onClick={handleFavorite}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-foreground border border-border/50 bg-secondary/30 hover:bg-secondary/60 transition-colors text-center"
            >
              {favorited ? "★ Remove from Favorites" : "☆ Add to Favorites"}
            </button>

            <button
              onClick={handleUnfollow}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-center"
            >
              Unfollow
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 rounded-2xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors text-center mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowingPopup;
