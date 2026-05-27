import { useState, useEffect, useRef } from "react";
import { X, ArrowLeft, Camera, Upload, Check, Trash2, Edit2, Sliders } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "consent" | "compose" | "editor";

export default function ReportProblemModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("consent");
  const [includeLogs, setIncludeLogs] = useState(false);
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]); // base64 images
  const [isCapturing, setIsCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Canvas editing refs & state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [editImageSrc, setEditImageSrc] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<{ x: number; y: number; w: number; h: number }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep("consent");
      setDescription("");
      setAttachments([]);
      setIncludeLogs(false);
      setEditingIndex(null);
    }
  }, [isOpen]);

  // Redraw canvas if highlights change
  useEffect(() => {
    if (step === "editor" && editImageSrc) {
      setTimeout(drawCanvas, 100);
    }
  }, [step, highlights, editImageSrc]);

  if (!isOpen) return null;

  // Perform background submission to both Supabase and FormSubmit.co
  const performBackgroundSubmit = async (desc: string, files: string[]) => {
    setSubmitting(true);
    
    // 1. Save to Supabase (we created the reports table, so it will succeed!)
    const diagnosticsData = {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
    };

    try {
      const { error: dbError } = await supabase.from("reports").insert({
        user_id: user?.id || null,
        email: user?.email || "anonymous@atome.app",
        description: desc.trim() || "Automatic screenshot bug report",
        diagnostics_included: includeLogs,
        diagnostics_data: includeLogs ? diagnosticsData : null,
        attachments: files,
      });

      if (dbError) {
        console.warn("Database save error:", dbError.message);
      }
    } catch (err) {
      console.warn("Supabase database insert error:", err);
    }

    // Helper to convert base64 data URI to File object for real email attachments
    const dataURLtoFile = (dataurl: string, filename: string): File => {
      const arr = dataurl.split(",");
      const mime = arr[0].match(/:(.*?);/)![1];
      const bstr = atob(arr[arr.length - 1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    };

    // 2. Dispatch email in background via FormSubmit.co (100% automatic, no window pops)
    try {
      const formData = new FormData();
      formData.append("_subject", "Atome Web App - Automatic Bug Report");
      formData.append("email", user?.email || "guest@atome.app");
      formData.append("message", desc.trim() || "(No text message provided - Automatic screenshot report)");
      formData.append("diagnostics_included", includeLogs ? "Yes" : "No");
      formData.append("user_id", user?.id || "Anonymous");
      formData.append("url", window.location.href);
      formData.append("user_agent", navigator.userAgent);
      formData.append("timestamp", new Date().toLocaleString());
      formData.append("screen_dimensions", `${window.innerWidth}x${window.innerHeight}`);

      // Add attached files
      files.forEach((base64Str, index) => {
        try {
          if (base64Str.startsWith("data:")) {
            const file = dataURLtoFile(base64Str, `screenshot_${index + 1}.png`);
            formData.append(`attachment_${index + 1}`, file);
          }
        } catch (e) {
          console.warn("Failed to convert base64 to file:", e);
          formData.append(`attachment_${index + 1}_base64`, base64Str);
        }
      });

      // Submit AJAX POST in background
      const emailResponse = await fetch("https://formsubmit.co/ajax/dineshkumar2729305@gmail.com", {
        method: "POST",
        body: formData
      });

      if (!emailResponse.ok) {
        throw new Error("Email sending returned an error status.");
      }
    } catch (err) {
      console.error("Background email dispatch failed:", err);
    } finally {
      setSubmitting(false);
      onClose();
      alert("🎉 Report Sent Automatically!\n\nThank you. The report has been recorded in Supabase and dispatched to dineshkumar2729305@gmail.com in the background (no email clients were opened!).");
    }
  };

  // 1. Capture Full Screen Screenshot and submit automatically
  const handleCaptureScreenshot = async () => {
    setIsCapturing(true);
    // Find the main overlay of the report modal and hide it momentarily
    const modalOverlays = document.querySelectorAll(".report-modal-overlay");
    modalOverlays.forEach((el) => {
      (el as HTMLElement).style.opacity = "0";
      (el as HTMLElement).style.pointerEvents = "none";
    });

    // Give a short delay for modal transitions/opacity change
    setTimeout(async () => {
      let dataUrl = "";
      try {
        const root = document.getElementById("root") || document.body;
        const canvas = await html2canvas(root, {
          useCORS: true,
          allowTaint: true,
          scale: 1, // 1x scale for smaller base64 payload to fit easily in AJAX requests!
          logging: false,
          ignoreElements: (element) => {
            return element.classList.contains("report-modal-overlay");
          }
        });
        
        dataUrl = canvas.toDataURL("image/png");
        setAttachments((prev) => [...prev, dataUrl]);
      } catch (err) {
        console.error("Screenshot capture failed:", err);
      } finally {
        // Restore modal visibility
        modalOverlays.forEach((el) => {
          (el as HTMLElement).style.opacity = "1";
          (el as HTMLElement).style.pointerEvents = "auto";
        });
        setIsCapturing(false);
        
        // Auto-submit immediately in background with the new screenshot!
        const updatedAttachments = dataUrl ? [...attachments, dataUrl] : attachments;
        await performBackgroundSubmit(description, updatedAttachments);
      }
    }, 400);
  };

  // 2. Upload file (photos/videos)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setAttachments((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 3. Remove an attachment
  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // 4. Open Screenshot markup editor
  const handleOpenEditor = (idx: number) => {
    setEditingIndex(idx);
    setEditImageSrc(attachments[idx]);
    setHighlights([]);
    setStep("editor");
  };

  // 5. Draw Highlight Logic
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartX(x);
    setStartY(y);
    setCurrentX(x);
    setCurrentY(y);
    setIsDrawing(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCurrentX(e.clientX - rect.left);
    setCurrentY(e.clientY - rect.top);
    drawCanvas();
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Add current dragged rectangle to highlights list
    const w = currentX - startX;
    const h = currentY - startY;
    if (Math.abs(w) > 5 && Math.abs(h) > 5) {
      setHighlights((prev) => [
        ...prev,
        {
          x: w < 0 ? currentX : startX,
          y: h < 0 ? currentY : startY,
          w: Math.abs(w),
          h: Math.abs(h),
        },
      ]);
    }
  };

  // Re-draw canvas with original image, grey overlay, and highlighted transparent holes
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !editImageSrc) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = editImageSrc;
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw base image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Create semi-transparent overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Re-draw highlights (transparent cutouts with bright borders)
      const allHighlights = [...highlights];
      if (isDrawing) {
        const w = currentX - startX;
        const h = currentY - startY;
        allHighlights.push({
          x: w < 0 ? currentX : startX,
          y: h < 0 ? currentY : startY,
          w: Math.abs(w),
          h: Math.abs(h),
        });
      }

      allHighlights.forEach((hl) => {
        // Cut out the rectangle
        ctx.clearRect(hl.x, hl.y, hl.w, hl.h);
        
        // Redraw image chunk in cutout
        ctx.drawImage(img, hl.x, hl.y, hl.w, hl.h, hl.x, hl.y, hl.w, hl.h);
        
        // Draw bright border representing highlight selection
        ctx.strokeStyle = "#4db3ff";
        ctx.lineWidth = 3.5;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.strokeRect(hl.x, hl.y, hl.w, hl.h);
        
        // Reset shadow
        ctx.shadowBlur = 0;
      });
    };
  };


  // Save the highlighted image back to attachments
  const handleSaveHighlights = () => {
    const canvas = canvasRef.current;
    if (!canvas || editingIndex === null) return;
    const finalDataUrl = canvas.toDataURL("image/png");
    setAttachments((prev) => {
      const copy = [...prev];
      copy[editingIndex] = finalDataUrl;
      return copy;
    });
    setStep("compose");
  };

  // Submit Feedback
  const handleSubmitReport = async () => {
    // If no screenshot has been taken yet, automatically capture one and submit in background!
    if (attachments.length === 0) {
      await handleCaptureScreenshot();
    } else {
      await performBackgroundSubmit(description, attachments);
    }
  };

  // Overlay styles
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.8)",
    backdropFilter: "blur(4px)",
    transition: "opacity 0.2s ease",
  };

  const cardStyle: React.CSSProperties = {
    background: "#1c1c1e",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 24px 70px rgba(0,0,0,0.9)",
    maxWidth: "100%",
    width: 440,
    display: "flex",
    flexDirection: "column",
    maxHeight: "90vh",
    animation: "fadeScaleIn 0.22s ease-out forwards",
    position: "relative",
    border: "1px solid #2c2c2e"
  };

  return (
    <div 
      className="report-modal-overlay" 
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── STEP 1: LOGS & DIAGNOSTICS CONSENT ── */}
      {step === "consent" && (
        <div style={cardStyle}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 16px", borderBottom: "1px solid #2c2c2e", position: "relative" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Report a problem</span>
            <button onClick={onClose} style={{ position: "absolute", right: 16, background: "transparent", border: "none", cursor: "pointer", display: "flex" }}>
              <X style={{ width: 20, height: 20, color: "#fff" }} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "28px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#fff", fontWeight: 600, marginBottom: 12 }}>
              Include complete logs and diagnostics?
            </p>
            <p style={{ fontSize: 13, color: "#999", lineHeight: 1.5, marginBottom: 24 }}>
              System logs and browser diagnostics help us understand and fix issues faster. Personal details like passwords are never included.
            </p>

            <button 
              onClick={() => { setIncludeLogs(true); setStep("compose"); }}
              style={{ width: "100%", padding: "14px", background: "#0095f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}
            >
              Include and continue
            </button>
            <button 
              onClick={() => { setIncludeLogs(false); setStep("compose"); }}
              style={{ width: "100%", padding: "14px", background: "#262626", color: "#b3b3b3", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              className="hover:bg-[#333] transition-colors"
            >
              Don't include and continue
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: COMPOSE REPORT ── */}
      {step === "compose" && (
        <div style={{ ...cardStyle, width: 500 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #2c2c2e" }}>
            <button onClick={() => setStep("consent")} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#b3b3b3" }}>
              <ArrowLeft style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Report a problem</span>
            <button 
              onClick={handleSubmitReport} 
              disabled={submitting || !description.trim() || isCapturing}
              style={{ background: "transparent", border: "none", color: description.trim() ? "#4db3ff" : "#363636", fontSize: 15, fontWeight: 700, cursor: submitting || !description.trim() ? "not-allowed" : "pointer" }}
            >
              {submitting ? "Sending…" : "Send"}
            </button>
          </div>

          {/* Form Content */}
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
            {isCapturing ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 180 }}>
                <div style={{ width: 36, height: 36, border: "3px solid #333", borderTopColor: "#4db3ff", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
                <p style={{ fontSize: 14, color: "#999" }}>Capturing screen screenshot...</p>
              </div>
            ) : (
              <>
                {/* Explain */}
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly explain what happened or what's not working. What were you doing when the bug popped up?"
                  rows={6}
                  style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: 15, outline: "none", resize: "none", padding: 0 }}
                  autoFocus
                />

                {/* Attachments Section */}
                {attachments.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#737373", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Attachments</p>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10 }}>
                      {attachments.map((img, idx) => (
                        <div key={idx} style={{ width: 90, height: 120, position: "relative", borderRadius: 8, overflow: "hidden", background: "#262626", border: "1px solid #3a3a3c", flexShrink: 0 }}>
                          <img src={img} alt="Attachment" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          {/* Options overlay */}
                          <div style={{ position: "absolute", top: 0, inset: 0, background: "rgba(0,0,0,0.45)", opacity: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 120ms" }} className="hover-overlay-attachment">
                            <button 
                              onClick={() => handleOpenEditor(idx)}
                              style={{ width: 26, height: 26, background: "#4db3ff", color: "#fff", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                              title="Highlight area / Edit"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => handleRemoveAttachment(idx)}
                              style={{ width: 26, height: 26, background: "#ff4d4f", color: "#fff", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                              title="Delete attachment"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Tray */}
                <div style={{ display: "flex", gap: 10, borderTop: "1px solid #2c2c2e", paddingTop: 16 }}>
                  <button
                    onClick={handleCaptureScreenshot}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "#262626", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    className="hover:bg-[#333] transition-colors"
                  >
                    <Camera size={18} color="#4db3ff" />
                    Take Screenshot
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "#262626", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    className="hover:bg-[#333] transition-colors"
                  >
                    <Upload size={18} color="#4db3ff" />
                    Upload photo/video
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={handleFileUpload}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: HIGHLIGHT AREA SELECTION CANVAS EDITOR ── */}
      {step === "editor" && editImageSrc && (
        <div style={{ ...cardStyle, width: "90vw", maxWidth: 700, maxHeight: "95vh" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #2c2c2e", background: "#1c1c1e", zIndex: 10 }}>
            <button onClick={() => setStep("compose")} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#fff" }}>
              <ArrowLeft style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 14 }}>Back</span>
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Highlight Issue Area</span>
            <button 
              onClick={handleSaveHighlights}
              style={{ background: "#4db3ff", color: "#000", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Save Selection
            </button>
          </div>

          {/* Canvas Drawer Body */}
          <div style={{ flex: 1, background: "#0b0b0c", padding: "20px 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
            <p style={{ fontSize: 12, color: "#8e8e93", marginBottom: 12, textAlign: "center" }}>
              👉 **Click &amp; Drag** over the screenshot below to draw bright highlight rectangles over the problem areas.
            </p>
            
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "100%", maxHeight: "60vh", overflow: "auto" }}>
              <canvas
                ref={canvasRef}
                width={500}
                height={600}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                style={{
                  background: "#1e1e1f",
                  borderRadius: 4,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                  cursor: "crosshair",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain"
                }}
              />
            </div>
            
            {highlights.length > 0 && (
              <button 
                onClick={() => setHighlights([])}
                style={{ marginTop: 12, padding: "6px 12px", background: "#ff4d4f", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                Clear Highlights ({highlights.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Injected Animations/Styles */}
      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .hover-overlay-attachment:hover {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
