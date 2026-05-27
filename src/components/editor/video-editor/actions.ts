/**
 * Actions Configuration - Override Default Actions and Add Custom Actions for Video Editor
 * Modified to integrate with Supabase for file uploads instead of local downloads.
 */

import type CreativeEditorSDK from '@cesdk/cesdk-js';

/**
 * Register actions for the video editor.
 * The exportDesign action is overridden here to support custom export handling.
 * The actual Supabase upload is done in CESDKEditor.tsx via onSave callback.
 *
 * @param cesdk - The CreativeEditorSDK instance to configure
 */
export function setupActions(cesdk: CreativeEditorSDK): void {
  // The exportDesign action is intentionally left as a no-op here.
  // CESDKEditor.tsx registers its own exportDesign handler that calls onSave(blob)
  // which then uploads to Supabase.
  // This placeholder ensures the action exists for the nav bar button.
  cesdk.actions.register('exportDesign', async (exportOptions: any) => {
    const { blobs, options } = await cesdk.utils.export(exportOptions);
    await cesdk.utils.downloadFile(blobs[0], options.mimeType);
  });
}
