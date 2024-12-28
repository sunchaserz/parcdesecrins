// Constants and Configuration
const CONFIG = {
  // API endpoints and URLs
  alphiBaseUrl: "https://live.api-server.io/run/v1/66ade5323b53b139de1ea229",
  googleBucketUrl: "https://storage.googleapis.com/parc_des_ecrins",
  maptilerApiKey: "fsCLuIQWGPlRskWhImQz",
  googleMapsApiKey: "AIzaSyDCeFfHwzjUWP2yZh7iTw1dGvAzG8cSLNc",

  // Map configuration
  defaultMapSettings: {
    zoom: 10.5,
    center: [6.079625696485338, 45.05582527284327],
    iconSize: 0.6,
  },

  // Geographic bounds
  ecrinsBounds: [5.784014, 44.488283, 6.81118, 45.193431],

  // UI elements
  searchDefaults: {
    buttonDefaultValue: "Search",
  },
};

// State management
const AppState = {
  geocoder: null,
  map: null,
  filterForPointLayer: ["any"],
  filterForClusterLayer: ["all", ["has", "point_count"]],
  urlParams: new URLSearchParams(window.location.search),
};

/**
 * Map Initialization and Setup
 */
class MapManager {
  constructor() {
    this.initializeMap();
    this.setupMapControls();
    this.setupEventListeners();
  }

  initializeMap() {
    // Hide map until data is loaded
    document.getElementById("map").style.visibility = "hidden";

    // Initialize Maptiler map
    AppState.map = new maptilersdk.Map({
      container: "map",
      zoom: CONFIG.defaultMapSettings.zoom,
      center: CONFIG.defaultMapSettings.center,
      fullscreenControl: "top-right",
      style: "b80bd75b-379c-45e4-9006-643ba8aa190e",
      antialias: true,
      navigationControl: false,
    });

    // Add navigation control with custom settings
    AppState.map.addControl(
      new maptilersdk.MaptilerNavigationControl({
        showCompass: false,
      })
    );
  }

  setupMapControls() {
    // Disable various map interactions for better UX
    AppState.map.dragRotate.disable();
    AppState.map.keyboard.disable();
    AppState.map.touchZoomRotate.disableRotation();
  }

  setupEventListeners() {
    AppState.map.on("load", () => this.onMapLoad());
    AppState.map.on("moveend", () => this.onMapMoveEnd());
    AppState.map.on("click", "point-layer", (e) => this.onPointClick(e));
    AppState.map.on("click", "cluster-layer", (e) => this.onClusterClick(e));
  }

  async onMapLoad() {
    await this.loadMapImages();
    DataManager.fetchInitialData();
  }

  async loadMapImages() {
    const imageLoader = new MapImageLoader(AppState.map);
    await imageLoader.loadRequiredImages();
  }

  onMapMoveEnd() {
    UIManager.showRefreshListButton();
    if (AppState.map.getLayer("point-layer") && AppState.map.isSourceLoaded("earthquakes")) {
      UIManager.createListFromSource();
    }
  }
}

/**
 * Data Management and API Interactions
 */
class DataManager {
  static async fetchInitialData() {
    const fetchAction = new FetchActionManager();
    await fetchAction.initialize();
  }

  static convertToGeoJson(data) {
    return {
      type: "FeatureCollection",
      crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
      },
      features: data.map(this.createGeoJsonFeature),
    };
  }

  static createGeoJsonFeature(item) {
    return {
      type: item.type,
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

/**
 * UI Management
 */
class UIManager {
  static initializeUI() {
    this.setupSearchHandling();
    this.setupCardInteractions();
    this.setupFilterControls();
  }

  static setupSearchHandling() {
    const searchInput = document.getElementById("search");
    searchInput.addEventListener("input", (e) => this.handleSearchInput(e));
  }

  static handleSearchInput(event) {
    const input = event.target;
    input.classList.toggle("has--value", input.value.length > 0);
  }

  // ... Additional UI methods ...
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  const mapManager = new MapManager();
  UIManager.initializeUI();
});

/**
 * Helper Functions
 */
const Helpers = {
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  getRenderedFeatures(point) {
    return AppState.map.queryRenderedFeatures(point, {
      layers: ["point-layer"],
    });
  },
};

// Export modules if needed
export { MapManager, DataManager, UIManager, Helpers };
