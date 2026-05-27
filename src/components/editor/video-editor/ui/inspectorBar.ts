import type CreativeEditorSDK from '@cesdk/cesdk-js';

export function setupInspectorBar(cesdk: CreativeEditorSDK): void {
  cesdk.ui.setComponentOrder(
    { in: 'ly.img.inspector.bar', when: { editMode: 'Transform' } },
    [
      'ly.img.spacer',
      'ly.img.pageResize.inspectorBar',
      'ly.img.separator',
      'ly.img.video.caption.inspectorBar',
      'ly.img.shape.options.inspectorBar',
      'ly.img.cutout.type.inspectorBar',
      'ly.img.cutout.offset.inspectorBar',
      'ly.img.cutout.smoothing.inspectorBar',
      'ly.img.group.create.inspectorBar',
      'ly.img.group.ungroup.inspectorBar',
      'ly.img.audio.replace.inspectorBar',
      'ly.img.separator',
      'ly.img.text.typeFace.inspectorBar',
      'ly.img.text.style.inspectorBar',
      'ly.img.text.bold.inspectorBar',
      'ly.img.text.italic.inspectorBar',
      'ly.img.text.fontSize.inspectorBar',
      'ly.img.text.alignHorizontal.inspectorBar',
      'ly.img.text.advanced.inspectorBar',
      'ly.img.combine.inspectorBar',
      'ly.img.separator',
      'ly.img.fill.inspectorBar',
      'ly.img.trim.inspectorBar',
      'ly.img.volume.inspectorBar',
      'ly.img.playbackSpeed.inspectorBar',
      'ly.img.crop.inspectorBar',
      'ly.img.separator',
      'ly.img.stroke.inspectorBar',
      'ly.img.separator',
      'ly.img.text.background.inspectorBar',
      'ly.img.separator',
      'ly.img.animations.inspectorBar',
      'ly.img.separator',
      {
        id: 'ly.img.appearance.inspectorBar',
        children: [
          'ly.img.adjustment.inspectorBar',
          'ly.img.filter.inspectorBar',
          'ly.img.effect.inspectorBar',
          'ly.img.blur.inspectorBar',
        ],
      },
      'ly.img.separator',
      'ly.img.shadow.inspectorBar',
      'ly.img.separator',
      'ly.img.opacityOptions.inspectorBar',
      'ly.img.separator',
      'ly.img.position.inspectorBar',
      'ly.img.spacer',
      'ly.img.separator',
      'ly.img.inspectorToggle.inspectorBar',
    ]
  );

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.inspector.bar', when: { editMode: 'Trim' } },
    ['ly.img.trimControls.inspectorBar']
  );

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.inspector.bar', when: { editMode: 'Crop' } },
    ['ly.img.cropControls.inspectorBar']
  );

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.inspector.bar', when: { editMode: 'Vector' } },
    [
      'ly.img.vectorEdit.moveMode.inspectorBar',
      'ly.img.vectorEdit.addMode.inspectorBar',
      'ly.img.vectorEdit.deleteMode.inspectorBar',
      'ly.img.separator',
      'ly.img.vectorEdit.bendMode.inspectorBar',
      'ly.img.vectorEdit.mirrorMode.inspectorBar',
      'ly.img.separator',
      'ly.img.vectorEdit.done.inspectorBar',
    ]
  );
}
