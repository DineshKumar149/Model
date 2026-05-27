/**
 * Video Editor Plugin - Complete Video Editing Configuration for CE.SDK
 * Adapted from the starterkit for use in the social media app.
 */

import type { EditorPlugin, EditorPluginContext } from '@cesdk/cesdk-js';
import CreativeEditorSDK from '@cesdk/cesdk-js';

import { setupActions } from './actions';
import { setupFeatures } from './features';
import { setupTranslations } from './i18n';
import { setupSettings } from './settings';
import { setupUI } from './ui';

export class VideoEditorConfig implements EditorPlugin {
  name = 'cesdk-video-editor';
  version = CreativeEditorSDK.version;

  async initialize({ cesdk, engine }: EditorPluginContext) {
    if (cesdk) {
      cesdk.resetEditor();
      setupFeatures(cesdk);
      setupUI(cesdk);
      setupActions(cesdk);
      setupTranslations(cesdk);
      setupSettings(engine);

      await cesdk.actions.run('editor.checkBrowserSupport', {
        videoDecode: 'block',
        videoEncode: 'warn',
      });

      cesdk.reapplyLegacyUserConfiguration();
    }
  }
}
