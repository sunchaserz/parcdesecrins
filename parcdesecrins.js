/**
 * PARC DES ECRINS
 * @author <THE ALLIANCE>
 *
 * LOGIC OVERVIEW
 * ==============
 * - On `map.on("load")`, the `getData()` function is triggered.
 * - This fetches JSON data from the Alphi.dev API.
 * - Data is sent to the cards component: `$app.components.cards.store.listings = data`.
 * - Data is converted to GeoJSON and displayed on the map using custom markers and layers.
 * - Popups styled in Webflow are integrated into the map.
 */

// === CONSTANTS AND CONFIGURATIONS ===
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];
const btnDefaultValue = "Search";

// === VARIABLES ===
let geocoder;
let searchterm = ""; // Default search term
let filterForPointLayer = ["any"]; // Logical operator for OR conditions
let filterForClusterLayer = ["all", ["has", "point_count"]];

// === HTML ELEMENTS ===
const locqueryInput = document.getElementById("search");
const filterGroup = document.getElementById("filter-group");

// === COMPONENT INITIALIZATION ===
const initialData = { listings: [] };
$app.createComponent("cards", initialData).mount("#cards");

// === MAP INITIALIZATION ===
maptilersdk.config.apiKey = "fsCLuIQWGPlRskWhImQz";
const map = new maptilersdk.Map({
  container: "map",
  zoom: 10.5,
  center: [6.079625696485338, 45.05582527284327],
  fullscreenControl: "top-right",
  style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
  antialias: true,
  navigationControl: false, // Disable navigation controls
}).addControl(
  new maptilersdk.MaptilerNavigationControl({
    showCompass: false,
  })
);

// Map visibility hidden until data is loaded
document.getElementById("map").style.visibility = "hidden";

// Disable map rotation
map.dragRotate.disable();
map.keyboard.disable();
map.touchZoomRotate.disableRotation();

// === UTILITY FUNCTIONS ===

/**
 * Toggles the loading state of the application.
 */
function toggleLoadingState(isLoading) {
  const loadingAnimation = document.getElementById("loading-animation");
  const searchButton = document.getElementById("btnSearch");

  loadingAnimation.style.display = isLoading ? "block" : "none";
  searchButton.value = isLoading ? searchButton.dataset.wait || "Loading..." : btnDefaultValue;
}

/**
 * Updates the results text based on the search results.
 */
function updateResultsText(count, searchTerm) {
  const resultText = count === 1 ? "result" : "results";
  const searchTermText = searchTerm ? ` for <b>"${searchTerm.toLowerCase()}"</b>` : "";
  document.getElementById("totalresults").innerHTML = `<b>${count}</b> ${resultText}${searchTermText}`;
}

/**
 * Toggles the visibility of results elements.
 */
function toggleResultsVisibility(show) {
  document.getElementById("no-results").style.display = show ? "none" : "block";
  document.getElementById("cards").style.display = show ? "block" : "none";
  document.getElementById("toolbar").style.display = show ? "block" : "none";
}

/**
 * Converts the fetched data into GeoJSON format.
 */
function convertToGeoJson(data) {
  const geoJsonFeatures = data.map((item) => ({
    type: "Feature",
    properties: {
      id: item.id,
      main_image: item.main_image,
      mag: 1.43,
      time: 1507424832518,
      felt: null,
      tsunami: 1,
      icon: "restaurantz",
    },
    geometry: {
      type: "Point",
      coordinates: [item.longitude, item.latitude],
    },
  }));

  return {
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    features: geoJsonFeatures,
  };
}

/**
 * Retrieves unique icons from the GeoJSON data.
 */
function getUniqueIcons(dataGeoJson) {
  const gfxFolder = `${googleBucketUrl}/map`;
  const uniqueIcons = new Set();

  dataGeoJson.features.forEach((feature) => {
    if (feature.properties && feature.properties.icon) {
      uniqueIcons.add(feature.properties.icon);
    }
  });

  return Array.from(uniqueIcons).map((iconName) => ({
    name: iconName,
    path: `${gfxFolder}/${iconName}.png`,
  }));
}

