/**
 * PARC DES ECRINS
 * @author <THE ALLIANCE>
 *
 * This file handles loading and displaying data on the map and in cards.
 * API keys are embedded in the code as requested.
 */

// ===== Constants =====
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const maptilerApiKey = "fsCLuIQWGPlRskWhImQz";
const googleApiKey = "AIzaSyDCeFfHwzjUWP2yZh7iTw1dGvAzG8cSLNc";
const btnDefaultValue = "Search";
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];
const iconSize = 0.6;

// ===== Global Variables =====
let geocoder;
let filterForPointLayer = ["any"];
let filterForClusterLayer = ["all", ["has", "point_count"]];

// ===== Initial Setup =====
$app.createComponent("cards", { listings: [] }).mount("#cards");
document.getElementById("map").style.visibility = "hidden";

// ===== Map Setup =====
maptilersdk.config.apiKey = maptilerApiKey;

const map = new maptilersdk.Map({
  container: "map",
  zoom: 10.5,
  center: [6.079625696485338, 45.05582527284327],
  style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
  fullscreenControl: "top-right",
  antialias: true,
  navigationControl: false,
}).addControl(new maptilersdk.MaptilerNavigationControl({ showCompass: false }));

map.dragRotate.disable();
map.keyboard.disable();
map.touchZoomRotate.disableRotation();

// ===== Main Functions =====

// Load Google Maps API for geocoding
function loadGoogleMapsAPI() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=mapsApiLoaded&v=weekly`;
  script.defer = true;
  document.head.appendChild(script);

  window.mapsApiLoaded = () => {
    geocoder = new google.maps.Geocoder();
    enableSearch();
  };
}

// Fetch data from Alphi.dev API
function getData() {
  $fetch.createAction("get_todos", {
    options: {
      method: "GET",
      url: alphiBaseUrl,
      headers: [{ key: "Content-Type", value: "application/json" }],
    },
    events: {
      onRequestInit: {
        callback: (options) => {
          showLoading();
          const searchValue = document.getElementById("search").value.trim();
          if (searchValue) {
            options.url = `${alphiBaseUrl}?endpoint=home&name=${searchValue.toLowerCase()}`;
          }
          return options;
        },
      },
      onSuccess: {
        callback: (_, data) => handleApiSuccess(data),
      },
      onError: {
        callback: (error) => {
          console.error("Error fetching data:", error);
          hideLoading();
        },
      },
    },
  });
}

// Handle successful API response
function handleApiSuccess(data) {
  hideLoading();
  if (data.length > 0) {
    console.log(`${data.length} results found`);
    updateUIWithData(data);
    const geoJson = convertToGeoJson(data);
    loadCustomMarkersAndLayers(geoJson);
    document.getElementById("map").style.visibility = "visible";
  } else {
    displayNoResults();
  }
}

// Update the UI with fetched data
function updateUIWithData(data) {
  $app.components.cards.store.listings = data;
  const searchValue = document.getElementById("search").value.trim();
  document.getElementById("totalresults").innerHTML = `<b>${data.length}</b> result${data.length > 1 ? "s" : ""} ${
    searchValue ? `for <b>"${searchValue}"</b>` : ""
  }`;
  document.getElementById("no-results").style.display = "none";
  document.getElementById("cards").style.display = "block";
  document.getElementById("toolbar").style.display = "block";
}

// Convert fetched data to GeoJSON
function convertToGeoJson(data) {
  return {
    type: "FeatureCollection",
    features: data.map((item) => ({
      type: "Feature",
      properties: { id: item.id, main_image: item.main_image, icon: "restaurantz" },
      geometry: { type: "Point", coordinates: [item.longitude, item.latitude] },
    })),
  };
}

// Load custom markers and layers onto the map
function loadCustomMarkersAndLayers(dataGeoJson) {
  const customMarkers = getUniqueIcons(dataGeoJson);
  clearMapLayers();

  customMarkers.forEach(({ name, path }) => {
    map.loadImage(path, (error, image) => {
      if (error) throw error;
      map.addImage(name, image);
      createCheckboxForFilter(name);
    });
  });

  map.addSource("earthquakes", {
    type: "geojson",
    data: dataGeoJson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  addMapLayers();
}

// Add layers to the map
function addMapLayers() {
  map.addLayer({
    id: "cluster-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["has", "point_count"],
    layout: { "icon-image": "r-cluster", "icon-size": iconSize },
  });

  map.addLayer({
    id: "point-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": ["get", "icon"],
      "icon-size": iconSize,
      "icon-allow-overlap": true,
    },
  });
}

// Clear existing map layers
function clearMapLayers() {
  ["cluster-layer", "point-layer", "cluster-count"].forEach((layer) => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });
  if (map.getSource("earthquakes")) map.removeSource("earthquakes");
}

// Get unique icons from GeoJSON
function getUniqueIcons(dataGeoJson) {
  const iconSet = new Set(dataGeoJson.features.map((feature) => feature.properties.icon));
  return Array.from(iconSet).map((icon) => ({
    name: icon,
    path: `${googleBucketUrl}/map/${icon}.png`,
  }));
}

// Create filter checkboxes
function createCheckboxForFilter(id) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = true;

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = id;

  input.addEventListener("change", updateFilters);

  document.getElementById("filter-group").appendChild(input);
  document.getElementById("filter-group").appendChild(label);
}

// Update filters based on checkboxes
function updateFilters() {
  const filterConditions = ["any"];
  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    if (checkbox.checked) filterConditions.push(["==", ["get", "icon"], checkbox.id]);
  });
  map.setFilter("point-layer", filterConditions);
}

// ===== Utility Functions =====

// Show loading animation
function showLoading() {
  document.getElementById("loading-animation").style.display = "block";
  document.getElementById("btnSearch").value = "Searching...";
}

// Hide loading animation
function hideLoading() {
  document.getElementById("loading-animation").style.display = "none";
  document.getElementById("btnSearch").value = btnDefaultValue;
}

// Display "No Results" message
function displayNoResults() {
  document.getElementById("no-results").style.display = "block";
  document.getElementById("cards").style.display = "none";
  document.getElementById("toolbar").style.display = "none";
}

// Enable search input
function enableSearch() {
  document.getElementById("search").addEventListener("input", debounce(getData, 300));
}

// Debounce helper function
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// ===== Event Listeners =====
map.on("load", getData);
map.on("click", "point-layer", (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ["point-layer"] });
  if (features.length) {
    const feature = features[0];
    const coordinates = feature.geometry.coordinates.slice();
    new maptilersdk.Popup().setLngLat(coordinates).setHTML(`<div>${feature.properties.main_image}</div>`).addTo(map);
  }
});
