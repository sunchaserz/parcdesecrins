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

// Sorting & Pagination State
const listState = {
  sortBy: null, // null | 'date' | 'price'
  sortDir: "asc",
  currentPage: 1,
  pageSize: 12,
  totalVisible: 0,
};

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

    // Augment cards after a short delay to let framework.js render
    setTimeout(() => {
      augmentCardsForListView();
      injectResultsToolbar();
      listState.currentPage = 1;
    }, 500);
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

    // Reset pagination on map move
    listState.currentPage = 1;

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

// ===== Sorting =====
function sortVisibleCards(sortBy) {
  if (listState.sortBy === sortBy) {
    listState.sortDir = listState.sortDir === "asc" ? "desc" : "asc";
  } else {
    listState.sortBy = sortBy;
    listState.sortDir = "asc";
  }
  listState.currentPage = 1;

  const list = document.querySelector(".uui-blogsection01_list");
  if (!list) return;

  const cards = Array.from(list.querySelectorAll(".uui-blogsection01_item:not(:first-child)"));
  const visibleCards = cards.filter((c) => c.style.display !== "none");

  visibleCards.sort((a, b) => {
    let valA, valB;
    if (sortBy === "price") {
      valA = parseFloat((a.getAttribute("data-price") || "0").replace(/[^0-9.]/g, "")) || 0;
      valB = parseFloat((b.getAttribute("data-price") || "0").replace(/[^0-9.]/g, "")) || 0;
    } else if (sortBy === "date") {
      valA = a.getAttribute("data-name") || "";
      valB = b.getAttribute("data-name") || "";
      return listState.sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return listState.sortDir === "asc" ? valA - valB : valB - valA;
  });

  // Reorder in DOM
  visibleCards.forEach((card) => list.appendChild(card));
  applyPagination();
  updateSortButtonStates();
}

function updateSortButtonStates() {
  document.querySelectorAll(".pde-sort-btn").forEach((btn) => {
    const sort = btn.dataset.sort;
    btn.classList.toggle("active", sort === listState.sortBy);
    const arrow = btn.querySelector(".sort-arrow");
    if (arrow) {
      arrow.textContent = sort === listState.sortBy ? (listState.sortDir === "asc" ? " ↑" : " ↓") : "";
    }
  });
}

// ===== Pagination =====
function applyPagination() {
  const list = document.querySelector(".uui-blogsection01_list");
  if (!list) return;

  const allCards = Array.from(list.querySelectorAll(".uui-blogsection01_item:not(:first-child)"));
  const visibleCards = allCards.filter((c) => {
    const d = c.style.display;
    return d !== "none";
  });

  // Re-check: some might be filtered by map bounds — we track "display:none" via setProperty
  // We need to count cards that SHOULD be visible (not hidden by map bounds)
  const boundsVisible = allCards.filter((c) => {
    // cards hidden by map bounds have display:none with !important
    return c.style.getPropertyPriority("display") !== "important" || c.style.getPropertyValue("display") !== "none";
  });

  listState.totalVisible = boundsVisible.length;
  const totalPages = Math.max(1, Math.ceil(listState.totalVisible / listState.pageSize));

  if (listState.currentPage > totalPages) listState.currentPage = totalPages;

  const start = (listState.currentPage - 1) * listState.pageSize;
  const end = start + listState.pageSize;

  let idx = 0;
  allCards.forEach((card) => {
    // Only paginate cards not hidden by map bounds
    const hiddenByBounds = card.style.getPropertyValue("display") === "none" && card.style.getPropertyPriority("display") === "important";
    if (hiddenByBounds) return; // leave as-is (hidden by map)

    if (idx >= start && idx < end) {
      card.style.setProperty("display", "block", "important");
    } else {
      card.style.setProperty("display", "none", "important");
    }
    idx++;
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  let paginationEl = document.getElementById("pde-pagination");
  if (!paginationEl) {
    paginationEl = document.createElement("div");
    paginationEl.id = "pde-pagination";
    const list = document.querySelector(".uui-blogsection01_list");
    if (list && list.parentElement) {
      list.parentElement.appendChild(paginationEl);
    }
  }

  if (totalPages <= 1) {
    paginationEl.style.display = "none";
    return;
  }

  paginationEl.style.display = "flex";
  paginationEl.innerHTML = `
    <button class="pde-page-btn pde-page-prev" ${listState.currentPage <= 1 ? "disabled" : ""}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      Previous
    </button>
    <span class="pde-page-info">Page ${listState.currentPage} of ${totalPages}</span>
    <button class="pde-page-btn pde-page-next" ${listState.currentPage >= totalPages ? "disabled" : ""}>
      Next
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  `;

  paginationEl.querySelector(".pde-page-prev")?.addEventListener("click", () => {
    if (listState.currentPage > 1) {
      listState.currentPage--;
      applyPagination();
      scrollListToTop();
    }
  });
  paginationEl.querySelector(".pde-page-next")?.addEventListener("click", () => {
    if (listState.currentPage < totalPages) {
      listState.currentPage++;
      applyPagination();
      scrollListToTop();
    }
  });
}

function scrollListToTop() {
  const list = document.querySelector(".uui-blogsection01_list");
  if (list) list.scrollTop = 0;
}

// ===== Enhanced Card Augmentation =====
function augmentCardsForListView() {
  const cards = document.querySelectorAll("#cards .uui-blogsection01_item:not(:first-child)");
  cards.forEach((card) => {
    if (card.dataset.augmented) return;
    card.dataset.augmented = "true";

    const id = card.getAttribute("data-id");
    const listing = findListingById(id);
    if (!listing) return;

    // Store data attributes for sorting
    card.setAttribute("data-price", listing.price || "0");
    card.setAttribute("data-name", listing.name || listing.title || "");

    const content = card.querySelector(".uui-blogsection01_content");
    if (!content) return;

    // Add type label
    const type = listing.type || "Experience";
    let typeLabel = card.querySelector(".pde-card-type");
    if (!typeLabel) {
      typeLabel = document.createElement("div");
      typeLabel.className = "pde-card-type";
      typeLabel.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      content.insertBefore(typeLabel, content.firstChild);
    }

    // Add star rating row
    let ratingRow = card.querySelector(".pde-card-rating");
    if (!ratingRow) {
      ratingRow = document.createElement("div");
      ratingRow.className = "pde-card-rating";
      const rating = listing.rating || 4;
      const reviewCount = listing.reviews || Math.floor(Math.random() * 40 + 10);
      ratingRow.innerHTML = `<span class="pde-stars">${renderStars(rating)}</span><span class="pde-review-count">${rating.toFixed(1)} (${reviewCount} reviews)</span>`;
      // Insert after title
      const title = content.querySelector(".uui-blogsection01_title, h3, h4");
      if (title && title.nextSibling) {
        content.insertBefore(ratingRow, title.nextSibling);
      } else {
        content.appendChild(ratingRow);
      }
    }

    // Add location row with icons
    let locationRow = card.querySelector(".pde-card-location");
    if (!locationRow) {
      locationRow = document.createElement("div");
      locationRow.className = "pde-card-location";
      const loc = listing.location || listing.address || "Parc des Écrins";
      locationRow.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667085" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> <span>${loc}</span>`;
      ratingRow.after(locationRow);
    }

    // Add price badge (for list view, shown on the right)
    let priceBadge = card.querySelector(".pde-card-price");
    if (!priceBadge && listing.price) {
      priceBadge = document.createElement("div");
      priceBadge.className = "pde-card-price";
      priceBadge.innerHTML = `<span class="pde-price-value">${listing.price}</span>`;
      card.appendChild(priceBadge);
    }

    // Add favorite heart button
    let favBtn = card.querySelector(".pde-card-fav");
    if (!favBtn) {
      favBtn = document.createElement("button");
      favBtn.className = "pde-card-fav";
      favBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        favBtn.classList.toggle("active");
      });

      // Place inside image wrapper
      const imgWrapper = card.querySelector(".uui-blogsection01_image-wrapper");
      if (imgWrapper) {
        imgWrapper.style.position = "relative";
        imgWrapper.appendChild(favBtn);
      }
    }
  });
}

// ===== Results Header Enhancement =====
function injectResultsToolbar() {
  const totalResultsEl = document.getElementById("totalresults");
  if (!totalResultsEl || document.getElementById("pde-toolbar-enhanced")) return;

  const toolbar = document.createElement("div");
  toolbar.id = "pde-toolbar-enhanced";
  toolbar.innerHTML = `
    <div class="pde-toolbar-top">
      <div class="pde-results-count" id="pde-results-text"></div>
      <div class="pde-toolbar-actions">
        <button class="pde-action-btn" id="pde-share-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share
        </button>
        <button class="pde-action-btn" id="pde-save-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          Save
        </button>
      </div>
    </div>
    <div class="pde-toolbar-bottom">
      <div class="pde-sort-group">
        <button class="pde-sort-btn" data-sort="date">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Sort by date<span class="sort-arrow"></span>
        </button>
        <button class="pde-sort-btn" data-sort="price">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          Sort by price<span class="sort-arrow"></span>
        </button>
      </div>
    </div>
  `;

  // Insert toolbar after the totalresults element
  totalResultsEl.parentNode.insertBefore(toolbar, totalResultsEl.nextSibling);
  // Move totalresults text into the new toolbar
  const pdeResultsText = document.getElementById("pde-results-text");
  if (pdeResultsText) {
    // We'll sync text from totalresults into our styled element
    const observer = new MutationObserver(() => {
      pdeResultsText.innerHTML = totalResultsEl.innerHTML;
    });
    observer.observe(totalResultsEl, { childList: true, subtree: true, characterData: true });
    pdeResultsText.innerHTML = totalResultsEl.innerHTML;
    totalResultsEl.style.display = "none";
  }

  // Sort button handlers
  toolbar.querySelectorAll(".pde-sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => sortVisibleCards(btn.dataset.sort));
  });

  // Share button
  document.getElementById("pde-share-btn")?.addEventListener("click", () => {
    if (navigator.share) {
      navigator.share({ title: "Parc des Écrins", url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  });
}

// ...existing code... (main() function)
