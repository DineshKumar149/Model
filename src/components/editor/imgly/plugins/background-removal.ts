/**
 * Background Removal Plugin
 * Adds AI-powered background removal using @imgly/background-removal.
 */

import type { AssetDefinition, CreativeEngine } from '@cesdk/cesdk-js';
import type CreativeEditorSDK from '@cesdk/cesdk-js';
import { removeBackground } from '@imgly/background-removal';
import { resolveAssetPath } from '../resolveAssetPath';

const SOURCE_ID = 'ly.img.apps';

export function setupBackgroundRemovalPlugin(cesdk: CreativeEditorSDK): void {
  const engine = cesdk.engine;

  cesdk.i18n.setTranslations({
    en: {
      'libraries.ly.img.apps.label': 'Apps',
    },
  });

  engine.asset.addLocalSource(SOURCE_ID, undefined, async (asset) => {
    if (asset.id === 'remove-bg') {
      await applyBackgroundRemoval(cesdk);
    }
    return undefined;
  });

  const removeBackgroundAsset: AssetDefinition = {
    id: 'remove-bg',
    label: { en: 'Remove Background' },
    meta: {
      width: 80,
      height: 120,
      thumbUri: resolveAssetPath('/assets/remove-bg.png'),
    },
  };

  engine.asset.addAssetToSource(SOURCE_ID, removeBackgroundAsset);

  cesdk.ui.addAssetLibraryEntry({
    id: 'ly.img.apps',
    sourceIds: ['ly.img.apps'],
    previewLength: 3,
    gridColumns: 3,
    gridItemHeight: 'auto',
    previewBackgroundType: 'contain',
    gridBackgroundType: 'cover',
    cardLabel: (assetResult) => assetResult.label,
    cardLabelPosition: () => 'below',
  });

  cesdk.ui.insertOrderComponent({ in: 'ly.img.dock' }, [
    'ly.img.spacer',
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.apps',
      icon: '@imgly/Apps',
      label: 'libraries.ly.img.apps.label',
      entries: ['ly.img.apps'],
    },
  ]);
}

async function convertUriToBlob(
  uri: string,
  engine: CreativeEngine
): Promise<string | Blob> {
  if (uri.startsWith('buffer://')) {
    const mimeType = await engine.editor.getMimeType(uri);
    const bufferLength = engine.editor.getBufferLength(uri);
    const bufferData = engine.editor.getBufferData(uri, 0, bufferLength);
    return new Blob([bufferData as BlobPart], { type: mimeType });
  }
  return uri;
}

async function applyBackgroundRemoval(cesdk: CreativeEditorSDK): Promise<void> {
  const engine = cesdk.engine;
  const selectedBlocks = engine.block.findAllSelected();

  if (selectedBlocks.length === 0) {
    cesdk.ui.showNotification({
      type: 'error',
      message: 'Please select an image block',
      duration: 'medium',
    });
    return;
  }

  if (selectedBlocks.length > 1) {
    cesdk.ui.showNotification({
      type: 'error',
      message: 'Please select only one block',
      duration: 'medium',
    });
    return;
  }

  const block = selectedBlocks[0];

  if (!engine.block.supportsFill(block)) {
    cesdk.ui.showNotification({
      type: 'error',
      message: 'Selected block does not support fills',
      duration: 'medium',
    });
    return;
  }

  const fill = engine.block.getFill(block);
  const fillType = engine.block.getType(fill);

  if (fillType !== '//ly.img.ubq/fill/image') {
    cesdk.ui.showNotification({
      type: 'error',
      message: 'Selected block is not an image',
      duration: 'medium',
    });
    return;
  }

  const sourceSet = engine.block.getSourceSet(fill, 'fill/image/sourceSet');
  const imageUri =
    sourceSet?.[0]?.uri ||
    engine.block.getString(fill, 'fill/image/imageFileURI');

  if (!imageUri) {
    cesdk.ui.showNotification({
      type: 'error',
      message: 'No image found in selection',
      duration: 'medium',
    });
    return;
  }

  engine.block.setState(block, { type: 'Pending', progress: 0 });

  try {
    const imageInput = await convertUriToBlob(imageUri, engine);
    const removedBackgroundBlob = await removeBackground(imageInput);
    const newImageUri = URL.createObjectURL(removedBackgroundBlob);

    if (sourceSet && sourceSet.length > 0) {
      engine.block.setSourceSet(fill, 'fill/image/sourceSet', [
        { ...sourceSet[0], uri: newImageUri },
      ]);
    } else {
      engine.block.setString(fill, 'fill/image/imageFileURI', newImageUri);
    }

    engine.block.setState(block, { type: 'Ready' });
    engine.editor.addUndoStep();
  } catch (error) {
    console.error('Failed to remove background:', error);
    engine.block.setState(block, { type: 'Ready' });
    cesdk.ui.showNotification({
      type: 'error',
      message: 'Failed to remove background',
      duration: 'medium',
    });
  }
}
