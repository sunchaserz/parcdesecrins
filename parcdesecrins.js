// Constants and Configuration
const CONFIG = {
  map: {
    apiKey: "fsCLuIQWGPlRskWhImQz",
    initialZoom: 10.5,
    initialCenter: [6.079625696485338, 45.05582527284327],
    styleId: "b80bd75b-379c-45e4-9006-643ba8aa190e",
    iconSize: 0.6,
    ecrinsBounds: [5.784014, 44.488283, 6.81118, 45.193431],
  },
  api: {
    alphiBaseUrl: "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229",
    googleBucketUrl: "https://storage.googleapis.com/parc_des_ecrins",
    googleMapsKey: "AIzaSyDCeFfHwzjUWP2yZh7iTw1dGvAzG8cSLNc",
  },
};

// Map Service
class MapService {
  constructor() {
    this.map = null;
    this.geocoder = null;
    this.filterForPointLayer = ["any"];
    this.filterForClusterLayer = ["all", ["has", "point_count"]];
  }

  async initialize() {
    this.map = new maptilersdk.Map({
      container: "map",
      zoom: CONFIG.map.initialZoom,
      center: CONFIG.map.initialCenter,
      fullscreenControl: "top-right",
      style: CONFIG.map.styleId,
      antialias: true,
      navigationControl: false,
    }).addControl(
      new maptilersdk.MaptilerNavigationControl({
        showCompass: false,
      })
    );

    this.disableMapRotation();
    this.setupEventListeners();
    await this.loadInitialMarkers();
  }

  disableMapRotation() {
    this.map.dragRotate.disable();
    this.map.keyboard.disable();
    this.map.touchZoomRotate.disableRotation();
  }

  setupEventListeners() {
    this.map.on("click", "point-layer", this.handlePointClick.bind(this));
    this.map.on("click", "cluster-layer", this.handleClusterClick.bind(this));
    this.map.on("mouseenter", "point-layer", () => (this.map.getCanvas().style.cursor = "pointer"));
    this.map.on("mouseleave", "point-layer", () => (this.map.getCanvas().style.cursor = ""));
    this.map.on("moveend", this.handleMoveEnd.bind(this));
  }

  async loadInitialMarkers() {
    await this.loadClusterImages();
    await this.getData();
  }

  async loadClusterImages() {
    const images = [
      { name: "restaurant+walk", path: `${CONFIG.api.googleBucketUrl}/map/restaurant+walk.png` },
      { name: "restaurant+walk-active", path: `${CONFIG.api.googleBucketUrl}/map/restaurant+walk-active.png` },
      { name: "r-cluster", path: `${CONFIG.api.googleBucketUrl}/map/r-cluster.png` },
      { name: "w-cluster", path: `${CONFIG.api.googleBucketUrl}/map/w-cluster.png` },
    ];

    for (const image of images) {
      await this.loadMapImage(image.name, image.path);
    }
  }

  async loadMapImage(name, path) {
    return new Promise((resolve, reject) => {
      this.map.loadImage(path, (error, image) => {
        if (error) reject(error);
        this.map.addImage(name, image);
        resolve();
      });
    });
  }
}

// Data Service
class DataService {
  constructor() {
    this.initialData = { listings: [] };
  }

  async fetchData(searchTerm = "") {
    const url = searchTerm ? `${CONFIG.api.alphiBaseUrl}?endpoint=home&name=${searchTerm.toLowerCase()}` : CONFIG.api.alphiBaseUrl;

    try {
      const response = await fetch(url);
      const data = await response.json();
      return this.processData(data);
    } catch (error) {
      console.error("Error fetching data:", error);
      return [];
    }
  }

  processData(data) {
    return data.map((item) => ({
      ...item,
      geoJson: this.convertToGeoJson(item),
    }));
  }

  convertToGeoJson(item) {
    return {
      type: "Feature",
      properties: {
        id: item.id,
        main_image: item.main_image,
        mag: 1.43,
        time: 1507424832518,
        felt: null,
        tsunami: 1,
        icon: "restaurantz",
      },
      geometry: {
        type: "Point",
        coordinates: [item.longitude, item.latitude],
      },
    };
  }
}

// UI Service
class UIService {
  constructor() {
    this.searchInput = document.getElementById("search");
    this.resultsContainer = document.getElementById("results");
    this.loadingAnimation = document.getElementById("loading-animation");
  }

  setupEventListeners() {
    this.searchInput.addEventListener("input", this.handleSearchInput.bind(this));
    document.getElementById("clearsearch").addEventListener("click", this.handleClearSearch.bind(this));
    document.getElementById("brand").addEventListener("click", this.handleClearSearch.bind(this));
  }

  handleSearchInput(event) {
    const hasValue = event.target.value.length > 0;
    event.target.classList.toggle("has--value", hasValue);
  }

  handleClearSearch() {
    this.searchInput.value = "";
    this.searchInput.dispatchEvent(new Event("input"));
  }

  updateResults(count, searchTerm = "") {
    const resultText = count === 1 ? "result" : "results";
    const searchTermText = searchTerm ? ` for <b>"${searchTerm}"</b>` : "";
    document.getElementById("totalresults").innerHTML = `<b>${count}</b> ${resultText}${searchTermText}`;
  }

  toggleLoading(show) {
    this.loadingAnimation.style.display = show ? "block" : "none";
  }
}

// Main Application
class MapApplication {
  constructor() {
    this.mapService = new MapService();
    this.dataService = new DataService();
    this.uiService = new UIService();
  }

  async initialize() {
    await this.mapService.initialize();
    this.uiService.setupEventListeners();
    await this.loadInitialData();
  }

  async loadInitialData() {
    this.uiService.toggleLoading(true);
    const data = await this.dataService.fetchData();
    await this.updateMapAndUI(data);
    this.uiService.toggleLoading(false);
  }

  async updateMapAndUI(data) {
    this.updateCards(data);
    this.updateMap(data);
    this.uiService.updateResults(data.length);
  }

  updateCards(data) {
    $app.components.cards.store.listings = data;
    this.activateCardListeners(data);
  }

  updateMap(data) {
    const geoJsonData = {
      type: "FeatureCollection",
      features: data.map((item) => item.geoJson),
    };
    this.mapService.updateMapData(geoJsonData);
  }

  activateCardListeners(data) {
    // Implementation of card click listeners
    // This would be similar to your existing activateList function
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  const app = new MapApplication();
  app.initialize();
});
