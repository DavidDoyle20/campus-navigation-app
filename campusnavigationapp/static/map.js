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
  minZoom: 17,
  maxZoom: 20,
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
let longPressTimer;
const LONG_PRESS_DURATION = 500; // Milliseconds

function handleMarkerCreation(e) {
  // Ensure we have valid coordinates
  if (!e.lngLat) {
    console.warn("No lngLat available from the event.");
    return;
  }

  // the longitude and latitude from the event
  console.log(e.lngLat);

  // Creates and adds marker to the map
  let marker = new maplibregl.Marker({
    color: "#FF0000",
  })
    .setLngLat(e.lngLat)
    .addTo(gl);

  // Defines the html for the remove marker button
  const popupContent = document.createElement("div");
  popupContent.innerHTML = `
    <button id="remove-marker">Remove Marker</button>
  `;

  // Adds the popup to the new marker
  const popup = new maplibregl.Popup().setDOMContent(popupContent);
  marker.setPopup(popup);

  // Adds an event listener to the marker
  popupContent.querySelector("#remove-marker").addEventListener("click", () => {
    marker.remove();
    indoorEqual.removeMarker(marker, currentLevel);
  });

  // Adds an onlick event listener for the popup
  marker.on("click", (e) => marker.togglePopup());
  indoorEqual.addMarker(marker, currentLevel);
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
  console.log(`Level changed to ${level}`);
});

// <!-- get the users current location. display it as a marker on the map. -->
navigator.geolocation.watchPosition(
  currentLocationSuccess,
  currentLocationError
);

let currentLocationMarker;

function currentLocationSuccess(pos) {
  if (currentLocationMarker) {
    currentLocationMarker.remove();
  }
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  currentLocationMarker = new maplibregl.Marker();
  currentLocationMarker.setLngLat([lng, lat]);
  currentLocationMarker.addTo(gl);
}
function currentLocationError(err) {
  if (err.code === 1) {
    // <!-- user declined geolocation -->
  } else {
    // <!-- could not get geolocation -->
  }
}

//open route service section:
//This is the basic implimintation of ors, takes 2 fixed points, calls the openroute with url.
//if route is found, process the data, and call display route which is passed the returned jsom data
//maplibregl uses geoJSOM to process routes, so need to convert the JSOM to geoJSOM first
//then we update or add a srouce, and a layer to the map
const getDirectionsButton = document.getElementById('getDirectionsButton');

//key: 5b3ce3597851110001cf6248cba65e5f9d29419d831a527c391f1e9b
const orsApiKey = '5b3ce3597851110001cf6248cba65e5f9d29419d831a527c391f1e9b';

//two points
const markerA = [43.0752889, -87.8862879];
const markerB = [43.075514, -87.884123];
//places a new marker at the start and end points for referance. we will want to use the markers we put down later.
new maplibregl.Marker().setLngLat(markerA.slice().reverse()).addTo(gl);
new maplibregl.Marker().setLngLat(markerB.slice().reverse()).addTo(gl);

async function getDirections(start, end) {
      //send start and end points to ors server
      const url = `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${orsApiKey}&start=${start[1]},${start[0]}&end=${end[1]},${end[0]}`;

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
          console.log('Route:', route);
          console.log('Distance:', distance, 'meters');
          console.log('Duration:', duration, 'seconds');

          //update the map to show the routing.
          displayRouteOnMap(route);

          //returns the three broken up sections of data as an array.
          return { route, distance, duration };
        } else {
          console.error('No route found.');
          return null;
        }
      } catch (error) {
        console.error('Error fetching directions:', error);
        return null;
      }
    }

    //updates map to show the routing
    function displayRouteOnMap(routeCoordinates) {
    //since ors returns jsom and maplibregl uses geoJSOM we need to convert it
      const routeGeoJsonData = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates,
        },
      };

      //checks if we made a rout already, updates it with new geoJSON data, otherwise makes new route
      if (gl.getSource('route')) {
        gl.getSource('route').setData(routeGeoJsonData);
      } else {
        //to add a route we need a source, the geojson data, and a layer, which contains the line
        gl.addSource('route', {
          type: 'geojson',
          data: routeGeoJsonData,
        });

        gl.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#3887be',
            'line-width': 5,
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

    //todo: need to update map.html to add a button to grab route. atm I have just hijacked the bookmark button to run the route functions.
    getDirectionsButton.addEventListener('click', () => {
      getDirections(markerA, markerB)
    });