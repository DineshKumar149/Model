import { useState, useRef } from "react";
import {
  X,
  Image as ImageIcon,
  Loader2,
  Video,
  ChevronDown,
  ChevronUp,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Music2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import FilerobotEditor from "@/components/editor/FilerobotEditor";
import CreateStory from "@/components/stories/CreateStory";
import MusicPicker from "@/components/shared/MusicPicker";
import { Track } from "@/lib/music";

interface GlobalCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalCreateModal = ({ isOpen, onClose }: GlobalCreateModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"select" | "post" | "story">("select");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // Post Creation States
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [editedMimeType, setEditedMimeType] = useState<string>("image/png");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [caption, setCaption] = useState("");
  const [hideLikes, setHideLikes] = useState(false);
  const [turnOffCommenting, setTurnOffCommenting] = useState(false);
  const [altText, setAltText] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [selectedMusic, setSelectedMusic] = useState<Track | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const primaryFile = editedBlob
    ? new File([editedBlob], "edited", { type: editedMimeType })
    : selectedFiles[0] || null;

  const hasContent = mode === "post" && (selectedFiles.length > 0 || editedBlob !== null);
  const isVideo = (primaryFile?.type || editedMimeType || "").startsWith("video/");
  const isMultipleImages = !isVideo && selectedFiles.length > 1 && !editedBlob;
  const primaryPreviewUrl = previewUrls[0] || null;

  const handleOutsideClick = () => {
    if (hasContent) {
      setShowDiscardConfirm(true);
    } else {
      handleClose();
    }
  };

  const revokeAllUrls = (urls: string[]) => {
    urls.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch { /* ignore */ }
    });
  };

  const handleClose = () => {
    setShowDiscardConfirm(false);
    setMode("select");
    setSelectedFiles([]);
    setEditedBlob(null);
    revokeAllUrls(previewUrls);
    setPreviewUrls([]);
    setCurrentSlide(0);
    setCaption("");
    setHideLikes(false);
    setTurnOffCommenting(false);
    setAltText("");
    setMusicTitle("");
    setSelectedMusic(null);
    setShowAdvanced(false);
    setShowEditor(false);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const arr = Array.from(files);
    setSelectedFiles(arr);
    setEditedBlob(null);
    setCurrentSlide(0);

    revokeAllUrls(previewUrls);
    const urls = arr.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);

    // Only auto-open editor for single file
    if (arr.length === 1) {
      setShowEditor(true);
    }
  };

  const handleEditorSave = (blob: Blob, mimeType: string, selectedMusicTitle?: string) => {
    setEditedBlob(blob);
    setEditedMimeType(mimeType);
    if (selectedMusicTitle) {
      setMusicTitle(selectedMusicTitle);
    }

    revokeAllUrls(previewUrls);
    const newUrl = URL.createObjectURL(blob);
    setPreviewUrls([newUrl]);
    setCurrentSlide(0);

    setShowEditor(false);
    toast({ title: "Edit applied ✨", description: "Your media is ready to share." });
  };

  const uploadFileToStorage = async (
    file: File | Blob,
    originalName: string,
    mimeType: string
  ) => {
    if (!user) throw new Error("Not signed in");

    const isVid = mimeType.startsWith("video/");
    const ext = isVid ? "mp4" : originalName.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("post-images").upload(path, file, {
      contentType: mimeType,
    });

    if (error) throw error;
    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSharePost = async () => {
    if (!user) return;
    if (!editedBlob && selectedFiles.length === 0) return;

    setUploading(true);
    try {
      if (editedBlob) {
        // Single edited file
        const mimeType = editedMimeType;
        const fileName = selectedFiles[0]?.name || "post-media";
        const isVid = mimeType.startsWith("video/");
        const url = await uploadFileToStorage(editedBlob, fileName, mimeType);

        await supabase.from("posts").insert({
          user_id: user.id,
          image_url: url,
          image_urls: isVid ? [] : [url],
          caption: caption.trim() || null,
          media_type: isVid ? "video" : "image",
          hide_likes: hideLikes,
          turn_off_commenting: turnOffCommenting,
          alt_text: altText.trim() || null,
          music_title: musicTitle.trim() || null,
          music_url: selectedMusic?.id || null,
        });
      } else if (selectedFiles.length === 1) {
        // Single unedited file
        const file = selectedFiles[0];
        const isVid = file.type.startsWith("video/");
        const url = await uploadFileToStorage(file, file.name, file.type);

        await supabase.from("posts").insert({
          user_id: user.id,
          image_url: url,
          image_urls: isVid ? [] : [url],
          caption: caption.trim() || null,
          media_type: isVid ? "video" : "image",
          hide_likes: hideLikes,
          turn_off_commenting: turnOffCommenting,
          alt_text: altText.trim() || null,
          music_title: musicTitle.trim() || null,
          music_url: selectedMusic?.id || null,
        });
      } else {
        // Multiple files — upload all as carousel post
        const urls: string[] = [];
        for (const file of selectedFiles) {
          const url = await uploadFileToStorage(file, file.name, file.type);
          urls.push(url);
        }

        await supabase.from("posts").insert({
          user_id: user.id,
          image_url: urls[0],
          image_urls: urls,
          caption: caption.trim() || null,
          media_type: "image",
          hide_likes: hideLikes,
          turn_off_commenting: turnOffCommenting,
          alt_text: altText.trim() || null,
          music_title: musicTitle.trim() || null,
          music_url: selectedMusic?.id || null,
        });
      }

      toast({ title: "Post shared successfully! 🎉" });
      handleClose();
    } catch (error: any) {
      toast({
        title: "Failed to share post",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // If showing Filerobot editor, render it full-screen
  if (showEditor && (selectedFiles.length > 0 || editedBlob)) {
    return (
      <FilerobotEditor
        initialMediaUrl={previewUrls[0]}
        onClose={() => setShowEditor(false)}
        onSave={handleEditorSave}
        title="Image Editor"
      />
    );
  }

  // If in Story mode, render the story creation modal
  if (mode === "story") {
    return <CreateStory onClose={handleClose} onCreated={handleClose} />;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleOutsideClick}
      >
        <div
          className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border/50 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <div className="w-8" />
            <h2 className="text-base font-bold text-foreground">
              {mode === "select" ? "Create new" : "Create new post"}
            </h2>
            <button
              onClick={handleOutsideClick}
              className="w-8 h-8 flex items-center justify-center hover:bg-secondary rounded-full transition-colors text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {mode === "select" ? (
            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border/50 h-[300px]">
              <button
                onClick={() => setMode("post")}
                className="flex-1 flex flex-col items-center justify-center gap-4 hover:bg-secondary/30 transition-colors group"
              >
                <div className="w-16 h-16 rounded-full border-2 border-foreground flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-8 h-8 text-foreground" />
                </div>
                <span className="font-bold text-foreground text-lg">Post</span>
              </button>
              <button
                onClick={() => setMode("story")}
                className="flex-1 flex flex-col items-center justify-center gap-4 hover:bg-secondary/30 transition-colors group"
              >
                <div className="w-16 h-16 rounded-full border-2 border-foreground flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Video className="w-8 h-8 text-foreground" />
                </div>
                <span className="font-bold text-foreground text-lg">Story</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col min-h-[400px]">
              {selectedFiles.length === 0 && !editedBlob ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                  <ImageIcon className="w-24 h-24 text-muted-foreground/50" />
                  <h3 className="text-xl font-medium text-foreground">
                    Drag photos and videos here
                  </h3>
                  <p className="text-sm text-muted-foreground -mt-2">
                    Select multiple photos to create a carousel post
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg px-6"
                  >
                    Select from computer
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileSelect}
                  />
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row h-full max-h-[520px]">
                  {/* Media preview — Carousel or Single */}
                  <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden aspect-square sm:aspect-auto">
                    {isMultipleImages ? (
                      /* Carousel for multiple images */
                      <>
                        <div className="w-full h-full relative">
                          <img
                            src={previewUrls[currentSlide]}
                            alt={`Preview ${currentSlide + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {/* Slide counter */}
                          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                            {currentSlide + 1}/{previewUrls.length}
                          </div>
                          {/* Dot indicators */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {previewUrls.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentSlide ? "bg-white scale-125" : "bg-white/50"}`}
                              />
                            ))}
                          </div>
                          {/* Left arrow */}
                          {currentSlide > 0 && (
                            <button
                              onClick={() => setCurrentSlide((s) => s - 1)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-10"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                          )}
                          {/* Right arrow */}
                          {currentSlide < previewUrls.length - 1 && (
                            <button
                              onClick={() => setCurrentSlide((s) => s + 1)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all z-10"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </>
                    ) : primaryPreviewUrl ? (
                      <>
                        {isVideo ? (
                          <video
                            src={primaryPreviewUrl}
                            controls
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={primaryPreviewUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Edit button — only for single image file */}
                        {(!selectedFiles[0]?.type.startsWith("video/")) && (
                          <button
                            onClick={() => setShowEditor(true)}
                            disabled={uploading}
                            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-xl transition-all z-10"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            Edit Image
                          </button>
                        )}

                        {/* Edited badge */}
                        {editedBlob && (
                          <div className="absolute top-2 left-2 z-10">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-600/90 text-white">
                              ✨ Edited
                            </span>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>

                  {/* Caption & settings sidebar */}
                  <div className="w-full sm:w-[340px] border-l border-border/50 flex flex-col bg-card overflow-y-auto scrollbar-thin max-h-[520px]">
                    <div className="p-4 border-b border-border/50 shrink-0">
                      <textarea
                        placeholder="Write a caption..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full h-24 resize-none bg-transparent border-none focus:ring-0 p-0 text-sm placeholder:text-muted-foreground text-foreground outline-none"
                      />
                    </div>

                    {/* Music title input */}
                    <div className="p-4 border-b border-border/50 shrink-0">
                      <MusicPicker 
                        selected={selectedMusic} 
                        onSelect={(t) => {
                          setSelectedMusic(t);
                          setMusicTitle(t ? `${t.title} - ${t.artist}` : "");
                        }} 
                      />
                      {musicTitle && (
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Music2 className="w-3 h-3 text-primary" />
                          Music will be played on your post
                        </p>
                      )}
                    </div>

                    <div className="border-t border-border/50">
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full p-4 flex items-center justify-between text-sm font-semibold hover:bg-secondary/30 transition-colors text-foreground"
                      >
                        Advanced settings
                        {showAdvanced ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      {showAdvanced && (
                        <div className="p-4 pt-0 space-y-5 bg-secondary/10">
                          {/* Hide Likes */}
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col max-w-[80%]">
                              <span className="text-sm font-semibold text-foreground">
                                Hide like and view counts
                              </span>
                              <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                Only you will see the total number of likes and views on this post. Others won't see like counts.
                              </span>
                            </div>
                            <Switch
                              checked={hideLikes}
                              onCheckedChange={setHideLikes}
                            />
                          </div>
                          {/* Turn Off Commenting */}
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col max-w-[80%]">
                              <span className="text-sm font-semibold text-foreground">
                                Turn off commenting
                              </span>
                              <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                You can change this later by going to the ··· menu at the top of your post.
                              </span>
                            </div>
                            <Switch
                              checked={turnOffCommenting}
                              onCheckedChange={setTurnOffCommenting}
                            />
                          </div>
                          {/* Alt Text */}
                          <div className="space-y-2">
                            <span className="text-sm font-semibold text-foreground">
                              Accessibility
                            </span>
                            <span className="text-xs text-muted-foreground leading-snug block mb-2">
                              Alt text describes your photos for people with visual impairments.
                            </span>
                            <Input
                              placeholder="Write alt text..."
                              value={altText}
                              onChange={(e) => setAltText(e.target.value)}
                              className="bg-secondary/50 text-sm h-10 rounded-lg border-transparent"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-border/50 mt-auto shrink-0 bg-card z-10 sticky bottom-0">
                      <Button
                        onClick={handleSharePost}
                        disabled={uploading}
                        className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Sharing...
                          </>
                        ) : (
                          "Share"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Discard Confirmation Dialog ── */}
        {showDiscardConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-card rounded-2xl shadow-2xl overflow-hidden w-[90%] max-w-[340px] animate-scale-in border border-border/30">
              <div className="px-6 pt-6 pb-4 text-center">
                <h3 className="text-lg font-bold text-foreground mb-1.5">
                  Discard post?
                </h3>
                <p className="text-sm text-muted-foreground leading-snug">
                  If you leave, your edits won't be saved.
                </p>
              </div>
              <div className="border-t border-border/30">
                <button
                  onClick={handleClose}
                  className="w-full py-3.5 text-[15px] font-bold text-red-500 hover:bg-red-500/5 transition-colors"
                >
                  Discard
                </button>
                <div className="border-t border-border/30">
                  <button
                    onClick={() => setShowDiscardConfirm(false)}
                    className="w-full py-3.5 text-[15px] font-medium text-foreground hover:bg-secondary/30 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GlobalCreateModal;
