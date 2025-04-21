/**
 * PARC DES ECRINS
 * @author <THE ALLIANCE>
 *
 * This file is being served by jsdelivr. (see webflow)
 * Make sure you are using the prod setup, not the uncached dev setup (see webflow Before </body> tag section)
 *
 * MAIN EXECUTION is at the bottom of the file - the map load kicks everything off
 */

// Configuration
const CONFIG = {
  urls: {
    googleBucket: "https://storage.googleapis.com/parc_des_ecrins",
    airtableData: "https://storage.googleapis.com/parc_des_ecrins/parcdesecrins-airtable-dump.json",
    mapImages: {
      restaurantWalk: "/map/restaurant+walk.png",
      restaurantWalkActive: "/map/restaurant+walk-active.png",
      rCluster: "/map/r-cluster.png",
      wCluster: "/map/w-cluster.png",
    },
  },
  map: {
    bounds: [5.784014, 44.488283, 6.81118, 45.193431],
    center: [6.079625696485338, 45.05582527284327],
    zoom: 10.5,
    style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
    iconSize: 0.6,
  },
  ui: {
    btnDefaultValue: "Search",
    debounceTime: 300,
    fadeTimeout: 2000,
    updateTimeout: 1000,
  },
};

// DOM Elements Cache
const DOM = {
  search: document.getElementById("search"),
  loadingAnimation: document.getElementById("loading-animation"),
  btnSearch: document.getElementById("btnSearch"),
  cards: document.getElementById("cards"),
  toolbar: document.getElementById("toolbar"),
  noResults: document.getElementById("no-results"),
  filterGroup: document.getElementById("filter-group"),
  autosuggest: document.getElementById("autosuggest"),
  totalResults: document.getElementById("totalresults"),
  reload: document.querySelector(".reload"),
  listContainer: document.querySelector(".uui-blogsection01_list"),
  emailForm: document.getElementById("email-form"),
  clearSearch: document.getElementById("clearsearch"),
};

// Global Variables
let geocoder;
let searchterm = "";
let filterForPointLayer = ["any"];
let filterForClusterLayer = ["all", ["has", "point_count"]];
let map;

// Initial data for the Cards component
const initialData = { listings: [] };

// Maptiler Configuration
maptilersdk.config.apiKey = "fsCLuIQWGPlRskWhImQz";

// Loading State Management
class LoadingManager {
  constructor() {
    this.loadingCount = 0;
  }

  startLoading() {
    this.loadingCount++;
    if (this.loadingCount === 1) {
      DOM.loadingAnimation.style.display = "block";
      // Show reload button when loading starts
      DOM.reload.classList.remove("hidden");
      // Hide menu-tabs when loading starts
      const menuTabs = document.querySelector(".menu-tabs.w-form");
      if (menuTabs) {
        menuTabs.style.display = "none";
      }
    }
  }

  stopLoading() {
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    if (this.loadingCount === 0) {
      DOM.loadingAnimation.style.display = "none";
      // Hide reload button when loading stops
      DOM.reload.classList.add("hidden");
    }
  }

  reset() {
    this.loadingCount = 0;
    DOM.loadingAnimation.style.display = "none";
    // Hide reload button on reset
    DOM.reload.classList.add("hidden");
  }
}

// Initialize loading manager
const loadingManager = new LoadingManager();

// Map Initialization
function initializeMap() {
  document.getElementById("map").style.visibility = "hidden";
  map = new maptilersdk.Map({
    container: "map",
    zoom: 10.5,
    center: [6.079625696485338, 45.05582527284327],
    fullscreenControl: "top-right",
    style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
    antialias: true,
    navigationControl: false,
  }).addControl(
    new maptilersdk.MaptilerNavigationControl({
      showCompass: false,
    })
  );

  // Disable map rotation
  map.dragRotate.disable();
  map.keyboard.disable();
  map.touchZoomRotate.disableRotation();

  return map;
}