/**
 * Updates a card's ID for tracking.
 */
function cardLoaded(card) {
  return `#card-${card.id}`;
}

// === MAP FUNCTIONALITY ===

/**
 * Loads custom markers and layers on the map.
 */
async function loadCustomMarkersAndLayers(dataGeoJson) {
  // Clear existing layers and sources
  ["cluster-layer", "point-layer", "cluster-count", "unclustered-point"].forEach((layer) => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });
  if (map.getSource("earthquakes")) map.removeSource("earthquakes");

  const customMarkers = getUniqueIcons(dataGeoJson);
  customMarkers.forEach((marker) => {
    map.loadImage(marker.path, (error, image) => {
      if (error) throw error;
      map.addImage(marker.name, image);
      createCheckboxesNew(marker.name);
    });
  });

  map.addSource("earthquakes", {
    type: "geojson",
    data: dataGeoJson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  map.addLayer({
    id: "cluster-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["has", "point_count"],
    layout: {
      "icon-image": [
        "case",
        ["all", ["get", "has_restaurant"], ["get", "has_walk"]],
        "restaurant+walk",
        ["get", "only_restaurant"],
        "r-cluster",
        "w-cluster",
      ],
      "icon-size": 0.1,
      "icon-allow-overlap": true,
    },
  });

  map.addLayer({
    id: "point-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": ["case", ["==", ["get", "icon"], "restaurantz"], "restaurantz", ["==", ["get", "icon"], "walk"], "walk", "walk"],
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
  });
}

/**
 * Fetches data from the Alphi API and updates the map and cards.
 */
function getData() {
  $fetch.createAction("get_todos", {
    options: {
      method: "get",
      url: alphiBaseUrl,
      headers: [{ key: "Content-Type", value: "application/json" }],
    },
    events: {
      onRequestInit: {
        callback: async (options) => {
          toggleLoadingState(true);
          const searchValue = document.getElementById("search").value.trim();
          if (searchValue) options.url = `${alphiBaseUrl}?endpoint=home&name=${searchValue.toLowerCase()}`;
          return options;
        },
      },
      onSuccess: {
        callback: async (_, data) => {
          toggleLoadingState(false);

          if (data.length > 0) {
            updateResultsText(data.length, document.getElementById("search").value);
            $app.components.cards.store.listings = data;
            toggleResultsVisibility(true);
            const dataGeoJson = convertToGeoJson(data);
            loadCustomMarkersAndLayers(dataGeoJson);
            document.getElementById("map").style.visibility = "visible";
          } else {
            toggleResultsVisibility(false);
          }
        },
      },
      onError: {
        callback: () => {
          console.error("Error loading data.");
          toggleLoadingState(false);
        },
      },
    },
  });
}

/**
 * Adds event listeners for map interactions.
 */
function addMapListeners() {
  map.on("load", () => {
    console.log("Map loaded.");
    getData();
  });

  map.on("click", "point-layer", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["point-layer"] });
    if (features.length) {
      const feature = features[0];
      new maptilersdk.Popup({ offset: 20 })
        .setLngLat(feature.geometry.coordinates)
        .setHTML(`<div class="popup">${feature.properties.id}</div>`)
        .addTo(map);
    }
  });

  map.on("moveend", () => {
    console.log("Map moved.");
  });
}

/**
 * Creates checkboxes dynamically for filtering map layers by marker type.
 * @param {string} id - The ID of the marker type.
 */
function createCheckboxesNew(id) {
  console.log("Creating checkbox for:", id);

  // Create checkbox element
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = true;

  // Append checkbox to the filter group
  filterGroup.appendChild(input);

  // Create label element
  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = id;

  // Append label to the filter group
  filterGroup.appendChild(label);

  // Event listener to toggle marker visibility
  input.addEventListener("change", () => {
    console.log(`Checkbox toggled for: ${id}`);
    updateFilter();
  });
}

// Call to add listeners
addMapListeners();
