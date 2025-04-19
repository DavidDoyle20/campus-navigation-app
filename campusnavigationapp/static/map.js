(function () {
  let indoorEqual, gl;
  let accessible = false;


  class CustomIndoorEqual extends IndoorEqual {
    constructor(map, options) {
      super(map, options);
      // does not include location marker
      this.MAX_MARKERS = 2;
      this.level = 0;
      // does not store location marker
      this.markers = [];
      this.start = null;
      this.destination = null;
      this.location = null;
      this.roomLayers = new Map();
    }

    addMarker(marker) {
      // Handle location marker separately
      if (marker._type == "geo") {
        marker.addTo(this.map);
        this.location = marker;
        return;
      }
      // remove color from geo
      if (marker._type == "start") {
        if (this.start) {
          this.start.setType("none");
        }
        this.start = marker;
        // Update geo marker if it was the start
        if (this.location._type === "geoStart") {
          this.location.setType("geo");
        }
      }
      if (marker._type == "end") {
        if (this.destination) {
          this.destination.setType("none");
        }
        this.destination = marker;
      }
      //adjust if needed, should stop markers set as waypoints from being removed.
      if (this.markers.length >= this.MAX_MARKERS) {
        //find next element that is not flagged as waypoint to remove.
        for (let i = 0; i < this.markers.length; i++) {
          if (
            this.markers[i]._type != "start" &&
            this.markers[i]._type != "end"
          ) {
            const oldestMarker = this.markers[i];
            this.removeMarker(oldestMarker);
            break;
          }
        }
      }
      this.markers.push(marker);
      marker.addTo(this.map);
      this.removeRoute();
      updateStartButtonVisibility();
    }

    createAndAddMarker(lng, lat, type = "none", level = 0) {
      if (typeof lng !== "number" || typeof lat !== "number") {
        throw new Error("Invalid coordinates", lng, lat);
      }
      if (!TypedMarker.VALID_TYPES.has(type)) {
        type = "none";
      }
      const marker = new TypedMarker({}, type, level).setLngLat([lng, lat]);
      this.addMarker(marker);
      this.toggleMarkers(this.level);
      return marker;
    }

    // Toggle markers bases on level
    toggleMarkers(level = this.level) {
      // marker levels are numbers while the inddorequal level is a string
      if (this.location) {
        const shouldShow = this.location._level + "" === level;
        shouldShow ? this.location.addTo(this.map) : this.location.remove();
      }
      // Update regular markers
      this.markers.forEach((marker) => {
        marker._level + "" === level ? marker.addTo(this.map) : marker.remove();
      });
    }

    removeMarker(marker) {
      marker.remove();
      const index = this.markers.indexOf(marker);
      if (index > -1) {
        this.markers.splice(index, 1);
      }

      // if (marker === this.location) this.location = null;
      if (marker === this.start) this.start = null;
      if (marker === this.destination) this.destination = null;

      this.removeRoute();
      updateStartButtonVisibility();
    }

    setLevel(level) {
      this.level = level;
      this._updateFilters();
      this.toggleMarkers(level);
      this._emitLevelChange();
      this._updateRouteVisibility();
      this._updateFloorColor();
      this._updateRoomVisibility();
    }

    _updateFloorColor() {
      try {
        let start, end;
        for (let i = 0; i < this._control.$el.children.length; i++) {
          start = false;
          end = false;
          for (let j = 0; j < this.markers.length; j++) {
            if (
              this.markers[j]._level == this._control.$el.children[i].innerText
            ) {
              if (this.markers[j]._type == "start") {
                this._control.$el.children[i].style.background = "#007ffb";
                start = true;
              } else if (this.markers[j]._type == "end") {
                this._control.$el.children[i].style.background = "#4CAF50";
                end = true;
              }
            }
            if (start && end) {
              this._control.$el.children[i].style.backgroundImage =
                "linear-gradient(to left, #007ffb 0%, #007ffb 50%, #4CAF50 50%)";
            }
            if (
              this._control.$el.children[i].className ==
              "maplibregl-ctrl-active"
            ) {
              this._control.$el.children[i].style.background = "#ffbd00";
            }
          }
        }
      } catch (e) {
        console.error("An error occurred:", e.message);
      }
    }

    removeRoute() {
      //remove routing layer if markers get changed.
      if (this.map.getLayer("route") != undefined) {
        this.map.removeLayer("route");
        this.map.removeSource("route");
      }
    }

    _updateRouteVisibility() {
      if (this.map.getSource("route")) {
        this.map.setFilter("route", [
          "==",
          ["to-number", ["get", "level"]],
          parseInt(this.level, 10),
        ]);
      }
    }

    _updateRoomVisibility() {
      // Toggle all room layers' visibility
      this.roomLayers.forEach((level, layerId) => {
        const visibility = level === this.level ? "visible" : "none";
        this.map.setLayoutProperty(layerId, "visibility", visibility);
      });
    }
  }

  class TypedMarker extends maplibregl.Marker {
    static VALID_TYPES = new Set(["start", "end", "none", "geo", "geoStart"]);
    static TYPE_COLORS = {
      start: "#007bff",
      end: "#4CAF50",
      none: "#333333",
      geo: "#80b0ff",
      geoStart: "#007bff",
    };

    constructor(options = {}, type = "none", level = "0") {
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
      // If the new type is one of these the start variable is set to null in preparation
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

    // Changes marker types
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
        indoorEqual.location
          ? indoorEqual.location.setType("geoStart")
          : console.log("Location is undefined", indoorEqual.location);
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
      indoorEqual.location.setType("geo");
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
          popupHTML = `<button id="remove-marker">Remove Marker</button><button id="set-destination">Set Destination</button>`;
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
      //todo when setting start and end postion, update floor level color to keep track of markers. will also need reset as markers are updated.
      popupContent.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", (e) => {
          switch (e.target.id) {
            case "set-start":
              this.setType("start");
              var ele = document.getElementsByClassName(
                "maplibregl-ctrl-active"
              );
              ele[0].style.background = "#007ffb";
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
    const mapContainer = document.getElementById("map");

    // create loading overlay
    const loadingOverlay = document.createElement("div");
    loadingOverlay.className = "loading-overlay";
    loadingOverlay.innerHTML = '<div class="loader"></div>';
    mapContainer.appendChild(loadingOverlay);

    gl = new maplibregl.Map({
      container: "map",
      style:
        "https://api.maptiler.com/maps/openstreetmap/style.json?key=UOLh4Ktc21SMniW0v30i",
      center: [-87.882799, 43.077622],
      zoom: 17,
      minZoom: 16,
      maxZoom: 20,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    gl.dragRotate.disable();

    indoorEqual = new CustomIndoorEqual(gl, {
      url: "https://osm.uwmnav.dedyn.io",
      heatmap: false,
    });
    // <!-- get the users current location. display it as a marker on the map. -->
    // TODO: add a floor to the geo marker. Maybe based on possible levels at the coords?
    navigator.geolocation.watchPosition(
      currentLocationSuccess,
      currentLocationError,
      { enableHighAccuracy: true }
    );

    Promise.all([
      new Promise((resolve) =>
        indoorEqual
          .loadSprite(
            "https://unpkg.com/maplibre-gl-indoorequal@latest/sprite/indoorequal"
          )
          .then(resolve)
      ),
      new Promise((resolve) => gl.once("idle", resolve)),
      new Promise((resolve) => {
        const handler = () => {
          indoorEqual.off("levelschange", handler); // Remove listener after first trigger
          resolve();
        };
        indoorEqual.on("levelschange", handler); // Use standard event listener
      }),
    ])
      .then(() => {
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
        loadingOverlay.remove();
        enableInteractions();
      })
      .catch((error) => {
        console.error("Initialization failed:", error);
        loadingOverlay.innerHTML = "Failed to load indoor navigation";
      });
  }

  function enableInteractions() {
    // Enable interactions
    gl.addControl(indoorEqual);
    gl.on("contextmenu", handleMarkerCreation);
    gl.on("touchstart", handleTouchStart);
    gl.on("touchend", handleTouchEnd);
    gl.on("touchmove", handleTouchMove);

    window.addEventListener("resize", () => gl.resize());
    window.addEventListener("zoomevent", () => gl.resize());

    let gyroscope = new Gyroscope({ frequence: 60 });
    gyroscope.addEventListener("reading", (e) => {
      console.log(`Angular velocity along the X-axis ${gyroscope.x}`);
      console.log(`Angular velocity along the Y-axis ${gyroscope.y}`);
      console.log(`Angular velocity along the Z-axis ${gyroscope.z}`);
    });
    gyroscope.start();
  }
  document.addEventListener("DOMContentLoaded", function () {
    initMap(); // Initialize first
    loadBookmarks();

    addBookmarkButton[0].addEventListener("click", function (e) {
      addBookmark(e);
    });
  });

  const addBookmarkButton = document.getElementsByClassName("bookmark_add");
  const startButton = document.getElementById("start-navigation");
  const accessibilityButton = document.getElementsByClassName("accessible")[0];

  startButton.addEventListener("click", async () => {
    console.log(
      "Start: ",
      indoorEqual.start._lngLat,
      "\nDest: ",
      indoorEqual.destination._lngLat
    );

    getDirections(indoorEqual.start, indoorEqual.destination);
  });

  accessibilityButton.addEventListener("click", () => {
    accessible = !accessible;
    accessibilityButton.classList.toggle("active");
  });

  async function addBookmark() {
    if (!indoorEqual.start && !indoorEqual.destination) {
      alert("Please enter a start or a destination");
      console.log("Missing start or destination");
      return;
    }

    let name;
    do {
      name = prompt("Enter bookmark name (required):");
      if (name === null) return; // User clicked cancel
      name = name.trim();
    } while (!name);

    const formData = new FormData();
    formData.append("name", name);
    if (indoorEqual.start) {
      formData.append("start_level", indoorEqual.start._level);
      formData.append("start_lng", indoorEqual.start._lngLat.lng);
      formData.append("start_lat", indoorEqual.start._lngLat.lat);
    }
    if (indoorEqual.destination) {
      formData.append("end_level", indoorEqual.destination._level);
      formData.append("end_lng", indoorEqual.destination._lngLat.lng);
      formData.append("end_lat", indoorEqual.destination._lngLat.lat);
    }

    if (!name) return;

    try {
      const response = await fetch("/bookmarks/save/", {
        method: "POST",
        headers: {
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: formData,
      });

      const result = await response.json();
      if (result.status === "success") {
        loadBookmarks();
        console.log(result);
      }
    } catch (error) {
      console.error("Bookmark save error:", error);
    }
  }

  async function loadBookmarks() {
    try {
      const response = await fetch("/bookmarks/");
      const data = await response.json();
      const dropdown = document.getElementById("bookmarks-dropdown");

      // Clear existing content safely
      dropdown.replaceChildren();

      data.bookmarks.forEach((bookmark) => {
        const li = document.createElement("li");
        li.dataset.bookmarkId = bookmark.id;
        li.innerHTML = `
          <div class="bookmark-item">
            <span class="button-primary">${bookmark.name}</span>
            <button class="button-delete">❌</button>
          </div>
            `;
        dropdown.appendChild(li);
      });
    } catch (error) {
      console.error("Error loading bookmarks:", error);
    }
  }

  // Outside of loadbookmarks
  document
    .getElementById("bookmarks-dropdown")
    .addEventListener("click", async (e) => {
      const listItem = e.target.closest("li");
      const bookmarkId = listItem.dataset.bookmarkId;

      // Handle delete button click
      if (e.target.classList.contains("button-delete")) {
        e.preventDefault();
        try {
          const response = await fetch(`/bookmarks/delete/${bookmarkId}/`, {
            method: "DELETE",
            headers: {
              "X-CSRFToken": getCookie("csrftoken"),
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            listItem.remove();
            console.log("Bookmark deleted successfully");
          } else {
            console.error("Delete failed:", await response.json());
          }
        } catch (error) {
          console.error("Delete error:", error);
        }
        return;
      }

      if (e.target.classList.contains("bookmark-item")) {
        try {
          const response = await fetch(`/bookmarks/${bookmarkId}/`);
          const { bookmark } = await response.json();

          if (bookmark.start_level !== null) {
            indoorEqual.createAndAddMarker(
              bookmark.start_lng,
              bookmark.start_lat,
              "start",
              bookmark.start_level
            );
          }
          if (bookmark.end_level !== null) {
            indoorEqual.createAndAddMarker(
              bookmark.end_lng,
              bookmark.end_lat,
              "end",
              bookmark.end_level
            );
          }
        } catch (error) {
          console.error("Error loading bookmark:", error);
        }
      }
    });

  // Sidebar controls
  const sidebar = document.querySelector(".sidebar");
  let wasActive = false;
  let hoverTimeout;

  // Toggle dropdown
  document.querySelectorAll(".dropdown-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const container = e.currentTarget.closest(".dropdown-container");
      container.classList.toggle("active");
    });
  });

  // Open sidebar when mouse hovers
  sidebar.addEventListener("mouseenter", (e) => {
    clearTimeout(hoverTimeout);

    if (wasActive) {
      const previouslyActive = document.querySelector(".dropdown-container");
      previouslyActive.classList.add("active");
      wasActive = false;
    }
  });

  //Close dropdown if mouse leaves sidebar
  sidebar.addEventListener("mouseleave", (e) => {
    const activeDropdown = document.querySelector(".dropdown-container.active");
    if (activeDropdown) {
      wasActive = true;
      hoverTimeout = setTimeout(() => {
        activeDropdown.classList.remove("active");
      }, 300);
    }
  });

  // For mobile functionality close sidebar if map is clicked
  document.addEventListener("click", (e) => {
    const activeDropdown = document.querySelector(".dropdown-container.active");
    if (!sidebar.contains(e.target)) {
      sidebar.classList.remove("active");
      if (activeDropdown) {
        activeDropdown.classList.remove("active");
        wasActive = true;
      }
    }
  });

  document.querySelectorAll(".dropdown-trigger").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      const container = e.currentTarget.closest(".dropdown-container");
      const isOpening = !container.classList.contains("active");

      // Close all dropdowns first
      document.querySelectorAll(".dropdown-container").forEach((c) => {
        c.classList.remove("active");
      });

      // Toggle clicked dropdown
      if (isOpening) {
        container.classList.add("active");
      }
    });
  });

  // called every time a new location is received
  function currentLocationSuccess(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Update location marker
    if (indoorEqual.location) {
      indoorEqual.location.setLngLat([lng, lat]);
    } else {
      indoorEqual.createAndAddMarker(lng, lat, "geo", 0);
    }
  }

  function currentLocationError(err) {
    const errorMessage =
      {
        1: "Please enable location access in browser settings",
        2: "Location unavailable (check GPS/WiFi)",
        3: "Location request timed out",
      }[err.code] || "Geolocation error";

    window.alert(errorMessage);
  }

  // Marker functionality
  // TODO: Add options in the popup menu (e.g. copy coordinates, change floor, etc.)
  let longPressTimer;
  const LONG_PRESS_DURATION = 500; // Milliseconds

  // Function to update the visibility of the Start button
  function updateStartButtonVisibility() {
    const startButton = document.getElementById("start-navigation");
    if (indoorEqual.start && indoorEqual.destination && !isRouteDisplayed()) {
      startButton.style.display = "block";
    } else {
      startButton.style.display = "none";
    }
  }

  function handleMarkerCreation(e) {
    // Ensure we have valid coordinates
    if (!e.lngLat) {
      console.warn("No lngLat available from the event.");
      return;
    }

    const { lng, lat } = e.lngLat;
    const newMarker = indoorEqual.createAndAddMarker(
      lng,
      lat,
      "none",
      indoorEqual.level
    );
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

  function handleTouchEnd() {
    clearTimeout(longPressTimer);
  }

  function handleTouchMove() {
    clearTimeout(longPressTimer);
  }

  async function getDirections(start, end) {
    try {
      const { lng: startLng, lat: startLat } = start._lngLat;
      const { lng: endLng, lat: endLat } = end._lngLat;
      const startLevel = parseInt(start._level, 10);
      const endLevel = parseInt(end._level, 10);

      // Existing direction fetching logic
      const response = await fetch("https://osm.uwmnav.dedyn.io/api/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: {
            lat: startLat,
            lng: startLng,
            level: startLevel,
          },
          destination: {
            lat: endLat,
            lng: endLng,
            level: endLevel,
          },
          profile: accessible ? "wheelchair" : "foot",
          direction: "forward",
          max: 3600,
        }),
      });

      // Process response and display route
      const data = await response.json();
      if (data.features?.length) {
        addRouteToMap(data);
      }
    } catch (error) {
      console.error("Error fetching directions:", error);
    }
  }

  // Update when adding routes
  function addRouteToMap(routeGEOJSON) {
    displayRouteOnMap(routeGEOJSON);
  }

  //updates map to show the routing
  function displayRouteOnMap(routeGEOJSON) {
   console.log(
    "Level types:",
    routeGEOJSON.features.map((f) => ({
      raw: f.properties.level,
      parsed: parseFloat(f.properties.level),
      type: typeof f.properties.level,
    }))
  );

  // Clear previous route if it exists
  if (gl.getSource("route")) {
    gl.getSource("route").setData(routeGEOJSON);
  } else {
    gl.addSource("route", {
      type: "geojson",
      data: routeGEOJSON,
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
        "line-opacity": [
          "case",
          ["boolean", ["feature-state", "cleared"], false],
          0.3,
          1,
        ],
      },
      filter: ["==", ["get", "level"], indoorEqual.level],
    });
  }

  indoorEqual._updateRouteVisibility();
  updateStartButtonVisibility();

  // Flatten all route coordinates
  const allCoordinates = [];
  routeGEOJSON.features.forEach((feature) => {
    const coords = feature.geometry.coordinates;
    coords.forEach((c) => allCoordinates.push(c));
  });

  // Save route for replay
  animatedRouteCoordinates = allCoordinates;

  // Animate marker along the route
  if (allCoordinates.length > 1) {
    // Remove existing marker
    if (movingMarker) movingMarker.remove();

    // Create new animated marker
    movingMarker = new maplibregl.Marker({ color: "blue" })
      .setLngLat(allCoordinates[0])
      .addTo(gl);

    // Start animation
    animateMarker(movingMarker, allCoordinates, 0.00005, gl);

    // Show Replay button
    document.getElementById("replay-animation").style.display = "block";
  }


    //zooms in/out the map to fit the full route in the screen.
    // const bounds = routeCoordinates.reduce(
    //   (bounds, coord) => bounds.extend(coord),
    //   new maplibregl.LngLatBounds(routeCoordinates[0], routeCoordinates[0])
    // );
    // gl.fitBounds(bounds, { padding: 20 });
  }

  function isRouteDisplayed() {
    return gl.getSource("route") && gl.getLayer("route");
  }

  function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == " ") {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }

  // function to be called from search bar
  //done: if only building name is searched highlight the full building.
  //todo: parse user input better. look for spaces or any other special characters like , to seperate room and building refs
  //done: fix case sensitivity. should find building and room regardless of case.

  async function search(address) {
    console.log(address, typeof address);
    // Doesnt contain room number so search for building
    if (typeof address !== "string") {
      displayBuilding(address);
      return;
    }
    if (!address.includes(",")) {
      const building_name = address.trim();
      const buildings = await loadBuildings();
      const building = buildings.find((b) => b.name === building_name);
      displayBuilding(building);
    } else {
      const arr = address.split(",");
      if (arr.length < 2) {
        return;
      }
      const building_name = arr[0].trim();
      const room_number = arr[1].trim();
      const response = await fetch("https://osm.uwmnav.dedyn.io/v1/find-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          building: building_name,
          room: room_number,
        }),
      });

      const data = await response.json();
      console.log(data);
      displayRoom(data);
    }
  }

  function displayBuilding(data) {
    if (gl.getLayer("building-fill")) {
      gl.removeLayer("building-fill");
    }
    if (gl.getLayer("building-line")) {
      gl.removeLayer("building-line");
    }

    if (gl.getSource("building-data")) {
      gl.removeSource("building-data");
    }

    const coordinates = data.nodes.map((node) => [
      node.longitude,
      node.latitude,
    ]);

    // Ensure polygon is closed
    if (
      JSON.stringify(coordinates[0]) !==
      JSON.stringify(coordinates[coordinates.length - 1])
    ) {
      coordinates.push(coordinates[0]);
    }

    gl.addSource("building-data", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [coordinates],
            },
          },
        ],
      },
    });

    gl.addLayer({
      id: "building-fill",
      type: "fill",
      source: "building-data",
      paint: {
        "fill-color": "#3388ff",
        "fill-opacity": 0.5,
      },
    });

    gl.addLayer({
      id: "building-line",
      type: "line",
      source: "building-data",
      paint: {
        "line-color": "#3388ff",
        "line-width": 2,
      },
    });

    // Zoom to room
    const bounds = coordinates.reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
    );
    gl.fitBounds(bounds, { padding: 20, maxZoom: 21 });
  }

  function displayRoom(data) {
    // Clear building layers if they are present
    if (gl.getLayer("building-fill")) {
      gl.removeLayer("building-fill");
    }
    if (gl.getLayer("building-line")) {
      gl.removeLayer("building-line");
    }
    indoorEqual.roomLayers.forEach((_, layerId) => {
      if (gl.getLayer(layerId)) {
        gl.removeLayer(layerId);
      }
    });
    indoorEqual.roomLayers.clear();

    if (gl.getSource("room-data")) {
      gl.removeSource("room-data");
    }

    const coordinates = data.nodes.map((node) => [
      node.longitude,
      node.latitude,
    ]);

    // Ensure polygon is closed
    if (
      JSON.stringify(coordinates[0]) !==
      JSON.stringify(coordinates[coordinates.length - 1])
    ) {
      coordinates.push(coordinates[0]);
    }

    // Create unique layer IDs with level prefix
    const levelPrefix = `level-${data.tags.level}-`;
    const fillLayerId = `${levelPrefix}fill-${data.osm_id}`;
    const borderLayerId = `${levelPrefix}border-${data.osm_id}`;

    // Store layer-level relationships
    indoorEqual.roomLayers.set(fillLayerId, data.tags.level);
    indoorEqual.roomLayers.set(borderLayerId, data.tags.level);

    gl.addSource("room-data", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [coordinates],
            },
          },
        ],
      },
    });

    gl.addLayer({
      id: fillLayerId,
      type: "fill",
      source: "room-data",
      paint: {
        "fill-color": "#3388ff",
        "fill-opacity": 0.5,
      },
    });

    gl.addLayer({
      id: borderLayerId,
      type: "line",
      source: "room-data",
      paint: {
        "line-color": "#3388ff",
        "line-width": 2,
      },
    });

    // Set initial visibility
    indoorEqual.setLevel(data.tags.level);
    indoorEqual.createAndAddMarker(
      data.longitude,
      data.latitude,
      "none",
      data.tags.level
    );

    // Zoom to room
    const bounds = coordinates.reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
    );
    gl.fitBounds(bounds, { padding: 20, maxZoom: 21 });
  }

  class Building {
    constructor(latitude, longitude, osm_id, name, nodes) {
      this.latitude = latitude;
      this.longitude = longitude;
      this.osm_id = osm_id;
      this.name = name;
      this.nodes = nodes;
    }
  }

  let buildingsCache = null;

  async function loadBuildings() {
    if (buildingsCache) return buildingsCache;

    try {
      const response = await fetch("https://osm.uwmnav.dedyn.io/v1/building");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      const buildingsArray =
        Array.isArray(data) && typeof data[0]?.count === "number"
          ? data.slice(1)
          : data;

      buildingsCache = buildingsArray
        .filter((obj) => obj.osm_id && obj.name)
        .map(
          (obj) =>
            new Building(
              obj.latitude,
              obj.longitude,
              obj.osm_id,
              obj.name,
              obj.nodes
            )
        );
      return buildingsCache;
    } catch (error) {
      console.error("Fetching error:", error);
      return [];
    }
  }

  let name; // Global variable to store the selected name

  new Autocomplete("#autocomplete", {
    search: async (input) => {
      if (!input) return [];
      const lowerCaseInput = input.toLowerCase();
      const buildings = await loadBuildings();
      return buildings.filter((item) =>
        item.name.toLowerCase().startsWith(lowerCaseInput)
      );
    },
    getResultValue: (item) => item.name,
    onSubmit: (result) => {
      name = result;
      const inputBox = document.querySelector("#building-search");
      console.log(`Selected item: ${name}`);
      search(name);

      appendCommaToAutocomplete();
    },
  });

  $("#building-search").on("keyup", function (e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      const inputBox = document.querySelector("#building-search");
      name = inputBox.value;
      console.log(`Searching address: ${name}`);
      search(name);
      appendCommaToAutocomplete();
    }
  });

  function appendCommaToAutocomplete() {
    const inputBox = document.querySelector("#building-search");
    const val = inputBox.value;
    if (val.includes(", ")) {
      return;
    }
    inputBox.value = inputBox.value + ", ";
  }
})();
document.addEventListener("DOMContentLoaded", function () {
  const helpLink = document.getElementById("help-link");
  const modal = document.getElementById("help-modal");
  const closeBtn = document.getElementById("close-help");

  if (helpLink && modal && closeBtn) {
    helpLink.addEventListener("click", function (e) {
      e.preventDefault();
      modal.style.display = "block";
    });

    closeBtn.addEventListener("click", function () {
      modal.style.display = "none";
    });

    window.addEventListener("click", function (e) {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  }
});
// Declare global variables at the top of your file if not already there:
let movingMarker = null;
let animatedRouteCoordinates = [];

/**
 * Animates a marker along a list of coordinates at a given speed.
 */
function animateMarker(marker, coordinates, speed = 0.00005, map = null) {
  let index = 0;

  function move() {
    if (index >= coordinates.length - 1) return;

    const [start, end] = [coordinates[index], coordinates[index + 1]];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];

    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(distance / speed);
    let step = 0;

    function stepMove() {
      if (step >= steps) {
        index++;
        move(); // move to next segment
        return;
      }

      const lng = start[0] + (dx * step / steps);
      const lat = start[1] + (dy * step / steps);
      const position = [lng, lat];

      marker.setLngLat(position);

      if (map) {
        map.easeTo({
          center: position,
          duration: 200,
          zoom: map.getZoom(),
        });
      }

      step++;
      requestAnimationFrame(stepMove);
    }

    stepMove();
  }

  move();
}

/**
 * Handles the Replay Animation button click.
 */
document.getElementById("replay-animation").addEventListener("click", () => {
  console.log("Replay button clicked");

  if (animatedRouteCoordinates.length > 1 && typeof gl !== "undefined") {
    if (movingMarker) movingMarker.remove();

    movingMarker = new maplibregl.Marker({ color: "blue" })
      .setLngLat(animatedRouteCoordinates[0])
      .addTo(gl);

    animateMarker(movingMarker, animatedRouteCoordinates, 0.00005, gl);
  } else {
    console.warn("Replay failed: Route or map not ready.");
  }
});