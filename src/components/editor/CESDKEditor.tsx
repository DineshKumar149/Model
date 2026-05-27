/**
 * CESDKEditor - React wrapper for the CE.SDK (IMG.LY Creative Editor SDK)
 *
 * Features:
 * - Full video editor with timeline, trim, effects, stickers, text overlays
 * - AI background removal
 * - Social media format presets (Instagram, TikTok, YouTube, etc.)
 * - Works in free/demo mode (watermark visible but fully functional)
 * - Exports image (PNG) or video (MP4) blob → calls onSave for Supabase upload
 */

import React, { useEffect, useRef, useCallback } from "react";
import CreativeEditorSDK from "@cesdk/cesdk-js";
import { X, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { initVideoEditor } from "./imgly";

interface CESDKEditorProps {
  /** Called with the exported blob and mimeType when user clicks "Done & Upload" */
  onSave: (blob: Blob, mimeType: string) => void;
  /** Called when user closes the editor without saving */
  onClose: () => void;
  /**
   * URL of media to load into the editor.
   * - Image URL: loaded as an image fill
   * - Video URL: loaded as a video scene
   * If not provided, editor starts blank with the ability to upload from the dock.
   */
  initialMediaUrl?: string;
  /** Type of media to edit — determines export format */
  mediaType?: "image" | "video";
  /** Optional title shown in the editor title area */
  title?: string;
}

const CESDKEditor: React.FC<CESDKEditorProps> = ({
  onSave,
  onClose,
  initialMediaUrl,
  mediaType = "image",
  title = "Edit Media",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cesdkRef = useRef<CreativeEditorSDK | null>(null);
  const initializingRef = useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  const handleExport = useCallback(
    (blob: Blob, mimeType: string) => {
      onSave(blob, mimeType);
    },
    [onSave]
  );

  const [isExporting, setIsExporting] = React.useState(false);

  const handleDoneEditing = async () => {
    if (!cesdkRef.current) return;
    setIsExporting(true);
    try {
      const cesdk = cesdkRef.current;
      const engine = cesdk.engine;
      const scene = engine.scene.get();
      let hasVideo = false;
      if (scene) {
        const allBlocks = engine.block.findAll();
        hasVideo = allBlocks.some((block) => {
          try {
            const type = engine.block.getType(block);
            if (type === '//ly.img.ubq/audio') return true;
            if (type === '//ly.img.ubq/graphic' && engine.block.supportsFill(block)) {
              return engine.block.getType(engine.block.getFill(block)) === '//ly.img.ubq/fill/video';
            }
            return false;
          } catch {
            return false;
          }
        });
      }

      const mimeType = hasVideo ? 'video/mp4' : 'image/png';
      const { blobs, options } = await cesdk.utils.export({ mimeType });
      handleExport(blobs[0], options.mimeType as string);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRetry = () => {
    // Dispose previous instance if any
    if (cesdkRef.current) {
      try { cesdkRef.current.dispose(); } catch { /* ignore */ }
      cesdkRef.current = null;
    }
    initializingRef.current = false;
    setLoadError(null);
    setIsLoading(true);
    setRetryKey((k) => k + 1);
  };

  useEffect(() => {
    if (!containerRef.current || initializingRef.current) return;
    initializingRef.current = true;

    let cesdk: CreativeEditorSDK | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        // CE.SDK configuration — role:'Creator' is required for the video editor
        const config: Record<string, any> = {
          role: 'Creator',
          theme: "dark",
          userId: "atome-social-app",
          // License key: add VITE_CESDK_LICENSE_KEY to .env for production (removes watermark)
          ...(import.meta.env.VITE_CESDK_LICENSE_KEY
            ? { license: import.meta.env.VITE_CESDK_LICENSE_KEY }
            : {}),
        };

        cesdk = await CreativeEditorSDK.create(
          containerRef.current!,
          config
        );

        if (cancelled) {
          try { cesdk.dispose(); } catch { /* ignore */ }
          return;
        }

        cesdkRef.current = cesdk;

        // Initialize with full video editor configuration
        await initVideoEditor(cesdk, handleExport);

        // Load initial media if provided
        if (initialMediaUrl) {
          if (mediaType === "video") {
            // Load video via scene creation
            try {
              await (cesdk as any).createFromVideo(initialMediaUrl);
            } catch {
              // Fallback: create a blank scene and load from URL
              await cesdk.engine.scene.create();
              const page = cesdk.engine.scene.getCurrentPage();
              if (page) {
                const block = cesdk.engine.block.create("//ly.img.ubq/graphic");
                const fill = cesdk.engine.block.createFill("video");
                cesdk.engine.block.setString(
                  fill,
                  "fill/video/fileURI",
                  initialMediaUrl
                );
                cesdk.engine.block.setFill(block, fill);
                cesdk.engine.block.appendChild(page, block);
                cesdk.engine.block.fillParent(block);
              }
            }
          } else {
            // Load image properly using CE.SDK's built-in helper
            try {
              await (cesdk as any).createFromImage(initialMediaUrl);
            } catch {
              // Fallback if createFromImage fails: create blank scene and append image
              await cesdk.engine.scene.create();
              const page = cesdk.engine.scene.getCurrentPage();
              if (page) {
                const block = cesdk.engine.block.create("//ly.img.ubq/graphic");
                const fill = cesdk.engine.block.createFill("image");
                cesdk.engine.block.setString(
                  fill,
                  "fill/image/imageFileURI",
                  initialMediaUrl
                );
                cesdk.engine.block.setFill(block, fill);
                cesdk.engine.block.appendChild(page, block);
                cesdk.engine.block.fillParent(block);
              }
            }
          }
        } else {
          // No media provided — create blank scene
          await cesdk.engine.scene.create();
        }

        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("CE.SDK initialization failed:", err);
        setLoadError(
          err instanceof Error
            ? err.message
            : "Failed to initialize the editor. Please try again."
        );
        setIsLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      // Cleanup on unmount
      if (cesdkRef.current) {
        try {
          cesdkRef.current.dispose();
        } catch {
          // Ignore disposal errors
        }
        cesdkRef.current = null;
      }
    };
  }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ zIndex: 700, background: "#0a0a0a" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10"
        style={{ background: "rgba(10,10,20,0.97)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 animate-pulse" />
          <span className="text-white font-semibold text-sm tracking-tight">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDoneEditing}
            disabled={isExporting || isLoading || !!loadError}
            className="flex items-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Done & Continue"
            )}
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
            title="Close editor without saving"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor container */}
      <div className="flex-1 relative overflow-hidden">
        {/* CE.SDK mounts here */}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ background: "#111" }}
        />

        {/* Loading overlay */}
        {isLoading && !loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a14] z-10">
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-900/60">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div className="absolute -inset-2 rounded-3xl border-2 border-indigo-500/30 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-base mb-1">Loading Editor</p>
                <p className="text-white/40 text-xs">Preparing creative tools...</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-indigo-500"
                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
            <style>{`
              @keyframes bounce {
                0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
                40% { transform: translateY(-8px); opacity: 1; }
              }
            `}</style>
          </div>
        )}

        {/* Error overlay */}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a14] z-10 p-8">
            <div className="flex flex-col items-center gap-5 max-w-md text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-base mb-2">
                  Editor Failed to Load
                </p>
                <p className="text-white/50 text-sm leading-relaxed">
                  {loadError}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CESDKEditor;
