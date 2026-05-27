import type CreativeEditorSDK from '@cesdk/cesdk-js';

export function setupDock(cesdk: CreativeEditorSDK): void {
  cesdk.engine.editor.setSetting('dock/hideLabels', false);
  cesdk.engine.editor.setSetting('dock/iconSize', 'large');

  cesdk.ui.setComponentOrder({ in: 'ly.img.dock' }, [
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.templates',
      icon: '@imgly/Template',
      label: 'libraries.ly.img.templates.label',
      entries: ['ly.img.templates'],
    },
    { id: 'ly.img.separator', key: 'ly.img.separator' },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.elements',
      icon: '@imgly/Library',
      label: 'component.library.elements',
      entries: ['ly.img.image', 'ly.img.video', 'ly.img.audio', 'ly.img.text', 'ly.img.vector.shape', 'ly.img.sticker'],
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.upload',
      icon: '@imgly/Upload',
      label: 'libraries.ly.img.upload.label',
      entries: ['ly.img.upload'],
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.image',
      icon: '@imgly/Image',
      label: 'libraries.ly.img.image.label',
      entries: ['ly.img.image', 'ly.img.image.upload'],
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.video',
      icon: '@imgly/Video',
      label: 'libraries.ly.img.video.label',
      entries: ['ly.img.video', 'ly.img.video.upload'],
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.audio',
      icon: '@imgly/Audio',
      label: 'libraries.ly.img.audio.label',
      entries: ['ly.img.audio', 'ly.img.audio.upload'],
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.text',
      icon: '@imgly/Text',
      label: 'libraries.ly.img.text.label',
      entries: ['ly.img.text'],
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.vector.shape',
      icon: '@imgly/Shapes',
      label: 'libraries.ly.img.vector.shape.label',
      entries: ['ly.img.vector.shape'],
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.sticker',
      icon: '@imgly/Sticker',
      label: 'libraries.ly.img.sticker.label',
      entries: ['ly.img.sticker'],
    },
  ]);
}
