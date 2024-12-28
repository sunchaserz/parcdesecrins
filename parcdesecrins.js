/**
 * PARC DES ECRINS
 * Optimized by <THE ALLIANCE>
 *
 * Main functionality includes fetching data, rendering the map, and managing interactions.
 */

// Constants
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];
const btnDefaultValue = "Search";
const iconSize = 0.6;

// Google geocoder
let geocoder;

// Initialize cards component
$app.createComponent("cards", { listings: [] }).mount("#cards");

// Initialize map
document.getElementById("map").style.visibility = "hidden";
maptilersdk.config.apiKey = "fsCLuIQWGPlRskWhImQz";
const map = new maptilersdk.Map({
  container: "map",
  zoom: 10.5,
  center: [6.079625696485338, 45.05582527284327],
  fullscreenControl: "top-right",
  style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
  antialias: true,
  navigationControl: false,
}).addControl(new maptilersdk.MaptilerNavigationControl({ showCompass: false }));

// Disable unnecessary map controls
["dragRotate", "keyboard", "touchZoomRotate"].forEach((control) => map[control]?.disableRotation?.());

// Load Google Maps API
function loadGoogleMapsAPI() {
  const script = document.createElement("script");
  script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDCeFfHwzjUWP2yZh7iTw1dGvAzG8cSLNc&callback=mapsApiLoaded&v=weekly";
  script.defer = true;
  document.head.appendChild(script);

  window.mapsApiLoaded = () => {
    geocoder = new google.maps.Geocoder();
    enableSearch();
  };
}

// Fetch data from API and handle results
function getData() {
  $fetch.createAction("get_todos", {
    options: {
      method: "get",
      url: alphiBaseUrl,
      headers: [{ key: "Content-Type", value: "application/json" }],
    },
    integrations: {
      authentication: console.log("Triggered: " + document.getElementById("search").value),
    },
    events: {
      onTrigger: { callback: console.log("Triggered fetch for: " + document.getElementById("search").value) },
      onRequestInit: {
        callback: async (options) => {
          document.getElementById("loading-animation").style.display = "block";
          document.getElementById("btnSearch").value = document.getElementById("btnSearch").dataset.wait;

          const searchValue = document.getElementById("search").value;
          if (searchValue) {
            options.url = `${alphiBaseUrl}?endpoint=home&name=${searchValue.toLowerCase()}`;
          }
          return options;
        },
      },
      onSuccess: {
        callback: async (_, data) => {
          document.getElementById("btnSearch").value = btnDefaultValue;

          if (data.length > 0) {
            updateUIWithData(data);
            const dataGeoJson = convertToGeoJson(data);
            loadCustomMarkersAndLayers(dataGeoJson);
            loadGoogleMapsAPI();
            document.getElementById("map").style.visibility = "visible";
          } else {
            handleNoResults();
          }
        },
      },
      onError: {
        callback: (response) => {
          console.error("Error:", response);
          document.getElementById("btnSearch").value = btnDefaultValue;
        },
      },
    },
  });
}

// Update UI components with fetched data
function updateUIWithData(data) {
  $app.components.cards.store.listings = data;
  document.getElementById("no-results").style.display = "none";
  document.getElementById("cards").style.display = "block";
  document.getElementById("toolbar").style.display = "block";

  document.getElementById("totalresults").innerHTML = `<b>${data.length}</b> result(s) ${
    document.getElementById("search").value ? `for <b>"${document.getElementById("search").value}"</b>` : ""
  }`;
}

// Handle no results
function handleNoResults() {
  document.getElementById("cards").style.display = "none";
  document.getElementById("no-results").style.display = "block";
  document.getElementById("toolbar").style.display = "none";
}

// Convert data to GeoJSON format
function convertToGeoJson(data) {
  return {
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    features: data.map((item) => ({
      type: "Feature",
      properties: {
        id: item.id,
        main_image: item.main_image,
        icon: "restaurantz",
      },
      geometry: {
        type: "Point",
        coordinates: [item.longitude, item.latitude],
      },
    })),
  };
}

// Load markers and layers onto the map
function loadCustomMarkersAndLayers(dataGeoJson) {
  const uniqueIcons = getUniqueIcons(dataGeoJson);

  uniqueIcons.forEach(({ name, path }) =>
    map.loadImage(path, (error, image) => {
      if (error) throw error;
      map.addImage(name, image);
      createCheckboxForFilter(name);
    })
  );

  map.addSource("earthquakes", { type: "geojson", data: dataGeoJson, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
  map.addLayer(createClusterLayer());
  map.addLayer(createPointLayer());
}

// Create layers for clusters and points
function createClusterLayer() {
  return {
    id: "cluster-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["has", "point_count"],
    layout: {
      "icon-image": "r-cluster",
      "icon-size": iconSize,
      "icon-allow-overlap": true,
    },
  };
}

function createPointLayer() {
  return {
    id: "point-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": ["case", ["==", ["get", "icon"], "restaurantz"], "restaurantz", "default"],
      "icon-size": iconSize,
      "icon-allow-overlap": true,
    },
  };
}

// Extract unique icons from data
function getUniqueIcons(dataGeoJson) {
  const gfxFolder = `${googleBucketUrl}/map`;
  const uniqueIcons = new Set(dataGeoJson.features.map((feature) => feature.properties.icon));
  return Array.from(uniqueIcons).map((icon) => ({ name: icon, path: `${gfxFolder}/${icon}.png` }));
}

// Create checkboxes for filtering
function createCheckboxForFilter(id) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = true;

  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = id;

  input.addEventListener("change", () => updateFilters(id, input.checked));
  filterGroup.appendChild(input);
  filterGroup.appendChild(label);
}

// Update map filters based on checkbox state
function updateFilters(id, isChecked) {
  const filterOp = isChecked ? "==" : "!=";
  map.setFilter("point-layer", [filterOp, ["get", "icon"], id]);
}

// Enable search functionality
function enableSearch() {
  const searchBox = document.getElementById("search");
  searchBox.style.visibility = "visible";

  searchBox.addEventListener(
    "input",
    debounce(() => {
      const query = searchBox.value;
      if (query) handleUserInput(query);
    }, 300)
  );
}

// Debounce function for input
function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Initialize map on load
map.on("load", () => getData());
