import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Music, Wand2, Check, Sliders, RotateCw, FlipHorizontal, FlipVertical, Crop, FastForward, Volume2, VolumeX } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'filters' | 'adjust' | 'transform' | 'speed' | 'audio'>('filters');
  const [selectedFilter, setSelectedFilter] = useState<string>('normal');
  const [adjustments, setAdjustments] = useState({ brightness: 100, contrast: 100, saturation: 100, vignette: 0, noise: 0 });
  const [transforms, setTransforms] = useState({ flipH: false, flipV: false, rotate: 0, ratio: 'original' });
  const [speed, setSpeed] = useState(1);
  const [audioConfig, setAudioConfig] = useState({ volume: 100, muted: false, selectedMusic: null as Track | null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('Loading...');
  
  const ffmpegRef = useRef(new FFmpeg());
  const mediaRef = useRef<HTMLVideoElement & HTMLImageElement>(null);

  useEffect(() => {
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
    loadFFmpeg();
  }, []);

  useEffect(() => {
    if (mediaRef.current && mediaType === 'video') {
      mediaRef.current.playbackRate = speed;
      mediaRef.current.volume = audioConfig.muted ? 0 : audioConfig.volume / 100;
    }
  }, [speed, audioConfig.volume, audioConfig.muted, mediaType]);

  const getPreviewStyle = () => {
    let filter = '';
    switch (selectedFilter) {
      case 'grayscale': filter += 'grayscale(100%) '; break;
      case 'sepia': filter += 'sepia(100%) '; break;
      case 'blur': filter += 'blur(6px) '; break;
      case 'invert': filter += 'invert(100%) '; break;
      case 'vintage': filter += 'sepia(50%) contrast(150%) saturate(120%) '; break;
      case 'dramatic': filter += 'contrast(180%) saturate(80%) brightness(90%) '; break;
    }
    filter += `brightness(${adjustments.brightness}%) `;
    filter += `contrast(${adjustments.contrast}%) `;
    filter += `saturate(${adjustments.saturation}%) `;

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
      const needsFFmpeg = 
        audioConfig.selectedMusic || 
        selectedFilter !== 'normal' ||
        adjustments.brightness !== 100 ||
        adjustments.contrast !== 100 ||
        adjustments.saturation !== 100 ||
        adjustments.vignette !== 0 ||
        adjustments.noise !== 0 ||
        transforms.flipH ||
        transforms.flipV ||
        transforms.rotate !== 0 ||
        transforms.ratio !== 'original' ||
        speed !== 1 ||
        audioConfig.volume !== 100 ||
        audioConfig.muted;

      if (!needsFFmpeg || !ffmpegRef.current.loaded) {
        const response = await fetch(initialMediaUrl);
        const blob = await response.blob();
        onSave(blob, blob.type);
        return;
      }

      const ffmpeg = ffmpegRef.current;
      setMessage('Preparing workspace...');

      const inputExt = mediaType === 'video' ? 'mp4' : 'jpg';
      const outputExt = mediaType === 'video' || audioConfig.selectedMusic ? 'mp4' : 'jpg';
      const inputMediaName = `input.${inputExt}`;
      const outputName = `output.${outputExt}`;

      await ffmpeg.writeFile(inputMediaName, await fetchFile(initialMediaUrl));
      if (audioConfig.selectedMusic) {
        await ffmpeg.writeFile('audio.mp3', await fetchFile(audioConfig.selectedMusic.audioUrl));
      }

      setMessage('Processing media...');

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
        case 'blur': vf.push('boxblur=7:1'); break;
        case 'invert': vf.push('negate'); break;
        case 'vintage': vf.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131', 'eq=contrast=1.5:brightness=-0.1:saturation=1.2'); break;
        case 'dramatic': vf.push('eq=contrast=1.8:saturation=0.8:brightness=-0.1'); break;
      }

      const b = (adjustments.brightness - 100) / 100;
      const c = adjustments.contrast / 100;
      const s = adjustments.saturation / 100;
      if (b !== 0 || c !== 1 || s !== 1) {
        vf.push(`eq=brightness=${b}:contrast=${c}:saturation=${s}`);
      }

      if (adjustments.vignette > 0) {
        vf.push(`vignette='PI*${(adjustments.vignette / 100) * 0.5}'`);
      }
      
      if (adjustments.noise > 0) {
        vf.push(`noise=alls=${Math.floor((adjustments.noise / 100) * 50)}:allf=t+u`);
      }

      if (mediaType === 'video' && speed !== 1) {
        vf.push(`setpts=${1/speed}*PTS`);
      }

      if (outputExt === 'mp4') {
        vf.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
        vf.push('format=yuv420p');
      }

      const af: string[] = [];
      if (mediaType === 'video' && speed !== 1 && !audioConfig.selectedMusic) af.push(`atempo=${speed}`);
      if (audioConfig.muted) af.push('volume=0');
      else if (audioConfig.volume !== 100) af.push(`volume=${audioConfig.volume/100}`);

      const vfStr = vf.join(',');
      const afStr = af.join(',');

      let execArgs: string[] = [];

      if (mediaType === 'image') {
        if (audioConfig.selectedMusic) {
          execArgs = ['-loop', '1', '-framerate', '30', '-i', inputMediaName, '-i', 'audio.mp3', '-c:v', 'libx264'];
          if (vfStr) execArgs.push('-vf', vfStr);
          execArgs.push('-c:a', 'aac');
          if (afStr) execArgs.push('-af', afStr);
          execArgs.push('-b:a', '192k', '-shortest', outputName);
        } else {
          execArgs = ['-i', inputMediaName];
          if (vfStr) execArgs.push('-vf', vfStr);
          execArgs.push(outputName);
        }
      } else {
        execArgs = ['-i', inputMediaName];
        if (audioConfig.selectedMusic) {
          execArgs.push('-i', 'audio.mp3', '-c:v', 'libx264');
          if (vfStr) execArgs.push('-vf', vfStr);
          execArgs.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac');
          if (afStr) execArgs.push('-af', afStr);
          execArgs.push('-shortest', outputName);
        } else {
          execArgs.push('-c:v', 'libx264');
          if (vfStr) execArgs.push('-vf', vfStr);
          if (afStr) {
            execArgs.push('-c:a', 'aac', '-af', afStr);
          } else {
            execArgs.push('-c:a', 'copy');
          }
          execArgs.push(outputName);
        }
      }

      await ffmpeg.exec(execArgs);
      
      setMessage('Finalizing...');
      const data = await ffmpeg.readFile(outputName);
      const mime = outputExt === 'mp4' ? 'video/mp4' : 'image/jpeg';
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

  const filters = [
    { id: 'normal', name: 'Normal' },
    { id: 'grayscale', name: 'B & W' },
    { id: 'sepia', name: 'Sepia' },
    { id: 'vintage', name: 'Vintage' },
    { id: 'dramatic', name: 'Dramatic' },
    { id: 'blur', name: 'Blur' },
    { id: 'invert', name: 'Invert' },
  ];

  return (
    <div className="fixed inset-0 z-[700] bg-[#000] flex flex-col font-sans">
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

        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
          <div 
            className="w-full max-w-[450px] bg-black rounded-xl overflow-hidden relative shadow-2xl border border-zinc-800/50 flex items-center justify-center transition-all duration-300"
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
                    className="w-full h-full transition-all duration-300" 
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
                    className="w-full h-full transition-all duration-300" 
                    style={{ 
                      objectFit: transforms.ratio === 'original' ? 'contain' : 'cover', 
                      ...getPreviewStyle() 
                    }}
                    alt="Preview" 
                  />
                )}
                
                {adjustments.vignette > 0 && (
                  <div 
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                    style={{ 
                      background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${adjustments.vignette / 100}) 120%)` 
                    }}
                  />
                )}
                
                {adjustments.noise > 0 && (
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-50 mix-blend-overlay transition-opacity duration-300"
                    style={{ 
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`, 
                      opacity: adjustments.noise / 100 
                    }}
                  />
                )}
              </>
            ) : (
               <p className="text-white/50 flex items-center justify-center h-full">No media selected</p>
            )}
          </div>
        </div>

        <div className="w-full md:w-[380px] bg-zinc-900/90 border-t md:border-t-0 md:border-l border-zinc-800 flex flex-col z-10">
          <div className="flex w-full border-b border-zinc-800 overflow-x-auto scrollbar-none">
            {[
              { id: 'filters', icon: Wand2, label: 'Filters' },
              { id: 'adjust', icon: Sliders, label: 'Adjust' },
              { id: 'transform', icon: Crop, label: 'Crop' },
              ...(mediaType === 'video' ? [{ id: 'speed', icon: FastForward, label: 'Speed' }] : []),
              { id: 'audio', icon: Music, label: 'Audio' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[75px] py-4 text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 transition-colors uppercase tracking-wider ${activeTab === tab.id ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
            {activeTab === 'filters' && (
              <div className="grid grid-cols-2 gap-3">
                {filters.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${selectedFilter === filter.id ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-zinc-800/40 border-transparent hover:bg-zinc-800'}`}
                  >
                    <div 
                      className="w-full aspect-square rounded-lg bg-zinc-700 bg-cover bg-center overflow-hidden relative"
                    >
                       <img 
                         src={initialMediaUrl} 
                         className="w-full h-full object-cover" 
                         style={{ filter: getPreviewStyle().filter }}
                         alt=""
                       />
                    </div>
                    <span className={`text-xs font-semibold tracking-wide ${selectedFilter === filter.id ? 'text-indigo-400' : 'text-zinc-300'}`}>
                      {filter.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'adjust' && (
              <div className="space-y-7">
                {(['brightness', 'contrast', 'saturation', 'vignette', 'noise'] as const).map(setting => (
                  <div key={setting} className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-300 font-medium capitalize">{setting}</span>
                      <span className="text-zinc-500 text-xs font-mono">{adjustments[setting]}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max={setting === 'vignette' || setting === 'noise' ? "100" : "200"} 
                      value={adjustments[setting]}
                      onChange={(e) => setAdjustments(prev => ({ ...prev, [setting]: parseInt(e.target.value) }))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                ))}
                <button 
                  onClick={() => setAdjustments({ brightness: 100, contrast: 100, saturation: 100, vignette: 0, noise: 0 })}
                  className="w-full py-2.5 mt-4 rounded-xl bg-zinc-800/50 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors border border-zinc-700/50"
                >
                  Reset Adjustments
                </button>
              </div>
            )}

            {activeTab === 'transform' && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1 block">Aspect Ratio</span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'original', label: 'Original', ratio: 'auto' },
                      { id: '1:1', label: 'Square', ratio: '1/1' },
                      { id: '4:5', label: 'Portrait', ratio: '4/5' },
                      { id: '16:9', label: 'Landscape', ratio: '16/9' },
                    ].map(r => (
                      <button 
                        key={r.id}
                        onClick={() => setTransforms(prev => ({ ...prev, ratio: r.id }))}
                        className={`py-3 rounded-xl border font-medium text-sm transition-all flex flex-col items-center gap-2 ${transforms.ratio === r.id ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-zinc-800/40 border-transparent hover:bg-zinc-800 text-zinc-300'}`}
                      >
                        <div className="w-6 h-6 border-2 border-current rounded-sm" style={{ aspectRatio: r.ratio }} />
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                   <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1 block">Orientation</span>
                   <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => setTransforms(prev => ({ ...prev, rotate: (prev.rotate + 90) % 360 }))}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 border border-transparent transition-all"
                    >
                      <RotateCw className="w-5 h-5 text-zinc-300" />
                      <span className="text-[11px] font-semibold text-zinc-400">Rotate</span>
                    </button>
                    <button 
                      onClick={() => setTransforms(prev => ({ ...prev, flipH: !prev.flipH }))}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${transforms.flipH ? 'bg-indigo-600/20 border-indigo-500' : 'bg-zinc-800/40 border-transparent hover:bg-zinc-800'}`}
                    >
                      <FlipHorizontal className={`w-5 h-5 ${transforms.flipH ? 'text-indigo-400' : 'text-zinc-300'}`} />
                      <span className={`text-[11px] font-semibold ${transforms.flipH ? 'text-indigo-400' : 'text-zinc-400'}`}>Flip X</span>
                    </button>
                    <button 
                      onClick={() => setTransforms(prev => ({ ...prev, flipV: !prev.flipV }))}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${transforms.flipV ? 'bg-indigo-600/20 border-indigo-500' : 'bg-zinc-800/40 border-transparent hover:bg-zinc-800'}`}
                    >
                      <FlipVertical className={`w-5 h-5 ${transforms.flipV ? 'text-indigo-400' : 'text-zinc-300'}`} />
                      <span className={`text-[11px] font-semibold ${transforms.flipV ? 'text-indigo-400' : 'text-zinc-400'}`}>Flip Y</span>
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={() => setTransforms({ flipH: false, flipV: false, rotate: 0, ratio: 'original' })}
                  className="w-full py-2.5 rounded-xl bg-zinc-800/50 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors border border-zinc-700/50"
                >
                  Reset Layout
                </button>
              </div>
            )}

            {activeTab === 'speed' && mediaType === 'video' && (
              <div className="space-y-6">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1 block mb-2">Playback Speed</span>
                <div className="grid grid-cols-2 gap-3">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                    <button 
                      key={s}
                      onClick={() => setSpeed(s)} 
                      className={`py-3.5 rounded-xl border font-bold text-sm transition-all ${speed === s ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-zinc-800/40 border-transparent hover:bg-zinc-800 text-zinc-300'}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mt-6">
                   <p className="text-xs text-indigo-300/80 leading-relaxed text-center">
                     Changing speed will automatically adjust the original audio pitch and tempo.
                   </p>
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1 block">Original Audio</span>
                  <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800">
                    <div className="flex justify-between items-center text-sm mb-4">
                      <span className="text-zinc-300 font-medium">Volume</span>
                      <span className="text-zinc-500 font-mono">{audioConfig.muted ? 0 : audioConfig.volume}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setAudioConfig(prev => ({...prev, muted: !prev.muted}))}
                        className="p-2 rounded-full hover:bg-zinc-700 transition-colors"
                      >
                        {audioConfig.muted ? <VolumeX className="text-red-400 w-5 h-5"/> : <Volume2 className="text-zinc-300 w-5 h-5"/>}
                      </button>
                      <input 
                        type="range" 
                        min="0" max="200" 
                        value={audioConfig.muted ? 0 : audioConfig.volume} 
                        onChange={(e) => setAudioConfig(prev => ({...prev, volume: parseInt(e.target.value), muted: false}))} 
                        className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="px-1">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Soundtrack</span>
                    <p className="text-[11px] text-zinc-400">Mix in a new track. Auto-loops for images.</p>
                  </div>
                  <MusicPicker 
                    onSelect={(m) => setAudioConfig(prev => ({...prev, selectedMusic: m}))} 
                    selected={audioConfig.selectedMusic} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
