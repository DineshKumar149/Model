import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, Heart, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import PostDetailModal from "@/components/profile/PostDetailModal";

interface Profile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Post {
  id: string;
  user_id: string;
  image_url: string | null;
  image_urls: string[] | null;
  caption: string | null;
  likes_count: number;
  media_type: string | null;
  created_at: string;
}

interface PostWithAuthor extends Post {
  authorProfile: Profile | null;
}

const Explore = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PostWithAuthor | null>(null);

  const getThumb = (post: Post) => {
    if (post.image_urls && post.image_urls.length > 0) return post.image_urls[0];
    return post.image_url || "";
  };

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const fetchExplorePosts = useCallback(async () => {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from("posts")
        .select("*")
        .order("likes_count", { ascending: false })
        .limit(45);

      if (debouncedQuery) {
        queryBuilder = queryBuilder.ilike("caption", `%${debouncedQuery}%`);
      }

      const { data: postsData, error } = await queryBuilder;
      if (error) throw error;
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const authorIds = Array.from(new Set(postsData.map((p) => p.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", authorIds);
      
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p as Profile]));

      setPosts(
        postsData.map((post) => ({
          ...(post as Post),
          authorProfile: profileMap.get(post.user_id) || null,
        }))
      );
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    fetchExplorePosts();
  }, [fetchExplorePosts]);

  const clearSearch = () => {
    setQuery("");
    setDebouncedQuery("");
  };

  const renderGrid = () => {
    // We want to create a mosaic layout where some videos span 2 rows.
    // CSS Grid can handle this nicely with auto-rows.
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 auto-rows-[minmax(0,_1fr)]" style={{ gridAutoRows: 'minmax(200px, 300px)' }}>
        {posts.map((post, i) => {
          // Dynamic row span for variety
          const isVideo = post.media_type === "video";
          const spanTwoRows = (i % 7 === 0) || (isVideo && i % 3 === 0);
          const thumb = getThumb(post);

          return (
            <div
              key={post.id}
              className={`relative cursor-pointer overflow-hidden group bg-background border border-border rounded-2xl transition-all duration-500 bw-hover-gradient ${
                spanTwoRows ? "row-span-2" : "row-span-1"
              }`}
              onClick={() => setSelectedPost(post)}
            >
              {isVideo ? (
                <video
                  src={thumb}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <img
                  src={thumb}
                  alt="Explore post"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}

              {/* Video Icon Top Right */}
              {isVideo && (
                <div className="absolute top-2 right-2">
                  <Play className="w-5 h-5 text-white fill-white drop-shadow-md" />
                </div>
              )}

              {/* Multiple Images Icon Top Right */}
              {!isVideo && post.image_urls && post.image_urls.length > 1 && (
                <div className="absolute top-2 right-2 flex gap-[2px]">
                  <div className="w-[14px] h-[14px] border-[1.5px] border-white rounded-[2px] opacity-90 shadow-sm relative">
                    <div className="absolute -top-1 -right-1 w-full h-full border-[1.5px] border-white rounded-[2px] opacity-70" />
                  </div>
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="flex items-center gap-2 text-white font-bold text-[15px]">
                  <Heart className="w-5 h-5 fill-white" />
                  {post.likes_count || 0}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 w-full min-h-screen bg-background">
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          authorProfile={selectedPost.authorProfile}
          onClose={() => setSelectedPost(null)}
        />
      )}

      <div className="max-w-[935px] mx-auto pt-6 pb-20">
        {/* Search Bar */}
        <div className="px-4 mb-6">
          <div className="relative flex items-center bg-background border border-border rounded-xl">
            <Search className="absolute left-4 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-10 pl-10 pr-10 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/80"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 w-4 h-4 flex items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
              >
                <X className="w-2.5 h-2.5 text-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="px-1 md:px-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-none" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center text-muted-foreground">
              <p>No results found</p>
            </div>
          ) : (
            renderGrid()
          )}
        </div>
      </div>
    </div>
  );
};

export default Explore;
