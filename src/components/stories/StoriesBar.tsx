import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profile?: Profile;
}

interface StoryGroup {
  user_id: string;
  profile: Profile;
  stories: Story[];
  hasViewed: boolean;
}

interface StoriesBarProps {
  onOpenViewer: (groups: StoryGroup[], startGroupIndex: number) => void;
  onOpenCreate: () => void;
}

export default function StoriesBar({ onOpenViewer, onOpenCreate }: StoriesBarProps) {
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [ownStories, setOwnStories] = useState<Story[]>([]);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll arrow states
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Mouse Drag to Scroll states
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);

  const updateArrows = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  }, []);

  const fetchStories = useCallback(async () => {
    if (!user) return;

    const now = new Date().toISOString();

    // Fetch followed user IDs
    const { data: myFollowing } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .eq("status", "following");
      
    const followingIds = (myFollowing || []).map((f) => f.following_id);
    const allowedUserIds = [user.id, ...followingIds];

    const { data: storiesData, error: storiesError } = await supabase
      .from("stories")
      .select("*")
      .in("user_id", allowedUserIds)
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    if (storiesError) {
      console.error("Error fetching stories:", storiesError);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((storiesData || []).map((s: Story) => s.user_id))];

    let profilesMap: Record<string, Profile> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, username")
        .in("user_id", userIds);

      if (profilesData) {
        profilesData.forEach((p: Profile) => {
          profilesMap[p.user_id] = p;
        });
      }
    }

    const { data: ownProfileData } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, username")
      .eq("user_id", user.id)
      .single();

    if (ownProfileData) {
      setOwnProfile(ownProfileData as Profile);
      profilesMap[user.id] = ownProfileData as Profile;
    }

    const { data: viewsData } = await supabase
      .from("story_views")
      .select("story_id")
      .eq("viewer_id", user.id);

    const viewedIds = new Set<string>((viewsData || []).map((v: { story_id: string }) => v.story_id));
    setViewedStoryIds(viewedIds);

    const stories: Story[] = (storiesData || []).map((s: Story) => ({
      ...s,
      profile: profilesMap[s.user_id],
    }));

    const myStories = stories.filter((s) => s.user_id === user.id);
    setOwnStories(myStories);

    const othersGrouped: Record<string, StoryGroup> = {};
    stories
      .filter((s) => s.user_id !== user.id)
      .forEach((s) => {
        if (!othersGrouped[s.user_id]) {
          othersGrouped[s.user_id] = {
            user_id: s.user_id,
            profile: profilesMap[s.user_id] || { user_id: s.user_id, display_name: null, avatar_url: null, username: null },
            stories: [],
            hasViewed: true,
          };
        }
        othersGrouped[s.user_id].stories.push(s);
        if (!viewedIds.has(s.id)) {
          othersGrouped[s.user_id].hasViewed = false;
        }
      });

    const sortedGroups = Object.values(othersGrouped).sort((a, b) => {
      if (!a.hasViewed && b.hasViewed) return -1;
      if (a.hasViewed && !b.hasViewed) return 1;
      return 0;
    });

    setStoryGroups(sortedGroups);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStories();

    const channel = supabase
      .channel("stories-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        () => {
          fetchStories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStories]);

  useEffect(() => {
    if (!loading) {
      setTimeout(updateArrows, 100);
    }
  }, [loading, storyGroups, updateArrows]);

  const handleOwnStoryClick = () => {
    if (ownStories.length > 0) {
      const allGroups: StoryGroup[] = [];
      allGroups.push({
        user_id: user!.id,
        profile: ownProfile || { user_id: user!.id, display_name: "You", avatar_url: null, username: "your_story" },
        stories: ownStories,
        hasViewed: true,
      });
      storyGroups.forEach((g) => allGroups.push(g));
      onOpenViewer(allGroups, 0);
    } else {
      onOpenCreate();
    }
  };

  const handleGroupClick = (group: StoryGroup) => {
    const allGroups: StoryGroup[] = [];
    if (ownStories.length > 0) {
      allGroups.push({
        user_id: user!.id,
        profile: ownProfile || { user_id: user!.id, display_name: "You", avatar_url: null, username: "your_story" },
        stories: ownStories,
        hasViewed: true,
      });
    }
    storyGroups.forEach((g) => allGroups.push(g));
    const idx = allGroups.findIndex((g) => g.user_id === group.user_id);
    onOpenViewer(allGroups, idx >= 0 ? idx : 0);
  };

  const getInitials = (profile: Profile | null): string => {
    if (!profile) return "?";
    const name = profile.display_name || profile.username || "?";
    return name.charAt(0).toUpperCase();
  };

  const truncateName = (profile: Profile | null): string => {
    if (!profile) return "User";
    const name = profile.username || profile.display_name || "User";
    return name.length > 10 ? name.slice(0, 9) + ".." : name;
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const shift = clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: direction === "left" ? -shift : shift, behavior: "smooth" });
      setTimeout(updateArrows, 300);
    }
  };

  // Drag to scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftStart(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftStart - walk;
    updateArrows();
  };

  if (loading) {
    return (
      <div className="w-full py-1.5 bg-transparent">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <Skeleton className="w-[66px] h-[66px] rounded-full bg-white/10" />
              <Skeleton className="w-12 h-2 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent relative group/bar mb-1">
      {/* Scroll Left Button */}
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-[33px] -translate-y-1/2 w-6 h-6 rounded-full bg-white text-black border border-white/20 shadow-lg flex items-center justify-center z-20 hover:scale-105 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={3} />
        </button>
      )}

      {/* Scroll Right Button */}
      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-[33px] -translate-y-1/2 w-6 h-6 rounded-full bg-white text-black border border-white/20 shadow-lg flex items-center justify-center z-20 hover:scale-105 active:scale-95 transition-transform"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={3} />
        </button>
      )}

      {/* Stories list */}
      <div
        ref={scrollRef}
        onScroll={updateArrows}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`flex gap-[18px] overflow-x-auto pb-1.5 pt-0.5 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Own story circle */}
        <div
          className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
          onClick={handleOwnStoryClick}
        >
          <div className="relative">
            {ownStories.length > 0 ? (
              <div className="p-[2.5px] rounded-full bg-gradient-to-br from-amber-500 via-red-500 to-purple-600 shadow-md">
                <div className="p-[2.5px] rounded-full bg-black">
                  <Avatar className="w-[56px] h-[56px]">
                    <AvatarImage src={ownProfile?.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold">
                      {getInitials(ownProfile)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            ) : (
              <div className="p-[2.5px] rounded-full bg-neutral-800">
                <div className="p-[2.5px] rounded-full bg-black">
                  <Avatar className="w-[56px] h-[56px]">
                    <AvatarImage src={ownProfile?.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-white font-bold">
                      {getInitials(ownProfile)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            )}
            <div className="absolute bottom-[1px] right-[1px] w-5 h-5 rounded-full bg-[#0095f6] flex items-center justify-center border-2 border-black shadow-md group-hover:scale-105 transition-transform">
              <Plus className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />
            </div>
          </div>
          <span className="text-[11px] text-white/60 font-normal tracking-wide max-w-[74px] truncate text-center">
            Your story
          </span>
        </div>

        {/* Other users' story circles */}
        {storyGroups.map((group) => {
          const allViewed = group.hasViewed;
          return (
            <div
              key={group.user_id}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
              onClick={() => handleGroupClick(group)}
            >
              <div className="relative">
                {allViewed ? (
                  <div className="p-[2.5px] rounded-full bg-neutral-800">
                    <div className="p-[2.5px] rounded-full bg-black">
                      <Avatar className="w-[56px] h-[56px] opacity-70">
                        <AvatarImage src={group.profile?.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-slate-500 to-slate-600 text-white font-bold">
                          {getInitials(group.profile)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                ) : (
                  <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 shadow-md">
                    <div className="p-[2.5px] rounded-full bg-black">
                      <Avatar className="w-[56px] h-[56px]">
                        <AvatarImage src={group.profile?.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold">
                          {getInitials(group.profile)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-white/65 font-normal tracking-wide truncate max-w-[72px] text-center">
                {truncateName(group.profile)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