// Google Maps API Loading
function loadGoogleMapsAPI() {
  const script = document.createElement("script");
  script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDCeFfHwzjUWP2yZh7iTw1dGvAzG8cSLNc&callback=mapsApiLoaded&v=weekly";
  script.defer = true;
  document.head.appendChild(script);

  window.mapsApiLoaded = () => {
    console.log("Google Maps API loaded successfully - show Search input");
    geocoder = new google.maps.Geocoder();
    enableSearch();
  };
}

// Map Data Management
class MapDataManager {
  constructor() {
    this.cache = new Map();
    this.currentFilter = null;
  }

  async fetchData(url) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const response = await fetch(url);
      const data = await response.json();
      this.cache.set(url, data);
      return data;
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }

  updateFilter(filter) {
    this.currentFilter = filter;
    if (map && map.getSource("earthquakes")) {
      map.setFilter("point-layer", filter);
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

// Filter Functions
function createCheckboxesNew(id) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = true;
  DOM.filterGroup.appendChild(input);

  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = id;
  DOM.filterGroup.appendChild(label);

  input.addEventListener("change", updateFilter);
}

function updateFilter() {
  filterForPointLayer.length = 1;
  filterForClusterLayer.length = 2;

  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  const checkedTypes = Array.from(checkboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.id);

  if (checkedTypes.length === 0) {
    filterForPointLayer = ["any"];
  } else {
    filterForPointLayer = ["any", ...checkedTypes.map((type) => ["==", ["get", "icon"], type])];
  }

  if (window.mapDataManager) {
    window.mapDataManager.updateFilter(filterForPointLayer);
  }
}

// Update getData to use loading manager
async function getData() {
  try {
    if (!window.mapDataManager) {
      window.mapDataManager = new MapDataManager();
    }

    loadingManager.startLoading();
    DOM.btnSearch.value = DOM.btnSearch.dataset.wait;

    // Hide menu-tabs during loading
    const menuTabs = document.querySelector(".menu-tabs.w-form");
    if (menuTabs) {
      menuTabs.style.display = "none";
    }

    const url =
      DOM.search.value !== "" ? `${CONFIG.urls.airtableData}?endpoint=home&name=${DOM.search.value.toLowerCase()}` : CONFIG.urls.airtableData;

    const data = await window.mapDataManager.fetchData(url);
    handleSuccessfulDataFetch(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    DOM.btnSearch.value = DOM.btnSearch.dataset.default;
    loadingManager.reset();
  }
}

// Helper Functions
function handleSuccessfulDataFetch(data) {
  DOM.btnSearch.value = CONFIG.ui.btnDefaultValue;

  if (data.length > 0) {
    console.log("We have " + data.length + " results!");
    updateResultsDisplay(data);
    if (window.$app && window.$app.components && window.$app.components.cards) {
      window.$app.components.cards.store.listings = data;
    }
    activateList(data);
    showResultsUI();
    setupTagClickHandlers();
    const dataGeoJson = convertToGeoJson(data);
    loadCustomMarkersAndLayers(dataGeoJson);
    loadGoogleMapsAPI();
    document.getElementById("map").style.visibility = "visible";

    // Show menu-tabs after content is loaded
    const menuTabs = document.querySelector(".menu-tabs.w-form");
    if (menuTabs) {
      menuTabs.style.display = "block";
    }
  } else {
    showNoResultsUI();
  }
  loadingManager.stopLoading();
}

function updateResultsDisplay(data) {
  const resultText = data.length === 1 ? "result" : "results";
  const resultSearchTerm = DOM.search.value.toLowerCase() === "" ? "" : ` for <b>"${DOM.search.value.toLowerCase()}"</b>`;

  DOM.totalResults.innerHTML = `<b>${data.length}</b> ${resultText}${resultSearchTerm}`;
}

function showResultsUI() {
  DOM.noResults.style.display = "none";
  DOM.cards.style.display = "block";
  DOM.toolbar.style.display = "block";
}

function showNoResultsUI() {
  DOM.cards.style.display = "none";
  DOM.noResults.style.display = "block";
  DOM.toolbar.style.display = "none";
}

function setupTagClickHandlers() {
  document.querySelectorAll(".tag").forEach((tag) => {
    tag.addEventListener("click", function () {
      DOM.search.value = this.textContent;
      DOM.search.dispatchEvent(new Event("input"));
      if (window.$fetch && window.$fetch.triggerAction) {
        window.$fetch.triggerAction("get_todos");
      }
    });
  });
}

function convertToGeoJson(data) {
  const dataGeoRaw =
    `{"type": "FeatureCollection","crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },` +
    `"features": [${data.map((item) => {
      return `{ "type": "${item.type}", "properties": { "id": "${item.id}", "main_image": "${item.main_image}","mag": 1.43, "time": 1507424832518, "felt": null, "tsunami": 1, "icon" : "restaurantz" }, "geometry": { "type": "Point", "coordinates": [ ${item.longitude}, ${item.latitude} ] } }`;
    })}]}`;
  return JSON.parse(dataGeoRaw);
}

// Map Utility Functions
function getUniqueIcons(dataGeoJson) {
  const gfxFolder = CONFIG.urls.googleBucket + "/map";
  const uniqueIcons = new Set();

  dataGeoJson.features.forEach((feature) => {
    if (feature.properties && feature.properties.icon) {
      uniqueIcons.add(feature.properties.icon);
    }
  });

  return Array.from(uniqueIcons).map((icon) => ({ name: icon, path: `${gfxFolder}/${icon}.png` }));
}

function loadCustomMarkersAndLayers(dataGeoJson) {
  const customMarkers = getUniqueIcons(dataGeoJson);
  let loadedImages = 0;
  const totalImages = customMarkers.length;

  // Clear existing layers and sources
  ["cluster-layer", "point-layer", "cluster-count", "unclustered-point"].forEach((layer) => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });
  if (map.getSource("earthquakes")) map.removeSource("earthquakes");

  // Load custom marker icons
  customMarkers.forEach((marker) => {
    map.loadImage(marker.path, (error, image) => {
      if (error) {
        console.error("Error loading image:", error);
        loadedImages++;
        if (loadedImages === totalImages) {
          loadingManager.stopLoading();
        }
        return;
      }
      map.addImage(marker.name, image);
      createCheckboxesNew(marker.name);
      loadedImages++;
      if (loadedImages === totalImages) {
        loadingManager.stopLoading();
      }
    });
  });

  // Add GeoJSON source
  map.addSource("earthquakes", {
    type: "geojson",
    data: dataGeoJson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
    clusterProperties: {
      has_restaurant: ["any", ["==", ["get", "icon"], "restaurantz"], "false"],
      has_walk: ["any", ["==", ["get", "icon"], "walk"], "false"],
      only_restaurant: ["all", ["==", ["get", "icon"], "restaurantz"], "false"],
      only_walk: ["all", ["==", ["get", "icon"], "walk"], "false"],
    },
  });

  // Add layers
  addMapLayers();
}

function addMapLayers() {
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
    id: "cluster-count",
    type: "symbol",
    source: "earthquakes",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-font": ["Arial Unicode MS Bold"],
      "text-size": 16,
    },
    paint: {
      "text-color": "#ffffff",
    },
  });

  map.addLayer({
    id: "point-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": ["case", ["==", ["get", "icon"], "restaurantz"], "restaurantz", ["==", ["get", "icon"], "walk"], "walk", "walk"],
      "icon-size": CONFIG.map.iconSize,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
}

// List Management
class ListManager {
  constructor() {
    this.observer = null;
    this.eventListeners = new Map();
  }

  initialize() {
    this.setupEventDelegation();
  }

  setupEventDelegation() {
    if (DOM.listContainer) {
      DOM.listContainer.addEventListener("mouseenter", this.handleListHover.bind(this), true);
      DOM.listContainer.addEventListener("click", this.handleListClick.bind(this), true);
    }
  }

  handleListHover(event) {
    const item = event.target.closest(".uui-blogsection01_item");
    if (!item) return;

    cleanSelection();
    item.classList.toggle("selected");
    if (item.classList.contains("selected")) {
      selectListToMap(item);
    }
  }

  handleListClick(event) {
    const flyToButton = event.target.closest(".fly-to-marker");
    if (!flyToButton) return;

    const item = flyToButton.closest(".uui-blogsection01_item");
    if (item) {
      flyToMarker(item);
    }
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.eventListeners.forEach((listener, element) => {
      element.removeEventListener(listener.type, listener.handler);
    });
    this.eventListeners.clear();
  }
}

// Update activateList to use the new ListManager
function activateList(data) {
  const items = data.map((item) => ({
    i: item.id,
    lat: item.latitude,
    lon: item.longitude,
  }));

  const listItems = DOM.listContainer?.querySelectorAll(".uui-blogsection01_item:not(:first-child)");

  if (listItems) {
    listItems.forEach((div, index) => {
      if (items[index]) {
        div.setAttribute("data-id", items[index].i);
        div.setAttribute("data-lonlat", `${items[index].lon},${items[index].lat}`);
      }
    });
  }
}

// Update waitForElement to include cleanup
function waitForElement(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      resolve();
    } else {
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });

      // Store observer for cleanup
      window._elementObserver = observer;
    }
  });
}

