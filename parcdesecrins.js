/**
 * PARC DES ECRINS
 * @author <THE ALLIANCE>
 *
 * This file is being served by jsdelivr. (see webflow)
 * Make sure you are using the prod setup, not the uncached dev setup (see webflow Before </body> tag section)
 */

// Constants and Configurations
const ALPHI_BASE_URL = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const GOOGLE_BUCKET_URL = "https://storage.googleapis.com/parc_des_ecrins";
const ECRINS_BOUNDS = [5.784014, 44.488283, 6.81118, 45.193431];
const ICON_SIZE = 0.6;
const BTN_DEFAULT_VALUE = "Search";

// Global Variables
let geocoder;
let searchterm = "";
let filterForPointLayer = ["any"];
let filterForClusterLayer = ["all", ["has", "point_count"]];
let map;

// DOM Elements
const locqueryInput = document.getElementById("search");
const filterGroup = document.getElementById("filter-group");

// Initial data for the Cards component
const initialData = { listings: [] };

// Create the cards component and mount it to the html element with the id "cards"
$app.createComponent("cards", initialData).mount("#cards");

// Maptiler Configuration
maptilersdk.config.apiKey = "fsCLuIQWGPlRskWhImQz";

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

// Data Fetching
function getData() {
  $fetch.createAction("get_todos", {
    options: {
      method: "get",
      url: ALPHI_BASE_URL,
      headers: [{ key: "Content-Type", value: "application/json" }],
      body: [],
    },
    integrations: {
      authentication: console.log("triggered" + document.getElementById("search").value),
    },
    events: {
      onTrigger: {
        callback: console.log("triggered for :" + document.getElementById("search").value),
      },
      onRequestInit: {
        callback: async (options, triggerEl) => {
          console.log("Initializing alphi request");
          document.getElementById("loading-animation").style.display = "block";
          document.getElementById("btnSearch").value = document.getElementById("btnSearch").dataset.wait;

          if (document.getElementById("search").value !== "") {
            console.log("searchterm entered and adding it to the fetch url");
            options.url = ALPHI_BASE_URL + "?endpoint=home&name=" + document.getElementById("search").value.toLowerCase();
          }
          return options;
        },
      },
      onSuccess: {
        redirectUrl: null,
        showElement: "#results",
        hideElement: "#loading-animation",
        callback: async (response, data) => {
          handleSuccessfulDataFetch(data);
        },
      },
      onError: {
        redirectUrl: null,
        showElement: "#error",
        hideElement: "#cards",
        callback: async (response, data) => {
          console.log("Error: " + response);
          document.getElementById("btnSearch").value = document.getElementById("btnSearch").dataset.default;
        },
      },
    },
  });
}

// Helper Functions
function handleSuccessfulDataFetch(data) {
  document.getElementById("btnSearch").value = BTN_DEFAULT_VALUE;

  if (data.length > 0) {
    console.log("We have " + data.length + " results!");
    updateResultsDisplay(data);
    console.log("before");
    console.log("Webflow object:", window.Webflow);
    console.log("Data before assignment:", data);

    $app.components.cards.store.listings = data;
    console.log("after");
    activateList(data);
    showResultsUI();
    setupTagClickHandlers();
    const dataGeoJson = convertToGeoJson(data);
    loadCustomMarkersAndLayers(dataGeoJson);
    loadGoogleMapsAPI();
    document.getElementById("map").style.visibility = "visible";
  } else {
    showNoResultsUI();
  }
}

function updateResultsDisplay(data) {
  let result_text = data.length == 1 ? "result" : "results";
  let result_searchterm =
    document.getElementById("search").value.toLowerCase() == "" ? "" : ' for <b>"' + document.getElementById("search").value.toLowerCase() + '"</b>';
  $("#totalresults").html("<b>" + data.length + "</b> " + result_text + result_searchterm);
}

function showResultsUI() {
  document.getElementById("no-results").style.display = "none";
  document.getElementById("cards").style.display = "block";
  document.getElementById("toolbar").style.display = "block";
}

function showNoResultsUI() {
  document.getElementById("cards").style.display = "none";
  document.getElementById("no-results").style.display = "block";
  document.getElementById("toolbar").style.display = "none";
}

function setupTagClickHandlers() {
  $(".tag").on("click", function () {
    $("#search").val($(this).text()).trigger("input");
    $fetch.triggerAction("get_todos");
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
  const gfxFolder = GOOGLE_BUCKET_URL + "/map";
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

  // Clear existing layers and sources
  ["cluster-layer", "point-layer", "cluster-count", "unclustered-point"].forEach((layer) => {
    if (map.getLayer(layer)) map.removeLayer(layer);
  });
  if (map.getSource("earthquakes")) map.removeSource("earthquakes");

  // Load custom marker icons
  customMarkers.forEach((marker) => {
    map.loadImage(marker.path, (error, image) => {
      if (error) throw error;
      map.addImage(marker.name, image);
      createCheckboxesNew(marker.name);
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
      "icon-size": ICON_SIZE,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
}

// Filter Functions
function updateFilter() {
  filterForPointLayer.length = 1;
  filterForClusterLayer.length = 2;

  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      filterForPointLayer.push(["==", ["get", "icon"], checkbox.id]);
      filterForClusterLayer.push(["get", `only_${checkbox.id}`]);
    }
  });

  const myStyle = map.getStyle();
  myStyle.sources.earthquakes.filter = filterForPointLayer;
  map.setStyle(myStyle);
}

function createCheckboxesNew(id) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = true;
  filterGroup.appendChild(input);

  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = id;
  filterGroup.appendChild(label);

  input.addEventListener("change", updateFilter);
}

// List Functions
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

      div.addEventListener("mouseenter", (e) => {
        cleanSelection();
        div.classList.toggle("selected");
        if (div.classList.contains("selected")) {
          selectListToMap(div);
        }
      });

      div.querySelector(".fly-to-marker").addEventListener("click", (e) => {
        flyToMarker(div);
      });
    }
  });
}

