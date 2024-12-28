/**
 *
 * PARC DES ECRINS
 * @author <THE ALLIANCE>
 *
 * This file is being served by jsdelivr. (see webflow)
 * Make sure you are using the prod setup, not the uncached dev setup (see webflow Before </body> tag section)
 *
 * THE LOGIC
 * =========
 * There's a map.on("load") event at the bottom that triggers the getData() function.
 * This function loads in a JSON from Alphi.dev API.
 * That data is filled into the cards component with $app.components.cards.store.listings = data;
 * Then we convert that data to GeoJson format on the fly to be used in the map
 * Then we add it to the map with loadCustomMarkersAndLayers(dataGeoJson);
 *
 * The popup is styled in Webflow (invisible but lives in map-wrapper) and then HTML is copied into source code below.
 */

// Defaults
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";

// Google geocoder init
let geocoder;

// General variables
const btnDefaultValue = "Search";
let searchterm = "";
const locqueryInput = document.getElementById("search");
const filterGroup = document.getElementById("filter-group");
const iconSize = 0.6;
let filterForPointLayer = ["any"];
let filterForClusterLayer = ["all", ["has", "point_count"]];

// Bounding box for Parc des Ecrins to limit geocoding search results
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];
const urlParams = new URLSearchParams(window.location.search);

// Initial data for the Cards component
const initialData = { listings: [] };

// Create the cards component and mount it to the HTML element with the id "cards"
$app.createComponent("cards", initialData).mount("#cards");

// Maptiler SDK setup
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
}).addControl(
  new maptilersdk.MaptilerNavigationControl({
    showCompass: false,
  })
);

// Disable rotation interactions
map.dragRotate.disable();
map.keyboard.disable();
map.touchZoomRotate.disableRotation();

// Google Maps API loader
function loadGoogleMapsAPI() {
  const script = document.createElement("script");
  script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDCeFfHwzjUWP2yZh7iTw1dGvAzG8cSLNc&callback=mapsApiLoaded&v=weekly";
  script.defer = true;
  document.head.appendChild(script);

  window.mapsApiLoaded = () => {
    console.log("Google Maps API loaded successfully");
    geocoder = new google.maps.Geocoder();
    enableSearch();
  };
}

// Fetch data from Alphi API
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
          const searchValue = locqueryInput.value.trim();
          if (searchValue) {
            options.url = `${alphiBaseUrl}?endpoint=home&name=${searchValue.toLowerCase()}`;
          }
          return options;
        },
      },
      onSuccess: {
        callback: (_, data) => {
          toggleLoadingState(false);
          if (data.length > 0) {
            console.log(`Received ${data.length} results`);
            $app.components.cards.store.listings = data;
            activateList(data);
            const dataGeoJson = convertToGeoJson(data);
            loadCustomMarkersAndLayers(dataGeoJson);
            loadGoogleMapsAPI();
            document.getElementById("map").style.visibility = "visible";
          } else {
            toggleResultsVisibility(false);
          }
        },
      },
      onError: {
        callback: () => {
          console.error("Error fetching data");
          toggleLoadingState(false);
        },
      },
    },
  });
}

// Map events
map.on("render", () => {
  if (map.getLayer("point-layer") && map.isSourceLoaded("earthquakes")) {
    createListFromSource();
  }
});

map.on("load", () => {
  map.loadImage(googleBucketUrl + "/map/restaurant+walk.png", (error, image) => {
    if (error) throw error;
    map.addImage("restaurant+walk", image);

    map.loadImage(googleBucketUrl + "/map/restaurant+walk-active.png", (error, image) => {
      if (error) throw error;
      map.addImage("restaurant+walk-active", image);

      map.loadImage(googleBucketUrl + "/map/r-cluster.png", (error, image) => {
        if (error) throw error;
        map.addImage("r-cluster", image);

        map.loadImage(googleBucketUrl + "/map/w-cluster.png", (error, image) => {
          if (error) throw error;
          map.addImage("w-cluster", image);
          getData();
        });
      });
    });
  });
});

map.on("click", "point-layer", (e) => {
  const features = getRenderedFeatures(e.point);
  if (features.length) {
    const feature = features[0];
    const coordinates = feature.geometry.coordinates.slice();
    const mainImage = feature.properties.main_image;
    new maptilersdk.Popup({ offset: 20 })
      .setLngLat(coordinates)
      .setHTML(
        `<div class="popup">
          <div class="popup-imgwrap">
            <img src="${mainImage}" loading="lazy" alt="" class="popup-image">
          </div>
        </div>`
      )
      .setMaxWidth("360px")
      .addTo(map);
    selectMapToList(feature);
  }
});

map.on("click", "cluster-layer", (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ["cluster-layer"],
  });
  if (features.length) {
    const clusterId = features[0].properties.cluster_id;
    map.getSource("earthquakes").getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  }
});

map.on("mouseenter", "point-layer", () => {
  map.getCanvas().style.cursor = "pointer";
});

map.on("mouseleave", "point-layer", () => {
  map.getCanvas().style.cursor = "";
});

map.on("moveend", () => {
  showRefreshListButton();
  if (map.getLayer("point-layer") && map.isSourceLoaded("earthquakes")) {
    createListFromSource();
  }
});

// Helper functions (toggleLoadingState, activateList, convertToGeoJson, etc.)
// and the rest of your code follows here...