// Update cleanup to reset loading state
function cleanup() {
  if (window._elementObserver) {
    window._elementObserver.disconnect();
  }
  if (window.listManager) {
    window.listManager.cleanup();
  }
  if (window.mapDataManager) {
    window.mapDataManager.clearCache();
  }
  loadingManager.reset();
  map?.remove();
}

// Search Functions
function enableSearch() {
  if (DOM.emailForm) {
    DOM.emailForm.style.visibility = "visible";
  }

  const debouncedHandleUserInput = debounce(handleUserInput, CONFIG.ui.debounceTime);

  // Update search icon and clear button based on input value
  function updateSearchUI() {
    const hasValue = DOM.search.value.trim() !== "";
    const emailValue = document.querySelector('input[name="Email-3"]')?.value.trim() || "";
    const spyglassIcon = document.querySelector("#spyglass");
    const clearSearch = document.querySelector("#clearsearch");
    const clearSearchSvg = document.querySelector("#clearsearch svg");
    const spyglassSvg = document.querySelector("#spyglass svg");

    if (spyglassIcon && clearSearch) {
      if (hasValue || emailValue) {
        spyglassIcon.style.display = "none";
        clearSearch.style.display = "block";
      } else {
        spyglassIcon.style.display = "block";
        clearSearch.style.display = "none";
      }
    }

    if (clearSearch) {
      clearSearch.style.display = hasValue ? "block" : "none";
      if (clearSearchSvg) {
        clearSearchSvg.style.width = "100%";
        clearSearchSvg.style.height = "100%";
      }
    }

    if (spyglassIcon && spyglassSvg) {
      spyglassSvg.style.width = "100%";
      spyglassSvg.style.height = "100%";
    }
  }

  // Initialize UI state
  updateSearchUI();

  // Add input listener for Email-3 field
  const emailInput = document.querySelector('input[name="Email-3"]');
  if (emailInput) {
    emailInput.addEventListener("input", updateSearchUI);
  }

  DOM.search.addEventListener("input", function () {
    console.log("input", DOM.search.value);
    updateSearchUI();
    if (DOM.search.value === "") return;
    debouncedHandleUserInput();
  });

  // Add click handler for clear search
  const clearSearch = document.querySelector("#clearsearch");
  if (clearSearch) {
    clearSearch.addEventListener("click", function (e) {
      e.preventDefault();
      DOM.search.value = "";
      DOM.search.dispatchEvent(new Event("input"));
      if (window.$fetch && window.$fetch.triggerAction) {
        window.$fetch.triggerAction("get_todos");
      }
    });
  }
}

