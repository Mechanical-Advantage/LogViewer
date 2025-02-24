import { AdvantageScopeAssets } from "../shared/AdvantageScopeAssets";
import { HubState } from "../shared/HubState";
import { SIM_ADDRESS, USB_ADDRESS } from "../shared/IPAddresses";
import NamedMessage from "../shared/NamedMessage";
import Preferences from "../shared/Preferences";
import Selection from "../shared/Selection";
import { SourceListItemState, SourceListTypeMemory } from "../shared/SourceListConfig";
import Log from "../shared/log/Log";
import { AKIT_TIMESTAMP_KEYS, MERGE_PREFIX, getEnabledData } from "../shared/log/LogUtil";
import { calcMockProgress, clampValue, htmlEncode, scaleValue } from "../shared/util";
import SelectionImpl from "./SelectionImpl";
import Sidebar from "./Sidebar";
import SourceList from "./SourceList";
import Tabs from "./Tabs";
import WorkerManager from "./WorkerManager";
import { HistoricalDataSource, HistoricalDataSourceStatus } from "./dataSources/HistoricalDataSource";
import { LiveDataSource, LiveDataSourceStatus } from "./dataSources/LiveDataSource";
import LiveDataTuner from "./dataSources/LiveDataTuner";
import loadZebra from "./dataSources/LoadZebra";
import PathPlannerSource from "./dataSources/PathPlannerSource";
import PhoenixDiagnosticsSource from "./dataSources/PhoenixDiagnosticsSource";
import { NT4Publisher, NT4PublisherStatus } from "./dataSources/nt4/NT4Publisher";
import NT4Source from "./dataSources/nt4/NT4Source";
import RLOGServerSource from "./dataSources/rlog/RLOGServerSource";

// Constants
const STATE_SAVE_PERIOD_MS = 250;
const TYPE_MEMORY_SAVE_PERIOD_MS = 1000;
const DRAG_ITEM = document.getElementById("dragItem") as HTMLElement;
const UPDATE_BUTTON = document.getElementsByClassName("update")[0] as HTMLElement;
const FEEDBACK_BUTTON = document.getElementsByClassName("feedback")[0] as HTMLElement;

// Global variables
declare global {
  interface Window {
    log: Log;
    preferences: Preferences | null;
    assets: AdvantageScopeAssets | null;
    typeMemory: SourceListTypeMemory;
    platform: string;
    platformRelease: string;
    platformArch: string;
    appVersion: string;
    isFullscreen: boolean;
    isFocused: boolean;
    isBattery: boolean;
    fps: boolean;

    selection: Selection;
    sidebar: Sidebar;
    tabs: Tabs;
    tuner: LiveDataTuner | null;
    getLoadingFields(): Set<string>;

    messagePort: MessagePort | null;
    sendMainMessage: (name: string, data?: any) => void;
    startDrag: (x: number, y: number, offsetX: number, offsetY: number, data: any) => void;

    // Provided by preload script
    electron: {
      getFilePath(file: File): string;
    };
  }
}

window.log = new Log();
window.preferences = null;
window.assets = null;
window.typeMemory = {};
window.platform = "";
window.platformRelease = "";
window.isFullscreen = false;
window.isFocused = true;
window.isBattery = false;
window.fps = false;

window.selection = new SelectionImpl();
window.sidebar = new Sidebar(() =>
  historicalSources.map((entry) => {
    let components = entry.path.split(window.platform === "win32" ? "\\" : "/");
    return components[components.length - 1];
  })
);
window.tabs = new Tabs();
window.tuner = null;
window.messagePort = null;

let historicalSources: {
  source: HistoricalDataSource;
  path: string;
  progress: number | null;
  progressIncluded: boolean;
}[] = [];
let liveSource: LiveDataSource | null = null;
let publisher: NT4Publisher | null = null;
let isExporting = false;
let logFriendlyName: string | null = null;
let liveActive = false;
let liveConnected = false;

let dragActive = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragLastX = 0;
let dragLastY = 0;
let dragData: any = null;

// WINDOW UTILITIES

