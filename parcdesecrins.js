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
    }),
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

    // Also listen for card clicks to open detail page
    const cardsContainer = document.getElementById("cards");
    if (cardsContainer) {
      cardsContainer.addEventListener("click", handleCardDetailClick, false);
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
        `<div class="popup"><div class="popup-imgwrap"><img src="${main_image}" loading="lazy" alt="" class="popup-image"></div><div class="popup-txtwrap">${mag} and tsunami: ${tsunami}This is a small text but I&nbsp;am not sure if it is ok to have this here so big and tall what do you think.</div></div>`,
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

    // Get all cards from both containers
    const allCards = document.querySelectorAll("#cards .uui-blogsection01_item:not(:first-child)");
    const allResults = document.querySelectorAll("#results .uui-blogsection01_item:not(:first-child)");

    // Filter cards based on bounds
    let visibleCount = 0;
    const visibleCards = [];

    allCards.forEach((card) => {
      const lonlat = card.getAttribute("data-lonlat");
      if (lonlat) {
        const [lon, lat] = lonlat.split(",").map(Number);
        const isInBounds = lon >= sw.lng && lon <= ne.lng && lat >= sw.lat && lat <= ne.lat;
        card.style.setProperty("display", isInBounds ? "block" : "none", "important");
        if (isInBounds) {
          visibleCount++;
          visibleCards.push(card);
        }
      }
    });

    // Update results container to match visible cards
    allResults.forEach((result) => {
      const cardId = result.getAttribute("data-id");
      const isVisible = visibleCards.some((card) => card.getAttribute("data-id") === cardId);
      result.style.setProperty("display", isVisible ? "block" : "none", "important");
    });

    // Reset all padding first
    visibleCards.forEach((card) => {
      card.style.setProperty("padding-left", "10px", "important");
      card.style.setProperty("padding-right", "10px", "important");
    });

    // Recalculate padding based on column position
    if (visibleCount > 0) {
      // Calculate which cards are in first and last columns
      visibleCards.forEach((card, index) => {
        const column = index % 3; // 0 = first column, 1 = middle column, 2 = last column

        // First column gets no left padding
        if (column === 0) {
          card.style.setProperty("padding-left", "0", "important");
        }

        // Last column gets no right padding
        if (column === 2) {
          card.style.setProperty("padding-right", "0", "important");
        }
      });
    }

    // Update the total results display with animation
    const resultText = visibleCount === 1 ? "result" : "results";

    // Add a small delay before updating the results
    setTimeout(() => {
      DOM.totalResults.innerHTML = `<b>${visibleCount}</b> ${resultText} within map area`;
      DOM.totalResults.classList.add("results-updating");

      // Remove the animation class after it completes
      setTimeout(() => {
        DOM.totalResults.classList.remove("results-updating");
      }, 500);
    }, 200);

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
      }),
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
    // Inject CSS for layout styles immediately
    injectCSS();

    // Hide menu-tabs immediately on page load
    const menuTabs = document.querySelector(".menu-tabs.w-form");
    if (menuTabs) {
      menuTabs.style.display = "none";
    }

    // Hide reload button on page load
    DOM.reload.classList.add("hidden");

    // Set grid view button to active by default
    const gridViewButton = document.querySelector(".button-with-icon.grid-view");
    const listViewButton = document.querySelector(".button-with-icon.list-view");
    const listToggleButton = document.querySelector(".list-toggle");
    const cardsContainer = document.getElementById("cards");

    if (gridViewButton) {
      gridViewButton.classList.add("active");

      // Add click handler for grid view
      gridViewButton.addEventListener("click", function () {
        gridViewButton.classList.add("active");
        if (listViewButton) {
          listViewButton.classList.remove("active");
        }
        if (listToggleButton) {
          listToggleButton.style.display = "block";
        }
        if (cardsContainer) {
          cardsContainer.classList.remove("list-layout");
          cardsContainer.classList.add("grid-layout");
        }
        // Toggle Webflow grid/list-mode classes
        const grid = document.querySelector(".uui-blogsection01_list");
        if (grid) {
          grid.classList.add("w-layout-grid");
          grid.classList.remove("list-mode");
        }
        forceGridViewDisplay();
      });
    }

    // Ensure list view button is not active by default
    if (listViewButton) {
      listViewButton.classList.remove("active");

      // Add click handler for list view
      listViewButton.addEventListener("click", function () {
        listViewButton.classList.add("active");
        if (gridViewButton) {
          gridViewButton.classList.remove("active");
        }
        if (listToggleButton) {
          listToggleButton.style.display = "none";
        }
        if (cardsContainer) {
          cardsContainer.classList.remove("grid-layout");
          cardsContainer.classList.add("list-layout");
        }
        // Toggle Webflow grid/list-mode classes
        const grid = document.querySelector(".uui-blogsection01_list");
        if (grid) {
          grid.classList.remove("w-layout-grid");
          grid.classList.add("list-mode");
        }
        resetListViewGridStyles();
        forceListViewDisplay();
      });
    }

    // Set default layout class on cards container
    if (cardsContainer) {
      cardsContainer.classList.add("grid-layout");
    }

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