// Update clear search button click handler
document.querySelectorAll("#clearsearch, #brand").forEach((element) => {
  element.addEventListener("click", function () {
    DOM.search.value = "";
    DOM.search.dispatchEvent(new Event("input"));
    if (window.$fetch && window.$fetch.triggerAction) {
      window.$fetch.triggerAction("get_todos");
    }

    // Force update UI after clear
    const spyglassIcon = document.querySelector("#spyglass");
    const clearSearch = document.querySelector("#clearsearch");
    const spyglassSvg = document.querySelector("#spyglass svg");
    if (spyglassIcon && clearSearch) {
      spyglassIcon.style.display = "block";
      clearSearch.style.display = "none";
    }
    if (clearSearch) {
      clearSearch.style.display = "none";
      const clearSearchSvg = document.querySelector("#clearsearch svg");
      if (clearSearchSvg) {
        clearSearchSvg.style.width = "100%";
        clearSearchSvg.style.height = "100%";
      }
    }
    if (spyglassSvg) {
      spyglassSvg.style.width = "100%";
      spyglassSvg.style.height = "100%";
    }
  });
});

async function handleUserInput() {
  const { AutocompleteSessionToken, AutocompleteSuggestion } = await google.maps.importLibrary("places");
  const query = DOM.search.value;

  if (!query.trim()) {
    console.warn("No input provided for Geocoding");
    return;
  }

  let request = {
    input: query,
    language: "en-US",
    region: "fr",
  };

  const token = new AutocompleteSessionToken();
  request.sessionToken = token;

  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

  let predictions = [];

  for (let suggestion of suggestions) {
    const placePrediction = suggestion.placePrediction;
    let place = await placePrediction.toPlace();
    place.route = "";
    await place.fetchFields({
      fields: ["displayName", "addressComponents", "location"],
    });

    const addressComponents = place.addressComponents;

    if (!addressComponents) {
      console.log("No address components available.");
      return null;
    }

    const getAddressComponent = (type) => {
      const component = addressComponents.find((comp) => comp.types.includes(type));
      return component ? component.longText : "";
    };

    predictions.push({
      displayName: place.displayName,
      location: {
        lat: place.location?.lat(),
        lng: place.location?.lng(),
      },
      formattedAddress: [getAddressComponent("route"), getAddressComponent("locality"), getAddressComponent("country")]
        .filter((component) => component && component.trim() !== "")
        .join(", "),
    });
  }

  populateAutoSuggest(predictions);
}