function setWindowTitle(name: string, status?: string) {
  let title = htmlEncode(name) + (status ? " (" + htmlEncode(status) + ")" : "") + " &mdash; AdvantageScope";
  document.getElementsByTagName("title")[0].innerHTML = title;
  document.getElementsByClassName("title-bar-text")[0].innerHTML = title;
}

/** Shows or hides the loading indicator and updates progress. Pass "null" to disable loading indicator. */
function setLoading(progress: number | null) {
  let showLoadingGlowProperty = progress !== null ? "1" : "0";
  if (document.documentElement.style.getPropertyValue("--show-loading-glow") !== showLoadingGlowProperty) {
    document.documentElement.style.setProperty("--show-loading-glow", showLoadingGlowProperty);
  }
  if (progress !== null) {
    document.documentElement.style.setProperty("--loading-glow-progress", progress.toString());
  }
}

function updateFancyWindow() {
  // Using fancy title bar?
  let releaseSplit = window.platformRelease.split(".");
  if (
    window.platform === "darwin" &&
    Number(releaseSplit[0]) >= 20 && // macOS Big Sur
    !window.isFullscreen
  ) {
    document.body.classList.add("fancy-title-bar-mac");
  } else {
    document.body.classList.remove("fancy-title-bar-mac");
  }
  if (window.platform === "win32") {
    document.body.classList.add("fancy-title-bar-win");
  } else {
    document.body.classList.remove("fancy-title-bar-win");
  }
  if (window.platform === "linux") {
    document.body.classList.add("fancy-title-bar-linux");
  } else {
    document.body.classList.remove("fancy-title-bar-linux");
  }

  // Using fancy sidebar?
  if (window.platform === "darwin") {
    document.body.classList.add("fancy-side-bar-mac");
  } else {
    document.body.classList.remove("fancy-side-bar-mac");
  }

  // Skip background material on Windows until https://github.com/electron/electron/issues/41824 is fixed
  //
  // if (window.platform === "win32" && Number(releaseSplit[releaseSplit.length - 1]) >= 22621) {
  //   // Windows 11 22H2
  //   document.body.classList.add("fancy-side-bar-win");
  // } else {
  //   document.body.classList.remove("fancy-side-bar-win");
  // }
}

function setExporting(exporting: boolean) {
  if (exporting !== isExporting) {
    isExporting = exporting;
    window.sendMainMessage("set-exporting", exporting);
  }
}

// MANAGE STATE

/** Returns the current state. */
function saveState(): HubState {
  return {
    sidebar: window.sidebar.saveState(),
    tabs: window.tabs.saveState()
  };
}

/** Restores to the provided state. */
function restoreState(state: HubState) {
  window.sidebar.restoreState(state.sidebar);
  window.tabs.restoreState(state.tabs);
}

setInterval(() => {
  window.sendMainMessage("save-state", saveState());
}, STATE_SAVE_PERIOD_MS);

setInterval(() => {
  window.sendMainMessage("save-type-memory", window.typeMemory);
}, TYPE_MEMORY_SAVE_PERIOD_MS);

// MANAGE DRAGGING

window.startDrag = (x, y, offsetX, offsetY, data) => {
  dragActive = true;
  dragOffsetX = offsetX;
  dragOffsetY = offsetY;
  dragLastX = x;
  dragLastY = y;
  dragData = data;

  DRAG_ITEM.hidden = false;
  DRAG_ITEM.style.left = (x - offsetX).toString() + "px";
  DRAG_ITEM.style.top = (y - offsetY).toString() + "px";
  document.body.style.cursor = "grabbing";
};

function dragMove(x: number, y: number) {
  if (dragActive) {
    DRAG_ITEM.style.left = (x - dragOffsetX).toString() + "px";
    DRAG_ITEM.style.top = (y - dragOffsetY).toString() + "px";
    dragLastX = x;
    dragLastY = y;
    window.dispatchEvent(
      new CustomEvent("drag-update", {
        detail: { end: false, x: x, y: y, data: dragData }
      })
    );
  }
}
window.addEventListener("mousemove", (event) => {
  dragMove(event.clientX, event.clientY);
});
window.addEventListener("touchmove", (event) => {
  dragMove(event.touches[0].clientX, event.touches[0].clientY);
});

