export interface Track {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  previewUrl?: string;
  coverColor: string;
}

export const TRACKS: Track[] = [
  { id: "1",  title: "Blinding Lights",    artist: "The Weeknd",        genre: "Pop",       duration: "3:20", coverColor: "#e11d48" },
  { id: "2",  title: "Levitating",         artist: "Dua Lipa",          genre: "Pop",       duration: "3:24", coverColor: "#7c3aed" },
  { id: "3",  title: "Stay",               artist: "Kid LAROI & Bieber", genre: "Pop",      duration: "2:21", coverColor: "#0891b2" },
  { id: "4",  title: "Peaches",            artist: "Justin Bieber",     genre: "R&B",       duration: "3:18", coverColor: "#d97706" },
  { id: "5",  title: "Good 4 U",           artist: "Olivia Rodrigo",    genre: "Pop Punk",  duration: "2:58", coverColor: "#be185d" },
  { id: "6",  title: "Montero",            artist: "Lil Nas X",         genre: "Hip-Hop",   duration: "2:17", coverColor: "#16a34a" },
  { id: "7",  title: "drivers license",    artist: "Olivia Rodrigo",    genre: "Pop",       duration: "4:02", coverColor: "#1d4ed8" },
  { id: "8",  title: "Heat Waves",         artist: "Glass Animals",     genre: "Indie",     duration: "3:59", coverColor: "#0f766e" },
  { id: "9",  title: "Save Your Tears",    artist: "The Weeknd",        genre: "Synth-Pop", duration: "3:35", coverColor: "#b91c1c" },
  { id: "10", title: "Industry Baby",      artist: "Lil Nas X",         genre: "Hip-Hop",   duration: "3:32", coverColor: "#ca8a04" },
  { id: "11", title: "abcdefu",            artist: "GAYLE",             genre: "Pop Rock",  duration: "2:53", coverColor: "#6d28d9" },
  { id: "12", title: "As It Was",          artist: "Harry Styles",      genre: "Pop",       duration: "2:37", coverColor: "#0e7490" },
  { id: "13", title: "Anti-Hero",          artist: "Taylor Swift",      genre: "Pop",       duration: "3:21", coverColor: "#b45309" },
  { id: "14", title: "Flowers",            artist: "Miley Cyrus",       genre: "Pop",       duration: "3:21", coverColor: "#15803d" },
  { id: "15", title: "Calm Down",          artist: "Rema & Selena G.",  genre: "Afrobeats", duration: "3:59", coverColor: "#7c2d12" },
];

export class AudioPreviewer {
  private audioCtx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private autoStopTimeout: any = null;

  stop() {
    if (this.autoStopTimeout) clearTimeout(this.autoStopTimeout);
    if (this.osc) {
      try {
        if (this.audioCtx && this.gain) {
          this.gain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
        }
        setTimeout(() => { try { this.osc?.stop(); } catch {} }, 200);
      } catch {}
      this.osc = null;
    }
  }

  play(trackId: string, durationMs: number = 8000) {
    this.stop();
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioCtx = ctx;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      this.gain = gain;

      const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
      const baseFreq = notes[parseInt(trackId) % notes.length] || 440;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = baseFreq;
      osc.connect(gain);
      osc.start();
      this.osc = osc;

      gain.gain.setTargetAtTime(0.15, ctx.currentTime, 0.1);

      let time = ctx.currentTime;
      notes.forEach((freq, i) => {
        osc.frequency.setValueAtTime(freq, time + i * 0.5);
      });

      if (durationMs > 0) {
        this.autoStopTimeout = setTimeout(() => {
          if (this.osc === osc) this.stop();
        }, durationMs);
      }
    } catch (e) {
      console.warn("Audio preview failed:", e);
    }
  }
}

export const getTrackById = (id: string) => TRACKS.find(t => t.id === id) || null;
