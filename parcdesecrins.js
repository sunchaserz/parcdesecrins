/**
 *
 * PARC DES ECRINS
 * @author <THE ALLIANCE>
 *
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


 * The popup is styled in Webflow (invisble but lives in map-wrapper) and then html is copied into source code below.
 */

// Defaults
const alphiBaseUrl = "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229";
const googleBucketUrl = "https://storage.googleapis.com/parc_des_ecrins";

//const alphiBaseUrl = "https://live.api-server.io/run/v1/644836c7eaebea1ea38e66c9";
const btnDefaultValue = "Search";
let searchterm = ""; // not necessary cause alphi.dev api also has default

// initial data for the Cards component
const initialData = {
  listings: [],
};

// Bounding box for Parc des Ecrins to limit geocoding search results
// sw = 44.488283, 5.784014
// ne = 45.193431, 6.811180
const ecrinsBounds = [5.784014, 44.488283, 6.81118, 45.193431];

const urlParams = new URLSearchParams(window.location.search);

// GENERAL SETTINGS
const filterGroup = document.getElementById("filter-group");
const iconSize = 0.6;
let filterForPointLayer = ["any"]; // Use 'any' logical operator for OR conditions
let filterForClusterLayer = ["all", ["has", "point_count"]];

// create the cards component and mount it to the html element with the id "cards"
$app.createComponent("cards", initialData).mount("#cards");

// Maptiler
maptilersdk.config.apiKey = "fsCLuIQWGPlRskWhImQz";
document.getElementById("map").style.visibility = "hidden"; // hide first until data is loaded
var map = new maptilersdk.Map({
  container: "map",
  zoom: 10.5,
  center: [6.079625696485338, 45.05582527284327],
  fullscreenControl: "top-right",
  style: "b80bd75b-379c-45e4-9006-643ba8aa190e", // plastic map : "802d2114-c629-44f6-b50f-987a6253af56",
  //terrain: true,
  //terrainExaggeration: 2,
  antialias: true,
  navigationControl: false, //disable the navigation control
}).addControl(
  new maptilersdk.MaptilerNavigationControl({
    showCompass: false,
  })
);

// Add the geocoder input
// const gc = new maptilersdkMaptilerGeocoder.GeocodingControl({});
// document.getElementById('maptilergeocoder').appendChild(gc.onAdd(map));
// map.addControl(gc, 'top-left');

// disable map rotation using right click + drag
map.dragRotate.disable();

// disable map rotation using keyboard
map.keyboard.disable();

// disable map rotation using touch rotation gesture
map.touchZoomRotate.disableRotation();