function dragEnd() {
  if (dragActive) {
    dragActive = false;
    DRAG_ITEM.hidden = true;
    document.body.style.cursor = "";
    window.dispatchEvent(
      new CustomEvent("drag-update", {
        detail: { end: true, x: dragLastX, y: dragLastY, data: dragData }
      })
    );
  }
}
window.addEventListener("mouseup", () => {
  dragEnd();
});
window.addEventListener("touchend", () => {
  dragEnd();
});

// FPS MEASUREMENT

const fpsDiv = document.getElementsByClassName("fps")[0] as HTMLElement;
const sampleLength = 10;
let frameTimes: number[] = [];
let periodic = () => {
  frameTimes.push(window.performance.now());
  while (frameTimes.length > sampleLength) {
    frameTimes.shift();
  }
  let fps = 0;
  if (frameTimes.length > 1) {
    let avgFrameTime = (frameTimes[frameTimes.length - 1] - frameTimes[0]) / (frameTimes.length - 1);
    fps = 1000 / avgFrameTime;
  }
  fpsDiv.hidden = !window.fps;
  if (window.fps) {
    fpsDiv.innerText = "FPS: " + fps.toFixed(1);
  }
  window.requestAnimationFrame(periodic);
};
window.requestAnimationFrame(periodic);

// DATA SOURCE HANDLING

window.getLoadingFields = () => {
  let output: Set<string> = new Set();
  historicalSources.forEach((entry) => {
    entry.source.getLoadingFields().forEach((field) => output.add(field));
  });
  return output;
};

/** Connects to a historical data source. */
function startHistorical(path: string, clear = true, merge = false) {
  clear = clear || !merge;
  let originalTimelineRange: null | [number, number] = null;
  let originalTimelineIsMaxZoom: null | boolean = null;
  if (clear) {
    historicalSources.forEach((entry) => entry.source.stop());
    historicalSources = [];
    originalTimelineRange = window.selection.getTimelineRange();
    originalTimelineIsMaxZoom = window.selection.getTimelineIsMaxZoom();
    window.log = new Log();
    window.sidebar.refresh();
    window.tabs.refresh();
  }

  liveSource?.stop();
  window.tuner = null;
  liveActive = false;
  liveConnected = false;
  setLoading(null);

  let updateLoading = () => {
    if (historicalSources.every((entry) => entry.progress === null)) {
      historicalSources.forEach((entry) => (entry.progressIncluded = false));
    }

    let totalProgress = 0;
    let progressCount = 0;
    historicalSources.forEach((entry) => {
      if (!entry.progressIncluded) return;
      totalProgress += entry.progress === null ? 1 : entry.progress;
      progressCount++;
    });

    if (progressCount === 0) {
      setLoading(null);
    } else {
      setLoading(totalProgress / progressCount);
    }
  };

  let source = new HistoricalDataSource();
  let sourceEntry = { source: source, path: path, progress: 0, progressIncluded: true } as {
    source: HistoricalDataSource;
    path: string;
    progress: number | null;
    progressIncluded: boolean;
  };
  historicalSources.push(sourceEntry);
  source.openFile(
    window.log,
    path,
    merge ? "/" + MERGE_PREFIX + (historicalSources.length - 1).toString() : "",
    (status: HistoricalDataSourceStatus) => {
      if (historicalSources.length === 1) {
        let components = historicalSources[0].path.split(window.platform === "win32" ? "\\" : "/");
        logFriendlyName = components[components.length - 1];
      } else {
        logFriendlyName = historicalSources.length.toString() + " Log Files";
      }
      switch (status) {
        case HistoricalDataSourceStatus.Reading:
        case HistoricalDataSourceStatus.DecodingInitial:
          setWindowTitle(logFriendlyName, "Loading");
          break;
        case HistoricalDataSourceStatus.DecodingField:
        case HistoricalDataSourceStatus.Idle:
          setWindowTitle(logFriendlyName);
          sourceEntry.progress = null;
          updateLoading();
          if (originalTimelineRange !== null && originalTimelineIsMaxZoom !== null) {
            window.selection.setTimelineRange(originalTimelineRange, originalTimelineIsMaxZoom);
            originalTimelineRange = null;
            originalTimelineIsMaxZoom = null;
          }
          break;
        case HistoricalDataSourceStatus.Error:
          setWindowTitle(logFriendlyName, "Error");
          sourceEntry.progress = null;
          updateLoading();
          let message = "There was a problem while reading the log file. Please try again.";
          if (source.getCustomError() !== null) {
            message = source.getCustomError()!;
          }
          window.sendMainMessage("error", {
            title: "Failed to open log",
            content: message
          });
          break;
        case HistoricalDataSourceStatus.Stopped:
          break;
      }
    },
    (progress: number) => {
      sourceEntry.progress = progress;
      updateLoading();
    },
    (hasNewFields: boolean) => {
      window.sidebar.refresh();
      if (hasNewFields) window.tabs.refresh();
    }
  );
}

