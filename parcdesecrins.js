/**
 * PARC DES ECRINS - MAP INTEGRATION
 * =================================
 * This script handles data fetching, rendering map layers, and interacting with a Webflow page.
 */

// ======= CONSTANTS =======
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const maptilerApiKey = "fsCLuIQWGPlRskWhImQz";
const googleApiKey = "AIzaSyDCeFfHwzjUWP2yZh7iTw1dGvAzG8cSLNc";
const btnDefaultValue = "Search";

// Bounding box for Parc des Ecrins
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];

// ======= GLOBAL VARIABLES =======
let geocoder;
const filterGroup = document.getElementById("filter-group");
const locqueryInput = document.getElementById("search");

// ======= INITIALIZE COMPONENTS =======
$app.createComponent("cards", { listings: [] }).mount("#cards");

// ======= MAP SETUP =======
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

// Disable unnecessary map interactions
map.dragRotate.disable();
map.keyboard.disable();
map.touchZoomRotate.disableRotation();

// ======= FUNCTIONS =======

// Load Google Maps API
function loadGoogleMapsAPI() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&callback=mapsApiLoaded&v=weekly`;
  script.defer = true;
  document.head.appendChild(script);

  window.mapsApiLoaded = () => {
    console.log("Google Maps API loaded successfully");
    geocoder = new google.maps.Geocoder();
    enableSearch();
  };
}

// Fetch data from Alphi.dev API and update map and cards
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
          console.log("Initializing API request");
          document.getElementById("loading-animation").style.display = "block";
          document.getElementById("btnSearch").value = "Searching...";
          const searchValue = locqueryInput.value.trim();
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
          document.getElementById("btnSearch").value = btnDefaultValue;
        },
      },
    },
  });
}

// Handle successful API response
function handleApiSuccess(data) {
  document.getElementById("btnSearch").value = btnDefaultValue;
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

// Update UI with fetched data
function updateUIWithData(data) {
  $app.components.cards.store.listings = data;
  document.getElementById("no-results").style.display = "none";
  document.getElementById("cards").style.display = "block";
  document.getElementById("toolbar").style.display = "block";

  const searchValue = locqueryInput.value.trim();
  const resultsText = `${data.length} result${data.length > 1 ? "s" : ""}`;
  const searchTermText = searchValue ? ` for <b>"${searchValue}"</b>` : "";
  document.getElementById("totalresults").innerHTML = `<b>${resultsText}</b>${searchTermText}`;
}

// Display "No Results" UI
function displayNoResults() {
  console.log("No results found");
  document.getElementById("no-results").style.display = "block";
  document.getElementById("cards").style.display = "none";
  document.getElementById("toolbar").style.display = "none";
}

// Convert data to GeoJSON format
function convertToGeoJson(data) {
  return {
    type: "FeatureCollection",
    features: data.map((item) => ({
      type: "Feature",
      properties: {
        id: item.id,
        main_image: item.main_image,
        icon: "restaurantz",
      },
      geometry: {
        type: "Point",
        coordinates: [item.longitude, item.latitude],
      },
    })),
  };
}

// Load custom markers and layers onto the map
function loadCustomMarkersAndLayers(dataGeoJson) {
  const customMarkers = getUniqueIcons(dataGeoJson);

  // Clear existing layers
  clearMapLayers();

  customMarkers.forEach(({ name, path }) => {
    map.loadImage(path, (error, image) => {
      if (error) throw error;
      map.addImage(name, image);
      createFilterCheckbox(name);
    });
  });

  // Add GeoJSON source
  map.addSource("earthquakes", {
    type: "geojson",
    data: dataGeoJson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  addMapLayers();
}

// Clear existing map layers and sources
function clearMapLayers() {
  ["cluster-layer", "point-layer", "cluster-count"].forEach((layer) => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });
  if (map.getSource("earthquakes")) map.removeSource("earthquakes");
}

// Add layers to the map
function addMapLayers() {
  map.addLayer({
    id: "cluster-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["has", "point_count"],
    layout: {
      "icon-image": "r-cluster",
      "icon-size": 0.6,
    },
  });

  map.addLayer({
    id: "point-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": ["get", "icon"],
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
  });
}

// Extract unique icons from GeoJSON data
function getUniqueIcons(dataGeoJson) {
  const iconSet = new Set(dataGeoJson.features.map((feature) => feature.properties.icon));
  return Array.from(iconSet).map((icon) => ({
    name: icon,
    path: `${googleBucketUrl}/map/${icon}.png`,
  }));
}

// Create filter checkbox for icons
function createFilterCheckbox(id) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = true;

  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = id;

  input.addEventListener("change", updateFilters);

  filterGroup.appendChild(input);
  filterGroup.appendChild(label);
}

// Update filters based on checkbox state
function updateFilters() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  const filterConditions = ["any"];
  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      filterConditions.push(["==", ["get", "icon"], checkbox.id]);
    }
  });
  map.setFilter("point-layer", filterConditions);
}

// Enable search input and autocomplete
function enableSearch() {
  locqueryInput.addEventListener("input", debounce(handleSearchInput, 300));
}

// Handle search input
function handleSearchInput() {
  const query = locqueryInput.value.trim();
  if (!query) return;
  handleUserInput(query);
}

// Debounce utility
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// ======= EVENT LISTENERS =======
map.on("load", getData);
