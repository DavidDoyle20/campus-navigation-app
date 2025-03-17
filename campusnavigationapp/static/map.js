(function () {
  let indoorEqual, gl;

  class CustomIndoorEqual extends IndoorEqual {
    constructor(map, options) {
      super(map, options);
      this.markers = {};
      this.start = null;
      this.destination = null;
      this.location = null;
    }

    addMarker(marker) {
      const level = marker._level;
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
      const level = marker._level;
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
    static VALID_TYPES = new Set(["start", "end", "none", "geo", "geoStart"]);
    static TYPE_COLORS = {
      start: "#4CAF50",
      end: "#ffc107",
      none: "#2196F3",
      geo: "#80b0ff",
      geoStart: "#4CAF50",
    };

    constructor(options = {}, type = "none", level = 0) {
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
            svgElement.style.fill =
              TypedMarker.TYPE_COLORS[type] || TypedMarker.TYPE_COLORS["none"];
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
      if (!TypedMarker.VALID_TYPES.has(newType)) return this;

      // Clean up previous type references
      this._cleanupPreviousType();

      // Handle type-specific logic
      this._handleTypeTransition(newType);

      // Update references for start/end types
      this._updateLocationReferences(newType);

      this._createPopup();
      return this;
    }

    _cleanupPreviousType() {
      if (["start", "geoStart"].includes(this._type)) {
        indoorEqual.start = null;
      }
      if (this._type === "end") {
        indoorEqual.destination = null;
      }
    }

    _handleTypeTransition(newType) {
      this._handleExistingMarkers(newType);
      this._updateTypeAndColor(newType);
    }

    _handleExistingMarkers(newType) {
      if (newType === "start" && indoorEqual.start) {
        const previousStart = indoorEqual.start;
        previousStart._type === "geoStart"
          ? previousStart._convertToGeo()
          : previousStart.setType("none");
      }

      if (newType === "end" && indoorEqual.destination) {
        indoorEqual.destination.setType("none");
      }
    }

    _updateTypeAndColor(newType) {
      const isGeoStartTransition = this._type === "geo" && newType === "start";

      if (isGeoStartTransition) {
        this._type = "geoStart";
        this.location?.setType("geoStart");
      } else {
        this._type = newType;
      }

      this._updateColor(TypedMarker.TYPE_COLORS[this._type]);
    }

    _updateLocationReferences() {
      if (this._type === "start" || this._type === "geoStart") {
        indoorEqual.start = this;
      }
      if (this._type === "end") {
        indoorEqual.destination = this;
      }
    }

    _convertToGeo() {
      this.setType("geo");
      this.location.setType("geo");
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

  function initMap() {
    gl = new maplibregl.Map({
      container: "map",
      style:
        "https://api.maptiler.com/maps/openstreetmap/style.json?key=UOLh4Ktc21SMniW0v30i",
      center: [-87.882799, 43.077622],
      zoom: 17,
      minZoom: 17,
      maxZoom: 20,
      attributionControl: false,
    });
    indoorEqual = new CustomIndoorEqual(gl, {
      url: "https://osm.uwmnav.dedyn.io",
    });

    gl.addControl(indoorEqual);
    gl.dragRotate.disable();

    requestIdleCallback(() => {
      indoorEqual.loadSprite(
        "https://unpkg.com/maplibre-gl-indoorequal@latest/sprite/indoorequal"
      );
    });

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
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMap(); // Initialize first

    // Prevent race condition
    gl.on("load", () => {
      gl.on("contextmenu", handleMarkerCreation);
      gl.on("touchstart", handleTouchStart);
      gl.on("touchend", handleTouchEnd);
      gl.on("touchmove", handleTouchMove);
    });

    // Listen for level changes
    indoorEqual.on("levelchange", (level) => {
      currentLevel = level;
      console.log(`Level changed to ${currentLevel}`);
    });

    // <!-- get the users current location. display it as a marker on the map. -->
    // TODO: add a floor to the geo marker. Maybe based on possible levels at the coords?
    navigator.geolocation.watchPosition(
      currentLocationSuccess,
      currentLocationError
    );
  });

  // Sidebar toggle functionality
  const startButton = document.getElementById("start-navigation");

  // Alter to work with navigation api
  startButton.addEventListener("click", async () => {
    console.log(
      "Start: ",
      indoorEqual.start._lngLat,
      "\nDest: ",
      indoorEqual.destination._lngLat
    );
  });
  // Alter to work with navigation api
  startButton.addEventListener("click", async () => {
    console.log(
      "Start: ",
      indoorEqual.start._lngLat,
      "\nDest: ",
      indoorEqual.destination._lngLat
    );

    getDirections(indoorEqual.start._lngLat, indoorEqual.destination._lngLat);
  });
  // <!-- get the users current location. display it as a marker on the map. -->
  // TODO: add a floor to the geo marker. Maybe based on possible levels at the coords?
  navigator.geolocation.watchPosition(
    currentLocationSuccess,
    currentLocationError
  );

  // called every time a new location is received
  function currentLocationSuccess(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (indoorEqual.location) {
      indoorEqual.location.setLngLat([lng, lat]);
    } else {
      // Initial marker creation
      const newMarker = new TypedMarker({}, "geo", 0)
        .setLngLat([lng, lat])
        .addTo(gl);
      indoorEqual.addMarker(newMarker);
      indoorEqual.location = newMarker;
    }
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
      //remove routing layer if markers get changed.
      if (gl.getLayer("route") != undefined) {
        gl.removeLayer("route");
      }
    }

    // Ensure we have valid coordinates
    if (!e.lngLat) {
      console.warn("No lngLat available from the event.");
      return;
    }

    let marker = new TypedMarker({}, "none", currentLevel)
      .setLngLat(e.lngLat)
      .addTo(gl);

    indoorEqual.addMarker(marker);
    currentMarkers.push([marker, currentLevel]);
  }

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

  //open route service section:
  //This is the basic implimintation of ors, takes 2 fixed points, calls the openroute with url.
  //if route is found, process the data, and call display route which is passed the returned jsom data
  //maplibregl uses geoJSOM to process routes, so need to convert the JSOM to geoJSOM first
  //then we update or add a srouce, and a layer to the map

  //key: 5b3ce3597851110001cf6248cba65e5f9d29419d831a527c391f1e9b
  const orsApiKey = "5b3ce3597851110001cf6248cba65e5f9d29419d831a527c391f1e9b";

  async function getDirections(start, end) {
    //send start and end points to ors server
    const url = `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${orsApiKey}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;

    try {
      //gets server response
      const response = await fetch(url);
      //gets the json data from the response
      const data = await response.json();

      //as long as there is a route to take we can process the data
      if (data.features && data.features.length > 0) {
        //splits data up into three usefull fileds
        const route = data.features[0].geometry.coordinates; //the array of points taken from a to b
        const distance = data.features[0].properties.summary.distance; //total distance covered
        const duration = data.features[0].properties.summary.duration; //estimated time of travel

        //pushes to the console to read, can remove after debugging.
        console.log("Route:", route);
        console.log("Distance:", distance, "meters");
        console.log("Duration:", duration, "seconds");

        //update the map to show the routing.
        displayRouteOnMap(route);

        //returns the three broken up sections of data as an array.
        return { route, distance, duration };
      } else {
        console.error("No route found.");
        return null;
      }
    } catch (error) {
      console.error("Error fetching directions:", error);
      return null;
    }
  }

  //updates map to show the routing
  function displayRouteOnMap(routeCoordinates) {
    //since ors returns jsom and maplibregl uses geoJSOM we need to convert it
    const routeGeoJsonData = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: routeCoordinates,
      },
    };

    //checks if we made a rout already, updates it with new geoJSON data, otherwise makes new route
    if (gl.getSource("route")) {
      gl.getSource("route").setData(routeGeoJsonData);
    } else {
      //to add a route we need a source, the geojson data, and a layer, which contains the line
      gl.addSource("route", {
        type: "geojson",
        data: routeGeoJsonData,
      });

      gl.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3887be",
          "line-width": 5,
        },
      });
    }

    //zooms in/out the map to fit the full route in the screen.
    const bounds = routeCoordinates.reduce(
      (bounds, coord) => bounds.extend(coord),
      new maplibregl.LngLatBounds(routeCoordinates[0], routeCoordinates[0])
    );
    gl.fitBounds(bounds, { padding: 20 });
  }
})();
