import { useState } from "react";
import { Play, Wand2 } from "lucide-react";
import CESDKEditor from "@/components/editor/CESDKEditor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";

interface PostGridItemProps {
  post: any;
  onClick: () => void;
  isOwner?: boolean; // Whether current user owns this post
}

const PostGridItem = ({ post, onClick, isOwner = false }: PostGridItemProps) => {
  const { user } = useAuth();
  const [showEditor, setShowEditor] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const thumb =
    post.image_urls && post.image_urls.length > 0
      ? post.image_urls[0]
      : post.image_url;

  const mediaType: "image" | "video" =
    post.media_type === "video" ? "video" : "image";

  // Called when CE.SDK exports edited media — upload to Supabase and update post
  const handleEditorSave = async (blob: Blob, mimeType: string) => {
    if (!user || !post.id) return;
    setShowEditor(false);
    setIsUploading(true);

    try {
      const isVid = mimeType.startsWith("video/");
      const ext = isVid ? "mp4" : "png";
      const path = `${user.id}/${Date.now()}-edited.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, blob, { contentType: mimeType });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("post-images")
        .getPublicUrl(path);

      const newUrl = urlData.publicUrl;

      // Update post in database
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          image_url: newUrl,
          image_urls: isVid ? [] : [newUrl],
          media_type: isVid ? "video" : "image",
        })
        .eq("id", post.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      toast({
        title: "Post updated! ✨",
        description: "Your edited post has been saved.",
      });

      // Refresh the page to show new media
      window.location.reload();
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Render CE.SDK editor full-screen
  if (showEditor) {
    return (
      <CESDKEditor
        onSave={handleEditorSave}
        onClose={() => setShowEditor(false)}
        initialMediaUrl={thumb || undefined}
        mediaType={mediaType}
        title={mediaType === "video" ? "Edit Video Post" : "Edit Photo Post"}
      />
    );
  }

  return (
    <div
      className="relative aspect-square cursor-pointer overflow-hidden group bg-zinc-100 dark:bg-zinc-800"
      onClick={onClick}
    >
      {post.media_type === "video" ? (
        <video
          src={thumb}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          muted
          preload="metadata"
        />
      ) : (
        <img
          src={thumb}
          alt={post.alt_text || post.caption || "Post"}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all duration-300 flex items-center justify-center">
        {/* Video play icon */}
        {post.media_type === "video" && (
          <div className="absolute top-2 right-2">
            <Play className="w-5 h-5 text-white fill-white drop-shadow-lg" />
          </div>
        )}

        {/* Multiple images indicator */}
        {post.image_urls && post.image_urls.length > 1 && (
          <div className="absolute top-2 right-2">
            <div className="flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
            </div>
          </div>
        )}

        {/* Hover stats */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-4 text-white font-bold text-sm">
          <span className="flex items-center gap-1.5">
            <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {post.likes_count || 0}
          </span>
        </div>
      </div>

      {/* Edit with CE.SDK button — only for owner */}
      {isOwner && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // prevent opening PostDetailModal
            setShowEditor(true);
          }}
          disabled={isUploading}
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-bold shadow-lg z-10"
          title="Edit post with CE.SDK editor"
        >
          <Wand2 className="w-3 h-3" />
          {isUploading ? "Saving..." : "Edit"}
        </button>
      )}
    </div>
  );
};

export default PostGridItem;
