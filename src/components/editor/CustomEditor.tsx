import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, Music, Wand2, Check, Sliders, RotateCw, 
  FlipHorizontal, FlipVertical, Crop, FastForward, 
  Volume2, VolumeX, Scissors, Download, Palette, Layers,
  Upload, X
} from 'lucide-react';
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
  title = 'Pro Editor Studio'
}: CustomEditorProps) {
  const [activeTab, setActiveTab] = useState<'filters' | 'adjust' | 'color' | 'transform' | 'video' | 'audio' | 'export'>('filters');
  const [selectedFilter, setSelectedFilter] = useState<string>('normal');
  const [adjustments, setAdjustments] = useState({ brightness: 100, contrast: 100, saturation: 100, vignette: 0, noise: 0, blur: 0, sharpen: 0 });
  const [color, setColor] = useState({ hue: 0, gamma: 100, temperature: 0 });
  const [transforms, setTransforms] = useState({ flipH: false, flipV: false, rotate: 0, ratio: 'original' });
  const [videoConfig, setVideoConfig] = useState({ speed: 1, trimStart: 0, trimEnd: 100 });
  const [duration, setDuration] = useState(0);
  const [audioConfig, setAudioConfig] = useState({ volume: 100, muted: false, selectedMusic: null as Track | null });
  const [exportSettings, setExportSettings] = useState({ quality: 80, format: mediaType === 'video' ? 'mp4' : 'jpg' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('Initializing Studio...');
  
  const ffmpegRef = useRef(new FFmpeg());
  const mediaRef = useRef<HTMLVideoElement & HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadFFmpeg = async () => {
      const ffmpeg = ffmpegRef.current;
      if (ffmpeg.loaded) return;
      try {
        await ffmpeg.load({
          coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
          wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
        });
        setMessage('Ready');
      } catch (e) {
        setMessage('Ready (Limited Mode)');
      }
    };
    loadFFmpeg();
  }, []);

  useEffect(() => {
    if (mediaRef.current && mediaType === 'video') {
      mediaRef.current.playbackRate = videoConfig.speed;
      mediaRef.current.volume = audioConfig.muted ? 0 : audioConfig.volume / 100;
      
      const handleTimeUpdate = () => {
        if (!mediaRef.current) return;
        const endTime = (videoConfig.trimEnd / 100) * duration;
        const startTime = (videoConfig.trimStart / 100) * duration;
        if (mediaRef.current.currentTime >= endTime) {
          mediaRef.current.currentTime = startTime;
        }
      };
      
      mediaRef.current.addEventListener('timeupdate', handleTimeUpdate);
      return () => mediaRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [videoConfig.speed, videoConfig.trimStart, videoConfig.trimEnd, audioConfig.volume, audioConfig.muted, mediaType, duration]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioConfig(prev => ({
        ...prev,
        selectedMusic: {
          id: `custom-${Date.now()}`,
          title: file.name,
          artist: 'Local Upload',
          audioUrl: url,
          duration: '0:00',
          coverUrl: ''
        } as any
      }));
    }
    if (e.target) e.target.value = '';
  };

  const getPreviewStyle = () => {
    let filter = '';
    switch (selectedFilter) {
      case 'grayscale': filter += 'grayscale(100%) '; break;
      case 'sepia': filter += 'sepia(100%) '; break;
      case 'vintage': filter += 'sepia(50%) contrast(150%) saturate(120%) '; break;
      case 'dramatic': filter += 'contrast(180%) saturate(80%) brightness(90%) '; break;
      case 'cyberpunk': filter += 'hue-rotate(90deg) saturate(200%) contrast(120%) '; break;
      case 'film': filter += 'contrast(110%) saturate(90%) sepia(20%) '; break;
    }
    
    filter += `brightness(${adjustments.brightness}%) `;
    filter += `contrast(${adjustments.contrast}%) `;
    filter += `saturate(${adjustments.saturation}%) `;
    filter += `hue-rotate(${color.hue}deg) `;
    
    if (color.temperature !== 0) {
      filter += color.temperature > 0 ? `sepia(${color.temperature / 2}%) ` : `saturate(${100 + color.temperature}%) `;
    }
    if (adjustments.blur > 0) filter += `blur(${adjustments.blur / 10}px) `;

    let transform = '';
    if (transforms.flipH) transform += 'scaleX(-1) ';
    if (transforms.flipV) transform += 'scaleY(-1) ';
    if (transforms.rotate) transform += `rotate(${transforms.rotate}deg) `;

    return { filter: filter.trim(), transform: transform.trim() };
  };

  const handleSave = async () => {
    if (!initialMediaUrl) {
      onClose();
      return;
    }

    setIsProcessing(true);
    try {
      if (!ffmpegRef.current.loaded) {
        const response = await fetch(initialMediaUrl);
        const blob = await response.blob();
        onSave(blob, blob.type);
        return;
      }

      const ffmpeg = ffmpegRef.current;
      setMessage('Preparing workspace...');

      const inputExt = mediaType === 'video' ? 'mp4' : 'jpg';
      const outputExt = exportSettings.format;
      const inputMediaName = `input.${inputExt}`;
      const outputName = `output.${outputExt}`;

      await ffmpeg.writeFile(inputMediaName, await fetchFile(initialMediaUrl));
      if (audioConfig.selectedMusic) {
        await ffmpeg.writeFile('audio.mp3', await fetchFile(audioConfig.selectedMusic.audioUrl));
      }

      setMessage('Rendering pipeline...');

      const vf: string[] = [];
      
      if (transforms.ratio === '1:1') vf.push("crop='min(iw,ih)':'min(iw,ih)'");
      else if (transforms.ratio === '4:5') vf.push("crop='min(iw,ih*(4/5))':'min(ih,iw*(5/4))'");
      else if (transforms.ratio === '16:9') vf.push("crop='min(iw,ih*(16/9))':'min(ih,iw*(9/16))'");

      if (transforms.flipH) vf.push('hflip');
      if (transforms.flipV) vf.push('vflip');
      if (transforms.rotate === 90) vf.push('transpose=1');
      if (transforms.rotate === 180) vf.push('transpose=1,transpose=1');
      if (transforms.rotate === 270) vf.push('transpose=2');

      switch (selectedFilter) {
        case 'grayscale': vf.push('colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3'); break;
        case 'sepia': vf.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131'); break;
        case 'vintage': vf.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131', 'eq=contrast=1.5:brightness=-0.1:saturation=1.2'); break;
        case 'dramatic': vf.push('eq=contrast=1.8:saturation=0.8:brightness=-0.1'); break;
        case 'cyberpunk': vf.push('hue=h=90', 'eq=saturation=2:contrast=1.2'); break;
        case 'film': vf.push('eq=contrast=1.1:saturation=0.9', 'colorbalance=rs=.2:gs=.1:bs=-.1'); break;
      }

      const b = (adjustments.brightness - 100) / 100;
      const c = adjustments.contrast / 100;
      const s = adjustments.saturation / 100;
      const g = color.gamma / 100;
      if (b !== 0 || c !== 1 || s !== 1 || g !== 1) {
        vf.push(`eq=brightness=${b}:contrast=${c}:saturation=${s}:gamma=${g}`);
      }

      if (color.hue !== 0) vf.push(`hue=h=${color.hue}`);
      
      if (color.temperature !== 0) {
        const t = color.temperature / 100;
        vf.push(`colorbalance=rs=${t > 0 ? t : 0}:bs=${t < 0 ? Math.abs(t) : 0}`);
      }

      if (adjustments.blur > 0) vf.push(`boxblur=${Math.floor(adjustments.blur / 10) + 1}:1`);
      if (adjustments.sharpen > 0) vf.push(`unsharp=5:5:${adjustments.sharpen / 20}:5:5:0.0`);
      if (adjustments.vignette > 0) vf.push(`vignette='PI*${(adjustments.vignette / 100) * 0.5}'`);
      if (adjustments.noise > 0) vf.push(`noise=alls=${Math.floor((adjustments.noise / 100) * 50)}:allf=t+u`);

      if (mediaType === 'video' && videoConfig.speed !== 1) {
        vf.push(`setpts=${1/videoConfig.speed}*PTS`);
      }

      if (outputExt === 'mp4' || outputExt === 'webm') {
        vf.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
        vf.push('format=yuv420p');
      }

      const af: string[] = [];
      if (mediaType === 'video' && videoConfig.speed !== 1 && !audioConfig.selectedMusic) af.push(`atempo=${videoConfig.speed}`);
      if (audioConfig.muted) af.push('volume=0');
      else if (audioConfig.volume !== 100) af.push(`volume=${audioConfig.volume/100}`);

      const vfStr = vf.join(',');
      const afStr = af.join(',');

      let execArgs: string[] = [];

      let startTimeStr = "0";
      let durationStr = "0";
      if (mediaType === 'video' && duration > 0) {
        const startSec = (videoConfig.trimStart / 100) * duration;
        const endSec = (videoConfig.trimEnd / 100) * duration;
        startTimeStr = startSec.toFixed(3);
        durationStr = (endSec - startSec).toFixed(3);
      }

      if (mediaType === 'image') {
        if (audioConfig.selectedMusic && (outputExt === 'mp4' || outputExt === 'webm')) {
          execArgs = ['-loop', '1', '-framerate', '30', '-i', inputMediaName, '-i', 'audio.mp3', '-c:v', 'libx264'];
          if (vfStr) execArgs.push('-vf', vfStr);
          execArgs.push('-c:a', 'aac');
          if (afStr) execArgs.push('-af', afStr);
          execArgs.push('-b:a', '192k', '-shortest', outputName);
        } else {
          execArgs = ['-i', inputMediaName];
          if (vfStr) execArgs.push('-vf', vfStr);
          if (outputExt === 'webp') execArgs.push('-qscale', Math.floor(100 - exportSettings.quality).toString());
          else if (outputExt === 'jpg') execArgs.push('-q:v', Math.floor((100 - exportSettings.quality) / 10 + 2).toString());
          execArgs.push(outputName);
        }
      } else {
        execArgs = ['-i', inputMediaName];
        if (audioConfig.selectedMusic) execArgs.push('-i', 'audio.mp3');
        
        if (mediaType === 'video' && duration > 0) {
          execArgs.push('-ss', startTimeStr, '-t', durationStr);
        }

        execArgs.push('-c:v', outputExt === 'webm' ? 'libvpx-vp9' : 'libx264');
        
        if (vfStr) execArgs.push('-vf', vfStr);
        
        if (outputExt === 'mp4' || outputExt === 'webm') {
          const crf = Math.floor(51 - (exportSettings.quality / 100) * 51);
          execArgs.push('-crf', crf.toString());
        }

        if (audioConfig.selectedMusic) {
          execArgs.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', outputExt === 'webm' ? 'libvorbis' : 'aac');
          if (afStr) execArgs.push('-af', afStr);
          execArgs.push('-shortest');
        } else {
          if (afStr) execArgs.push('-c:a', outputExt === 'webm' ? 'libvorbis' : 'aac', '-af', afStr);
          else execArgs.push('-c:a', 'copy');
        }
        
        execArgs.push(outputName);
      }

      await ffmpeg.exec(execArgs);
      
      setMessage('Finalizing build...');
      const data = await ffmpeg.readFile(outputName);
      let mime = 'application/octet-stream';
      if (outputExt === 'mp4') mime = 'video/mp4';
      if (outputExt === 'webm') mime = 'video/webm';
      if (outputExt === 'jpg') mime = 'image/jpeg';
      if (outputExt === 'png') mime = 'image/png';
      if (outputExt === 'webp') mime = 'image/webp';
      
      const blob = new Blob([(data as Uint8Array).buffer], { type: mime });
      onSave(blob, mime, audioConfig.selectedMusic?.title);
    } catch (err) {
      console.error(err);
      const response = await fetch(initialMediaUrl);
      const blob = await response.blob();
      onSave(blob, blob.type);
    } finally {
      setIsProcessing(false);
    }
  };

  const getMimeTypes = () => {
    if (mediaType === 'video') return [{ id: 'mp4', label: 'MP4 (H.264)' }, { id: 'webm', label: 'WebM (VP9)' }];
    return [{ id: 'jpg', label: 'JPEG' }, { id: 'png', label: 'PNG' }, { id: 'webp', label: 'WebP' }];
  };

  return (
    <div className="fixed inset-0 z-[700] bg-[#050505] flex flex-col font-sans select-none">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-[#0a0a0a]">
        <button 
          onClick={onClose} 
          disabled={isProcessing}
          className="text-zinc-400 hover:text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
           <Layers className="w-4 h-4 text-indigo-500" />
           <h2 className="text-white font-bold tracking-wide text-sm">{title}</h2>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isProcessing}
          className="bg-white hover:bg-zinc-200 text-black px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Exporting</>
          ) : (
            <>Export <Download className="w-4 h-4 ml-0.5" /></>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row bg-[#050505]">
        {isProcessing && (
          <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-md">
             <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex flex-col items-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
               <div className="relative w-16 h-16 mb-6 flex items-center justify-center">
                 <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
                 <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                 <Wand2 className="w-6 h-6 text-indigo-400" />
               </div>
               <h3 className="text-white font-bold text-lg mb-2">Processing Media</h3>
               <p className="text-zinc-400 text-sm font-medium">{message}</p>
             </div>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIklEQVQ4T2NkYGD4z8DAwMgQI8CowagBowYQA8NJhAwMIwAC/hIC3Y90CQAAAABJRU5ErkJggg==')]">
          <div 
            className="w-full max-w-[500px] bg-black rounded-sm overflow-hidden relative shadow-2xl flex items-center justify-center ring-1 ring-white/10"
            style={{ 
              aspectRatio: transforms.ratio === 'original' ? '9/16' : transforms.ratio.replace(':', '/'),
              maxHeight: '100%'
            }}
          >
            {initialMediaUrl ? (
              <>
                {mediaType === 'video' ? (
                  <video 
                    ref={mediaRef as any}
                    src={initialMediaUrl} 
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    className="w-full h-full transition-all duration-200" 
                    style={{ 
                      objectFit: transforms.ratio === 'original' ? 'contain' : 'cover', 
                      ...getPreviewStyle() 
                    }}
                    autoPlay loop playsInline muted={audioConfig.muted || !!audioConfig.selectedMusic} 
                  />
                ) : (
                  <img 
                    ref={mediaRef as any}
                    src={initialMediaUrl} 
                    className="w-full h-full transition-all duration-200" 
                    style={{ 
                      objectFit: transforms.ratio === 'original' ? 'contain' : 'cover', 
                      ...getPreviewStyle() 
                    }}
                    alt="Preview" 
                  />
                )}
                
                {adjustments.vignette > 0 && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${adjustments.vignette / 100}) 120%)` }}
                  />
                )}
                
                {adjustments.noise > 0 && (
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-50 mix-blend-overlay"
                    style={{ 
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, 
                      opacity: adjustments.noise / 100 
                    }}
                  />
                )}
              </>
            ) : (
               <div className="flex flex-col items-center gap-3 text-white/30">
                 <Layers className="w-10 h-10" />
                 <p className="text-sm font-medium">No media selected</p>
               </div>
            )}
          </div>
        </div>

        <div className="w-full md:w-[400px] bg-[#0a0a0a] border-t md:border-t-0 md:border-l border-zinc-800/80 flex flex-col z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex w-full border-b border-zinc-800/80 overflow-x-auto scrollbar-none px-2 py-1">
            {[
              { id: 'filters', icon: Wand2, label: 'Filters' },
              { id: 'adjust', icon: Sliders, label: 'Adjust' },
              { id: 'color', icon: Palette, label: 'Color' },
              { id: 'transform', icon: Crop, label: 'Layout' },
              ...(mediaType === 'video' ? [{ id: 'video', icon: Scissors, label: 'Video' }] : []),
              { id: 'audio', icon: Music, label: 'Audio' },
              { id: 'export', icon: Download, label: 'Export' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[70px] py-4 text-[10px] font-bold flex flex-col items-center justify-center gap-2 transition-all uppercase tracking-widest rounded-lg ${activeTab === tab.id ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''}`} /> 
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {activeTab === 'filters' && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'normal', name: 'Original' },
                  { id: 'film', name: 'Kodak 400' },
                  { id: 'vintage', name: '1977' },
                  { id: 'dramatic', name: 'Cinematic' },
                  { id: 'cyberpunk', name: 'Neon City' },
                  { id: 'grayscale', name: 'Noir' },
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`group flex flex-col items-center gap-3 p-2 rounded-2xl transition-all ${selectedFilter === filter.id ? 'bg-indigo-500/10' : 'hover:bg-zinc-900'}`}
                  >
                    <div className={`w-full aspect-[3/4] rounded-xl bg-zinc-800 bg-cover bg-center overflow-hidden relative transition-all ${selectedFilter === filter.id ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#0a0a0a]' : 'group-hover:ring-1 ring-zinc-700 ring-offset-2 ring-offset-[#0a0a0a]'}`}>
                       <img src={initialMediaUrl} className="w-full h-full object-cover" style={{ filter: getPreviewStyle().filter }} alt="" />
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${selectedFilter === filter.id ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                      {filter.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'adjust' && (
              <div className="space-y-8">
                {(['brightness', 'contrast', 'saturation', 'vignette', 'noise', 'blur', 'sharpen'] as const).map(setting => (
                  <div key={setting} className="space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-zinc-400">
                      <span>{setting}</span>
                      <span className="text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md">{adjustments[setting]}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max={['vignette', 'noise', 'blur', 'sharpen'].includes(setting) ? "100" : "200"} 
                      value={adjustments[setting]}
                      onChange={(e) => setAdjustments(prev => ({ ...prev, [setting]: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white"
                    />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'color' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-zinc-400">
                    <span>Hue Shift</span>
                    <span className="text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md">{color.hue}°</span>
                  </div>
                  <input type="range" min="0" max="360" value={color.hue} onChange={(e) => setColor(prev => ({...prev, hue: parseInt(e.target.value)}))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }} />
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-zinc-400">
                    <span>Temperature</span>
                    <span className="text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md">{color.temperature}</span>
                  </div>
                  <input type="range" min="-100" max="100" value={color.temperature} onChange={(e) => setColor(prev => ({...prev, temperature: parseInt(e.target.value)}))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ background: 'linear-gradient(to right, #4361ee, #4cc9f0, #e9ecef, #f72585, #7209b7)' }} />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-zinc-400">
                    <span>Gamma</span>
                    <span className="text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md">{(color.gamma / 100).toFixed(2)}</span>
                  </div>
                  <input type="range" min="10" max="300" value={color.gamma} onChange={(e) => setColor(prev => ({...prev, gamma: parseInt(e.target.value)}))} className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white" />
                </div>
              </div>
            )}

            {activeTab === 'transform' && (
              <div className="space-y-10">
                <div className="space-y-4">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-4">Format</span>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'original', label: 'Free', ratio: 'auto' },
                      { id: '1:1', label: '1:1 IG', ratio: '1/1' },
                      { id: '4:5', label: '4:5 Post', ratio: '4/5' },
                      { id: '16:9', label: '16:9 YT', ratio: '16/9' },
                    ].map(r => (
                      <button 
                        key={r.id}
                        onClick={() => setTransforms(prev => ({ ...prev, ratio: r.id }))}
                        className={`py-4 rounded-2xl border-2 font-bold text-xs transition-all flex flex-col items-center gap-3 uppercase tracking-wider ${transforms.ratio === r.id ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-transparent border-zinc-800 hover:border-zinc-600 text-zinc-400'}`}
                      >
                        <div className="w-6 h-6 border-2 border-current rounded-[4px]" style={{ aspectRatio: r.ratio }} />
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                   <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-4">Rotate & Flip</span>
                   <div className="grid grid-cols-3 gap-4">
                    <button onClick={() => setTransforms(prev => ({ ...prev, rotate: (prev.rotate + 90) % 360 }))} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 transition-all text-zinc-300">
                      <RotateCw className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">90°</span>
                    </button>
                    <button onClick={() => setTransforms(prev => ({ ...prev, flipH: !prev.flipH }))} className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all ${transforms.flipH ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'}`}>
                      <FlipHorizontal className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Horiz</span>
                    </button>
                    <button onClick={() => setTransforms(prev => ({ ...prev, flipV: !prev.flipV }))} className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all ${transforms.flipV ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'}`}>
                      <FlipVertical className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Vert</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'video' && mediaType === 'video' && (
              <div className="space-y-10">
                <div className="space-y-6">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">Trim Timeline</span>
                  <div className="px-2 space-y-4">
                    <div className="h-16 bg-zinc-900 rounded-xl border border-zinc-800 relative overflow-hidden flex items-center px-1">
                      <div className="absolute top-0 bottom-0 bg-indigo-500/20 border-y-2 border-indigo-500" style={{ left: `${videoConfig.trimStart}%`, width: `${videoConfig.trimEnd - videoConfig.trimStart}%` }} />
                      <div className="absolute top-0 bottom-0 w-2 bg-white rounded-full cursor-ew-resize -ml-1 z-10 shadow-lg" style={{ left: `${videoConfig.trimStart}%` }} />
                      <div className="absolute top-0 bottom-0 w-2 bg-white rounded-full cursor-ew-resize -ml-1 z-10 shadow-lg" style={{ left: `${videoConfig.trimEnd}%` }} />
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Start %</label>
                         <input type="range" min="0" max={videoConfig.trimEnd - 5} value={videoConfig.trimStart} onChange={(e) => setVideoConfig(prev => ({...prev, trimStart: parseInt(e.target.value)}))} className="w-full accent-indigo-500" />
                      </div>
                      <div className="flex-1 space-y-2">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">End %</label>
                         <input type="range" min={videoConfig.trimStart + 5} max="100" value={videoConfig.trimEnd} onChange={(e) => setVideoConfig(prev => ({...prev, trimEnd: parseInt(e.target.value)}))} className="w-full accent-indigo-500" />
                      </div>
                    </div>
                    <div className="text-center text-xs text-zinc-400 font-mono">
                       Duration: {((videoConfig.trimEnd - videoConfig.trimStart) / 100 * duration).toFixed(1)}s
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-4">Speed Control</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[0.5, 1, 1.5, 2].map(s => (
                      <button key={s} onClick={() => setVideoConfig(prev => ({...prev, speed: s}))} className={`py-3 rounded-xl font-bold text-xs transition-all ${videoConfig.speed === s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-10">
                <div className="space-y-6">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">Primary Audio</span>
                  <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800/80">
                    <div className="flex items-center gap-6">
                      <button onClick={() => setAudioConfig(prev => ({...prev, muted: !prev.muted}))} className={`p-4 rounded-xl transition-all ${audioConfig.muted ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                        {audioConfig.muted ? <VolumeX className="w-6 h-6"/> : <Volume2 className="w-6 h-6"/>}
                      </button>
                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                           <span>Volume</span>
                           <span className="text-white">{audioConfig.muted ? 0 : audioConfig.volume}%</span>
                        </div>
                        <input type="range" min="0" max="200" value={audioConfig.muted ? 0 : audioConfig.volume} onChange={(e) => setAudioConfig(prev => ({...prev, volume: parseInt(e.target.value), muted: false}))} className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Soundtrack</span>
                      <p className="text-[11px] text-zinc-400">Mix in a new track or upload your own.</p>
                    </div>
                    <input 
                      type="file" 
                      accept="audio/*" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleAudioUpload}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-indigo-500/30"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload
                    </button>
                  </div>
                  
                  {audioConfig.selectedMusic?.id.toString().startsWith('custom-') ? (
                    <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-xl flex items-center justify-between mt-4">
                       <div className="flex items-center gap-3 overflow-hidden">
                         <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                           <Music className="w-5 h-5 text-indigo-400" />
                         </div>
                         <div className="truncate pr-4">
                           <p className="text-sm font-bold text-white truncate">{audioConfig.selectedMusic.title}</p>
                           <p className="text-xs text-indigo-300 truncate">Local Audio File</p>
                         </div>
                       </div>
                       <button 
                         onClick={() => setAudioConfig(prev => ({...prev, selectedMusic: null}))}
                         className="text-zinc-500 hover:text-white p-2 flex-shrink-0 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"
                       >
                         <X className="w-4 h-4" />
                       </button>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <MusicPicker onSelect={(m) => setAudioConfig(prev => ({...prev, selectedMusic: m}))} selected={audioConfig.selectedMusic} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'export' && (
              <div className="space-y-10">
                <div className="space-y-4">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-4">Export Format</span>
                  <div className="grid grid-cols-2 gap-4">
                     {getMimeTypes().map(format => (
                        <button key={format.id} onClick={() => setExportSettings(prev => ({...prev, format: format.id}))} className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 uppercase tracking-wider ${exportSettings.format === format.id ? 'bg-white text-black border-white shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
                           {format.label}
                        </button>
                     ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-zinc-400">
                    <span>Render Quality</span>
                    <span className="text-zinc-500 bg-zinc-900 px-3 py-1 rounded-md">{exportSettings.quality}%</span>
                  </div>
                  <div className="px-2">
                     <input type="range" min="10" max="100" value={exportSettings.quality} onChange={(e) => setExportSettings(prev => ({...prev, quality: parseInt(e.target.value)}))} className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-green-500" />
                     <div className="flex justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-3">
                        <span>Fast / Smaller</span>
                        <span>Best Quality</span>
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