/** Connects to a live data source. */
function startLive(isSim: boolean) {
  historicalSources.forEach((entry) => entry.source.stop());
  historicalSources = [];
  liveSource?.stop();
  publisher?.stop();
  liveActive = true;
  setLoading(null);

  if (!window.preferences) return;
  switch (window.preferences.liveMode) {
    case "nt4":
      liveSource = new NT4Source(false);
      break;
    case "nt4-akit":
      liveSource = new NT4Source(true);
      break;
    case "phoenix":
      liveSource = new PhoenixDiagnosticsSource();
      break;
    case "pathplanner":
      liveSource = new PathPlannerSource();
      break;
    case "rlog":
      liveSource = new RLOGServerSource();
      break;
  }

  let address = "";
  if (isSim) {
    address = SIM_ADDRESS;
  } else if (window.preferences?.usb) {
    address = USB_ADDRESS;
  } else {
    if (window.preferences) {
      address = window.preferences.rioAddress;
    }
  }

  liveSource.connect(
    address,
    (status: LiveDataSourceStatus) => {
      switch (status) {
        case LiveDataSourceStatus.Connecting:
          setWindowTitle(address, "Searching");
          break;
        case LiveDataSourceStatus.Active:
          setWindowTitle(address);
          break;
        case LiveDataSourceStatus.Error:
          setWindowTitle(address, "Error");
          window.sendMainMessage("error", {
            title: "Problem with live source",
            content:
              "There was a problem while connecting to the live source. Please check your connection settings and try again."
          });
          break;
      }

      if (status !== LiveDataSourceStatus.Active) {
        window.selection.setLiveDisconnected();
      }
    },
    (log: Log, timeSupplier: () => number) => {
      liveConnected = true;
      window.log = log;
      window.selection.setLiveConnected(timeSupplier);
      window.sidebar.refresh();
      window.tabs.refresh();
    }
  );
  window.tuner = liveSource.getTuner();
}

// File dropped on window
document.addEventListener("dragover", (event) => {
  event.preventDefault();
});
document.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (event.dataTransfer) {
    let files: string[] = [];
    for (const file of event.dataTransfer.files) {
      files.push(window.electron.getFilePath(file));
    }
    if (files.length > 0) {
      files.forEach((file, index) => {
        startHistorical(file, index === 0, files.length > 1);
      });
    }
  }
});

// MAIN MESSAGE HANDLING

window.sendMainMessage = (name: string, data?: any) => {
  if (window.messagePort !== null) {
    let message: NamedMessage = { name: name, data: data };
    window.messagePort.postMessage(message);
  }
};

window.addEventListener("message", (event) => {
  if (event.source === window && event.data === "port") {
    window.messagePort = event.ports[0];
    window.messagePort.onmessage = (event) => {
      let message: NamedMessage = event.data;
      handleMainMessage(message);
    };
  }
});

UPDATE_BUTTON.addEventListener("click", () => {
  window.sendMainMessage("prompt-update");
});

FEEDBACK_BUTTON.addEventListener("click", () => {
  window.sendMainMessage("open-feedback");
});

// Update touch bar slider position
setInterval(() => {
  if (window.platform === "darwin") {
    let range = window.log.getTimestampRange();
    let liveTime = window.selection.getCurrentLiveTime();
    if (liveTime !== null) {
      range[1] = liveTime;
    }
    let selectedTime = window.selection.getSelectedTime();
    if (selectedTime === null) {
      selectedTime = range[0];
    }
    let timePercent = clampValue(scaleValue(selectedTime, range, [0, 1]), 0, 1);
    window.sendMainMessage("update-touch-bar-slider", timePercent);
  }
}, 1000 / 60);

