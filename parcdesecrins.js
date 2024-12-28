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

// Wait for DOM and framework.js
async function initializeCardsComponent() {
  await waitForElement("#cards");
  await waitForFrameworkJS();
  $app.createComponent("cards", initialData).mount("#cards");
}

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
    }
  });
}

function waitForFrameworkJS() {
  return new Promise((resolve) => {
    const checkFramework = () => {
      if (window.$app && window.$app.createComponent) {
        resolve();
      } else {
        setTimeout(checkFramework, 100);
      }
    };
    checkFramework();
  });
}

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
    $app.components.cards.store.listings = data;
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

// Existing functions like `updateResultsDisplay`, `convertToGeoJson`, `loadCustomMarkersAndLayers`, etc., remain the same...

// Main Execution
(async function main() {
  await initializeCardsComponent();
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
})();
