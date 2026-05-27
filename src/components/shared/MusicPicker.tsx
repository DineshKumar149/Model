/**
 * MusicPicker — Instagram-style music selector for posts.
 * Integrates iTunes Search API and custom local file uploads.
 */
import { useState, useRef, useEffect } from "react";
import { Music2, Search, Play, Pause, X, Check, ChevronDown, ChevronUp, Upload, Loader2 } from "lucide-react";
import { Track, formatDuration } from "@/lib/music";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";

interface MusicPickerProps {
  selected: Track | null;
  onSelect: (track: Track | null) => void;
}

export default function MusicPicker({ selected, onSelect }: MusicPickerProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Search iTunes API
  useEffect(() => {
    const searchTracks = async () => {
      if (!query.trim()) {
        setTracks([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`);
        const data = await res.json();
        
        const results: Track[] = data.results.map((t: any) => ({
          id: t.trackId.toString(),
          title: t.trackName,
          artist: t.artistName,
          genre: t.primaryGenreName,
          duration: formatDuration(t.trackTimeMillis || 0),
          previewUrl: t.previewUrl,
          coverUrl: t.artworkUrl100,
          coverColor: "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0') // fallback color
        })).filter((t: Track) => t.previewUrl); // only keep tracks with audio previews

        setTracks(results);
      } catch (err) {
        console.error("iTunes search failed", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchTracks, 500);
    return () => clearTimeout(debounce);
  }, [query]);

  // Handle custom upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (!file.type.startsWith('audio/')) {
      toast({ title: "Invalid file", description: "Please upload an audio file (MP3/WAV)", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `custom-music/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("post-images").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Create a track object for it
      const customTrack: Track = {
        id: `custom_${Date.now()}`,
        title: file.name.replace(`.${ext}`, ''),
        artist: "Custom Audio",
        genre: "Custom",
        duration: "Unknown", // we could calculate via audio element but skipping for simplicity
        previewUrl: publicUrl,
        coverColor: "#8b5cf6"
      };

      onSelect(customTrack);
      setOpen(false);
      toast({ title: "Music uploaded!", description: "Your custom audio is attached." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingId(null);
  };

  const togglePreview = (track: Track) => {
    if (playingId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();

    const audio = new Audio(track.previewUrl);
    audio.play().catch(e => console.error("Audio playback error", e));
    
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  useEffect(() => () => stopPreview(), []);

  const handleSelect = (track: Track) => {
    stopPreview();
    onSelect(selected?.id === track.id ? null : track);
    setOpen(false);
  };

  return (
    <div className="music-picker relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all border border-transparent hover:border-primary/20 group"
      >
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${selected ? "bg-primary" : "bg-secondary"} transition-colors`}>
          <Music2 className={`w-4 h-4 ${selected ? "text-primary-foreground" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 text-left truncate">
          {selected ? (
            <div>
              <p className="text-sm font-semibold text-foreground truncate">{selected.title}</p>
              <p className="text-xs text-muted-foreground truncate">{selected.artist}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Add music (iTunes & Custom)</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selected && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); stopPreview(); onSelect(null); }}
              className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="absolute z-[100] mt-2 w-full rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden animate-fade-in">
          {/* Custom Upload Button */}
          <div className="p-2 border-b border-border/30 bg-secondary/20">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isUploading ? "Uploading..." : "Import from Computer"}
            </button>
            <input 
              type="file" 
              accept="audio/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
          </div>

          <div className="p-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search iTunes database..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/60 border-none outline-none text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : tracks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {query ? "No songs found" : "Type to search..."}
              </div>
            ) : (
              tracks.map(track => {
                const isPlaying = playingId === track.id;
                const isSelected = selected?.id === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => handleSelect(track)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all hover:bg-secondary/40 ${
                      isSelected ? "bg-primary/5 border-l-2 border-primary" : ""
                    }`}
                  >
                    <div
                      className="relative w-10 h-10 rounded-lg flex-shrink-0 bg-secondary flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: track.coverColor }}
                    >
                      {track.coverUrl ? (
                        <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <Music2 className="w-4 h-4 text-white opacity-60" />
                      )}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); togglePreview(track); }}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                      >
                        {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-tight">{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{track.duration}</span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); togglePreview(track); }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isPlaying ? "bg-primary text-primary-foreground" : "bg-secondary/80 hover:bg-secondary"
                        }`}
                      >
                        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