// Autosuggest Functions
function populateAutoSuggest(predictions) {
  DOM.autosuggest.innerHTML = "";

  const ul = document.createElement("ul");

  predictions.forEach((prediction) => {
    const li = document.createElement("li");
    li.innerHTML = `${prediction.displayName} <span class="grey">${prediction.formattedAddress}</span>`;
    li.setAttribute("data-center", `${prediction.location.lat},${prediction.location.lng}`);
    li.setAttribute("data-displayname", `${prediction.displayName}`);
    ul.appendChild(li);
  });

  const img = document.createElement("img");
  img.className = "powered-by-google";
  img.src = "https://storage.googleapis.com/geo-devrel-public-buckets/powered_by_google_on_white.png";
  img.alt = "Powered by Google";
  ul.appendChild(img);

  ul.addEventListener("click", handleAutosuggestClick);

  DOM.autosuggest.appendChild(ul);
  DOM.autosuggest.classList.remove("hidden");
}

function handleAutosuggestClick(event) {
  let clickedItem = event.target.closest("li");
  if (clickedItem) {
    const [lat, lng] = clickedItem.dataset.center.split(",");
    DOM.search.value = clickedItem.dataset.displayname;
    map.flyTo({
      center: [parseFloat(lng), parseFloat(lat)],
      zoom: 12,
    });
    DOM.autosuggest.innerHTML = "";
  }
}

