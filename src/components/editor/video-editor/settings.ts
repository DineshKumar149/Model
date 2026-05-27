/**
 * Engine Settings Configuration
 * Copied from the CE.SDK starterkit.
 */

import type { CreativeEngine } from '@cesdk/cesdk-js';

export function setupSettings(engine: CreativeEngine): void {
  engine.editor.setSetting('features/videoCaptionsEnabled', true);
  engine.editor.setSetting('timeline/trackVisibility', 'active');
  engine.editor.setSetting('doubleClickToCropEnabled', true);
  engine.editor.setSetting('doubleClickSelectionMode', 'Hierarchical');
  engine.editor.setSetting('page/allowCropInteraction', true);
  engine.editor.setSetting('page/dimOutOfPageAreas', true);
  engine.editor.setSetting('page/moveChildrenWhenCroppingFill', false);
  engine.editor.setSetting('page/selectWhenNoBlocksSelected', false);
  engine.editor.setSetting('page/title/show', false);
  engine.editor.setSetting('page/title/showOnSinglePage', true);
  engine.editor.setSetting('page/title/showPageTitleTemplate', true);
  engine.editor.setSetting('page/title/appendPageName', true);
  engine.editor.setSetting('page/title/separator', '-');
  engine.editor.setSetting('placeholderControls/showOverlay', true);
  engine.editor.setSetting('placeholderControls/showButton', true);
  engine.editor.setSetting('colorPicker/colorMode', 'RGB');
}
