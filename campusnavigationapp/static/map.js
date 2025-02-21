class CustomIndoorEqual extends IndoorEqual {
  constructor(map, options) {
    super(map, options);
    this.markers = {};
  }

  addMarker(marker, level) {
    if (!this.markers[level]) {
      this.markers[level] = [];
    }
    this.markers[level].push(marker);
    if (level === this.level) {
      marker.addTo(this.map);
    }
  }

  toggleMarkers(level) {
    //console.log(this.markers);
    Object.keys(this.markers).forEach((markerLevel) => {
      this.markers[markerLevel].forEach((marker) => {
        if (markerLevel === level) {
          marker.addTo(this.map);
        } else {
          marker.remove();
        }
      });
    });
  }

  removeMarker(marker, level) {
    if (this.markers[level]) {
      this.markers[level] = this.markers[level].filter((m) => m !== marker);
    }
  }

  setLevel(level) {
    this.level = level;
    this._updateFilters();
    this.toggleMarkers(level);
    this._emitLevelChange();
  }
}

const gl = new maplibregl.Map({
  container: "map",
  style:
    "https://api.maptiler.com/maps/openstreetmap/style.json?key=UOLh4Ktc21SMniW0v30i",
  center: [-87.882799, 43.077622],
  zoom: 17,
  minZoom: 16,
  maxZoom: 22,
});
const indoorEqual = new CustomIndoorEqual(gl, {
  apiKey: "iek_lkFHtGmMEwKkwk4wAiWpGb49RFNI",
});
gl.addControl(indoorEqual);
gl.dragRotate.disable();
indoorEqual.loadSprite(
  "https://unpkg.com/maplibre-gl-indoorequal@latest/sprite/indoorequal"
);

gl.once("idle", () => {
  gl.setPaintProperty("indoor-polygon", "fill-color", [
    "match",
    ["get", "class"],
    "room",
    "#ffd359",
    "#b8b8b8", // default color
  ]);
  gl.setPaintProperty("indoor-lines", "line-color", [
    "match",
    ["get", "class"],
    "room",
    "#ffbd00",
    "#000000", // default color
  ]);
});

window.addEventListener("resize", () => {
  gl.resize();
});

window.addEventListener("zoomevent", () => {
  gl.resize();
});

// Sidebar toggle functionality
const sidebar = document.getElementById("sidebar");
const toggleButton = document.getElementById("toggle-sidebar");
const mapOverlay = document.getElementById("map-overlay");
const hamburgerIcon = document.getElementById("hamburger-icon");
const closeIcon = document.getElementById("close-icon");

toggleButton.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  mapOverlay.classList.toggle("active");
  // Toggle icons
  if (sidebar.classList.contains("open")) {
    hamburgerIcon.style.display = "none";
    closeIcon.style.display = "inline-block";
  } else {
    hamburgerIcon.style.display = "inline-block";
    closeIcon.style.display = "none";
  }
});

// Marker functionality
// TODO: Add options in the popup menu (e.g. set start/end, copy coordinates, change floor, etc.)
let currentLevel = 0;

function handleMarkerCreation(e) {
  e.preventDefault();
  let marker = new maplibregl.Marker({
    color: "#FF0000",
  })
    .setLngLat(e.lngLat)
    .addTo(gl);

  const popupContent = document.createElement("div");
  popupContent.innerHTML = `
    <button id="remove-marker">Remove Marker</button>
  `;
  const popup = new maplibregl.Popup().setDOMContent(popupContent);
  marker.setPopup(popup);

  popupContent.querySelector("#remove-marker").addEventListener("click", () => {
    marker.remove();
    indoorEqual.removeMarker(marker, currentLevel);
  });

  marker.on("click", (e) => marker.togglePopup());
  indoorEqual.addMarker(marker, currentLevel);
}
gl.on("contextmenu", handleMarkerCreation);

// Handle long-press event
let longPressTimer;
const LONG_PRESS_DURATION = 500; // milliseconds

gl.getCanvas().addEventListener("touchstart", (e) => {
  longPressTimer = setTimeout(() => {
    const touch = e.touches[0];
    const lngLat = gl.unproject([touch.clientX, touch.clientY]);
    handleMarkerCreation({ lngLat, preventDefault: () => {} });
  }, LONG_PRESS_DURATION);
});

gl.getCanvas().addEventListener("touchend", () => {
  clearTimeout(longPressTimer);
});

gl.getCanvas().addEventListener("touchmove", () => {
  clearTimeout(longPressTimer);
});

// Listen for level changes
indoorEqual.on("levelchange", (level) => {
  currentLevel = level;
  console.log(`Level changed to ${level}`);
});
