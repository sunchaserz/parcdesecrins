/**
 * PARC DES ECRINS
 * @author <THE ALLIANCE>
 * This file is served by jsdelivr (see webflow setup).
 * Ensure you are using the production setup.
 */

const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const btnDefaultValue = "Search";

// Default map and UI settings
const locqueryInput = document.getElementById("search");
const filterGroup = document.getElementById("filter-group");
const initialData = { listings: [] };
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];
let geocoder;

// Create and mount cards component
$app.createComponent("cards", initialData).mount("#cards");

// Initialize Maptiler
maptilersdk.config.apiKey = "fsCLuIQWGPlRskWhImQz";
document.getElementById("map").style.visibility = "hidden";

const map = new maptilersdk.Map({
  container: "map",
  zoom: 10.5,
  center: [6.079625696485338, 45.05582527284327],
  style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
  navigationControl: false,
  antialias: true,
}).addControl(new maptilersdk.MaptilerNavigationControl({ showCompass: false }));

// Map settings
map.dragRotate.disable();
map.keyboard.disable();
map.touchZoomRotate.disableRotation();

// ====== Fetch and Update Functions ======

function getData() {
  $fetch.createAction("get_todos", {
    options: {
      method: "get",
      url: alphiBaseUrl,
      headers: [{ key: "Content-Type", value: "application/json" }],
    },
    integrations: {
      authentication: () => console.log("Triggered: " + locqueryInput.value),
    },
    events: {
      onTrigger: {
        callback: () => console.log("Fetching data for: " + locqueryInput.value),
      },
      onRequestInit: {
        callback: async (options) => prepareRequest(options),
      },
      onSuccess: {
        callback: async (_, data) => processResults(data),
      },
      onError: {
        callback: (response) => handleError(response),
      },
    },
  });
}

function prepareRequest(options) {
  console.log("Preparing request...");
  toggleLoadingState(true);

  const searchValue = locqueryInput.value.trim();
  if (searchValue) {
    options.url = `${alphiBaseUrl}?endpoint=home&name=${searchValue.toLowerCase()}`;
  }
  return options;
}

function processResults(data) {
  toggleLoadingState(false);

  if (data.length > 0) {
    console.log(`Received ${data.length} results.`);
    updateResultsText(data.length, locqueryInput.value);
    $app.components.cards.store.listings = data;
    activateList(data);
    toggleResultsVisibility(true);

    const dataGeoJson = convertToGeoJson(data);
    loadCustomMarkersAndLayers(dataGeoJson);
    loadGoogleMapsAPI();
    document.getElementById("map").style.visibility = "visible";
  } else {
    console.log("No results found.");
    toggleResultsVisibility(false);
  }
}

function handleError(response) {
  console.error("Error fetching data:", response);
  toggleLoadingState(false);
}

// ====== UI and Helper Functions ======

function toggleLoadingState(isLoading) {
  document.getElementById("loading-animation").style.display = isLoading ? "block" : "none";
  document.getElementById("btnSearch").value = isLoading ? document.getElementById("btnSearch").dataset.wait : btnDefaultValue;
}

function updateResultsText(count, searchTerm) {
  const resultText = count === 1 ? "result" : "results";
  const searchTermText = searchTerm ? ` for <b>"${searchTerm.toLowerCase()}"</b>` : "";
  document.getElementById("totalresults").innerHTML = `<b>${count}</b> ${resultText}${searchTermText}`;
}

function toggleResultsVisibility(visible) {
  document.getElementById("no-results").style.display = visible ? "none" : "block";
  document.getElementById("cards").style.display = visible ? "block" : "none";
  document.getElementById("toolbar").style.display = visible ? "block" : "none";
}

// Attach click handlers for dynamically generated tags
function attachTagClickHandlers() {
  $(".tag").on("click", function () {
    const tagText = $(this).text();
    locqueryInput.value = tagText;
    $fetch.triggerAction("get_todos");
  });
}

function convertToGeoJson(data) {
  const features = data.map((item) => ({
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
  }));

  return {
    type: "FeatureCollection",
    features,
  };
}

async function loadCustomMarkersAndLayers(dataGeoJson) {
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
      "icon-image": "r-cluster",
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
      "icon-image": "restaurantz",
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
  });
}

function getUniqueIcons(dataGeoJson) {
  const uniqueIcons = new Set();

  dataGeoJson.features.forEach((feature) => {
    if (feature.properties.icon) {
      uniqueIcons.add(feature.properties.icon);
    }
  });

  return [...uniqueIcons].map((icon) => ({
    name: icon,
    path: `${googleBucketUrl}/map/${icon}.png`,
  }));
}

// ====== Event Handlers ======

map.on("load", () => {
  loadGoogleMapsAPI();
  getData();
});

locqueryInput.addEventListener("input", debounce(handleUserInput, 300));

function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

function handleUserInput() {
  const query = locqueryInput.value.trim();
  if (query) {
    console.log("User is typing:", query);
  }
}
