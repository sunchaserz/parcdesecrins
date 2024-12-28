/**
 * PARC DES ECRINS Interactive Map Application
 * ============================================
 * Author: <THE ALLIANCE>
 *
 * This application integrates a map with a listings component, filters, and search functionality.
 * Data is fetched from the Alphi API, converted to GeoJSON, and displayed on a Maptiler map.
 * Interactions between the map and a dynamic card list are fully supported.
 */

// ===================== CONSTANTS & GLOBAL VARIABLES =====================
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const maptilerApiKey = "fsCLuIQWGPlRskWhImQz";
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431]; // Bounding box for Parc des Ecrins

const initialData = { listings: [] }; // Initial data structure for cards
let geocoder; // Google geocoder instance
let searchterm = ""; // Default search term
let filterForPointLayer = ["any"];
let filterForClusterLayer = ["all", ["has", "point_count"]];

const locqueryInput = document.getElementById("search");
const filterGroup = document.getElementById("filter-group");

// Initialize the Map
document.getElementById("map").style.visibility = "hidden"; // Hide map until data loads
const map = initializeMap();

// ===================== INITIALIZATION =====================

/**
 * Initialize the Maptiler Map
 * @returns {object} Maptiler map instance
 */
function initializeMap() {
  maptilersdk.config.apiKey = maptilerApiKey;

  const map = new maptilersdk.Map({
    container: "map",
    zoom: 10.5,
    center: [6.079625696485338, 45.05582527284327],
    style: "b80bd75b-379c-45e4-9006-643ba8aa190e", // Custom Maptiler style ID
    antialias: true,
    navigationControl: false, // Disable navigation controls
  });

  map.addControl(
    new maptilersdk.MaptilerNavigationControl({
      showCompass: false,
    })
  );

  // Disable map rotations
  map.dragRotate.disable();
  map.keyboard.disable();
  map.touchZoomRotate.disableRotation();

  return map;
}

/**
 * Initialize the Cards Component
 */
$app.createComponent("cards", initialData).mount("#cards");

// ===================== DATA FETCHING =====================

/**
 * Fetch data from Alphi API, process it, and update the map and UI.
 */
async function fetchData() {
  try {
    const response = await fetch(alphiBaseUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (data.length > 0) {
      updateCardsComponent(data);
      const geoJson = convertDataToGeoJson(data);
      loadCustomMarkersAndLayers(geoJson);
      document.getElementById("map").style.visibility = "visible"; // Show the map
    } else {
      handleNoResults();
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    handleError();
  }
}

/**
 * Convert Alphi API data to GeoJSON format for use on the map.
 * @param {Array} data - Alphi API data
 * @returns {Object} GeoJSON object
 */
function convertDataToGeoJson(data) {
  return {
    type: "FeatureCollection",
    features: data.map((item) => ({
      type: "Feature",
      properties: {
        id: item.id,
        main_image: item.main_image,
        icon: "marker",
      },
      geometry: {
        type: "Point",
        coordinates: [item.longitude, item.latitude],
      },
    })),
  };
}

// ===================== UI UPDATES =====================

/**
 * Update the Cards Component with fetched data.
 * @param {Array} data - Alphi API data
 */
function updateCardsComponent(data) {
  $app.components.cards.store.listings = data;
  activateList(data); // Enable interactivity
  showCards();
}

/**
 * Handle UI updates when no results are found.
 */
function handleNoResults() {
  document.getElementById("no-results").style.display = "block";
  document.getElementById("cards").style.display = "none";
  document.getElementById("toolbar").style.display = "none";
}

/**
 * Handle UI updates when an error occurs during data fetching.
 */
function handleError() {
  document.getElementById("error").style.display = "block";
  document.getElementById("cards").style.display = "none";
}

// ===================== MAP LAYER MANAGEMENT =====================

/**
 * Load markers and layers into the map.
 * @param {Object} geoJson - GeoJSON data
 */
function loadCustomMarkersAndLayers(geoJson) {
  clearMapLayers();

  map.addSource("listings", {
    type: "geojson",
    data: geoJson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  addClusterLayer();
  addPointLayer();
}

/**
 * Add a clustered layer for displaying grouped points.
 */
function addClusterLayer() {
  map.addLayer({
    id: "cluster-layer",
    type: "circle",
    source: "listings",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#51bbd6", // Blue
        100,
        "#f1f075", // Yellow
        750,
        "#f28cb1", // Pink
      ],
      "circle-radius": [
        "step",
        ["get", "point_count"],
        20, // Small circle
        100,
        30, // Medium circle
        750,
        40, // Large circle
      ],
    },
  });
}

/**
 * Add a layer for individual points.
 */
function addPointLayer() {
  map.addLayer({
    id: "point-layer",
    type: "symbol",
    source: "listings",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": "marker",
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
  });
}

/**
 * Clear all existing layers and sources from the map.
 */
function clearMapLayers() {
  const layers = ["cluster-layer", "point-layer"];
  const sources = ["listings"];

  layers.forEach((layer) => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });

  sources.forEach((source) => {
    if (map.getSource(source)) map.removeSource(source);
  });
}

// ===================== INTERACTIVITY =====================

/**
 * Enable interactivity between the map and the card list.
 * @param {Array} data - Listing data
 */
function activateList(data) {
  const listContainer = document.querySelector(".uui-blogsection01_list");
  const listItems = listContainer.querySelectorAll(".uui-blogsection01_item:not(:first-child)");

  listItems.forEach((item, index) => {
    const listing = data[index];
    if (!listing) return;

    item.dataset.id = listing.id;
    item.dataset.lonlat = `${listing.longitude},${listing.latitude}`;

    item.addEventListener("mouseenter", () => highlightOnMap(item.dataset.id));
    item.querySelector(".fly-to-marker").addEventListener("click", () => flyToMarker(item));
  });
}

/**
 * Highlight a point on the map based on its ID.
 * @param {string} id - Listing ID
 */
function highlightOnMap(id) {
  map.setFilter("point-layer", ["==", ["get", "id"], id]);
}

/**
 * Fly to a specific marker on the map.
 * @param {HTMLElement} item - List item element
 */
function flyToMarker(item) {
  const [lon, lat] = item.dataset.lonlat.split(",");
  map.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 12 });
}

// ===================== EVENT LISTENERS =====================

map.on("load", fetchData);
