/**
 * Leaflet Map Bearing Plugin
 * Adds support for rotating the entire map
 */
(function () {
  // Only initialize if Leaflet is available
  if (typeof L === "undefined") {
    console.error("Leaflet must be loaded before this plugin");
    return;
  }

  // Add CSS for map rotation
  const style = document.createElement("style");
  style.textContent = `
    .leaflet-rotate-enabled {
      transition: transform 0.3s ease-out;
      transform-origin: center center;
      backface-visibility: hidden;
    }
    
    .leaflet-container.map-bearing-active {
      overflow: hidden !important;
    }
    
    /* Counter-rotate controls for readability */
    .map-bearing-active .leaflet-control-container {
      transition: transform 0.3s ease-out;
    }
    
    /* Handle tiles slightly differently */
    .map-bearing-active .leaflet-tile {
      will-change: transform;
    }
    
    /* Special handling for markers - keep user marker able to rotate independently */
    .map-bearing-active .leaflet-marker-icon:not(.user-location-marker) {
      transition: transform 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);

  // Extend L.Map to add bearing functionality
  L.Map.include({
    bearing: 0,

    /**
     * Set the bearing (rotation) of the map
     * @param {number} bearing - Angle in degrees
     */
    setBearing: function (bearing) {
      // Normalize to 0-360
      this.bearing = ((bearing % 360) + 360) % 360;

      // Access map container and various elements
      const mapContainer = this.getContainer();
      const mapPane = mapContainer.querySelector(".leaflet-map-pane");
      const tilePane = mapContainer.querySelector(".leaflet-tile-pane");
      const controlContainer = mapContainer.querySelector(
        ".leaflet-control-container"
      );

      // Add active class for CSS rules
      mapContainer.classList.add("map-bearing-active");

      // Apply inverse rotation angle
      const angle = -this.bearing;

      // Rotate the map panes
      if (mapPane) {
        mapPane.style.transform = `rotate(${angle}deg)`;
        mapPane.style.transformOrigin = "center center";
        mapPane.classList.add("leaflet-rotate-enabled");
      }

      // Counter-rotate controls so they remain upright
      if (controlContainer) {
        controlContainer.style.transform = `rotate(${-angle}deg)`;
        controlContainer.style.transformOrigin = "center center";
      }

      // Set CSS variables for use in other components
      document.documentElement.style.setProperty(
        "--map-bearing",
        `${this.bearing}deg`
      );
      document.documentElement.style.setProperty(
        "--map-bearing-inverse",
        `${-this.bearing}deg`
      );

      // Apply counter-rotation to all markers (except user marker)
      document
        .querySelectorAll(".leaflet-marker-icon:not(.user-location-marker)")
        .forEach((marker) => {
          marker.style.transform = `rotate(${-angle}deg)`;
        });

      // Fire event for other components to respond
      this.fire("bearing", { bearing: this.bearing });

      return this;
    },

    /**
     * Get the current bearing of the map
     * @returns {number} - Current bearing in degrees
     */
    getBearing: function () {
      return this.bearing;
    },

    /**
     * Reset the bearing to 0 (north up)
     */
    resetBearing: function () {
      return this.setBearing(0);
    },
  });

  console.log("[leaflet.mapbearing] Plugin initialized successfully");
})();
