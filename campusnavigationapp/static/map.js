class CustomIndoorEqual extends IndoorEqual {
  constructor(map, options) {
    super(map, options);
    this.markers = {};
    this.start = null;
    this.destination = null;
  }

  addMarker(marker) {
    const level = marker._level
    if (!this.markers[level]) {
      this.markers[level] = [];
    }
    this.markers[level].push(marker);
    if (level === this.level) {
      marker.addTo(this.map);
    }
  }

  toggleMarkers(level) {
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

  removeMarker(marker) {
    const level = marker._level
    if (this.markers[level]) {
      if (this.start === marker) {
        this.start = null;
      }
      if (this.destination === marker) {
        this.destination = null;
      }
      this.markers[level] = this.markers[level].filter((m) => m !== marker);
      marker.remove();
    }
    updateStartButtonVisibility();
  }

  setLevel(level) {
    this.level = level;
    this._updateFilters();
    this.toggleMarkers(level);
    this._emitLevelChange();
  }
}
class TypedMarker extends maplibregl.Marker {
  constructor(options = {}, type = "none", level = 0) {
    const colors = {
      start: "#4CAF50",
      end: "#ffc107",
      none: "#2196F3",
      geo: "#80b0ff",
      geoStart: "#4CAF50",
    };

    const markerElement = document.createElement("div");
    const svgContainer = document.createElement("div");

    markerElement.style.width = "48px";
    markerElement.style.height = "48px";

    fetch(window.iconUrl)
      .then((response) => response.text())
      .then((svg) => {
        svgContainer.innerHTML = svg;
        const svgElement = svgContainer.querySelector("svg");
        if (svgElement) {
          svgElement.style.width = "100%";
          svgElement.style.height = "100%";
          svgElement.style.fill = colors[type] || colors.none;
        }
      });

    markerElement.appendChild(svgContainer);

    super({
      ...options,
      element: markerElement,
    });

    this._type = type;
    this._level = level;
    this._createPopup();
  }

  setType(newType) {
    const colors = {
      start: "#4CAF50",
      end: "#ffc107",
      none: "#2196F3",
      geo: "#80b0ff",
      geoStart: "#4CAF50",
    };


    if (["start", "end", "none", "geo", "geoStart"].includes(newType)) {
      // update start or destination if the type was changed
      if (this._type === "start" || this._type === "geoStart") {
        indoorEqual.start = null;
      }
      if (this._type === "end") {
        indoorEqual.destination = null;
      }
      // if there is already a start marker update it
      if (newType === "start" && indoorEqual.start) {
        if (indoorEqual.start._type === "geoStart") {
          indoorEqual.start.setType("geo");
        } else {
          indoorEqual.start.setType("none");
        }
      }
      // Sets the type of the previous end and start variables to none or geo
      if (newType === "end" && indoorEqual.destination) {
        indoorEqual.destination.setType("none");
      }
      if (this._type === "geo" && newType === "start") {
        this._type = "geoStart";
        this._updateColor(colors["geoStart"]);
        indoorEqual.start = this;
      } else {
        this._type = newType;
        this._updateColor(colors[newType]);
      }
      if (this._type === "start") {
        indoorEqual.start = this;
      }
      if (this._type === "end") {
        indoorEqual.destination = this;
      }
      this._createPopup();
    }
    return this;
  }

  _updateColor(newColor) {
    const svgElement = this.getElement().querySelector("svg");
    if (svgElement) {
      svgElement.style.fill = newColor;
    }
  }

  _createPopup() {
    const popupContent = document.createElement("div");
    let popupHTML = "";

    switch (this._type) {
      case "start":
        popupHTML = `<button id="remove-marker">Remove Marker</button><button id="set-dest">Set Destination</button>`;
        break;
      case "end":
        popupHTML = `<button id="remove-marker">Remove Marker</button><button id="set-start">Set Start</button>`;
        break;
      case "geoStart":
        popupHTML = `<button id="remove-start">Remove Start</button>`;
        break;
      case "geo":
        popupHTML = `<button id="set-start">Set Start</button>`;
        break;
      default:
        popupHTML = `<button id="remove-marker">Remove Marker</button>
          <button id="set-start">Set Start</button>
          <button id="set-destination">Set Destination</button>`;
    }

    popupContent.innerHTML = `<div class="popup-buttons">${popupHTML}</div>`;

    const popupOptions = {
      closeButton: false,
      className: "custom-popup",
    };
    // Update existing popup or create new one
    const existingPopup = this.getPopup();
    if (existingPopup) {
      existingPopup.setDOMContent(popupContent);
    } else {
      this.setPopup(
        new maplibregl.Popup(popupOptions).setDOMContent(popupContent)
      );
    }

    // Add event listeners
    popupContent.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", (e) => {
        switch (e.target.id) {
          case "set-start":
            this.setType("start");
            break;
          case "set-destination":
            this.setType("end");
            break;
          case "remove-marker":
            indoorEqual.removeMarker(this);
            break;
          case "remove-start":
            this.setType("geo");
            break;
        }
        this.getPopup()?.remove();
      });
    });
    updateStartButtonVisibility();
  }
}

