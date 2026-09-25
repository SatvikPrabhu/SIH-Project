# AERO3D Architecture

## 7-Phase System Architecture
1. **Ingestion**: Upload video + GPS telemetry via Frontend (IngestionDrawer).
2. **Preprocessing**: Backend decodes video, filters dynamic objects, and extracts keyframes.
3. **Visual-Inertial Odometry**: Estimate camera poses using SLAM techniques.
4. **Reconstruction**: Deep learning-based multi-view stereo or Gaussian Splatting for dense 3D points.
5. **Geo-referencing**: Align local coordinates to UTM/WGS84 using GPS/IMU metadata.
6. **Meshing/Tiling**: Convert points into 3D Tiles or meshes for visualization.
7. **Export & Visualization**: Client-side CesiumJS rendering and GIS export capabilities.

## Folder Structure
```
/
├── package.json
├── src/
│   ├── app/ (Next.js App Router)
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   └── modals/
│   └── types/
```

## Data Contract Endpoints
- `POST /upload` -> Video + Telemetry
- `GET /preprocess` -> Keyframe Extraction Status
- `GET /reconstruct` -> 3D Point Cloud Streaming
- `POST /georeference` -> Align to Map
- `GET /export_gis` -> Download LAS/OBJ/GeoTIFF
