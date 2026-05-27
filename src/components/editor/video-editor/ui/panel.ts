import type CreativeEditorSDK from '@cesdk/cesdk-js';

export function setupPanels(cesdk: CreativeEditorSDK): void {
  cesdk.ui.setPanelPosition('//ly.img.panel/inspector', 'left');
  cesdk.ui.setPanelFloating('//ly.img.panel/inspector', false);
  cesdk.ui.setPanelPosition('//ly.img.panel/assets', 'left');
  cesdk.ui.setPanelFloating('//ly.img.panel/assets', false);
}