const gl = new maplibregl.Map({
  container: "map",
  style:
    "https://api.maptiler.com/maps/openstreetmap/style.json?key=UOLh4Ktc21SMniW0v30i",
  center: [-87.882799, 43.077622],
  zoom: 17,
  minZoom: 17,
  maxZoom: 20,
  attributionControl: false,
});
const indoorEqual = new CustomIndoorEqual(gl, {
  url: "https://osm.uwmnav.dedyn.io",
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
const startButton = document.getElementById("start-navigation");

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

// Alter to work with navigation api
startButton.addEventListener("click", async () => {
  console.log(
    "Start: ",
    indoorEqual.start._lngLat,
    "\nDest: ",
    indoorEqual.destination._lngLat
  );
});
// <!-- get the users current location. display it as a marker on the map. -->
// TODO: add a floor to the geo marker. Maybe based on possible levels at the coords?
navigator.geolocation.watchPosition(
  currentLocationSuccess,
  currentLocationError
);

let lastMarker;

// called every time a new location is received
function currentLocationSuccess(pos) {
  let markerType = "geo"
  if (lastMarker) {
    if (lastMarker._type === "geoStart") {
      markerType = "geoStart"
    }
    indoorEqual.removeMarker(lastMarker, lastMarker._level)
  }
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  lastMarker = new TypedMarker({}, markerType).setLngLat([lng, lat]).addTo(gl);

  indoorEqual.addMarker(lastMarker, 0);
}


function currentLocationError(err) {
  if (err.code === 1) {
    // <!-- user declined geolocation -->
    console.log("Geolocation declined by user");
  } else {
    // <!-- could not get geolocation -->
    console.log("Could not getgeolocation. Does your device support it?");
  }
}

// Marker functionality
// TODO: Add options in the popup menu (e.g. copy coordinates, change floor, etc.)
let currentLevel = 0;
let longPressTimer;

let currentMarkers = [];
const MAX_MARKERS = 2;

const LONG_PRESS_DURATION = 500; // Milliseconds

// Function to update the visibility of the Start button
function updateStartButtonVisibility() {
  const startButton = document.getElementById("start-navigation");
  if (indoorEqual.start && indoorEqual.destination) {
    startButton.style.display = "block";
  } else {
    startButton.style.display = "none";
  }
}

function handleMarkerCreation(e) {
  if (currentMarkers.length >= MAX_MARKERS) {
    const [oldestMarker, oldestMarkerLevel] = currentMarkers.shift(); // remove oldest marker
    indoorEqual.removeMarker(oldestMarker, oldestMarkerLevel);
  }

  // Ensure we have valid coordinates
  if (!e.lngLat) {
    console.warn("No lngLat available from the event.");
    return;
  }

  let marker = new TypedMarker({}, "none", currentLevel).setLngLat(e.lngLat).addTo(gl);

  indoorEqual.addMarker(marker);
  currentMarkers.push([marker, currentLevel]);
}
gl.on("contextmenu", handleMarkerCreation);

// This code makes interaction with the markers better on mobile
function handleTouchStart(e) {
  // Prevent action if there are multiple touches
  if (e.originalEvent.touches.length > 1) {
    return;
  }

  longPressTimer = setTimeout(() => {
    handleMarkerCreation(e);
  }, LONG_PRESS_DURATION);
}

function handleTouchEnd(e) {
  clearTimeout(longPressTimer);
}

function handleTouchMove(e) {
  clearTimeout(longPressTimer);
}

gl.on("touchstart", handleTouchStart);
gl.on("touchend", handleTouchEnd);
gl.on("touchmove", handleTouchMove);

// Listen for level changes
indoorEqual.on("levelchange", (level) => {
  currentLevel = level;
  console.log(`Level changed to ${currentLevel}`);
});
