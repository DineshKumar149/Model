/**
 * Feature Configuration - Enable/Disable Editor Capabilities
 * Copied from the CE.SDK starterkit and adapted for the social media app.
 */

import type CreativeEditorSDK from '@cesdk/cesdk-js';

export function setupFeatures(cesdk: CreativeEditorSDK): void {
  cesdk.feature.enable([
    'ly.img.navigation',
    'ly.img.text',
    'ly.img.crop',
    'ly.img.transform',
    'ly.img.filter',
    'ly.img.adjustment',
    'ly.img.effect',
    'ly.img.blur',
    'ly.img.shadow',
    'ly.img.cutout',
    'ly.img.canvas',
    'ly.img.inspector',
    'ly.img.delete',
    'ly.img.duplicate',
    'ly.img.group',
    'ly.img.replace',
    'ly.img.page.resize',
    'ly.img.page.settings',
    'ly.img.page.clipContent',
    'ly.img.fill',
    'ly.img.stroke',
    'ly.img.opacity',
    'ly.img.blendMode',
    'ly.img.shape.options',
    'ly.img.combine',
    'ly.img.position',
    'ly.img.trim',
    'ly.img.notifications',
    'ly.img.dock',
    'ly.img.library.panel',
    'ly.img.video',
    'ly.img.volume',
    'ly.img.playbackSpeed',
    'ly.img.animations',
  ]);

  cesdk.feature.disable([
    'ly.img.video.timeline.ruler',
  ]);
}
