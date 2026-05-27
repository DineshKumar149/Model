import type CreativeEditorSDK from '@cesdk/cesdk-js';

export function setupNavigationBar(cesdk: CreativeEditorSDK): void {
  cesdk.ui.setComponentOrder({ in: 'ly.img.navigation.bar' }, [
    'ly.img.documentSettings.navigationBar',
    'ly.img.undoRedo.navigationBar',
    'ly.img.spacer',
    'ly.img.title.navigationBar',
    'ly.img.spacer',
    'ly.img.zoom.navigationBar',
    'ly.img.preview.navigationBar',
    'ly.img.action.navigationBar.export',
  ]);
}