// Here we get the data from Alphi.dev API
// this is using https://shinyobjectlabs.gitbook.io/fetch-js/
// This is being triggered by the x-fetch="get_todos" in <body> and then later by the "Search button"
function getData() {
  $fetch.createAction("get_todos", {
    options: {
      method: "get",
      //    "url": alphiBaseUrl + "?endpoint=home&name=" + searchterm,
      url: alphiBaseUrl,
      headers: [
        {
          key: "Content-Type",
          value: "application/json",
        },
      ],
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
          // show/hide some stuff
          document.getElementById("loading-animation").style.display = "block";
          // document.getElementById('results').style.display = "none";

          // Change button text
          document.getElementById("btnSearch").value = document.getElementById("btnSearch").dataset.wait;

          //const id = triggerEl?.parentElement?.querySelector("[airtable-id]")?.textContent
          if (document.getElementById("search").value !== "") {
            console.log("searchterm entered and adding it to the fetch url");
            // set the value dynamically
            options.url = alphiBaseUrl + "?endpoint=home&name=" + document.getElementById("search").value.toLowerCase();

            // return the updated options
            return options;
          }

          // searchterm empty so return all results (from initial options object)
          return options;
        },
      },
      onSuccess: {
        redirectUrl: null,
        showElement: "#results",
        hideElement: "#loading-animation",
        callback: async (response, data) => {
          // Change button text
          document.getElementById("btnSearch").value = btnDefaultValue;

          if (data.length > 0) {
            // we have results, send to component
            console.log("We have " + data.length + " results!");
            console.log(data[0].link);

            // resultaat bar
            let result_text = data.length == 1 ? "result" : "results";
            let result_searchterm =
              document.getElementById("search").value.toLowerCase() == ""
                ? ""
                : ' for <b>"' + document.getElementById("search").value.toLowerCase() + '"</b>';
            $("#totalresults").html("<b>" + data.length + "</b> " + result_text + result_searchterm);

            // PUT THE DATA INTO THE CARDS
            $app.components.cards.store.listings = data;
            activateList(data); // make cards clickable

            // show/hide when all is ready for clicks
            document.getElementById("no-results").style.display = "none";
            document.getElementById("cards").style.display = "block";
            document.getElementById("toolbar").style.display = "block";

            // this needs to be here cause .tag is dynamic
            $(".tag").on("click", function () {
              $("#search").val($(this).text()).trigger("input"); // trigger is needed to trigger below input trigger function and add has--value class
              $fetch.triggerAction("get_todos");
            });

            // THIS WORKS IF YOU HAVE THE GEOJSON ON GOOGLE BUCKET, but we dont need separate GeoJson for this
            // we'll just create it on the fly from the data we got from Alphi
            //const dataRes = await fetch(googleBucketUrl + '/map/data.geojson');
            //const dataGeo = await dataRes.json();

            // Convert the data we just got from Alphi into GeoJson format for the map
            const dataGeoRaw =
              `{"type": "FeatureCollection","crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },` +
              `"features": [${data.map((item) => {
                return `{ "type": "${item.type}", "properties": { "id": "${item.id}", "main_image": "${item.main_image}","mag": 1.43, "time": 1507424832518, "felt": null, "tsunami": 1, "icon" : "restaurantz" }, "geometry": { "type": "Point", "coordinates": [ ${item.longitude}, ${item.latitude} ] } }`;
              })}]}`;

            const dataGeoJson = JSON.parse(dataGeoRaw);

            // PUT THE DATA INTO THE MAP
            loadCustomMarkersAndLayers(dataGeoJson);
          } else {
            // 200 but no results
            console.log("We have " + data.length + " results!");

            // show/hide
            document.getElementById("cards").style.display = "none";
            document.getElementById("no-results").style.display = "block";
            document.getElementById("toolbar").style.display = "none";
          }
        },
      },
      onError: {
        redirectUrl: null,
        showElement: "#error",
        hideElement: "#cards",
        callback: async (response, data) => {
          console.log("Error: " + response);
          document.getElementById("btnSearch").value = document.getElementById("btnSearch").dataset.default;
        }, // callback
      }, // onError
    },
  });
} // getData

// Helper to display tags
function createTagLink(tag) {
  // if (tags == null) return false;
  // let tagsText = "niks";
  // tags.forEach((tag) => {
  // console.log("tag >>> " + tag);
  //  tagsText += "<a href='" + tag + "'>tagje</a>";
  //});

  return "#";
}

// When the user begins typing, hide the suggestions placeholder text
$("#search").on("input", function () {
  if ($(this).val()) {
    $(this).addClass("has--value");
  } else {
    $(this).removeClass("has--value");
  }
});

// when clicking on CROSS in searchfield or Logo
$("#clearsearch,#brand").on("click", function () {
  $("#search").val("").trigger("input"); // to trigger above function and add has--value class
  $fetch.triggerAction("get_todos");
});

// when clicking on HIDE LIST icon on map
document.querySelector(".list-toggle").addEventListener("click", function () {
  document.querySelector(".uui-cta06_component").classList.toggle("expanded");

  // Toggle the active class for the button
  this.classList.toggle("active");
});

// start: rain layer
// const weatherLayer = new maptilerweather.PrecipitationLayer();
// end: rain layer

/////////////////////////////
////////////////////////////////////////
///////////////////////////////////////////////////// START: HELPERS

// function createCheckboxWithLabel(layerID, symbol) {
//     // Add checkbox and label elements for the layer.
//     const input = document.createElement('input');
//     input.type = 'checkbox';
//     input.id = layerID;
//     input.checked = true;
//     filterGroup.appendChild(input);

//     const label = document.createElement('label');
//     label.setAttribute('for', layerID);
//     label.textContent = symbol;
//     filterGroup.appendChild(label);

