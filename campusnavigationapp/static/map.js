const MAX_API_ZOOM = 19;
const MIN_API_ZOOM = 1;
const MIN_ZOOM_FOR_ROOMS = 18;

let cachedData = {};
let roomLayer;
let lastBounds;
let labelLayerGroup;

// Level selector control
L.Control.LevelSelector = L.Control.extend({
  options: {
    position: "topright",
  },

  onAdd: function (map) {
    var container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
    var select = L.DomUtil.create("select", "level-selector", container);

    // Add options for different levels
    var levels = ["Ground", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor"];
    levels.forEach(function (level, index) {
      var option = L.DomUtil.create("option", "", select);
      option.value = index;
      option.innerHTML = level;
    });

    L.DomEvent.on(
      select,
      "change",
      function (e) {
        var selectedLevel = parseInt(e.target.value);
        this._map.fire("levelchange", { level: selectedLevel });
      },
      this
    );

    L.DomEvent.disableClickPropagation(container);
    return container;
  },
});

L.control.levelSelector = function (opts) {
  return new L.Control.LevelSelector(opts);
};

async function fetchIndoorData(map, level = 0) {
  const currentZoom = map.getZoom();

  // Removes the room layer under a certain zoom level
  if (currentZoom < MIN_ZOOM_FOR_ROOMS) {
    if (roomLayer) {
      map.removeLayer(roomLayer);
      roomLayer = null;
    }
    if (labelLayerGroup) {
      labelLayerGroup.clearLayers();
    }
    return;
  }

  if (currentZoom < MIN_API_ZOOM) {
    return;
  }

  const maxRetries = 5;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const { url, effectiveZoom } = getOverpassQuery(map, level);
      const cacheKey = `${url}_${effectiveZoom}`;

      if (cachedData[cacheKey]) {
        displayIndoorData(cachedData[cacheKey], map);
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit exceeded");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Received non-JSON response");
      }

      const data = await response.json();
      cachedData[cacheKey] = data;
      displayIndoorData(data, map);
      return;
    } catch (error) {
      console.error("Error fetching indoor data:", error);
      retryCount++;
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error("Max retries reached. Please try again later.");
      }
    }
  }
}

function getEffectiveZoom(map) {
  return Math.min(MAX_API_ZOOM, map.getZoom());
}

function getOverpassQuery(map, level) {
  const bounds = map.getBounds();
  const effectiveZoom = getEffectiveZoom(map);
  const query = `
      [out:json][timeout:25];
      (
        way["indoor"="room"]["level"="${level}"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        node["indoor"="room"]["level"="${level}"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
      );
      out geom;
    `;

  return {
    url: `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
      query
    )}`,
    effectiveZoom: effectiveZoom,
  };
}

function convertToGeoJSON(overpassData) {
  const geojson = {
    type: "FeatureCollection",
    features: [],
  };

  overpassData.elements.forEach((element) => {
    if (element.type === "way" || element.type === "relation") {
      const feature = {
        type: "Feature",
        properties: element.tags,
        geometry: {
          type: "Polygon",
          coordinates: [element.geometry.map((node) => [node.lon, node.lat])],
        },
      };
      geojson.features.push(feature);
    }
  });

  return geojson;
}

function displayIndoorData(data, map) {
  const geojsonData = convertToGeoJSON(data);

  if (roomLayer) {
    map.removeLayer(roomLayer);
  }
  labelLayerGroup.clearLayers();

  roomLayer = L.geoJSON(geojsonData, {
    style: function (feature) {
      return {
        color: "#ffbd00",
        weight: 2,
        opacity: 0.65,
        fillOpacity: 0.4,
      };
    },
    onEachFeature: function (feature, layer) {
      if (
        feature.properties &&
        (feature.properties.ref || feature.properties.name)
      ) {
        const center = layer.getBounds().getCenter();
        const icon = L.divIcon({
          className: "area-label",
          html: feature.properties.ref || feature.properties.name,
          iconSize: null,
          iconSize: [100, 40],
          iconAnchor: [50, 10], // Center the icon on the point
        });
        L.marker(center, { icon: icon, interactive: false }).addTo(
          labelLayerGroup
        );
      }
    },
  }).addTo(map);
}

// Hides labels under a certain zoom level
function updateLabelVisibility(map) {
  const currentZoom = map.getZoom();
  const minZoomToShowLabels = 19;

  if (currentZoom >= minZoomToShowLabels) {
    map.addLayer(labelLayerGroup); // Show labels
  } else {
    map.removeLayer(labelLayerGroup); // Hide labels
  }
}

function map_init(map, options) {
  // Configure base tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxNativeZoom: MAX_API_ZOOM,
    maxZoom: 22,
  }).addTo(map);

  labelLayerGroup = L.layerGroup();
  fetchIndoorData(map); // Initial fetch

  L.control.levelSelector().addTo(map);

  let currentLevel = 0;

  map.on("moveend", function () {
    fetchIndoorData(map, currentLevel);
  });
  map.on("zoomend", function () {
    updateLabelVisibility(map);
    fetchIndoorData(map, currentLevel);
  });
  map.on("levelchange", function (e) {
    currentLevel = e.level;
    console.log(currentLevel);
    fetchIndoorData(map, currentLevel);
  });

  // Add click event
  // map.on('click', function (e) {
  //     var newMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
  //     newMarker.bindPopup("Latitude: " + e.latlng.lat + "<br>Longitude: " + e.latlng.lng);
  // });
}

window.map_init = map_init;