async function handleMainMessage(message: NamedMessage) {
  switch (message.name) {
    case "show-when-ready":
      // Wait for DOM updates to finish
      window.requestAnimationFrame(() => {
        window.sendMainMessage("show");
      });
      break;

    case "restore-state":
      restoreState(message.data);
      break;

    case "restore-type-memory":
      window.typeMemory = message.data;
      break;

    case "set-fullscreen":
      window.isFullscreen = message.data;
      updateFancyWindow();
      break;

    case "set-focused":
      window.isFocused = message.data;
      Array.from(document.getElementsByTagName("button")).forEach((button) => {
        if (window.isFocused) {
          button.classList.remove("blurred");
        } else {
          button.classList.add("blurred");
        }
      });
      break;

    case "set-battery":
      window.isBattery = message.data;
      break;

    case "set-version":
      window.platform = message.data.platform;
      window.platformRelease = message.data.platformRelease;
      window.platformArch = message.data.platformArch;
      window.appVersion = message.data.appVersion;
      updateFancyWindow();
      break;

    case "set-preferences":
      window.preferences = message.data;
      break;

    case "set-assets":
      if (JSON.stringify(window.assets) !== JSON.stringify(message.data)) {
        let oldHadFailed = window.assets && window.assets.loadFailures.length > 0;
        let newHasFailed = message.data && message.data.loadFailures.length > 0;
        window.assets = message.data;
        window.tabs.newAssets();

        // Alert about failed assets
        if (newHasFailed) {
          console.warn(
            "Failed to load: " +
              window.assets!.loadFailures.join(", ") +
              ". Check that all assets follow the format described in the AdvantageScope documentation."
          );
        }
        if (newHasFailed && !oldHadFailed) {
          window.sendMainMessage("error", {
            title: "Failed to load assets",
            content: "Some asset files failed to load. Check the developer console for details."
          });
        }
        if (!newHasFailed && oldHadFailed) {
          console.log("All assets loaded successfully");
        }
      }
      break;

    case "set-active-satellites":
      window.tabs.setActiveSatellites(message.data);
      break;

    case "set-active-xr-uuid":
      window.tabs.setActiveXRUUID(message.data);
      break;

    case "call-selection-setter":
      let uuid: string = message.data.uuid;
      let name: string = message.data.name;
      let args: any[] = message.data.args;
      if (window.tabs.isValidUUID(uuid)) {
        switch (name) {
          case "setHoveredTime":
            window.selection.setHoveredTime(args[0]);
            break;
          case "setSelectedTime":
            window.selection.setSelectedTime(args[0]);
            break;
          case "goIdle":
            window.selection.goIdle();
            break;
          case "play":
            window.selection.play();
            break;
          case "pause":
            window.selection.pause();
            break;
          case "togglePlayback":
            window.selection.togglePlayback();
            break;
          case "lock":
            window.selection.lock();
            break;
          case "unlock":
            window.selection.unlock();
            break;
          case "toggleLock":
            window.selection.toggleLock();
            break;
          case "stepCycle":
            window.selection.stepCycle(args[0]);
            break;
          case "setGrabZoomRange":
            window.selection.setGrabZoomRange(args[0]);
            break;
          case "finishGrabZoom":
            window.selection.finishGrabZoom();
            break;
          case "applyTimelineScroll":
            window.selection.applyTimelineScroll(args[0], args[1], args[2]);
            break;
        }
      }
      break;

    case "zoom-enabled":
      {
        let enabledData = getEnabledData(window.log);
        let range = window.log.getTimestampRange();
        let firstEnableIndex = enabledData === null ? -1 : enabledData.values.findIndex((value) => value);
        let lastDisableIndex = enabledData === null ? -1 : enabledData.values.findLastIndex((value) => !value);
        if (firstEnableIndex !== -1) {
          range[0] = enabledData!.timestamps[firstEnableIndex];
        }
        if (lastDisableIndex !== -1) {
          range[1] = enabledData!.timestamps[lastDisableIndex];
        }
        window.selection.setTimelineRange(range, firstEnableIndex === -1 && lastDisableIndex === -1);
      }
      break;

    case "show-update-button":
      document.documentElement.style.setProperty("--show-update-button", message.data ? "1" : "0");
      UPDATE_BUTTON.hidden = !message.data;
      break;

    case "show-feedback-button":
      document.documentElement.style.setProperty("--show-feedback-button", message.data ? "1" : "0");
      FEEDBACK_BUTTON.hidden = !message.data;
      break;

    case "historical-data":
      historicalSources.forEach((entry) => {
        entry.source.handleMainMessage(message.data);
      });
      break;

    case "live-data":
      if (liveSource !== null) {
        liveSource.handleMainMessage(message.data);
      }
      break;

    case "open-files":
      let files: string[] = message.data.files;
      let merge: boolean = message.data.merge;

      if (isExporting) {
        window.sendMainMessage("error", {
          title: "Cannot open file" + (files.length !== 1 ? "s" : ""),
          content: "Please wait for the export to finish, then try again."
        });
      } else if (merge && (liveActive || historicalSources.length === 0)) {
        window.sendMainMessage("error", {
          title: "Cannot insert file" + (files.length !== 1 ? "s" : ""),
          content: 'No log files are currently loaded. Choose "Open Log(s)" to load new files.'
        });
      } else {
        files.forEach((file, index) => {
          if (merge) {
            startHistorical(file, false, true);
          } else {
            startHistorical(file, index === 0, files.length > 1);
          }
        });
      }
      break;

    case "start-live":
      if (isExporting) {
        window.sendMainMessage("error", {
          title: "Cannot connect",
          content: "Please wait for the export to finish, then try again."
        });
      } else {
        startLive(message.data);
      }
      break;

    case "start-publish":
      if (liveActive) {
        window.sendMainMessage("error", {
          title: "Cannot publish",
          content: "Publishing is is not allowed from a live source."
        });
      } else if (!("NT" in window.log.getFieldTree())) {
        window.sendMainMessage("error", {
          title: "Cannot publish",
          content: "Please open a log file with NetworkTables data, then try again."
        });
      } else {
        // Start mock progress
        let mockProgress = 0;
        let mockProgressStart = new Date().getTime();
        let mockProgressInterval = setInterval(() => {
          mockProgress = calcMockProgress((new Date().getTime() - mockProgressStart) / 1000, 1);
          setLoading(mockProgress);
        }, 1000 / 60);

        // Load missing fields
        if (historicalSources.length > 0) {
          await historicalSources[0].source.loadAllFields(); // Root NT table is always from the first source
        }
        clearInterval(mockProgressInterval);

        // Start publisher
        publisher?.stop();
        publisher = new NT4Publisher(message.data, (status) => {
          if (logFriendlyName === null) return;
          switch (status) {
            case NT4PublisherStatus.Connecting:
              setWindowTitle(logFriendlyName, "Searching");
              break;
            case NT4PublisherStatus.Active:
              setWindowTitle(logFriendlyName, "Publishing");
              break;
            case NT4PublisherStatus.Stopped:
              setWindowTitle(logFriendlyName);
              break;
          }
        });
      }
      break;

    case "stop-publish":
      publisher?.stop();
      break;

    case "load-zebra":
      if (liveActive) {
        window.sendMainMessage("error", {
          title: "Cannot load Zebra data",
          content: "Loading Zebra data is not allowed while connected to a live source."
        });
      } else {
        setLoading(1);
        loadZebra()
          .then(() => {
            setLoading(null);
          })
          .catch(() => {
            setLoading(null);
          });
      }
      break;

    case "set-playback-options":
      window.selection.setPlaybackSpeed(message.data.speed);
      window.selection.setPlaybackLooping(message.data.looping);
      break;

    case "toggle-sidebar":
      window.sidebar.toggleVisible();
      break;

    case "toggle-controls":
      window.tabs.toggleControlsVisible();
      break;

    case "new-tab":
      window.tabs.addTab(message.data);
      break;

    case "new-satellite":
      window.tabs.newSatellite();
      break;

    case "move-tab":
      window.tabs.setSelected(window.tabs.getSelectedTab() + message.data);
      break;

    case "shift-tab":
      window.tabs.shift(window.tabs.getSelectedTab(), message.data);
      break;

    case "close-tab":
      window.tabs.close(window.tabs.getSelectedTab(), message.data);
      break;

    case "rename-tab":
      window.tabs.renameTab(message.data.index, message.data.name);
      break;

    case "source-list-type-response":
      {
        let uuid: string = message.data.uuid;
        let state: SourceListItemState = message.data.state;
        if (uuid in SourceList.typePromptCallbacks) {
          SourceList.typePromptCallbacks[uuid](state);
        }
      }
      break;

    case "source-list-clear-response":
      {
        let uuid: string = message.data.uuid;
        if (uuid in SourceList.clearPromptCallbacks) {
          SourceList.clearPromptCallbacks[uuid]();
        }
      }
      break;

    case "add-discrete-enabled":
      window.tabs.addDiscreteEnabled();
      break;

    case "edit-axis":
      window.tabs.editAxis(
        message.data.legend,
        message.data.lockedRange,
        message.data.unitConversion,
        message.data.filter
      );
      break;

    case "clear-axis":
      window.tabs.clearAxis(message.data);
      break;

    case "set-3d-camera":
      window.tabs.set3DCamera(message.data);
      break;

    case "edit-fov":
      window.tabs.setFov(message.data);
      break;

    case "edit-stream-settings":
      window.tabs.setStreamSettings(message.data);
      break;

    case "add-table-range":
      window.tabs.addTableRange(message.data.controllerUUID, message.data.rendererUUID, message.data.range);
      break;

    case "video-data":
      window.tabs.processVideoData(message.data);
      break;

    case "start-export":
      let logPath = historicalSources.length > 0 ? historicalSources[0].path : null;
      if (isExporting) {
        window.sendMainMessage("error", {
          title: "Cannot export data",
          content: "Please wait for the previous export to finish, then try again."
        });
      } else if (logPath === null && !liveConnected) {
        window.sendMainMessage("error", {
          title: "Cannot export data",
          content: "Please open a log file or connect to a live source, then try again."
        });
      } else {
        setExporting(true);
        const incompleteWarning =
          liveConnected &&
          (window.preferences?.liveSubscribeMode === "low-bandwidth" || window.preferences?.liveMode === "phoenix");
        const supportsAkit = window.log.getFieldKeys().find((key) => AKIT_TIMESTAMP_KEYS.includes(key)) !== undefined;
        window.sendMainMessage("prompt-export", {
          path: logPath,
          incompleteWarning: incompleteWarning,
          supportsAkit: supportsAkit
        });
      }
      break;

    case "cancel-export":
      setExporting(false);
      break;

    case "prepare-export":
      // Start mock progress
      let mockProgress = 0;
      let mockProgressStart = new Date().getTime();
      let mockProgressInterval = setInterval(() => {
        mockProgress = calcMockProgress((new Date().getTime() - mockProgressStart) / 1000, 0.25);
        setLoading(mockProgress);
      }, 1000 / 60);

      // Load missing fields
      await Promise.all(historicalSources.map((entry) => entry.source.loadAllFields()));

      // Convert to export format
      WorkerManager.request(
        "../bundles/hub$exportWorker.js",
        {
          options: message.data.options,
          log: window.log.toSerialized()
        },
        (progress: number) => {
          clearInterval(mockProgressInterval);
          setLoading(scaleValue(progress, [0, 1], [mockProgress, 1]));
        }
      )
        .then((content) => {
          window.sendMainMessage("write-export", {
            path: message.data.path,
            content: content
          });
        })
        .catch(() => {
          window.sendMainMessage("error", {
            title: "Failed to export data",
            content: "There was a problem while converting to the export format. Please try again."
          });
          setLoading(null);
        })
        .finally(() => {
          setExporting(false);
        });
      break;

    case "finish-export":
      setLoading(null);
      break;

    case "update-touch-bar-slider":
      let range = window.log.getTimestampRange();
      let liveTime = window.selection.getCurrentLiveTime();
      if (liveTime !== null) {
        range[1] = liveTime;
      }
      window.selection.setSelectedTime(scaleValue(message.data, [0, 1], range));
      break;

    default:
      console.warn("Unknown message from main process", message);
      break;
  }
}
