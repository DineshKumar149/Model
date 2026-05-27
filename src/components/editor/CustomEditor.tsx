import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Music, Wand2, Check } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import MusicPicker, { Track } from '@/components/shared/MusicPicker';

interface CustomEditorProps {
  onSave: (blob: Blob, mimeType: string, musicTitle?: string) => void;
  onClose: () => void;
  initialMediaUrl?: string;
  mediaType?: 'image' | 'video';
  title?: string;
}

export default function CustomEditor({
  onSave,
  onClose,
  initialMediaUrl,
  mediaType = 'image',
  title = 'Advanced Editor'
}: CustomEditorProps) {
  const [selectedMusic, setSelectedMusic] = useState<Track | null>(null);
  const [activeTab, setActiveTab] = useState<'filters' | 'music'>('filters');
  const [selectedFilter, setSelectedFilter] = useState<string>('normal');
  const [isProcessing, setIsProcessing] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const [message, setMessage] = useState('Loading...');

  const loadFFmpeg = async () => {
    const ffmpeg = ffmpegRef.current;
    if (ffmpeg.loaded) return;
    
    ffmpeg.on('log', ({ message }) => console.log(message));
    try {
      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      });
      setMessage('Ready');
    } catch (e) {
      console.error('Failed to load FFmpeg:', e);
      setMessage('Ready (No FFmpeg)');
    }
  };

  useEffect(() => {
    loadFFmpeg();
  }, []);

  const getFilterCSS = (filter: string) => {
    switch(filter) {
      case 'grayscale': return 'grayscale(100%)';
      case 'sepia': return 'sepia(100%)';
      case 'blur': return 'blur(4px)';
      default: return 'none';
    }
  };

  const getFFmpegFilterStr = (filter: string) => {
    switch(filter) {
      case 'grayscale': return 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3';
      case 'sepia': return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
      case 'blur': return 'boxblur=5:1';
      default: return '';
    }
  };

  const handleSave = async () => {
    if (!initialMediaUrl) {
      onClose();
      return;
    }
    
    setIsProcessing(true);
    try {
      const needsFFmpeg = selectedMusic || selectedFilter !== 'normal';

      if (!needsFFmpeg || !ffmpegRef.current.loaded) {
        // No modifications or FFmpeg failed, just return original
        const response = await fetch(initialMediaUrl);
        const blob = await response.blob();
        onSave(blob, blob.type);
        return;
      }

      // Merge with FFmpeg
      const ffmpeg = ffmpegRef.current;
      setMessage('Downloading media...');
      
      const inputMediaName = mediaType === 'video' ? 'input.mp4' : 'input.jpg';
      const outputName = 'output.mp4';
      
      await ffmpeg.writeFile(inputMediaName, await fetchFile(initialMediaUrl));
      
      const vfStr = getFFmpegFilterStr(selectedFilter);

      if (selectedMusic) {
        await ffmpeg.writeFile('audio.mp3', await fetchFile(selectedMusic.audioUrl));
      }

      setMessage('Processing media... (This might take a moment)');
      
      if (mediaType === 'image') {
        if (selectedMusic) {
          let execArgs = ['-loop', '1', '-framerate', '30', '-i', inputMediaName, '-i', 'audio.mp3', '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k'];
          const scaleFilter = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
          if (vfStr) {
              execArgs = [...execArgs, '-vf', `${scaleFilter},format=yuv420p,${vfStr}`];
          } else {
              execArgs = [...execArgs, '-vf', `${scaleFilter},format=yuv420p`];
          }
          execArgs = [...execArgs, '-shortest', outputName];
          await ffmpeg.exec(execArgs);
          
          setMessage('Finalizing...');
          const data = await ffmpeg.readFile(outputName);
          const blob = new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
          onSave(blob, 'video/mp4', selectedMusic?.title);
        } else {
          // Just image with filter
          const outImg = 'output.jpg';
          let execArgs = ['-i', inputMediaName];
          if (vfStr) execArgs = [...execArgs, '-vf', vfStr];
          execArgs = [...execArgs, outImg];
          await ffmpeg.exec(execArgs);
          
          setMessage('Finalizing...');
          const data = await ffmpeg.readFile(outImg);
          const blob = new Blob([(data as Uint8Array).buffer], { type: 'image/jpeg' });
          onSave(blob, 'image/jpeg');
        }
      } else {
        // Merge video and audio. Replace original audio.
        let execArgs = ['-i', inputMediaName];
        if (selectedMusic) {
            execArgs = [...execArgs, '-i', 'audio.mp3'];
            if (vfStr) {
                execArgs = [...execArgs, '-c:v', 'libx264', '-vf', `scale=trunc(iw/2)*2:trunc(ih/2)*2,${vfStr}`];
            } else {
                execArgs = [...execArgs, '-c:v', 'copy'];
            }
            execArgs = [...execArgs, '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', outputName];
        } else {
            // Video with filter but no new music (keep original audio if any)
            if (vfStr) {
                execArgs = [...execArgs, '-c:v', 'libx264', '-vf', `scale=trunc(iw/2)*2:trunc(ih/2)*2,${vfStr}`, '-c:a', 'copy', outputName];
            } else {
                // This shouldn't be reached due to !needsFFmpeg check, but just in case
                execArgs = [...execArgs, '-c:v', 'copy', '-c:a', 'copy', outputName];
            }
        }
        await ffmpeg.exec(execArgs);
        
        setMessage('Finalizing...');
        const data = await ffmpeg.readFile(outputName);
        const blob = new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
        onSave(blob, 'video/mp4', selectedMusic?.title);
      }
    } catch (err) {
      console.error(err);
      // Fallback
      const response = await fetch(initialMediaUrl);
      const blob = await response.blob();
      onSave(blob, blob.type);
    } finally {
      setIsProcessing(false);
    }
  };

  const filters = [
    { id: 'normal', name: 'Normal' },
    { id: 'grayscale', name: 'B & W' },
    { id: 'sepia', name: 'Sepia' },
    { id: 'blur', name: 'Blur' },
  ];

  return (
    <div className="fixed inset-0 z-[700] bg-[#000] flex flex-col font-sans">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black">
        <button 
          onClick={onClose} 
          disabled={isProcessing}
          className="text-white hover:text-white/80 px-4 py-2 font-medium transition-colors disabled:opacity-50"
        >
          Discard
        </button>
        <h2 className="text-white font-semibold tracking-tight">{title}</h2>
        <button 
          onClick={handleSave} 
          disabled={isProcessing}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
          {isProcessing ? 'Processing' : 'Continue'}
          {!isProcessing && <Check className="w-4 h-4 ml-1" />}
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row bg-[#0a0a0c]">
        {isProcessing && (
          <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
             <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center shadow-2xl">
               <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
               <p className="text-white font-medium text-center">{message}</p>
             </div>
          </div>
        )}

        {/* Media Preview Area */}
        <div className="flex-1 flex items-center justify-center p-4 relative">
          <div className="w-full max-w-[400px] aspect-[9/16] bg-black rounded-xl overflow-hidden relative shadow-2xl border border-zinc-800/50">
            {initialMediaUrl ? (
              mediaType === 'video' ? (
                <video 
                  src={initialMediaUrl} 
                  className="w-full h-full object-cover transition-all duration-300" 
                  style={{ filter: getFilterCSS(selectedFilter) }}
                  autoPlay loop playsInline muted={!!selectedMusic} 
                />
              ) : (
                <img 
                  src={initialMediaUrl} 
                  className="w-full h-full object-cover transition-all duration-300" 
                  style={{ filter: getFilterCSS(selectedFilter) }}
                  alt="Preview" 
                />
              )
            ) : (
               <p className="text-white/50 flex items-center justify-center h-full">No media selected</p>
            )}
          </div>
        </div>

        {/* Sidebar / Bottom Tools Panel */}
        <div className="w-full md:w-[350px] bg-zinc-900/90 border-t md:border-t-0 md:border-l border-zinc-800 flex flex-col z-10">
          
          {/* Tool Tabs */}
          <div className="flex w-full border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('filters')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'filters' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Wand2 className="w-4 h-4" /> Filters
            </button>
            <button
              onClick={() => setActiveTab('music')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'music' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Music className="w-4 h-4" /> Music
            </button>
          </div>

          {/* Tool Content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {activeTab === 'filters' && (
              <div className="grid grid-cols-2 gap-3">
                {filters.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${selectedFilter === filter.id ? 'bg-indigo-600/20 border-indigo-500' : 'bg-zinc-800/50 border-transparent hover:bg-zinc-800'}`}
                  >
                    <div 
                      className="w-full aspect-square rounded-lg bg-zinc-700 bg-cover bg-center"
                      style={{ 
                        backgroundImage: `url(${initialMediaUrl})`,
                        filter: getFilterCSS(filter.id)
                      }}
                    />
                    <span className={`text-xs font-medium ${selectedFilter === filter.id ? 'text-indigo-400' : 'text-zinc-300'}`}>
                      {filter.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'music' && (
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 px-1">Choose a soundtrack for your post. It will automatically loop for images or merge with your video.</p>
                <MusicPicker onSelect={setSelectedMusic} selected={selectedMusic} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
