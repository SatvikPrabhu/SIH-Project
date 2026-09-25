export type PipelineStage = 'idle' | 'uploading' | 'preprocessing' | 'reconstructing' | 'georeferencing' | 'exporting' | 'complete' | 'error';

export interface ProcessingMetrics {
  frameCount: number;
  droppedFrames: number;
  scaleFactor: number;
  pointCount: number;
}

export type GisExportFormat = 'las' | 'obj' | 'geotiff' | '3dtiles';