function selectListToMap(item) {
  map.setLayoutProperty("point-layer", "icon-image", ["case", ["==", ["get", "id"], item.dataset.id], "restaurant+walk-active", ["get", "icon"]]);
}

function flyToMarker(item) {
  map.flyTo({
    center: item.dataset.lonlat.split(","),
  });
}

function cleanSelection() {
  const listSelected = document.querySelector(".uui-blogsection01_item.selected");
  if (listSelected) {
    listSelected.classList.remove("selected");
  }
}

function selectMapToList(element) {
  cleanSelection();
  const listSelected = document.querySelector(`.uui-blogsection01_item[data-id="${element.properties.id}"]`);
  listSelected.classList.add("selected");
}

// Search Functions
function enableSearch() {
  document.getElementById("email-form").style.visibility = "visible";

  let debounceTimer;

  locqueryInput.addEventListener("input", function () {
    if (locqueryInput.value === "") return;

    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(handleUserInput, 300);
  });
}

async function handleUserInput() {
  const { AutocompleteSessionToken, AutocompleteSuggestion } = await google.maps.importLibrary("places");
  const query = locqueryInput.value;

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
  const autosuggestDiv = document.getElementById("autosuggest");
  autosuggestDiv.innerHTML = "";

  const ul = document.createElement("ul");

  predictions.forEach((prediction) => {
    const li = document.createElement("li");
    li.innerHTML = `
            ${prediction.displayName} <span class="grey">${prediction.formattedAddress}</span>
        `;
    li.setAttribute("data-center", `${prediction.location.lat},${prediction.location.lng}`);
    ul.appendChild(li);
  });

  const img = document.createElement("img");
  img.className = "powered-by-google";
  img.src = "https://storage.googleapis.com/geo-devrel-public-buckets/powered_by_google_on_white.png";
  img.alt = "Powered by Google";
  ul.appendChild(img);

  ul.addEventListener("click", handleAutosuggestClick);

  autosuggestDiv.appendChild(ul);
}

function handleAutosuggestClick(event) {
  let clickedItem = event.target.closest("li");
  if (clickedItem) {
    const [lat, lng] = clickedItem.dataset.center.split(",");
    document.getElementById("search").value = clickedItem.textContent;
    map.flyTo({
      center: [parseFloat(lng), parseFloat(lat)],
      zoom: 12,
    });
    document.getElementById("autosuggest").innerHTML = "";
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
  showRefreshListButton();
  if (map.getLayer("point-layer") && map.isSourceLoaded("earthquakes")) {
    createListFromSource();
  }
}

// Utility Functions
function getRenderedFeatures(point) {
  return map.queryRenderedFeatures(point, {
    layers: ["point-layer"],
  });
}

function showRefreshListButton() {
  document.querySelector(".reload").classList.remove("hidden");
}

function createListFromSource() {
  document.getElementById("loading-animation").style.display = "block";
  document.getElementById("reload").classList.remove("hidden");
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

  document.getElementById("loading-animation").style.display = "none";
  document.getElementById("reload").classList.add("hidden");
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
  }, 2000);
  setTimeout(() => {
    $("#totalresults").html(`<b>${count}</b> results within map area`);
  }, 1000);
}

// abusing the x-show  (see webflow on the card) functionality from framework.js to inject an id into the card
function cardLoaded(card) {
  //console.log("card loaded" + card.id);

  return "#card-" + card.id;
}

// Event Listeners
$("#search").on("input", function () {
  $(this).val() ? $(this).addClass("has--value") : $(this).removeClass("has--value");
});

$("#clearsearch,#brand").on("click", function () {
  $("#search").val("").trigger("input");
  $fetch.triggerAction("get_todos");
});

document.querySelector(".list-toggle").addEventListener("click", function () {
  document.querySelector(".uui-cta06_component").classList.toggle("expanded");
  this.classList.toggle("active");
});

// Main Execution
map = initializeMap();
map.on("load", () => {
  map.loadImage(GOOGLE_BUCKET_URL + "/map/restaurant+walk.png", (error, image) => {
    if (error) throw error;
    map.addImage("restaurant+walk", image);

    map.loadImage(GOOGLE_BUCKET_URL + "/map/restaurant+walk-active.png", (error, image) => {
      if (error) throw error;
      map.addImage("restaurant+walk-active", image);

      map.loadImage(GOOGLE_BUCKET_URL + "/map/r-cluster.png", (error, image) => {
        if (error) throw error;
        map.addImage("r-cluster", image);

        map.loadImage(GOOGLE_BUCKET_URL + "/map/w-cluster.png", (error, image) => {
          if (error) throw error;
          map.addImage("w-cluster", image);
          getData();
        });
      });
    });
  });

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