//     // When the checkbox changes, update the visibility of the layer.
//     input.addEventListener('change', (e) => {

//         console.log("changing");
//         // filterBy('restaurants_off');
//         // this is also a way but need to use Style in this case as workaround so the points are also taken out of the clusters
//         map.setLayoutProperty(
//             layerID,
//             'visibility',
//             e.target.checked ? 'visible' : 'none'
//         );
//         const myStyle = map.getStyle();
//         const switcher = e.target.checked ? '==' : '!=';
//         myStyle.sources.earthquakes.filter = ["all",
//             [switcher, ["get", "icon"], symbol]
//         ];
//         map.setStyle(myStyle);
//     });

// }

function updateFilter() {
  console.log("update filter");
  filterForPointLayer.length = 1; // CLEAR the filter array BUT keep the initial operator
  filterForClusterLayer.length = 2; // CLEAR the filterForClusterLayer array BUT keep the initial 2 operators

  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    console.log(checkbox.id + " vs " + checkbox.checked);
    if (checkbox.checked) {
      // filter.push(['==', 'type', checkbox.id]);
      filterForPointLayer.push(["==", ["get", "icon"], checkbox.id]);
      filterForClusterLayer.push(["get", `only_${checkbox.id}`]);
    }
  });

  // style workaround to update clusters properly (https://github.com/mapbox/mapbox-gl-js/issues/2613)
  const myStyle = map.getStyle();
  myStyle.sources.earthquakes.filter = filterForPointLayer;
  map.setStyle(myStyle);

  // Apply the filter to the layer
  // map.setFilter('point-layer', filterForPointLayer); // this works tho
  // map.setFilter('cluster-layer', filterForClusterLayer); // this does not work hence we need the style-workaround above
}

function createCheckboxesNew(id) {
  console.log("create checkboxes new");
  // Add checkbox and label elements for the layer.
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = `${id}`;
  input.checked = true;
  filterGroup.appendChild(input);

  const label = document.createElement("label");
  label.setAttribute("for", `${id}`);
  label.textContent = id;
  filterGroup.appendChild(label);

  // When the checkbox changes, update the visibility of the layer.
  input.addEventListener("change", (e) => {
    console.log("changing");

    updateFilter();
    // e.target.checked ? '==' : '!=';
    // filter.push(['==', ['get', 'icon'], id]);

    // map.setFilter('point-layer', filter);

    // console.log(filter);

    //console.log("changing");
    //updateFilter();
    // filterBy('restaurants_off');
    // this is also a way but need to use Style in this case as workaround so the points are also taken out of the clusters
    // map.setLayoutProperty(
    //     id,
    //     'visibility',
    //     e.target.checked ? 'visible' : 'none'
    // );
    // const myStyle = map.getStyle();
    // const switcher = e.target.checked ? '==' : '!=';
    // myStyle.sources.earthquakes.filter = ["all",
    //     [switcher, ["get", "icon"], id]
    // ];
    // map.setStyle(myStyle);
  });
}

// START: legend filtering
// function filterBy(what) {

//     // var filters = ['==', 'month', month];
//     if (what == "restaurants_on") {
//         map.setFilter('poi-restaurant', ['==', ['get', 'icon'], 'restaurant']);
//     } else {
//         map.setFilter('poi-restaurant', ['!=', ['get', 'icon'], 'restaurant']);
//     }
//     // map.setFilter('earthquake-circles', filters);
//     // map.setFilter('earthquake-labels', filters);

//     // Set the label to the month
//     // document.getElementById('month').textContent = months[month];
// }
// END: legend filtering

// START: get unique icons from geodata
function getUniqueIcons(dataGeoJson) {
  const gfxFolder = googleBucketUrl + "/map"; // Replace with the path to your "gfx" folder

  const uniqueIcons = new Set();

  // Loop through the "features" array and extract "icon" values
  dataGeoJson.features.forEach((feature) => {
    if (feature.properties && feature.properties.icon) {
      console.log("property" + JSON.stringify(feature.properties));

      uniqueIcons.add(feature.properties.icon);
    }
  });

  const customMarkerArr = [];

  uniqueIcons.forEach((uniqueIcon) => {
    customMarkerArr.push({ name: uniqueIcon, path: `${gfxFolder}/${uniqueIcon}.png` });
  });

  return customMarkerArr;
} // END: get unique icons from geodata

