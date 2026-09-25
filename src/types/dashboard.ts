export type MediaAsset = {
  file: File;
  name: string;
  size: number;
  durationSec?: number;
  previewUrl?: string;
};

export type MeasurementTool = "distance" | "height" | "area";

export type VizMode = "mesh" | "pointcloud";

export type GisExportFormat = "3dtiles" | "las" | "tiff" | "obj";

export type ProcessingStage = {
  id: string;
  label: string;
};

export const PROCESSING_STAGES: ProcessingStage[] = [
  { id: "upload", label: "Uploading video & telemetry..." },
  { id: "preprocess", label: "Preprocessing keyframes & filtering blur..." },
  { id: "reconstruct", label: "Regressing 3D Pointmaps & Masking Traffic..." },
  { id: "georeference", label: "Solving Sim(3) Georeferencing & Scale..." },
  { id: "export", label: "Generating OGC 3D Tiles & GeoTIFFs..." },
];

// API Response Types
export type UploadResponse = {
  video_id: string;
  video_filename: string;
  telemetry_filename?: string;
  telemetry_data: TelemetryPoint[];
  message: string;
};

export type TelemetryPoint = {
  frame_index: number;
  timestamp_ms: number;
  latitude: number;
  longitude: number;
  altitude_m: number;
  speed_ms: number;
  heading_deg: number;
};

export type PreprocessResponse = {
  video_id: string;
  total_keyframes: number;
  blurred_frames_dropped: number;
  processing_time_seconds: number;
  keyframes: KeyframeResult[];
  message: string;
};

export type KeyframeResult = {
  frame_index: number;
  keyframe_path: string;
  telemetry: TelemetryPoint;
  laplacian_variance: number;
  is_sharp: boolean;
};

export type ReconstructResponse = {
  video_id: string;
  status: string;
  total_points: number;
  processing_time_sec: number;
  is_synthetic: boolean;
  model_used: string;
  ply_download_url: string;
  message: string;
};

export type GeoreferenceResponse = {
  video_id: string;
  scale_factor_s: number;
  utm_zone: string;
  bounding_box_meters: {
    min_easting: number;
    max_easting: number;
    min_northing: number;
    max_northing: number;
    min_altitude: number;
    max_altitude: number;
    width_meters: number;
    length_meters: number;
    height_meters: number;
  };
  georeferenced_ply: string;
  georeferenced_ply_url: string;
  total_points: number;
  message: string;
};

export type GISExportResponse = {
  video_id: string;
  export_urls: Record<string, string>;
  message: string;
};
