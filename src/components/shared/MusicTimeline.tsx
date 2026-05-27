import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

interface MusicTimelineProps {
  audioUrl: string;
  maxDuration?: number; // Usually 30s for iTunes previews
  snippetDuration?: number; // The length of the clip to select, e.g., 15s
  startTime: number;
  onChangeStartTime: (time: number) => void;
}

export default function MusicTimeline({
  audioUrl,
  maxDuration = 30,
  snippetDuration = 15,
  startTime,
  onChangeStartTime,
}: MusicTimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [isDragging, setIsDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate a mock symmetric waveform array (like instagram)
  // Instead of truly random, we make a pleasing symmetric-ish mountain shape
  const waveformBars = useRef(
    Array.from({ length: 40 }).map((_, i) => {
      const x = i / 40;
      // create a curve that is higher in the middle
      let height = Math.sin(x * Math.PI) * 0.5 + Math.random() * 0.5;
      return Math.max(0.1, Math.min(1, height));
    })
  ).current;

  // Audio setup
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audio.currentTime = startTime;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Loop if it exceeds snippet duration
      if (audio.currentTime >= startTime + snippetDuration) {
        audio.currentTime = startTime;
        // Keep playing, it loops
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.pause();
    };
  }, [audioUrl, startTime, snippetDuration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = startTime; // Always start from beginning of snippet when hitting play
      audioRef.current.play().catch(e => console.error(e));
      setIsPlaying(true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateStartTime(e.clientX);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const updateStartTime = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    
    // We want the drag coordinate to represent the CENTER of the window for ease of use
    // Or the start of the window. Let's say it represents the start of the window.
    // The max start time is maxDuration - snippetDuration
    const maxStart = Math.max(0, maxDuration - snippetDuration);
    
    // If the user clicks, the point clicked should be the start
    // So if percentage is e.g. 0.5, start time is 15s (if max is 30)
    let newStart = percentage * maxDuration;
    if (newStart > maxStart) newStart = maxStart;

    onChangeStartTime(newStart);
    setCurrentTime(newStart);
    if (audioRef.current) {
      audioRef.current.currentTime = newStart;
    }
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      updateStartTime(e.clientX);
    };
    const handlePointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
        // Auto play on release? Sure, Instagram does this.
        if (audioRef.current) {
          audioRef.current.play().catch(console.error);
          setIsPlaying(true);
        }
      }
    };

    if (isDragging) {
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    }
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, maxDuration, snippetDuration, onChangeStartTime]);

  const windowWidthPercentage = (snippetDuration / maxDuration) * 100;
  const windowLeftPercentage = (startTime / maxDuration) * 100;

  // The top scrubber shows a dot representing the exact current time
  const currentTimePercentage = (currentTime / maxDuration) * 100;

  return (
    <div className="w-full bg-[#111111] p-4 rounded-3xl flex flex-col gap-6 text-white overflow-hidden shadow-inner font-sans border border-white/5">
      
      {/* Top Scrubber Row */}
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button 
          onClick={togglePlay}
          className="w-10 h-10 flex-shrink-0 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
        </button>

        {/* Duration Circle */}
        <div className="w-10 h-10 flex-shrink-0 rounded-full border-2 border-white flex items-center justify-center font-bold text-sm">
          {snippetDuration}
        </div>

        {/* Top Timeline Slider */}
        <div className="flex-1 h-1 bg-zinc-800 rounded-full relative">
          {/* Active selection line */}
          <div 
            className="absolute h-full bg-zinc-600 rounded-full"
            style={{ 
              left: `${windowLeftPercentage}%`, 
              width: `${windowWidthPercentage}%` 
            }}
          />
          {/* Start and end dots */}
          <div className="absolute w-2 h-2 rounded-full bg-pink-500 top-1/2 -translate-y-1/2 -ml-1" style={{ left: `${windowLeftPercentage}%` }} />
          <div className="absolute w-2 h-2 rounded-full bg-pink-500 top-1/2 -translate-y-1/2 -ml-1" style={{ left: `${windowLeftPercentage + windowWidthPercentage}%` }} />
          
          {/* Current playing dot */}
          <div className="absolute w-4 h-4 rounded-full bg-white top-1/2 -translate-y-1/2 -ml-2 shadow-sm transition-all duration-75" 
               style={{ left: `${currentTimePercentage}%` }} 
          />
        </div>
      </div>

      {/* Waveform Area */}
      <div 
        className="relative h-20 w-full cursor-pointer group"
        ref={containerRef}
        onPointerDown={handlePointerDown}
      >
        {/* Background Waveform Bars */}
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
          {waveformBars.map((height, i) => (
            <div 
              key={i} 
              className="w-1.5 bg-zinc-600 rounded-full opacity-60"
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>

        {/* Colored Draggable Window Overlay */}
        <div 
          className="absolute h-[110%] -top-[5%] rounded-lg shadow-2xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 pointer-events-none overflow-hidden transition-all duration-75"
          style={{ 
            left: `${windowLeftPercentage}%`, 
            width: `${windowWidthPercentage}%` 
          }}
        >
          {/* We must draw the SAME bars inside the window, but colored white to show the "cutout" effect */}
          {/* To do this accurately across responsive widths, we render the exact same flex container but absolutely positioned relative to the window, shifting it back by the window's left position */}
          <div 
            className="absolute inset-0 flex items-center justify-between"
            style={{ 
              width: `${(100 / windowWidthPercentage) * 100}%`,
              left: `-${(windowLeftPercentage / windowWidthPercentage) * 100}%`
            }}
          >
            {waveformBars.map((height, i) => (
              <div 
                key={i} 
                className="w-1.5 bg-white rounded-full opacity-90 shadow-sm"
                style={{ height: `${height * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
