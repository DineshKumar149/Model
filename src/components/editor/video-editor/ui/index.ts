/**
 * UI Configuration - All UI setup files
 */

export { setupCanvas } from './canvas';
export { setupComponents } from './components';
export { setupDock } from './dock';
export { setupInspectorBar } from './inspectorBar';
export { setupNavigationBar } from './navigationBar';
export { setupPanels } from './panel';

import type CreativeEditorSDK from '@cesdk/cesdk-js';
import { setupCanvas } from './canvas';
import { setupComponents } from './components';
import { setupDock } from './dock';
import { setupInspectorBar } from './inspectorBar';
import { setupNavigationBar } from './navigationBar';
import { setupPanels } from './panel';

export function setupUI(cesdk: CreativeEditorSDK): void {
  setupPanels(cesdk);
  setupComponents(cesdk);
  setupNavigationBar(cesdk);
  setupCanvas(cesdk);
  setupInspectorBar(cesdk);
  setupDock(cesdk);
}