// START : Important function that loads all markers and adds layers accordlingly
async function loadCustomMarkersAndLayers(dataGeoJson) {
  const customMarkers = getUniqueIcons(dataGeoJson);
  console.log("custommarkers length" + customMarkers.length);

  // clear all layers and sources first (if search and not initial load)
  if (map.getLayer("cluster-layer")) map.removeLayer("cluster-layer");
  if (map.getLayer("point-layer")) map.removeLayer("point-layer");
  if (map.getLayer("cluster-count")) map.removeLayer("cluster-count");
  if (map.getLayer("unclustered-point")) map.removeLayer("unclustered-point");
  if (map.getSource("earthquakes")) map.removeSource("earthquakes");

  // Load each custom marker icon using map.loadImage
  customMarkers.forEach((marker) => {
    map.loadImage(marker.path, function (error, image) {
      if (error) throw error;

      // Add the loaded image as a new icon to the map
      console.log("added image for " + marker.name);
      map.addImage(marker.name, image);

      createCheckboxesNew(marker.name);
    });
  }); // loop for each type of marker

  // add a clustered GeoJSON source for a sample set of earthquakes
  map.addSource("earthquakes", {
    type: "geojson",
    data: dataGeoJson,
    cluster: true,
    clusterMaxZoom: 14, // Max zoom to cluster points on
    clusterRadius: 50,
    clusterProperties: {
      has_restaurant: ["any", ["==", ["get", "icon"], "restaurantz"], "false"],
      has_walk: ["any", ["==", ["get", "icon"], "walk"], "false"],
      only_restaurant: ["all", ["==", ["get", "icon"], "restaurantz"], "false"],
      only_walk: ["all", ["==", ["get", "icon"], "walk"], "false"],
    },
  });

  // after loop
  map.addLayer({
    id: "cluster-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["has", "point_count"],
    // filter: ['all',['has', 'point_count'],['get','only_restaurant']],
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

  // /* start: if you want circles in stead of icons

  map.addLayer({
    id: "point-layer",
    type: "symbol",
    source: "earthquakes",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": [
        "case",
        ["==", ["get", "icon"], "restaurantz"],
        "restaurantz",
        ["==", ["get", "icon"], "walk"],
        "walk",
        "walk", // default cause 'case'
      ],
      "icon-size": iconSize,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true, // icon will not push away underlaying village names.
    },
  });
  // end: if you want circles */

  // When all features (points) are loaded, create a list of all features on the left side
  //createListFromSource();
}
// END : Important function that loads all markers and adds layers accordlingly

///////////////////////////////////////////////////// END: HELPERS
////////////////////////////////////////
/////////////////////////////

// WAIT UNTIL ALL LAYERS HAVE LOADED
map.on("idle", function () {
  console.log("Map is fully loaded cause " + map.getLayer("point-layer") + " and " + map.isSourceLoaded("earthquakes"));
  if (map.getLayer("point-layer") && map.isSourceLoaded("earthquakes")) {
    console.log("Points-layer is fully loaded!");
    document.getElementById("map").style.visibility = "visible"; // show map when all is loaded
    createListFromSource();
    // Perform any actions now that the points-layer is fully loaded
  }
});

