export interface Track {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  previewUrl: string; // The URL to the actual mp3/wav
  coverColor: string;
  coverUrl?: string; // iTunes artwork URL
}

// Global function to get duration string from ms
export function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
}
