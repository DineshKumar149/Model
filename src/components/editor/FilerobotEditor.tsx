import React, { useState, useRef } from 'react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilerobotEditorProps {
  onSave: (blob: Blob, mimeType: string) => void;
  onClose: () => void;
  initialMediaUrl?: string;
  title?: string;
}

export default function FilerobotEditor({
  onSave,
  onClose,
  initialMediaUrl,
  title = 'Advanced Editor'
}: FilerobotEditorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const filerobotRef = useRef<any>(null);

  if (!initialMediaUrl) {
    return (
      <div className="fixed inset-0 z-[700] bg-black/90 flex items-center justify-center">
        <p className="text-white">No image provided.</p>
        <button onClick={onClose} className="absolute top-4 right-4 text-white p-2">Close</button>
      </div>
    );
  }

  const handleSave = async (editedImageObject: any, designState: any) => {
    setIsProcessing(true);
    try {
      const imgBase64 = editedImageObject.imageBase64;
      const res = await fetch(imgBase64);
      const blob = await res.blob();
      onSave(blob, editedImageObject.mimeType || 'image/jpeg');
    } catch (error) {
      console.error("Failed to save edited image", error);
      // Fallback to original
      try {
        const response = await fetch(initialMediaUrl);
        const originalBlob = await response.blob();
        onSave(originalBlob, originalBlob.type);
      } catch (fallbackError) {
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] bg-black flex flex-col w-screen h-screen overflow-hidden">
      {isProcessing && (
        <div className="absolute inset-0 z-[800] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
          <p className="text-white font-medium text-center">Processing image...</p>
        </div>
      )}
      
      {/* Custom Next Button Overlay to bypass the Save Modal completely */}
      <div className="absolute top-0 right-0 z-[800] p-2.5 px-4 flex justify-end pointer-events-none w-full">
         <Button 
            className="pointer-events-auto bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-2 font-bold rounded-lg shadow-lg"
            onClick={() => {
              if (filerobotRef.current) {
                // Instantly grab the image data without any modals
                const result = filerobotRef.current({ name: 'edited-image', extension: 'png' });
                if (result && result.imageData) {
                  handleSave(result.imageData, result.designState);
                }
              }
            }}
         >
           Next
         </Button>
      </div>

      <FilerobotImageEditor
        source={initialMediaUrl}
        onSave={handleSave}
        onClose={onClose}
        annotationsCommon={{
          fill: '#000000',
        }}
        Text={{ text: 'Add Text' }}
        Rotate={{ angle: 90, componentType: 'slider' }}
        defaultTabId={TABS.ADJUST}
        defaultToolId={TOOLS.CROP}
        savingPixelRatio={4}
        previewPixelRatio={Math.max(1, window.devicePixelRatio || 1)}
        translations={{
          profile: 'Profile',
          coverPhoto: 'Cover photo',
          custom: 'Custom',
          save: 'Next',
          saveAs: 'Next',
          export: 'Next'
        }}
        defaultSavedImageType="png"
        useBackendTranslations={false}
        removeSaveButton={true}
        getCurrentImgDataFnRef={filerobotRef}
      />
    </div>
  );
}