// Map Event Handlers
function handlePointLayerClick(e) {
  const features = getRenderedFeatures(e.point);
  if (features.length) {
    const element = features[0];
    var coordinates = features[0].geometry.coordinates.slice();
    var mag = features[0].properties.mag;
    var main_image = features[0].properties.main_image;
    var tsunami = features[0].properties.tsunami === 1 ? "yes" : "no";

    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    new maptilersdk.Popup({ offset: 20 })
      .setLngLat(coordinates)
      .setHTML(
        `<div class="popup"><div class="popup-imgwrap"><img src="${main_image}" loading="lazy" alt="" class="popup-image"></div><div class="popup-txtwrap">${mag} and tsunami: ${tsunami}This is a small text but I&nbsp;am not sure if it is ok to have this here so big and tall what do you think.</div></div>`
      )
      .setMaxWidth("360px")
      .addTo(map);

    selectMapToList(element);
  }
}

function handleClusterLayerClick(e) {
  var features = map.queryRenderedFeatures(e.point, {
    layers: ["cluster-layer"],
  });
  var clusterId = features[0].properties.cluster_id;
  map.getSource("earthquakes").getClusterExpansionZoom(clusterId, function (err, zoom) {
    if (err) return;
    map.easeTo({
      center: features[0].geometry.coordinates,
      zoom: zoom,
    });
  });
}

function handleMapMoveEnd() {
  if (map.getLayer("point-layer") && map.isSourceLoaded("earthquakes")) {
    // Start loading before filtering
    loadingManager.startLoading();

    // Get current map bounds
    const bounds = map.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    // Get all cards from the current data
    const allCards = document.querySelectorAll("#cards .uui-blogsection01_item");

    // Filter cards based on bounds
    allCards.forEach((card) => {
      const lonlat = card.getAttribute("data-lonlat");
      if (lonlat) {
        const [lon, lat] = lonlat.split(",").map(Number);
        const isInBounds = lon >= sw.lng && lon <= ne.lng && lat >= sw.lat && lat <= ne.lat;
        card.style.display = isInBounds ? "block" : "none";
      }
    });

    // Update the results count, excluding the first card
    const visibleCards = document.querySelectorAll("#cards .uui-blogsection01_item:not(:first-child):not([style*='display: none'])");
    const count = visibleCards.length;

    // Update the total results display
    DOM.totalResults.innerHTML = `<b>${count}</b> results within map area`;

    // Stop loading after filtering is complete
    loadingManager.stopLoading();
  }
}

// Utility Functions
function getRenderedFeatures(point) {
  return map.queryRenderedFeatures(point, {
    layers: ["point-layer"],
  });
}

function showRefreshListButton() {
  // This function is now handled by the LoadingManager
}

function createListFromSource() {
  DOM.loadingAnimation.style.display = "block";
  DOM.reload.classList.remove("hidden");
  console.log("loading ON");
  const features = getRenderedFeaturesInView("point-layer");

  if (features.length) {
    map.off("render", createListFromSource);
    updateList();
  }
}

function getRenderedFeaturesInView(layer) {
  return map.queryRenderedFeatures({ layers: [layer] });
}

function updateList() {
  const features = getRenderedFeatures();
  const listItems = features.map((item) => item.properties.id);

  const allCards = document.querySelectorAll("#cards .uui-blogsection01_item");

  allCards.forEach((div) => {
    const dataId = div.getAttribute("data-id");
    if (listItems.includes(dataId)) {
      div.classList.remove("hidden");
    } else {
      div.classList.add("hidden");
    }
  });

  DOM.loadingAnimation.style.display = "none";
  DOM.reload.classList.add("hidden");
  console.log("loading OFF");
  countVisibleCards();
}

function countVisibleCards() {
  const visibleCards = document.querySelectorAll("#cards .uui-blogsection01_item:not(.hidden)");
  const count = visibleCards.length;
  updateCounter(count);
}

function updateCounter(count) {
  fadeDiv("warning-updated", count);
}

