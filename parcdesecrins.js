// ===============================
// Constants and Initial Setup
// ===============================
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const btnDefaultValue = "Search";

// Bounding box for Parc des Ecrins
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];

// General settings
const iconSize = 0.6;
let filterForPointLayer = ["any"]; // Use 'any' logical operator for OR conditions
let filterForClusterLayer = ["all", ["has", "point_count"]];

// Initial Data for Cards
const initialData = {
  listings: [],
};

// Elements
const locqueryInput = document.getElementById("search");
const filterGroup = document.getElementById("filter-group");

// Initialize Cards Component
$app.createComponent("cards", initialData).mount("#cards");

// Map initialization
maptilersdk.config.apiKey = "fsCLuIQWGPlRskWhImQz";
document.getElementById("map").style.visibility = "hidden";

const map = new maptilersdk.Map({
  container: "map",
  zoom: 10.5,
  center: [6.079625696485338, 45.05582527284327],
  fullscreenControl: "top-right",
  style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
  antialias: true,
  navigationControl: false,
}).addControl(new maptilersdk.MaptilerNavigationControl({ showCompass: false }));

map.dragRotate.disable();
map.keyboard.disable();
map.touchZoomRotate.disableRotation();

// ===============================
// Core Functions
// ===============================

// Data Fetching
function getData() {
  $fetch.createAction("get_todos", {
    options: {
      method: "get",
      url: alphiBaseUrl,
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: [],
    },
    integrations: {
      authentication: () => console.log("Triggered: " + locqueryInput.value),
    },
    events: {
      onTrigger: { callback: () => console.log("Triggered action.") },
      onRequestInit: { callback: modifyFetchOptions },
      onSuccess: { callback: handleFetchSuccess },
      onError: { callback: handleFetchError },
    },
  });
}

// Fetch Modifiers and Handlers
function modifyFetchOptions(options) {
  console.log("Initializing API request...");
  toggleLoadingState(true);

  const searchValue = locqueryInput.value.trim();
  if (searchValue) {
    console.log("Search term entered. Adding it to the fetch URL.");
    options.url = `${alphiBaseUrl}?endpoint=home&name=${searchValue.toLowerCase()}`;
  }

  return options;
}

function handleFetchSuccess(_, data) {
  toggleLoadingState(false);

  if (data.length > 0) {
    console.log(`Received ${data.length} results.`);
    updateResultsText(data.length, locqueryInput.value);
    $app.components.cards.store.listings = data;
    activateList(data);
    toggleResultsVisibility(true);
    attachTagClickHandlers();

    const dataGeoJson = convertToGeoJson(data);
    loadCustomMarkersAndLayers(dataGeoJson);
    loadGoogleMapsAPI();
    document.getElementById("map").style.visibility = "visible";
  } else {
    console.log("No results found.");
    toggleResultsVisibility(false);
  }
}

function handleFetchError(response) {
  console.error("Error occurred:", response);
  toggleLoadingState(false);
}

// ===============================
// UI Helpers
// ===============================
function toggleLoadingState(isLoading) {
  document.getElementById("loading-animation").style.display = isLoading ? "block" : "none";
  document.getElementById("btnSearch").value = isLoading ? document.getElementById("btnSearch").dataset.wait : btnDefaultValue;
}

function updateResultsText(count, searchTerm) {
  const resultText = count === 1 ? "result" : "results";
  const searchTermText = searchTerm ? ` for <b>"${searchTerm.toLowerCase()}"</b>` : "";
  document.getElementById("totalresults").innerHTML = `<b>${count}</b> ${resultText}${searchTermText}`;
}

function toggleResultsVisibility(show) {
  document.getElementById("no-results").style.display = show ? "none" : "block";
  document.getElementById("cards").style.display = show ? "block" : "none";
  document.getElementById("toolbar").style.display = show ? "block" : "none";
}

