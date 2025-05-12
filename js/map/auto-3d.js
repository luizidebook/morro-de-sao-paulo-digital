import { loadMapboxGLScript, enable3DMode, isMap3DReady } from "./map-3d.js";

/**
 * Auto-enables 3D mode after the page loads
 */
export function autoEnable3DMode(showLoading = false) {
  console.log("[auto-3D] Setting up auto-enable for 3D mode");

  // We're NOT showing a separate loading indicator - using the main one from index.html
  // removing the call to showMap3DLoadingIndicator();

  // Wait for DOM to be ready
  if (document.readyState !== "loading") {
    setupAutoEnable();
  } else {
    document.addEventListener("DOMContentLoaded", setupAutoEnable);
  }
}

function setupAutoEnable() {
  // First ensure Mapbox GL JS is loaded
  loadMapboxGLScript()
    .then(() => {
      console.log("[auto-3D] Mapbox GL JS loaded successfully");

      // Wait a bit for potential Leaflet map to initialize
      setTimeout(() => {
        console.log("[auto-3D] Attempting to enable 3D mode");

        // Try to get the map instance from the global scope
        const mapInstance =
          window.map ||
          (window.getMapInstance && window.getMapInstance()) ||
          null;

        // Enable 3D mode with default options
        enable3DMode({
          pitch: 60,
          bearing: -15,
          animationDuration: 3500,
          mapInstance: mapInstance,
        })
          .then(() => {
            // Listen for the map ready event - but don't change anything about the loading indicator
            document.addEventListener("mapbox3d:ready", () => {
              console.log("[auto-3D] 3D map is fully loaded and rendered");
              // The main.js will handle hiding the loading overlay
            });
          })
          .catch((error) => {
            console.error("[auto-3D] Error enabling 3D mode:", error);
          });
      }, 2000);
    })
    .catch((error) => {
      console.error("[auto-3D] Failed to load Mapbox GL JS:", error);
    });
}

// Remove the auto-initialization to prevent duplicate loading
// autoEnable3DMode();
