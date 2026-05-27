import { useState, useRef, useCallback } from "react";
import { X, Upload, ImageIcon, VideoIcon, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { addHours } from "date-fns";
import CustomEditor from "@/components/editor/CustomEditor";

interface CreateStoryProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateStory({ onClose, onCreated }: CreateStoryProps) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  // Edited blob from CustomEditor (overrides original file)
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [editedMimeType, setEditedMimeType] = useState<string>("image/png");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image or video file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 100MB.",
        variant: "destructive",
      });
      return;
    }

    const type = file.type.startsWith("video/") ? "video" : "image";
    setMediaType(type);
    setSelectedFile(file);
    setEditedBlob(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Automatically open the editor
    setShowCustomEditor(true);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  // Called when CE.SDK exports — store the blob for upload
  const handleEditorSave = useCallback((blob: Blob, mimeType: string) => {
    setEditedBlob(blob);
    setEditedMimeType(mimeType);

    // Revoke old preview URL and create new one from edited blob
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const newUrl = URL.createObjectURL(blob);
    setPreviewUrl(newUrl);

    // Update mediaType based on exported mimeType
    if (mimeType.startsWith("video/")) {
      setMediaType("video");
    } else {
      setMediaType("image");
    }

    setShowCustomEditor(false);

    toast({
      title: "Edit applied ✨",
      description: "Your media has been edited. Click Share Story to publish.",
    });
  }, [previewUrl]);

  const handleUpload = async () => {
    if ((!selectedFile && !editedBlob) || !user) return;

    setUploading(true);

    try {
      // Determine file to upload: edited blob OR original file
      const fileToUpload = editedBlob || selectedFile!;
      const ext = editedBlob
        ? editedMimeType.startsWith("video/") ? "mp4" : "png"
        : selectedFile!.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");

      const timestamp = Date.now();
      const filePath = `stories/${user.id}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, fileToUpload, {
          cacheControl: "3600",
          upsert: false,
          contentType: editedBlob ? editedMimeType : (selectedFile?.type || "image/jpeg"),
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;

      const expiresAt = addHours(new Date(), 24).toISOString();

      const { error: insertError } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
        expires_at: expiresAt,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      toast({
        title: "Story published! ✨",
        description: "Your story will be visible for 24 hours.",
      });

      onCreated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setEditedBlob(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Show CustomEditor full-screen
  if (showCustomEditor) {
    return (
      <CustomEditor
        onSave={handleEditorSave}
        onClose={() => setShowCustomEditor(false)}
        initialMediaUrl={previewUrl || undefined}
        mediaType={mediaType}
        title={mediaType === "video" ? "Edit Video Story" : "Edit Image Story"}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 600, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "rgba(15, 15, 30, 0.95)",
          border: "1px solid rgba(99,102,241,0.25)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
            <h2 className="text-white font-semibold text-lg tracking-tight">Create Story</h2>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5">
          {/* Media upload / preview area */}
          {!previewUrl ? (
            <div
              className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 py-12 ${
                dragOver
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-white/20 hover:border-indigo-500/50 hover:bg-white/5"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Upload className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium text-sm">Drop your media here</p>
                <p className="text-white/40 text-xs mt-1">or click to browse</p>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  <ImageIcon className="w-3 h-3 text-indigo-400" />
                  <span className="text-xs text-white/50">Images</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  <VideoIcon className="w-3 h-3 text-purple-400" />
                  <span className="text-xs text-white/50">Videos</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden aspect-[9/16] max-h-72 bg-black">
              {mediaType === "video" ? (
                <video
                  src={previewUrl}
                  className="w-full h-full object-cover"
                  controls
                  muted
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Remove button */}
              <button
                onClick={handleRemoveFile}
                disabled={uploading}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Media type badge */}
              <div className="absolute bottom-2 left-2 z-10">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    mediaType === "video"
                      ? "bg-purple-600/80 text-white"
                      : "bg-indigo-600/80 text-white"
                  }`}
                >
                  {editedBlob ? "✨ Edited" : mediaType === "video" ? "Video" : "Image"}
                </span>
              </div>

              {/* Edit with CustomEditor button — for BOTH images and videos */}
              <button
                onClick={() => setShowCustomEditor(true)}
                disabled={uploading}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg transition-all z-10"
              >
                <Wand2 className="w-3 h-3" />
                {mediaType === "video" ? "Edit Video" : "Edit Photo"}
              </button>
            </div>
          )}

          {/* Caption input */}
          <div className="flex flex-col gap-2">
            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
              Caption <span className="text-white/30 normal-case">(optional)</span>
            </label>
            <Textarea
              placeholder="Write a caption for your story..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              rows={3}
              disabled={uploading}
              className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500/60 rounded-xl text-sm"
            />
            <div className="flex justify-end">
              <span className="text-white/30 text-xs">{caption.length}/200</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 bg-transparent border-white/15 text-white/70 hover:bg-white/5 hover:text-white rounded-xl"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 border-0 transition-all disabled:opacity-60"
              onClick={handleUpload}
              disabled={(!selectedFile && !editedBlob) || uploading}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Share Story
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