function attachTagClickHandlers() {
  $(".tag").on("click", function () {
    const tagText = $(this).text();
    $("#search").val(tagText).trigger("input");
    $fetch.triggerAction("get_todos");
  });
}

// ===============================
// GeoJSON Conversion
// ===============================
function convertToGeoJson(data) {
  return {
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    features: data.map((item) => ({
      type: "Feature",
      properties: {
        id: item.id,
        main_image: item.main_image,
        mag: 1.43,
        icon: "restaurantz",
      },
      geometry: {
        type: "Point",
        coordinates: [item.longitude, item.latitude],
      },
    })),
  };
}

// ===============================
// Card Functions
// ===============================
function cardLoaded(card) {
  console.log("Card loaded with ID: " + card.id);
  return `#card-${card.id}`;
}

function activateList(data) {
  const items = data.map((item) => ({
    id: item.id,
    lat: item.latitude,
    lon: item.longitude,
  }));

  const listContainer = document.querySelector(".uui-blogsection01_list");
  const listItems = listContainer.querySelectorAll(".uui-blogsection01_item:not(:first-child)");

  listItems.forEach((div, index) => {
    if (items[index]) {
      div.setAttribute("data-id", items[index].id);
      div.setAttribute("data-lonlat", `${items[index].lon},${items[index].lat}`);

      div.addEventListener("mouseenter", () => {
        cleanSelection();
        div.classList.add("selected");
        selectListToMap(div);
      });

      div.querySelector(".fly-to-marker").addEventListener("click", () => flyToMarker(div));
    }
  });
}

function selectListToMap(item) {
  map.setLayoutProperty("point-layer", "icon-image", ["case", ["==", ["get", "id"], item.dataset.id], "restaurant+walk-active", ["get", "icon"]]);
}

function flyToMarker(item) {
  map.flyTo({
    center: item.dataset.lonlat.split(",").map(Number),
    zoom: 12,
  });
}

// ===============================
// Marker and Layer Management
// ===============================
async function loadCustomMarkersAndLayers(dataGeoJson) {
  const customMarkers = getUniqueIcons(dataGeoJson);

  // Clear layers and sources
  clearLayersAndSources();

  // Add new markers
  customMarkers.forEach((marker) => {
    map.loadImage(marker.path, (error, image) => {
      if (error) throw error;
      map.addImage(marker.name, image);
      createCheckboxesNew(marker.name);
    });
  });

  // Add clustered GeoJSON source and layers
  map.addSource("earthquakes", {
    type: "geojson",
    data: dataGeoJson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  addClusterLayers();
}

function clearLayersAndSources() {
  if (map.getLayer("cluster-layer")) map.removeLayer("cluster-layer");
  if (map.getLayer("point-layer")) map.removeLayer("point-layer");
  if (map.getLayer("cluster-count")) map.removeLayer("cluster-count");
  if (map.getSource("earthquakes")) map.removeSource("earthquakes");
}

function addClusterLayers() {
  map.addLayer({
    id: "cluster-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["has", "point_count"],
    layout: { "icon-image": "restaurant+walk", "icon-size": 0.1 },
  });

  map.addLayer({
    id: "point-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["!", ["has", "point_count"]],
    layout: { "icon-image": "restaurantz", "icon-size": iconSize },
  });
}

// ===============================
// Utility Functions
// ===============================
function getUniqueIcons(dataGeoJson) {
  const uniqueIcons = new Set();
  dataGeoJson.features.forEach((feature) => uniqueIcons.add(feature.properties.icon));
  return Array.from(uniqueIcons).map((icon) => ({
    name: icon,
    path: `${googleBucketUrl}/${icon}.png`,
  }));
}

function createCheckboxesNew(id) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = true;

  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = id;

  filterGroup.appendChild(input);
  filterGroup.appendChild(label);

  input.addEventListener("change", updateFilter);
}

function updateFilter() {
  console.log("Updating filter...");
}