// CRUX
map.on("load", async () => {
  const bounds = map.getBounds();
  console.log("bounds" + JSON.stringify(bounds));

  // const rw = await map.loadImage(googleBucketUrl + '/map/restaurant+walk.png');
  // map.addImage('restaurant+walk', rw);

  // const rc = await map.loadImage(googleBucketUrl + '/map/r-cluster.png');
  // map.addImage('r-cluster', rc);

  // const wc = await map.loadImage(googleBucketUrl + '/map/w-cluster.png');
  // map.addImage('w-cluster', wc);
  // getData();

  map.loadImage(googleBucketUrl + "/map/restaurant+walk.png", (error, image) => {
    if (error) throw error;
    map.addImage("restaurant+walk", image);

    map.loadImage(googleBucketUrl + "/map/restaurant+walk-active.png", (error, image) => {
      if (error) throw error;
      map.addImage("restaurant+walk-active", image);

      map.loadImage(googleBucketUrl + "/map/r-cluster.png", (error, image) => {
        if (error) throw error;
        map.addImage("r-cluster", image);

        map.loadImage(
          googleBucketUrl + "/map/w-cluster.png", // Replace with your image URL
          (error, image) => {
            if (error) throw error;

            map.addImage("w-cluster", image);
            getData();
          }
        );
      });
    });
  });

  // this adds cluster CIRCLES on map

  // map.addLayer({
  //     id: 'clusters',
  //     type: 'circle',
  //     source: 'earthquakes',
  //     filter: ['has', 'point_count'], // Filter for restaurants
  //     paint: {
  //         // Use step expressions (https://docs.maptiler.com/gl-style-specification/expressions/#step)
  //         // with three steps to implement three types of circles:
  //         //   * Blue, 20px circles when point count is less than 100
  //         //   * Yellow, 30px circles when point count is between 100 and 750
  //         //   * Pink, 40px circles when point count is greater than or equal to 750
  //         'circle-color': [
  //             'step',
  //             ['get', 'point_count'],
  //             '#51bbd6', // color when less than 100 points
  //             100,
  //             '#f1f075', // color between 100 and 750 points
  //             750,
  //             '#f28cb1' // color for more than 750 points
  //         ],
  //         'circle-radius': [
  //             'step',
  //             ['get', 'point_count'],
  //             20, // size when less than 100 points
  //             100,
  //             30, // size between 100 and 750 points
  //             750,
  //             40 // size for more than 750 points
  //         ]
  //     }
  // });

  // When a click event occurs on a feature in
  // the unclustered-point layer, open a popup at
  // the location of the feature, with
  // description HTML from its properties.
  map.on("click", "point-layer", function (e) {
    const features = getRenderedFeatures(e.point);

    if (features.length) {
      const element = features[0];

      var coordinates = features[0].geometry.coordinates.slice();
      var mag = features[0].properties.mag;
      var main_image = features[0].properties.main_image;
      var tsunami;

      if (features[0].properties.tsunami === 1) {
        tsunami = "yes";
      } else {
        tsunami = "no";
      }

      // Ensure that if the map is zoomed out such that
      // multiple copies of the feature are visible, the
      // popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // Construct the popup and set its content,
      new maptilersdk.Popup({ offset: 20 })
        .setLngLat(coordinates)
        .setHTML(
          '<div class="popup"><div class="popup-imgwrap"><img src="' +
            main_image +
            '" loading="lazy" alt="" class="popup-image"></div><div class="popup-txtwrap">' +
            mag +
            " and tsunami: " +
            tsunami +
            "This is a small text but I&nbsp;am not sure if it is ok to have this here so big and tall what do you think.</div></div>"
        )
        .setMaxWidth("360px")
        .addTo(map); // style popup in webform, copy html and paste it here

      // Scroll to the item in the list belonging to this marker
      selectMapToList(element);
    }
  }); // end: on click

  // start :rain layer
  // map.addLayer(weatherLayer, 'Water');
  // weatherLayer.animateByFactor(3600);
  // end : rain layer

  // inspect a cluster on click
  map.on("click", "cluster-layer", function (e) {
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
  });

  /// When the mouse is over the markers, update the cursor
  map.on("mouseenter", "point-layer", function () {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "point-layer", function () {
    map.getCanvas().style.cursor = "";
  });

  //map.on('render', 'point-layer', createListFromSource); // this in case  you want to load map first and then list (im doing different)
  map.on("moveend", showRefreshListButton);

  const mapStyle = map.getStyle();

  // Enable input through query string
  if (urlParams.get("q")) {
    // docs https://docs.maptiler.com/client-js/geocoding/
    const results = await maptilersdk.geocoding.forward(urlParams.get("q"), {
      proximity: [6.271158, 44.825107], // results closer to parc des ecrins get priority
      //bbox:ecrinsBounds,  // limit search to ecrins bounds
    });
    //ecrinsBounds
    console.log(results);
    // map.getSource('search-results').setData(results);
    if (results.features[0]) {
      populateAutoSuggest(results.features);
      //map.fitBounds(results.features[0].bbox, {maxZoom: 19})
    }
  }

  // ++ Enable input through search box and autocomplete through maptiler geocoding
  const locqueryInput = document.getElementById("search");
  let debounceTimer; // Timer variable for debouncing

  // Event listener for the 'input' event
  locqueryInput.addEventListener("input", function () {
    // Exit the function if input is empty
    if (locqueryInput.value === "") {
      return;
    }

    // Clear the previous timer
    clearTimeout(debounceTimer);

    // Set a new timer with 300ms delay
    debounceTimer = setTimeout(function () {
      // Call the function after 300ms
      handleUserInput();
    }, 300);
  });

  async function handleUserInput() {
    // docs https://docs.maptiler.com/client-js/geocoding/
    const results = await maptilersdk.geocoding.forward(locqueryInput.value, {
      proximity: [6.271158, 44.825107], // results closer to parc des ecrins get priority
      //bbox:ecrinsBounds,  // limit search to ecrins bounds
    });
    //ecrinsBounds
    //console.log(results);
    // map.getSource('search-results').setData(results);
    if (results.features[0]) {
      populateAutoSuggest(results.features);
      //map.fitBounds(results.features[0].bbox, {maxZoom: 19})
      // map.flyTo({
      //   center: results.features[0].center,
      // });
    }
  }
  // ++

  // // start: click on legend items
  // document
  //     .getElementById('kaka')
  //     .addEventListener('change', function (e) {
  //         if (e.target.checked) {
  //             console.log("Checkbox is checked..");
  //             filterBy("restaurants_on");
  //         } else {
  //             console.log("Checkbox is not checked..");
  //             filterBy("restaurants_off");
  //         }
  //         console.log("changed " + parseInt(e.target.value))
  //         // var month = parseInt(e.target.value, 10);
  //         // filterBy(month);
  //     });
  // // end: click on legend items
}); // END MAP LOAD

// When the user begins typing, hide the suggestions placeholder text
$("#search").on("input", function () {
  if ($(this).val()) {
    $(this).addClass("has--value");
  } else {
    $(this).removeClass("has--value");
  }
});

// when clicking on CROSS in searchfield or Logo
$("#clearsearch,#brand").on("click", function () {
  $("#search").val("").trigger("input"); // to trigger above function and add has--value class
  $fetch.triggerAction("get_todos");
});

function createShopLink(card) {
  console.log("hier zit iet");
  return "/shop-detail?id=" + card.author;
}

// abusing the x-show  (see webflow on the card) functionality from framework.js to inject an id into the card
function cardLoaded(card) {
  //console.log("card loaded" + card.id);

  return "#card-" + card.id;
}

// inject id's and latlongs into list items and catch clicks (could be cleaner I guess, but framework.js doesnt allow data attributes to be filled
// on the webflow side
function activateList(data) {
  // see : https://docs.maptiler.com/sdk-js/examples/list-of-places/
  //console.log(data);
  const items = data.map((item) => {
    return {
      i: item.id,
      lat: item.latitude,
      lon: item.longitude,
    };
  });

  let listContainer = document.querySelector(".uui-blogsection01_list");
  const listItems = listContainer.querySelectorAll(".uui-blogsection01_item:not(:first-child)"); // first one is a dummy item, so we skip it
  listItems.forEach((div, index) => {
    if (items[index]) {
      console.log("index " + index);
      div.setAttribute("data-id", items[index].i);
      div.setAttribute("data-lonlat", items[index].lon + "," + items[index].lat);

      // on mouseenter : change icon on map
      div.addEventListener("mouseenter", (e) => {
        cleanSelection();
        //const li = e.target.closest(".uui-blogsection01_item");
        div.classList.toggle("selected");
        if (div.classList.contains("selected")) {
          //selectedItem = li.querySelector("a").split("#")[1];
          selectListToMap(div);
        }
      });

      // on click : fly to marker and center
      div.querySelector(".fly-to-marker").addEventListener("click", (e) => {
        console.log("click on fly to marker");
        //const li = e.target.closest(".uui-blogsection01_item");
        //selectedItem = li.querySelector("a").split("#")[1];
        flyToMarker(div);
      });
    }
  });
}

// function to communicate from LIST to MAP
function selectListToMap(item) {
  map.setLayoutProperty("point-layer", "icon-image", [
    "case",
    ["==", ["get", "id"], item.dataset.id], // get the feature id (make sure your data has an id set or use generateIds for GeoJSON sources
    "restaurant+walk-active", //image when id is the clicked feature id
    ["get", "icon"], // default
  ]);
}

function flyToMarker(item) {
  map.flyTo({
    center: item.dataset.lonlat.split(","),
  });
}
// function to communicate from MAP to LIST
function selectMapToList(element) {
  cleanListSelection();

  const listSelected = document.querySelector(`.uui-blogsection01_item[data-id="${element.properties.id}"]`);
  listSelected.classList.add("selected");
  //listSelected.scrollIntoView({behavior: 'smooth', block: 'center'}); // added offset in webflow custom property: scroll-margin-top
}

function cleanSelection() {
  //selectedItem = null;
  //map.setLayoutProperty('points', 'icon-image', 'pinShoe');
  cleanListSelection();
}

function cleanListSelection() {
  const listSelected = document.querySelector(".uui-blogsection01_item.selected");
  if (listSelected) {
    listSelected.classList.remove("selected");
  }
}

function showRefreshListButton() {
  document.querySelector(".reload").classList.remove("hidden");
}

function getRenderedFeatures(point) {
  //if the point is null, it is searched within the bounding box of the map view
  const features = map.queryRenderedFeatures(point, {
    layers: ["point-layer"],
  });
  return features;
}

/*window.addEventListener('resize', function(event) {
    //make sure searchbox stickies when intro scales responsiveness
    console.log($( "#intro" ).height());
    $("#intro-wrapper").css({ top: $( "#navbar" ).height() - $( "#intro" ).height()  });
}, true);
*/

// -- Helper: populate the autosuggest div with the list of places after user stops typing in the search box
function populateAutoSuggest(featuresArray) {
  const autosuggestDiv = document.getElementById("autosuggest");

  // Clear existing content
  autosuggestDiv.innerHTML = "";

  // Create a <ul> element to hold the list items
  const ul = document.createElement("ul");

  featuresArray.forEach((feature) => {
    // Create a <li> element for each place_name
    // console.log(feature);
    const li = document.createElement("li");
    li.textContent = feature.place_name;
    li.setAttribute("data-center", feature.center);

    // Append the list item to the <ul>
    ul.appendChild(li);
  });

  // Click on any of the auto suggested things
  ul.addEventListener("click", function (event) {
    // Check if the clicked element is an <li>
    if (event.target && event.target.nodeName === "LI") {
      // Get the index or content of the clicked list item
      const clickedItem = event.target;
      console.log(`You clicked on: ${clickedItem.dataset.center}`);
      document.getElementById("search").value = clickedItem.textContent;
      getData();
      map.flyTo({
        center: clickedItem.dataset.center.split(","),
      });
      // Clear the autosuggest div
      autosuggestDiv.innerHTML = "";

      // You can also access custom data attributes like:
      //console.log(`Item index: ${clickedItem.dataset.index}`);
    }
  });

  // Append the <ul> to the autosuggest div
  autosuggestDiv.appendChild(ul);
}
// --

// -- Helper: Create the list from what we see on the map
function createListFromSource() {
  const features = getRenderedFeatures();
  if (features.length) {
    console.log("getRenderedFeatures" + features);
    //stop listening to the map render event
    map.off("render", createListFromSource);
    //updateList();
  }
}
// --

// -- Helper: Get all features within the map view
function getRenderedFeatures(point) {
  //if the point is null, it is searched within the bounding box of the map view
  console.log("getRenderedFeatures point " + point);
  const features = map.queryRenderedFeatures({ layers: ["point-layer"] });

  // const features = map.queryRenderedFeatures(point, {
  //   layers: ['point-layer']
  // });
  console.log("getRenderedFeatures features " + features);
  return features;
}
// --