// Function to inject CSS styles
function injectCSS() {
  // Check if styles are already injected
  if (document.getElementById("view-toggle-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "view-toggle-styles";
  style.textContent = `
    /* Reset any existing styles */
    .uui-blogsection01_list {
      all: initial !important;
      display: flex !important;
      flex-wrap: wrap !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .uui-blogsection01_item {
      all: initial !important;
      box-sizing: border-box !important;
    }

    /* Grid layout - default */
    #cards.grid-layout .uui-blogsection01_list,
    .uui-blogsection01_list.w-layout-grid {
      display: flex !important;
      flex-wrap: wrap !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    #cards.grid-layout .uui-blogsection01_item {
      width: 33.333% !important;
      padding: 10px !important;
      box-sizing: border-box !important;
    }

    /* Remove left padding from first column (accounting for hidden placeholder) */
    #cards.grid-layout .uui-blogsection01_item:nth-child(3n+2) {
      padding-left: 0 !important;
    }

    /* Remove right padding from last column (accounting for hidden placeholder) */
    #cards.grid-layout .uui-blogsection01_item:nth-child(3n+1) {
      padding-right: 0 !important;
    }

    /* List layout - override Webflow grid */
    #cards.list-layout .uui-blogsection01_list,
    .uui-blogsection01_list.list-mode {
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      box-sizing: border-box !important;
      gap: 0 !important;
      padding: 10px !important;
    }

    #cards.list-layout .uui-blogsection01_item,
    .uui-blogsection01_list.list-mode .uui-blogsection01_item {
      flex-direction: row !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      align-items: center !important;
      min-height: 150px !important;
      padding: 8px 10px !important;
    }

    /* Remove left padding from first item in list view */
    #cards.list-layout .uui-blogsection01_item:first-child,
    .uui-blogsection01_list.list-mode .uui-blogsection01_item:first-child {
      padding-left: 0 !important;
    }

    /* Remove right padding from last item in list view */
    #cards.list-layout .uui-blogsection01_item:last-child,
    .uui-blogsection01_list.list-mode .uui-blogsection01_item:last-child {
      padding-right: 0 !important;
    }

    #cards.list-layout .uui-blogsection01_image-wrapper,
    .uui-blogsection01_list.list-mode .uui-blogsection01_image-wrapper {
      width: auto !important;
      min-width: 150px !important;
      max-width: none !important;
      height: 150px !important;
      margin-right: 1rem !important;
      flex-shrink: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      padding-top: 0 !important;
    }

    #cards.list-layout .uui-blogsection01_image-wrapper img,
    .uui-blogsection01_list.list-mode .uui-blogsection01_image-wrapper img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      display: block !important;
    }

    #cards.list-layout .uui-blogsection01_content,
    .uui-blogsection01_list.list-mode .uui-blogsection01_content {
      width: 70% !important;
      padding: 0 8px !important;
      flex-grow: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
    }

    /* Media query for responsive grid */
    @media screen and (max-width: 991px) {
      #cards.grid-layout .uui-blogsection01_item {
        width: 50% !important;
      }
    }

    @media screen and (max-width: 767px) {
      #cards.grid-layout .uui-blogsection01_item {
        width: 100% !important;
      }
    }

    #cards.grid-layout .card-wrapper {
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
    }

    .uui-blogsection01_item:first-child {
      display: none !important;
    }

    .uui-blogsection01_item:not([data-id]) {
      display: none !important;
    }

    .uui-blogsection01_list .uui-blogsection01_item:nth-child(1) {
      display: none !important;
    }

    /* Results animation */
    @keyframes resultsUpdate {
      0% {
        opacity: 0.5;
        transform: scale(0.95);
      }
      50% {
        opacity: 1;
        transform: scale(1.05);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    .results-updating {
      animation: resultsUpdate 0.5s ease-out;
      display: inline-block;
    }

    /* ===== Detail Page Overlay ===== */
    .detail-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 2vh 2vw;
      overflow-y: auto;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .detail-overlay.visible {
      opacity: 1;
    }

    .detail-container {
      background: #fff;
      border-radius: 16px;
      max-width: 820px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      position: relative;
      margin: auto;
    }

    .detail-close {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 10;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.9);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      line-height: 1;
      color: #333;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      transition: background 0.2s;
    }
    .detail-close:hover {
      background: #fff;
    }

    /* Gallery */
    .detail-gallery {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 6px;
      height: 380px;
      overflow: hidden;
    }
    .detail-gallery-thumbs {
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow: hidden;
    }
    .detail-gallery-thumb {
      width: 100%;
      flex: 1;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      position: relative;
    }
    .detail-gallery-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: opacity 0.2s;
    }
    .detail-gallery-thumb:hover img {
      opacity: 0.85;
    }
    .detail-gallery-thumb .thumb-badge {
      position: absolute;
      bottom: 6px;
      left: 6px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .detail-gallery-main {
      border-radius: 4px;
      overflow: hidden;
    }
    .detail-gallery-main img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Body */
    .detail-body {
      padding: 28px 32px 32px;
    }

    /* Title row */
    .detail-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }
    .detail-title {
      font-size: 26px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0;
      line-height: 1.25;
    }
    .detail-price {
      font-size: 18px;
      font-weight: 600;
      color: #f56960;
      white-space: nowrap;
      margin-left: 16px;
      margin-top: 4px;
    }

    /* Location & rating */
    .detail-location-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      color: #666;
      font-size: 14px;
    }
    .detail-stars {
      color: #f5a623;
      font-size: 14px;
      letter-spacing: 1px;
    }

    /* Tags */
    .detail-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .detail-tag {
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      border: 1.5px solid;
      background: transparent;
    }
    .detail-tag:nth-child(4n+1) { color: #f56960; border-color: #f56960; }
    .detail-tag:nth-child(4n+2) { color: #4ecdc4; border-color: #4ecdc4; }
    .detail-tag:nth-child(4n+3) { color: #5b7ff5; border-color: #5b7ff5; }
    .detail-tag:nth-child(4n)   { color: #f5a623; border-color: #f5a623; }

    /* Meta row */
    .detail-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      padding: 18px 0;
      border-top: 1px solid #eee;
      border-bottom: 1px solid #eee;
      margin-bottom: 24px;
    }
    .detail-meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .detail-meta-label {
      font-size: 12px;
      color: #999;
      text-transform: capitalize;
    }
    .detail-meta-value {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    .detail-meta-icon {
      font-size: 16px;
      margin-bottom: 2px;
    }

    /* Description + map */
    .detail-content-row {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 24px;
      margin-bottom: 28px;
    }

    .detail-description h3 {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 10px;
    }
    .detail-description p {
      font-size: 14px;
      line-height: 1.65;
      color: #555;
      margin: 0;
    }
    .detail-read-more {
      font-weight: 600;
      color: #1a1a1a;
      text-decoration: underline;
      cursor: pointer;
      border: none;
      background: none;
      padding: 0;
      font-size: 14px;
    }

    .detail-minimap {
      width: 100%;
      height: 200px;
      border-radius: 12px;
      overflow: hidden;
      border: 2px solid #e0f0f0;
    }
    .detail-minimap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Action row */
    .detail-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .detail-btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #f56960;
      color: #fff;
      border: none;
      padding: 12px 28px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .detail-btn-primary:hover {
      background: #e05550;
    }
    .detail-btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      color: #666;
      font-size: 14px;
      cursor: pointer;
      padding: 8px 0;
    }
    .detail-btn-secondary:hover {
      color: #f56960;
    }

    /* Responsive detail */
    @media screen and (max-width: 767px) {
      .detail-gallery {
        grid-template-columns: 1fr;
        height: 260px;
      }
      .detail-gallery-thumbs {
        flex-direction: row;
        order: 2;
        height: 70px;
      }
      .detail-gallery-main {
        order: 1;
      }
      .detail-body {
        padding: 20px 18px 24px;
      }
      .detail-content-row {
        grid-template-columns: 1fr;
      }
      .detail-title {
        font-size: 22px;
      }
      .detail-meta {
        gap: 16px;
      }
    }
  `;
  document.head.appendChild(style);
  console.log("View toggle styles injected successfully");
}

// ===== Detail Page =====

/**
 * Find a listing object from the cached data by its ID
 */
function findListingById(id) {
  if (!window.mapDataManager || !window.mapDataManager.cache) return null;
  for (const [, data] of window.mapDataManager.cache) {
    if (Array.isArray(data)) {
      const found = data.find((item) => String(item.id) === String(id));
      if (found) return found;
    }
  }
  return null;
}

/**
 * Generate star HTML from a numeric rating (0-5)
 */
function renderStars(rating) {
  const full = Math.floor(rating || 4);
  const half = (rating || 4) % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

/**
 * Build and show the detail overlay for a given listing
 */
function openDetailPage(listing) {
  if (!listing) return;

  // Close any existing detail overlay
  closeDetailPage();

  const mainImage = listing.main_image || "";
  const title = listing.name || listing.title || listing.id || "Untitled";
  const location = listing.location || listing.address || "Parc des Écrins, France";
  const rating = listing.rating || 4;
  const tags = listing.tags || listing.categories || [];
  const tagsArray = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  const description = listing.description || listing.summary || "";
  const price = listing.price || "";
  const duration = listing.duration || "";
  const activityLevel = listing.activity_level || listing.difficulty || "";
  const language = listing.language || "";
  const includes = listing.includes || "";
  const link = listing.link || listing.url || "#";
  const images = listing.images || listing.gallery || [];
  const imagesArray = Array.isArray(images)
    ? images
    : typeof images === "string"
      ? images
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  // Ensure main image is first in gallery
  const allImages = [mainImage, ...imagesArray.filter((img) => img !== mainImage)].filter(Boolean);
  const thumbImages = allImages.slice(0, 3);
  const extraCount = allImages.length > 3 ? allImages.length - 3 : 0;

  // Build the Maptiler static map URL for the minimap
  const lat = listing.latitude || CONFIG.map.center[1];
  const lon = listing.longitude || CONFIG.map.center[0];
  const minimapUrl = `https://api.maptiler.com/maps/${CONFIG.map.style}/static/${lon},${lat},11/220x200@2x.png?key=fsCLuIQWGPlRskWhImQz`;

  // Truncate description
  const maxDescLength = 280;
  const isLong = description.length > maxDescLength;
  const shortDesc = isLong ? description.substring(0, maxDescLength) + "..." : description;

  // Build meta items (only show if data exists)
  const metaItems = [];
  if (duration) metaItems.push({ icon: "🕐", label: "Duration", value: duration });
  if (activityLevel) metaItems.push({ icon: "⚡", label: "Activity Level", value: activityLevel });
  if (language) metaItems.push({ icon: "🏠", label: "Hosted in", value: language });
  if (includes) metaItems.push({ icon: "📦", label: "Includes", value: includes });

  const overlay = document.createElement("div");
  overlay.className = "detail-overlay";
  overlay.id = "detail-overlay";

  overlay.innerHTML = `
    <div class="detail-container">
      <button class="detail-close" id="detail-close" aria-label="Close">&times;</button>

      <!-- Gallery -->
      <div class="detail-gallery">
        <div class="detail-gallery-thumbs">
          ${thumbImages
            .map(
              (img, i) => `
            <div class="detail-gallery-thumb" data-img-index="${i}">
              <img src="${img}" alt="Thumbnail ${i + 1}" loading="lazy">
              ${i === thumbImages.length - 1 && extraCount > 0 ? `<span class="thumb-badge">🖼 ${extraCount}+</span>` : ""}
            </div>
          `,
            )
            .join("")}
        </div>
        <div class="detail-gallery-main">
          <img src="${allImages[0] || ""}" alt="${title}" id="detail-main-image" loading="lazy">
        </div>
      </div>

      <!-- Body -->
      <div class="detail-body">
        <div class="detail-title-row">
          <h2 class="detail-title">${title}</h2>
          ${price ? `<span class="detail-price">${price}</span>` : ""}
        </div>

        <div class="detail-location-row">
          <span>${location}</span>
          <span class="detail-stars">${renderStars(rating)}</span>
        </div>

        ${
          tagsArray.length > 0
            ? `
          <div class="detail-tags">
            ${tagsArray.map((tag) => `<span class="detail-tag">${tag}</span>`).join("")}
          </div>
        `
            : ""
        }

        ${
          metaItems.length > 0
            ? `
          <div class="detail-meta">
            ${metaItems
              .map(
                (m) => `
              <div class="detail-meta-item">
                <span class="detail-meta-icon">${m.icon}</span>
                <span class="detail-meta-label">${m.label}</span>
                <span class="detail-meta-value">${m.value}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }

        <div class="detail-content-row">
          <div class="detail-description">
            <h3>Description</h3>
            <p id="detail-desc-text">${shortDesc}</p>
            ${isLong ? `<button class="detail-read-more" id="detail-read-more">Read More</button>` : ""}
          </div>
          <div class="detail-minimap">
            <img src="${minimapUrl}" alt="Location map">
          </div>
        </div>

        <div class="detail-actions">
          ${link && link !== "#" ? `<a href="${link}" target="_blank" class="detail-btn-primary">🗓 View Details</a>` : `<button class="detail-btn-primary" id="detail-fly-btn">🗺 Show on Map</button>`}
          <button class="detail-btn-secondary" id="detail-fav-btn">♡ Add to favourite</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add("visible");
  });

  // Prevent body scroll
  document.body.style.overflow = "hidden";

  // === Event Listeners ===

  // Close button
  document.getElementById("detail-close").addEventListener("click", closeDetailPage);

  // Click outside to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDetailPage();
  });

  // Escape key to close
  const escHandler = (e) => {
    if (e.key === "Escape") {
      closeDetailPage();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  // Thumbnail clicks swap main image
  overlay.querySelectorAll(".detail-gallery-thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const idx = parseInt(thumb.dataset.imgIndex, 10);
      const mainImg = document.getElementById("detail-main-image");
      if (mainImg && allImages[idx]) {
        mainImg.src = allImages[idx];
      }
    });
  });

  // Read More
  const readMoreBtn = document.getElementById("detail-read-more");
  if (readMoreBtn) {
    readMoreBtn.addEventListener("click", () => {
      document.getElementById("detail-desc-text").textContent = description;
      readMoreBtn.style.display = "none";
    });
  }

  // Fly to map button
  const flyBtn = document.getElementById("detail-fly-btn");
  if (flyBtn) {
    flyBtn.addEventListener("click", () => {
      closeDetailPage();
      if (listing.longitude && listing.latitude) {
        map.flyTo({
          center: [parseFloat(listing.longitude), parseFloat(listing.latitude)],
          zoom: 14,
        });
      }
    });
  }
}

/**
 * Close the detail overlay
 */
function closeDetailPage() {
  const overlay = document.getElementById("detail-overlay");
  if (overlay) {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 300);
    document.body.style.overflow = "";
  }
}

/**
 * Handle card click to open detail page.
 * Attached via event delegation on the cards container.
 */
function handleCardDetailClick(event) {
  // Don't open detail if clicking the fly-to-marker button
  if (event.target.closest(".fly-to-marker")) return;

  const item = event.target.closest(".uui-blogsection01_item");
  if (!item) return;

  const id = item.getAttribute("data-id");
  if (!id) return;

  const listing = findListingById(id);
  if (listing) {
    openDetailPage(listing);
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

function resetListViewGridStyles() {
  const list = document.querySelector(".uui-blogsection01_list");
  if (list) {
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gridTemplateColumns = "";
    list.style.gridTemplateRows = "";
    list.style.justifyItems = "";
    list.style.alignItems = "";
    list.style.gridColumnGap = "";
    list.style.gridRowGap = "";
    list.style.gridArea = "";
  }
}

function forceListViewDisplay() {
  const list = document.querySelector(".uui-blogsection01_list");
  if (list) {
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gridTemplateColumns = "";
    list.style.gridTemplateRows = "";
    list.style.justifyItems = "";
    list.style.alignItems = "";
    list.style.gridColumnGap = "";
    list.style.gridRowGap = "";
    list.style.gridArea = "";
  }
}

function forceGridViewDisplay() {
  const list = document.querySelector(".uui-blogsection01_list");
  if (list) {
    list.style.display = "grid";
    list.style.flexDirection = "";
    list.style.gridTemplateColumns = "repeat(3, 1fr)";
    list.style.gridTemplateRows = "";
  }
}