function fadeDiv(divId, count) {
  const fadeDiv = document.getElementById(divId);
  fadeDiv.classList.add("fade-in-out");
  setTimeout(() => {
    fadeDiv.classList.remove("fade-in-out");
  }, CONFIG.ui.fadeTimeout);
  setTimeout(() => {
    DOM.totalResults.innerHTML = `<b>${count}</b> results within map area`;
  }, CONFIG.ui.updateTimeout);
}

// abusing the x-show  (see webflow on the card) functionality from framework.js to inject an id into the card
function cardLoaded(card) {
  //console.log("card loaded" + card.id);

  return "#card-" + card.id;
}

// Event Listeners
DOM.search.addEventListener("input", function () {
  this.value ? this.classList.add("has--value") : this.classList.remove("has--value");
});

// Update list toggle
document.querySelector(".list-toggle")?.addEventListener("click", function () {
  document.querySelector(".uui-cta06_component")?.classList.toggle("expanded");
  this.classList.toggle("active");
});

// MAIN EXECUTION
// Ensure DOM is ready and framework.js is fully loaded
/**
 * Ensure framework.js and cards DOM element are available before initializing
 */
async function initializeCardsComponent() {
  await waitForFrameworkJS();
  await waitForElement("#cards");
  $app.createComponent("cards", initialData).mount("#cards");
}

function waitForFrameworkJS() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (window.$app && window.$app.createComponent) {
        clearInterval(interval);
        resolve();
      }
    }, 50); // Check every 50ms
  });
}

// Utility Functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function loadMapImages() {
  const imagePromises = Object.entries(CONFIG.urls.mapImages).map(
    ([key, path]) =>
      new Promise((resolve, reject) => {
        map.loadImage(CONFIG.urls.googleBucket + path, (error, image) => {
          if (error) reject(error);
          else resolve({ name: key, image });
        });
      })
  );

  try {
    const images = await Promise.all(imagePromises);
    images.forEach(({ name, image }) => map.addImage(name, image));
    return true;
  } catch (error) {
    console.error("Error loading map images:", error);
    return false;
  }
}

// Main Execution
async function main() {
  try {
    // Hide menu-tabs immediately on page load
    const menuTabs = document.querySelector(".menu-tabs.w-form");
    if (menuTabs) {
      menuTabs.style.display = "none";
    }

    // Hide reload button on page load
    DOM.reload.classList.add("hidden");

    await initializeCardsComponent();
    map = initializeMap();
    window.listManager = new ListManager();
    window.listManager.initialize();

    map.on("load", async () => {
      const imagesLoaded = await loadMapImages();
      if (imagesLoaded) {
        getData();
      }

      map.on("click", "point-layer", handlePointLayerClick);
      map.on("click", "cluster-layer", handleClusterLayerClick);
      map.on("mouseenter", "point-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "point-layer", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("moveend", handleMapMoveEnd);
    });
  } catch (error) {
    console.error("Error during initialization:", error);
    cleanup();
  }
}

// Call main explicitly
main().catch((error) => {
  console.error("Error during initialization:", error);
});

// Add cleanup on page unload
window.addEventListener("unload", cleanup);

// Add initial hide on page load
document.addEventListener("DOMContentLoaded", function () {
  const menuTabs = document.querySelector(".menu-tabs.w-form");
  if (menuTabs) {
    menuTabs.style.display = "none";
  }
});

// List Selection Functions
function cleanSelection() {
  const listSelected = document.querySelector(".uui-blogsection01_item.selected");
  if (listSelected) {
    listSelected.classList.remove("selected");
  }
}

function selectListToMap(item) {
  map.setLayoutProperty("point-layer", "icon-image", ["case", ["==", ["get", "id"], item.dataset.id], "restaurant+walk-active", ["get", "icon"]]);
}

function flyToMarker(item) {
  map.flyTo({
    center: item.dataset.lonlat.split(","),
  });
}

function selectMapToList(element) {
  cleanSelection();
  const listSelected = document.querySelector(`.uui-blogsection01_item[data-id="${element.properties.id}"]`);
  if (listSelected) {
    listSelected.classList.add("selected");
  }
}
