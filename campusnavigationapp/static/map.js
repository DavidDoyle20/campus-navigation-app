const gl = new maplibregl.Map({
  container: "map",
  style:
    "https://api.maptiler.com/maps/openstreetmap/style.json?key=UOLh4Ktc21SMniW0v30i",
  center: [-87.882799, 43.077622],
  zoom: 17,
  minZoom: 16,
  maxZoom: 22,
});
const indoorEqual = new IndoorEqual(gl, {
  apiKey: "iek_lkFHtGmMEwKkwk4wAiWpGb49RFNI",
});
gl.addControl(indoorEqual);
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
