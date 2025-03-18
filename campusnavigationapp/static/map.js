(function () {
  let indoorEqual, gl;

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
    }

    addMarker(marker) {
      // Handle location marker separately
      if (marker._type == "geo") {
        this.location = marker;
        return;
      }
      // remove color from geo
      if (marker._type == "start") {
        this.start = marker;
        // Update geo marker if it was the start
        if (this.location._type === "geoStart") {
          this.location.setType("geo");
        }
      }
      if (marker._type == "end") {
        this.destination = marker;
      }

      if (this.markers.length >= this.MAX_MARKERS) {
        const oldestMarker = this.markers.shift();
        this.removeMarker(oldestMarker);
      }
      this.markers.push(marker);
      marker.addTo(this.map);
      this.updateRoute();
      updateStartButtonVisibility();
    }

    createAndAddMarker(lng, lat, type = "none", level = 0) {
      if (typeof lng !== "number" || typeof lat !== "number") {
        throw new Error("Invalid coordinates");
      }
      if (!TypedMarker.VALID_TYPES.has(type)) {
        type = "none";
      }
      const marker = new TypedMarker({}, type, level).setLngLat([lng, lat]);
      this.addMarker(marker);
      return marker;
    }

    // Toggle markers bases on level
    toggleMarkers(level = this.level) {
      if (this.location) {
        const shouldShow = this.location._level === level;
        shouldShow ? this.location.addTo(this.map) : this.location.remove();
      }
      // Update regular markers
      this.markers.forEach((marker) => {
        marker._level === level ? marker.addTo(this.map) : marker.remove();
      });
    }

    removeMarker(marker) {
      marker.remove();
      const index = this.markers.indexOf(marker);
      if (index > -1) {
        this.markers.splice(index, 1);
      }

      if (marker === this.location) this.location = null;
      if (marker === this.start) this.start = null;
      if (marker === this.destination) this.destination = null;

      this.updateRoute();
      updateStartButtonVisibility();
    }

    setLevel(level) {
      this.level = level;
      this._updateFilters();
      this.toggleMarkers(level);
      this._emitLevelChange();
    }

    updateRoute() {
      //remove routing layer if markers get changed.
      if (this.map.getLayer("route") != undefined) {
        this.map.removeLayer("route");
        this.map.removeSource("route");
      }
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

    // Initialize other components
    navigator.geolocation.watchPosition(
      currentLocationSuccess,
      currentLocationError
    );
  }
  document.addEventListener("DOMContentLoaded", function () {
    initMap(); // Initialize first
    loadBookmarks();

    // <!-- get the users current location. display it as a marker on the map. -->
    // TODO: add a floor to the geo marker. Maybe based on possible levels at the coords?
    navigator.geolocation.watchPosition(
      currentLocationSuccess,
      currentLocationError
    );
    addBookmarkButton[0].addEventListener("click", function (e) {
      addBookmark(e);
    });
  });

  const addBookmarkButton = document.getElementsByClassName("bookmark_add");
  const startButton = document.getElementById("start-navigation");

  startButton.addEventListener("click", async () => {
    console.log(
      "Start: ",
      indoorEqual.start._lngLat,
      "\nDest: ",
      indoorEqual.destination._lngLat
    );

    getDirections(indoorEqual.start._lngLat, indoorEqual.destination._lngLat);
  });

  async function addBookmark() {
    if (!indoorEqual.start || !indoorEqual.destination) {
      alert("Please enter a start and a destination");
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
    formData.append("start_level", indoorEqual.start._level);
    formData.append("start_lng", indoorEqual.start._lngLat.lng);
    formData.append("start_lat", indoorEqual.start._lngLat.lat);
    formData.append("end_level", indoorEqual.destination._level);
    formData.append("end_lng", indoorEqual.destination._lngLat.lng);
    formData.append("end_lat", indoorEqual.destination._lngLat.lat);

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

      dropdown.innerHTML = data.bookmarks
        .map(
          (bookmark) => `
        <li data-bookmark-id="${bookmark.id}">
          <div class="bookmark-item">
            <span class="button-primary">${bookmark.name}</span>
          </div> 
        </li>
      `
        )
        .join("");
      // Add event listeners
      dropdown.querySelectorAll(".button-primary").forEach((button) => {
        button.addEventListener("click", async (e) => {
          const listItem = e.target.closest("li");
          const bookmarkId = listItem.dataset.bookmarkId;

          try {
            // place bookmark coordinates on map
            const response = await fetch(`/bookmarks/${bookmarkId}/`);
            const { bookmark } = await response.json();

            const startMarker = indoorEqual.createAndAddMarker(
              bookmark.start_lng,
              bookmark.start_lat,
              "start",
              bookmark.start_level
            );
            const endMarker = indoorEqual.createAndAddMarker(
              bookmark.end_lng,
              bookmark.end_lat,
              "end",
              bookmark.end_level
            );

            console.log(indoorEqual.markers);
          } catch (error) {
            console.error("Error loading bookmark: ", error);
          }
        });
      });
    } catch (error) {
      console.error("Error loading bookmarks: ", error);
    }
  }

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

    if (indoorEqual.location) {
      // update the location of the current location marker
      indoorEqual.location.setLngLat([lng, lat]);
    } else {
      // Initial marker creation
      const newMarker = indoorEqual.createAndAddMarker(lng, lat, "geo", 0);
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
  let longPressTimer;
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
    console.log(newMarker);
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

  //open route service section:
  //This is the basic implimintation of ors, takes 2 fixed points, calls the openroute with url.
  //if route is found, process the data, and call display route which is passed the returned jsom data
  //maplibregl uses geoJSOM to process routes, so need to convert the JSOM to geoJSOM first
  //then we update or add a srouce, and a layer to the map

  //key: 5b3ce3597851110001cf6248cba65e5f9d29419d831a527c391f1e9b
  const orsApiKey = "5b3ce3597851110001cf6248cba65e5f9d29419d831a527c391f1e9b";

  async function getDirections(start, end) {
    //send start and end points to ors server
    const url = `http://api.openrouteservice.org/v2/directions/foot-walking?api_key=${orsApiKey}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;

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
})();
