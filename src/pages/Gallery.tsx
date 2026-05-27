import { useState, useEffect } from "react";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FeedPostItem from "@/components/gallery/FeedPostItem";
import StoriesBar from "@/components/stories/StoriesBar";
import StoryViewer from "@/components/stories/StoryViewer";
import CreateStory from "@/components/stories/CreateStory";

const Gallery = () => {
  const { user } = useAuth();
  const [media, setMedia] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Profile Data
  const [profileData, setProfileData] = useState<any>(null);

  // Story States
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerGroups, setStoryViewerGroups] = useState<any[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [createStoryOpen, setCreateStoryOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfileData(data);
    };

    const fetchFeed = async () => {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from("posts")
        .select(`*, profiles(display_name, avatar_url, username, is_private), post_likes(user_id), post_comments(id)`)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setMedia(data);
      }
      setIsLoading(false);
    };

    const fetchSuggested = async () => {
      const { data: follows } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const followingIds = follows ? follows.map(f => f.following_id) : [];
      followingIds.push(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", `(${followingIds.map(id => `"${id}"`).join(",")})`)
        .limit(5);
      setSuggestedUsers(data || []);
    };

    fetchProfile();
    fetchFeed();
    fetchSuggested();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1000px] mx-auto flex gap-16 pt-8 px-4 md:px-4">
        
        {/* Main Feed Column */}
        <div className="flex-1 max-w-[630px] w-full mx-auto mob-feed-wrapper">
          {/* Stories Bar */}
          <div className="mb-2 bg-transparent p-0 border-none shadow-none">
            <StoriesBar
              onOpenViewer={(groups, idx) => { setStoryViewerGroups(groups); setStoryViewerIndex(idx); setStoryViewerOpen(true); }}
              onOpenCreate={() => setCreateStoryOpen(true)}
            />
          </div>

          {/* Feed Posts */}
          <div className="flex flex-col gap-6 pb-20 md:pb-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-20 w-full"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : media.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center border border-border rounded-3xl transition-all w-full">
                <div className="p-8 rounded-full bg-foreground/5 mb-6"><ImageIcon className="w-16 h-16 text-foreground/50" /></div>
                <h3 className="text-2xl font-bold tracking-tight text-foreground font-display">No posts yet</h3>
                <p className="text-sm text-muted-foreground font-medium mt-2">When you or others upload photos or videos, they will appear here.</p>
              </div>
            ) : (
              media.map((item) => (
                <FeedPostItem key={item.id} item={item} currentUser={user} />
              ))
            )}
          </div>
        </div>

      </div>

      {storyViewerOpen && (
        <StoryViewer groups={storyViewerGroups} startGroupIndex={storyViewerIndex} onClose={() => setStoryViewerOpen(false)} />
      )}
      {createStoryOpen && (
        <CreateStory onClose={() => setCreateStoryOpen(false)} onCreated={() => setCreateStoryOpen(false)} />
      )}
    </div>
  );
};

export default Gallery;
