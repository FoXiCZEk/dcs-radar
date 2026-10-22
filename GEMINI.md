# Antigravity Project Instructions: DCS Radar

## Project Overview
DCS Radar is a realtime tactical radar web application for Digital Combat Simulator (DCS World). It connects to DCS via Tacview Realtime Telemetry (RTT TCP port 42674) and DCS-gRPC (port 40051), providing a 2D MapLibre map and 3D Cesium globe, tactical BRAA calculation, SAM threat rings, and missile alerts.

## Critical Session Handoff
For the complete and up-to-date session state, what was completed, network settings, and next steps, read:
**[SESSION_STATE.md](file:///SESSION_STATE.md)**

## Tech Stack
- **Backend:** Go 1.26 (gorilla/websocket, DCS-gRPC go-bindings, ACMI streaming parser)
- **Frontend:** React 19, TypeScript, Vite, MapLibre GL 6.15, Cesium 1.146, Lucide React
- **Packaging:** Multi-stage Docker container (`docker compose up -d --build`), served statically from Go binary on `:8080`

## Key Architecture & Coding Guidelines
1. **MapLibre 2D Map (`TacticalMap2D.tsx`):**
   - DO NOT use `map.isStyleLoaded()` to block updates; it returns `false` during raster tile network requests. Use the reactive `isMapReady` state instead.
   - Both 2D and 3D containers are mounted simultaneously in `App.tsx` (`display: block / none`) so WebGL contexts are never destroyed when toggling views. When switching to 2D, call `map.resize()`.
   - Dynamic styling (selection, reference, colors) must be embedded in feature properties (`isSelected`, `isReference`) rather than static style expressions.
2. **3D Cesium Globe (`TacticalGlobe3D.tsx`):**
   - Use `new Cesium.ImageryLayer(provider)` with `viewer.imageryLayers.add(layer)` for live imagery provider switching.
3. **Telemetry & Realism:**
   - Simulation mode is removed. When Tacview telemetry is not sending data, verify if DCS is paused vs disconnected using the game port and gRPC health checks.
