/**
 * CE.SDK Video Editor - Initialization Module
 * Adapted from the starterkit for use in the social media app.
 * Works in free/demo mode without a license key.
 */

import type CreativeEditorSDK from '@cesdk/cesdk-js';

import {
  BlurAssetSource,
  CaptionPresetsAssetSource,
  ImageColorsAssetSource,
  ColorPaletteAssetSource,
  CropPresetsAssetSource,
  DemoAssetSources,
  EffectsAssetSource,
  FiltersAssetSource,
  PagePresetsAssetSource,
  PremiumTemplatesAssetSource,
  StickerAssetSource,
  TextComponentAssetSource,
  TypefaceAssetSource,
  TextAssetSource,
  VectorShapeAssetSource,
  UploadAssetSources,
} from '@cesdk/cesdk-js/plugins';

import { VideoEditorConfig } from '../video-editor/plugin';
import { setupBackgroundRemovalPlugin } from './plugins/background-removal';

export { VideoEditorConfig } from '../video-editor/plugin';
export { setupBackgroundRemovalPlugin } from './plugins/background-removal';

/**
 * Initialize the CE.SDK Video Editor with a complete configuration.
 *
 * @param cesdk - The CreativeEditorSDK instance to configure
 * @param onExport - Optional callback called when user clicks Export/Done button with the blob
 */
export async function initVideoEditor(
  cesdk: CreativeEditorSDK,
  onExport?: (blob: Blob, mimeType: string) => void
) {
  // 1. Add the video editor configuration plugin
  await cesdk.addPlugin(new VideoEditorConfig());

  // 2. Background removal plugin (AI-powered)
  setupBackgroundRemovalPlugin(cesdk);

  // 3. Asset source plugins
  await cesdk.addPlugin(new BlurAssetSource());
  await cesdk.addPlugin(new CaptionPresetsAssetSource());
  await cesdk.addPlugin(new ImageColorsAssetSource());
  await cesdk.addPlugin(new ColorPaletteAssetSource());
  await cesdk.addPlugin(new CropPresetsAssetSource());

  await cesdk.addPlugin(
    new UploadAssetSources({
      include: [
        'ly.img.image.upload',
        'ly.img.video.upload',
        'ly.img.audio.upload',
      ],
    })
  );

  await cesdk.addPlugin(
    new DemoAssetSources({
      include: [
        'ly.img.templates.video.*',
        'ly.img.image.*',
        'ly.img.audio.*',
        'ly.img.video.*',
      ],
    })
  );

  await cesdk.addPlugin(new EffectsAssetSource());
  await cesdk.addPlugin(new FiltersAssetSource());

  await cesdk.addPlugin(
    new PagePresetsAssetSource({
      include: [
        'ly.img.page.presets.instagram.*',
        'ly.img.page.presets.facebook.*',
        'ly.img.page.presets.x.*',
        'ly.img.page.presets.linkedin.*',
        'ly.img.page.presets.pinterest.*',
        'ly.img.page.presets.tiktok.*',
        'ly.img.page.presets.youtube.*',
        'ly.img.page.presets.video.*',
      ],
    })
  );

  await cesdk.addPlugin(new StickerAssetSource());
  await cesdk.addPlugin(new TextAssetSource());
  await cesdk.addPlugin(new TextComponentAssetSource());
  await cesdk.addPlugin(new TypefaceAssetSource());
  await cesdk.addPlugin(new VectorShapeAssetSource());

  await cesdk.addPlugin(
    new PremiumTemplatesAssetSource({
      include: ['ly.img.templates.premium.*'],
    })
  );

  // 4. Translations
  cesdk.i18n.setTranslations({
    en: {
      'actions.export.done': 'Done & Continue',
      'actions.export.video': 'Done & Continue',
      'actions.export.image': 'Done & Continue',
    },
  });

  // 5. Override exportDesign to call our onExport callback instead of downloading
  if (onExport) {
    cesdk.actions.register('exportDesign', async (exportOptions: any) => {
      const resolvedOptions = exportOptions || { mimeType: 'image/png' };
      const { blobs, options } = await cesdk.utils.export(resolvedOptions);
      onExport(blobs[0], options.mimeType as string);
    });
  }

}
