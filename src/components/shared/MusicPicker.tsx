/**
 * MusicPicker ΓÇö Instagram-style music selector for posts.
 * Search curated tracks, preview them, and attach to post.
 */
import { useState, useRef, useEffect } from "react";
import { Music2, Search, Play, Pause, X, Check, ChevronDown, ChevronUp } from "lucide-react";

import { Track, TRACKS } from "@/lib/music";

const GENRES = ["All", "Pop", "Hip-Hop", "R&B", "Indie", "Pop Punk", "Afrobeats"];

interface MusicPickerProps {
  selected: Track | null;
  onSelect: (track: Track | null) => void;
}

// Waveform bars animation component
function WaveformBars({ playing, color }: { playing: boolean; color: string }) {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[3, 5, 4, 6, 3, 5, 4, 3, 6, 4, 5, 3].map((h, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: playing ? `${h * (Math.random() * 0.4 + 0.8)}px` : `${h * 0.5}px`,
            backgroundColor: color,
            borderRadius: 1,
            transition: playing ? `height ${0.15 + i * 0.03}s ease-in-out` : "height 0.3s ease",
            animation: playing ? `wave-bar-${(i % 3) + 1} ${0.6 + i * 0.05}s ease-in-out infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

export default function MusicPicker({ selected, onSelect }: MusicPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // force re-render for waveform

  // Waveform animation ticker
  useEffect(() => {
    if (!playingId) return;
    const id = setInterval(() => setTick(t => t + 1), 150);
    return () => clearInterval(id);
  }, [playingId]);

  // Simulate audio preview with Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const stopPreview = () => {
    if (oscRef.current) {
      try {
        gainRef.current?.gain.setTargetAtTime(0, audioCtxRef.current!.currentTime, 0.1);
        setTimeout(() => { try { oscRef.current?.stop(); } catch {} }, 200);
      } catch {}
      oscRef.current = null;
    }
    setPlayingId(null);
  };

  const togglePreview = (track: Track) => {
    if (playingId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      gainRef.current = gain;

      // Create a pleasant melody using multiple oscillators
      const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
      const baseFreq = notes[parseInt(track.id) % notes.length];

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = baseFreq;
      osc.connect(gain);
      osc.start();
      oscRef.current = osc;

      // Fade in
      gain.gain.setTargetAtTime(0.15, ctx.currentTime, 0.1);

      // Gentle frequency modulation for musicality
      let time = ctx.currentTime;
      notes.forEach((freq, i) => {
        osc.frequency.setValueAtTime(freq, time + i * 0.5);
      });

      setPlayingId(track.id);

      // Auto-stop after 8 seconds
      setTimeout(() => {
        if (oscRef.current === osc) stopPreview();
      }, 8000);
    } catch (e) {
      console.warn("Audio preview failed:", e);
    }
  };

  useEffect(() => () => stopPreview(), []);

  const filtered = TRACKS.filter(t => {
    const q = query.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    const matchGenre = genre === "All" || t.genre === genre;
    return matchSearch && matchGenre;
  });

  const handleSelect = (track: Track) => {
    stopPreview();
    onSelect(selected?.id === track.id ? null : track);
    setOpen(false);
  };

  return (
    <div className="music-picker">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all border border-transparent hover:border-primary/20 group"
      >
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${selected ? "bg-primary" : "bg-secondary"} transition-colors`}>
          <Music2 className={`w-4 h-4 ${selected ? "text-primary-foreground" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 text-left">
          {selected ? (
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{selected.title}</p>
              <p className="text-xs text-muted-foreground">{selected.artist}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Add music</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selected && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="mt-2 rounded-2xl border border-border/50 bg-card shadow-xl overflow-hidden animate-fade-in">
          {/* Search bar */}
          <div className="p-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search songs or artists..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/60 border-none outline-none text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30"
                autoFocus
              />
            </div>
          </div>

          {/* Genre filter pills */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none border-b border-border/20">
            {GENRES.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  genre === g
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Track list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No songs found
              </div>
            ) : (
              filtered.map(track => {
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
                    {/* Album cover */}
                    <div
                      className="relative w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${track.coverColor}cc, ${track.coverColor})` }}
                    >
                      <Music2 className="w-4 h-4 opacity-60" />
                      {/* Play overlay */}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); togglePreview(track); }}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-lg"
                      >
                        {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                      </button>
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-tight">{track.title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                        {isPlaying && (
                          <div className="flex items-end gap-[2px] h-3">
                            {[2, 4, 3, 5, 2, 4].map((_, i) => (
                              <div
                                key={i}
                                style={{
                                  width: 2,
                                  backgroundColor: track.coverColor,
                                  borderRadius: 1,
                                  height: `${(tick + i) % 2 === 0 ? 8 : 4}px`,
                                  transition: "height 0.15s ease",
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{track.duration}</span>
                      {/* Play button */}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); togglePreview(track); }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isPlaying
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>
                      {/* Check mark for selected */}
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

          {/* Footer */}
          <div className="px-3 py-2 border-t border-border/20 bg-secondary/10 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{filtered.length} tracks</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-primary font-medium hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
