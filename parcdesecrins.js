/**
 * PARC DES ECRINS
 * @author <THE ALLIANCE>
 *
 * This file is being served by jsdelivr. (see webflow)
 * Make sure you are using the prod setup, not the uncached dev setup (see webflow Before </body> tag section)
 *
 * THE LOGIC
 * =========
 * - `map.on("load")` triggers `getData()`.
 * - `getData()` loads a JSON from Alphi.dev API and populates cards with `$app.components.cards.store.listings`.
 * - Converts data to GeoJSON for the map and loads it with `loadCustomMarkersAndLayers(dataGeoJson)`.
 * - Popup styling is managed via Webflow and injected into the source code.
 */

// ===============================
// CONSTANTS & INITIALIZATION
// ===============================
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];
const iconSize = 0.6;
const btnDefaultValue = "Search";

let geocoder;
let searchterm = "";
let filterForPointLayer = ["any"];
let filterForClusterLayer = ["all", ["has", "point_count"]];

const locqueryInput = document.getElementById("search");
const filterGroup = document.getElementById("filter-group");
const urlParams = new URLSearchParams(window.location.search);

const initialData = { listings: [] };

// Create cards component
$app.createComponent("cards", initialData).mount("#cards");

// ===============================
// MAP INITIALIZATION
// ===============================
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
// DATA FETCHING & HANDLING
// ===============================

/**
 * Fetch data from Alphi API and update the map and UI.
 */
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
      onRequestInit: { callback: modifyFetchOptions },
      onSuccess: { callback: handleFetchSuccess },
      onError: { callback: handleFetchError },
    },
  });
}

function modifyFetchOptions(options) {
  toggleLoadingState(true);

  const searchValue = locqueryInput.value.trim();
  if (searchValue) {
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
    toggleResultsVisibility(false);
    console.log("No results found.");
  }
}

function handleFetchError(response) {
  toggleLoadingState(false);
  console.error("Error occurred:", response);
}

// ===============================
// UI UTILITIES
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
// DATA PROCESSING
// ===============================

/**
 * Convert API data to GeoJSON format.
 * @param {Array} data - API response data.
 * @returns {Object} GeoJSON formatted data.
 */
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
// MAP AND UI INTERACTIONS
// ===============================

/**
 * Populate map with markers and custom layers.
 */
async function loadCustomMarkersAndLayers(dataGeoJson) {
  const customMarkers = getUniqueIcons(dataGeoJson);

  clearMapLayers();

  customMarkers.forEach((marker) => {
    map.loadImage(marker.path, (error, image) => {
      if (error) throw error;
      map.addImage(marker.name, image);
      createCheckboxesNew(marker.name);
    });
  });

  addMapLayers(dataGeoJson);
}

function clearMapLayers() {
  ["cluster-layer", "point-layer", "cluster-count", "unclustered-point"].forEach((layer) => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });
  if (map.getSource("earthquakes")) map.removeSource("earthquakes");
}

function addMapLayers(dataGeoJson) {
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
      "icon-image": "restaurant+walk",
      "icon-size": 0.1,
    },
  });

  map.addLayer({
    id: "point-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": "restaurantz",
      "icon-size": iconSize,
    },
  });
}

/**
 * Handle the card's load and inject relevant attributes.
 */
function cardLoaded(card) {
  console.log("Card loaded: " + card.id);
  return `#card-${card.id}`;
}

/**
 * Activate and interact with the data list.
 */
function activateList(data) {
  const items = data.map((item) => ({
    i: item.id,
    lat: item.latitude,
    lon: item.longitude,
  }));

  const listContainer = document.querySelector(".uui-blogsection01_list");
  const listItems = listContainer.querySelectorAll(".uui-blogsection01_item:not(:first-child)");

  listItems.forEach((div, index) => {
    if (items[index]) {
      div.setAttribute("data-id", items[index].i);
      div.setAttribute("data-lonlat", `${items[index].lon},${items[index].lat}`);

      div.addEventListener("mouseenter", () => handleMouseEnter(div));
      div.querySelector(".fly-to-marker").addEventListener("click", () => flyToMarker(div));
    }
  });
}

function handleMouseEnter(div) {
  cleanSelection();
  div.classList.toggle("selected");
  if (div.classList.contains("selected")) {
    selectListToMap(div);
  }
}

function flyToMarker(item) {
  map.flyTo({ center: item.dataset.lonlat.split(",").map(Number), zoom: 12 });
}

function selectListToMap(item) {
  map.setLayoutProperty("point-layer", "icon-image", ["case", ["==", ["get", "id"], item.dataset.id], "restaurant+walk-active", ["get", "icon"]]);
}

// ===============================
// HELPER FUNCTIONS
// ===============================

function getUniqueIcons(dataGeoJson) {
  const gfxFolder = googleBucketUrl + "/map";
  const uniqueIcons = new Set();

  dataGeoJson.features.forEach((feature) => {
    if (feature.properties && feature.properties.icon) {
      uniqueIcons.add(feature.properties.icon);
    }
  });

  return Array.from(uniqueIcons).map((icon) => ({
    name: icon,
    path: `${gfxFolder}/${icon}.png`,
  }));
}

function createCheckboxesNew(id) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = `${id}`;
  input.checked = true;
  filterGroup.appendChild(input);

  const label = document.createElement("label");
  label.setAttribute("for", `${id}`);
  label.textContent = id;
  filterGroup.appendChild(label);

  input.addEventListener("change", updateFilter);
}

function updateFilter() {
  filterForPointLayer = ["any"];
  filterForClusterLayer = ["all", ["has", "point_count"]];

  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    if (checkbox.checked) {
      filterForPointLayer.push(["==", ["get", "icon"], checkbox.id]);
      filterForClusterLayer.push(["get", `only_${checkbox.id}`]);
    }
  });

  const myStyle = map.getStyle();
  myStyle.sources.earthquakes.filter = filterForPointLayer;
  map.setStyle(myStyle);
}
