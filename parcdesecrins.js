/**
 * PARC DES ECRINS - Interactive Map with Listings and Filtering
 *
 * This script integrates a map with listing cards, filters,
 * and search functionality. It uses data from the Alphi API,
 * Maptiler SDK for map rendering, and Google Maps API for geocoding.
 *
 * Author: <THE ALLIANCE>
 * Dependency: Ensure production setup via jsdelivr (Webflow setup).
 */

// Constants and Configuration
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const maptilerApiKey = "fsCLuIQWGPlRskWhImQz";
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];
const btnDefaultValue = "Search";

let geocoder; // Google geocoder instance
let filterForPointLayer = ["any"];
let filterForClusterLayer = ["all", ["has", "point_count"]];

// Initialize Maptiler
const map = initializeMap();

// Initialize the Cards Component
$app.createComponent("cards", { listings: [] }).mount("#cards");

// Entry Point: Initialize App
map.on("load", async () => {
  await loadCustomImages();
  await fetchData();
  mapEvents();
});

// ----------- Core Functions --------------

/**
 * Initialize the Maptiler Map
 * @returns {object} Maptiler map instance
 */
function initializeMap() {
  return new maptilersdk.Map({
    container: "map",
    zoom: 10.5,
    center: [6.079625696485338, 45.05582527284327],
    fullscreenControl: "top-right",
    style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
    antialias: true,
    navigationControl: false,
  })
    .addControl(new maptilersdk.MaptilerNavigationControl({ showCompass: false }))
    .on("render", showMapOnceDataLoaded);
}

/**
 * Fetch data from Alphi API and process it.
 */
async function fetchData() {
  const response = await fetch(alphiBaseUrl, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();
  updateCardsComponent(data);
  const geoJson = convertDataToGeoJson(data);
  loadMapData(geoJson);
}

/**
 * Update the Cards Component with fetched data.
 * @param {Array} data - Array of listing objects
 */
function updateCardsComponent(data) {
  if (data.length) {
    $app.components.cards.store.listings = data;
    activateList(data);
    document.getElementById("cards").style.display = "block";
  } else {
    document.getElementById("no-results").style.display = "block";
  }
}

/**
 * Convert Alphi data to GeoJSON format.
 * @param {Array} data - Array of listing objects
 * @returns {Object} GeoJSON object
 */
function convertDataToGeoJson(data) {
  const features = data.map((item) => ({
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
  }));

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Load custom marker images and add them to the map.
 */
async function loadCustomImages() {
  const images = [
    { name: "marker", url: `${googleBucketUrl}/map/marker.png` },
    // Add more marker images here as needed.
  ];

  for (const image of images) {
    map.loadImage(image.url, (error, img) => {
      if (error) throw error;
      map.addImage(image.name, img);
    });
  }
}

/**
 * Load GeoJSON data into the map and configure layers.
 * @param {Object} geoJson - GeoJSON data
 */
function loadMapData(geoJson) {
  map.addSource("listings", {
    type: "geojson",
    data: geoJson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  addMapLayers();
}

/**
 * Add layers to the map for clusters and points.
 */
function addMapLayers() {
  // Cluster layer
  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "listings",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": ["step", ["get", "point_count"], "#51bbd6", 100, "#f1f075", 750, "#f28cb1"],
      "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
    },
  });

  // Unclustered point layer
  map.addLayer({
    id: "unclustered-points",
    type: "symbol",
    source: "listings",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": "marker",
      "icon-size": 0.6,
    },
  });
}

/**
 * Handle map events (e.g., click, mouseenter).
 */
function mapEvents() {
  map.on("click", "unclustered-points", (e) => showPopup(e.features[0]));
  map.on("mouseenter", "unclustered-points", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "unclustered-points", () => (map.getCanvas().style.cursor = ""));
}

/**
 * Show popup for a map feature.
 * @param {Object} feature - Map feature
 */
function showPopup(feature) {
  const { coordinates } = feature.geometry;
  const { main_image } = feature.properties;

  new maptilersdk.Popup({ offset: 20 }).setLngLat(coordinates).setHTML(`<img src="${main_image}" alt="Image">`).addTo(map);
}

/**
 * Activate interactivity between the list and map.
 * @param {Array} data - Array of listing objects
 */
function activateList(data) {
  const items = document.querySelectorAll(".list-item");
  items.forEach((item, index) => {
    if (data[index]) {
      item.dataset.id = data[index].id;
      item.addEventListener("mouseenter", () => highlightOnMap(data[index].id));
    }
  });
}

// ----------- Utility Functions --------------

/**
 * Highlight a point on the map by ID.
 * @param {string} id - Feature ID
 */
function highlightOnMap(id) {
  map.setFilter("unclustered-points", ["==", ["get", "id"], id]);
}

/**
 * Show the map after data has been loaded.
 */
function showMapOnceDataLoaded() {
  document.getElementById("map").style.visibility = "visible";
}
