import { TabsState } from "../shared/HubState";
import LineGraphFilter from "../shared/LineGraphFilter";
import TabType, { getDefaultTabTitle, getTabIcon } from "../shared/TabType";
import { getAutonomousKey, getEnabledKey } from "../shared/log/LogUtil";
import CameraStreamRenderer from "../shared/renderers/CameraStreamRenderer";
import ConsoleRenderer from "../shared/renderers/ConsoleRenderer";
import DocumentationRenderer from "../shared/renderers/DocumentationRenderer";
import JoysticksRenderer from "../shared/renderers/JoysticksRenderer";
import LineGraphRenderer from "../shared/renderers/LineGraphRenderer";
import MechanismRenderer from "../shared/renderers/MechanismRenderer";
import MetadataRenderer from "../shared/renderers/MetadataRenderer";
import OdometryRenderer from "../shared/renderers/OdometryRenderer";
import PointsRenderer from "../shared/renderers/PointsRenderer";
import StatisticsRenderer from "../shared/renderers/StatisticsRenderer";
import SwerveRenderer from "../shared/renderers/SwerveRenderer";
import TabRenderer, { NoopRenderer } from "../shared/renderers/TabRenderer";
import TableRenderer from "../shared/renderers/TableRenderer";
import ThreeDimensionRenderer from "../shared/renderers/ThreeDimensionRenderer";
import VideoRenderer from "../shared/renderers/VideoRenderer";
import { UnitConversionPreset } from "../shared/units";
import ScrollSensor from "./ScrollSensor";
import Timeline from "./Timeline";
import CameraStreamController from "./controllers/CameraStreamController";
import ConsoleController from "./controllers/ConsoleController";
import JoysticksController from "./controllers/JoysticksController";
import LineGraphController from "./controllers/LineGraphController";
import MechanismController from "./controllers/MechanismController";
import MetadataController from "./controllers/MetadataController";
import OdometryController from "./controllers/OdometryController";
import PointsController from "./controllers/PointsController";
import StatisticsController from "./controllers/StatisticsController";
import SwerveController from "./controllers/SwerveController";
import TabController, { NoopController } from "./controllers/TabController";
import TableController from "./controllers/TableController";
import ThreeDimensionController from "./controllers/ThreeDimensionController";
import VideoController from "./controllers/VideoController";

export default class Tabs {
  private TAB_DRAG_THRESHOLD_PX = 5;
  private DEFAULT_CONTROLS_HEIGHT = 200;

  private TIMELINE_CONTAINER = document.getElementsByClassName("timeline")[0] as HTMLElement;
  private TAB_BAR = document.getElementsByClassName("tab-bar")[0];
  private SHADOW_LEFT = document.getElementsByClassName("tab-bar-shadow-left")[0] as HTMLElement;
  private SHADOW_RIGHT = document.getElementsByClassName("tab-bar-shadow-right")[0] as HTMLElement;
  private SCROLL_OVERLAY = document.getElementsByClassName("tab-bar-scroll")[0] as HTMLElement;
  private DRAG_ITEM = document.getElementById("dragItem") as HTMLElement;
  private DRAG_HIGHLIGHT = document.getElementsByClassName("tab-bar-drag-highlight")[0] as HTMLElement;

  private RENDERER_CONTENT = document.getElementsByClassName("renderer-content")[0] as HTMLElement;
  private CONTROLS_CONTENT = document.getElementsByClassName("controls-content")[0] as HTMLElement;
  private CONTROLS_HANDLE = document.getElementsByClassName("controls-handle")[0] as HTMLElement;

  private CLOSE_BUTTON = document.getElementsByClassName("close")[0] as HTMLElement;
  private POPUP_BUTTON = document.getElementsByClassName("popup")[0] as HTMLElement;
  private ADD_BUTTON = document.getElementsByClassName("add-tab")[0] as HTMLElement;

  private FIXED_CONTROL_HEIGHTS: Map<TabType, number | undefined> = new Map();

  private tabsScrollSensor: ScrollSensor;
  private timeline: Timeline;

  private tabList: {
    type: TabType;
    title: string;
    titleElement: HTMLElement;
    controlsElement: HTMLElement;
    rendererElement: HTMLElement;
    controller: TabController;
    renderer: TabRenderer;
    controlsHeight: number;
  }[] = [];
  private selectedTab = 0;
  private activeSatellites: string[] = [];
  private activeXRUUID: string | null = null;
  private controlsHandleActive = false;

  constructor() {
    // Set up tab configs
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Documentation, 0);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.LineGraph, undefined);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Table, 0);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Console, 0);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Statistics, undefined);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Odometry, undefined);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.ThreeDimension, undefined);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Video, 85);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Joysticks, 85);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Swerve, undefined);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Mechanism, undefined);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Points, undefined);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.CameraStream, undefined);
    this.FIXED_CONTROL_HEIGHTS.set(TabType.Metadata, 0);

    // Hover and click handling
    let mouseDownInfo: [number, number] | null = null;
    this.SCROLL_OVERLAY.addEventListener("mousedown", (event) => {
      mouseDownInfo = [event.clientX, event.clientY];
    });
    this.SCROLL_OVERLAY.addEventListener("mouseup", (event) => {
      if (mouseDownInfo === null) return;
      if (
        Math.abs(event.clientX - mouseDownInfo[0]) < this.TAB_DRAG_THRESHOLD_PX &&
        Math.abs(event.clientY - mouseDownInfo[1]) < this.TAB_DRAG_THRESHOLD_PX
      ) {
        this.tabList.forEach((tab, index) => {
          let rect = tab.titleElement.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            this.setSelected(index);
          }
        });
      }
      mouseDownInfo = null;
    });
    this.SCROLL_OVERLAY.addEventListener("mousemove", (event) => {
      // Update hover
      this.tabList.forEach((tab) => {
        let rect = tab.titleElement.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          tab.titleElement.classList.add("tab-hovered");
        } else {
          tab.titleElement.classList.remove("tab-hovered");
        }
      });

      // Start drag
      if (
        mouseDownInfo !== null &&
        (Math.abs(event.clientX - mouseDownInfo[0]) >= this.TAB_DRAG_THRESHOLD_PX ||
          Math.abs(event.clientY - mouseDownInfo[1]) >= this.TAB_DRAG_THRESHOLD_PX)
      ) {
        // Find tab
        let tabIndex = 0;
        this.tabList.forEach((tab, index) => {
          let rect = tab.titleElement.getBoundingClientRect();
          if (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            tabIndex = index;
          }
        });
        if (tabIndex === 0) return;

        // Trigger drag event
        while (this.DRAG_ITEM.firstChild) {
          this.DRAG_ITEM.removeChild(this.DRAG_ITEM.firstChild);
        }
        let tab = document.createElement("div");
        tab.classList.add("tab");
        if (tabIndex === this.selectedTab) {
          tab.classList.add("tab-selected");
        }
        tab.innerText = this.tabList[tabIndex].titleElement.innerText;
        this.DRAG_ITEM.appendChild(tab);
        let tabRect = this.tabList[tabIndex].titleElement.getBoundingClientRect();
        window.startDrag(event.clientX, event.clientY, event.clientX - tabRect.left, event.clientY - tabRect.top, {
          tabIndex: tabIndex
        });
        mouseDownInfo = null;
      }
    });
    this.SCROLL_OVERLAY.addEventListener("mouseout", () => {
      this.tabList.forEach((tab) => {
        tab.titleElement.classList.remove("tab-hovered");
      });
    });
    this.SCROLL_OVERLAY.addEventListener("contextmenu", (event) => {
      mouseDownInfo = null;
      this.tabList.forEach((tab, index) => {
        if (index === 0) return;
        let rect = tab.titleElement.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          window.sendMainMessage("ask-rename-tab", {
            index: index,
            name: this.tabList[index].title
          });
        }
      });
    });

    // Controls handle
    this.CONTROLS_HANDLE.addEventListener("mousedown", () => {
      this.controlsHandleActive = true;
      document.body.style.cursor = "row-resize";
    });
    window.addEventListener("mouseup", () => {
      this.controlsHandleActive = false;
      document.body.style.cursor = "initial";
    });
    window.addEventListener("mousemove", (event) => {
      let fixedHeight = this.FIXED_CONTROL_HEIGHTS.get(this.tabList[this.selectedTab].type);
      if (this.controlsHandleActive) {
        let height = window.innerHeight - event.clientY;
        if (height >= 30 && height < 100) height = 100;
        if (height < 30) {
          if (this.tabList[this.selectedTab].controlsHeight > 0) {
            height = 0;
          } else {
            height = this.tabList[this.selectedTab].controlsHeight;
          }
        }
        if (fixedHeight !== undefined && height !== 0) {
          height = fixedHeight;
        }
        this.tabList[this.selectedTab].controlsHeight = height;
        this.updateControlsHeight();
      }
    });
    let lastClick = 0;
    this.CONTROLS_HANDLE.addEventListener("click", () => {
      let now = new Date().getTime();
      if (now - lastClick < 400) {
        this.toggleControlsVisible();
        lastClick = 0;
      } else {
        lastClick = now;
      }
    });
    this.updateControlsHeight();

    // Control buttons
    this.CLOSE_BUTTON.addEventListener("click", () => this.close(this.selectedTab));
    this.POPUP_BUTTON.addEventListener("click", () => this.newSatellite());
    this.ADD_BUTTON.addEventListener("click", () => {
      window.sendMainMessage("ask-new-tab");
    });

    // Drag handling
    window.addEventListener("drag-update", (event) => {
      let dragData = (event as CustomEvent).detail;
      if (!("tabIndex" in dragData.data)) return;
      let end = dragData.end;
      let x = dragData.x;
      let y = dragData.y;
      let tabIndex = dragData.data.tabIndex;

      let tabBarRect = this.SCROLL_OVERLAY.getBoundingClientRect();
      if (y > tabBarRect.bottom + 100) {
        this.DRAG_HIGHLIGHT.hidden = true;
        return;
      }

      let closestDist = Infinity;
      let closestIndex = 0;
      this.tabList.forEach((tab, index) => {
        let dist = Math.abs(x - tab.titleElement.getBoundingClientRect().right);
        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = index;
        }
      });

      if (end) {
        this.DRAG_HIGHLIGHT.hidden = true;
        if (closestIndex >= tabIndex) {
          this.shift(tabIndex, closestIndex - tabIndex);
        } else {
          this.shift(tabIndex, closestIndex - tabIndex + 1);
        }
      } else {
        this.DRAG_HIGHLIGHT.hidden = false;
        let highlightX =
          this.tabList[closestIndex].titleElement.getBoundingClientRect().right -
          this.SCROLL_OVERLAY.getBoundingClientRect().left +
          10;
        this.DRAG_HIGHLIGHT.style.left = highlightX.toString() + "px";
      }
    });

    // Add default tabs
    this.addTab(TabType.Documentation);
    this.addTab(TabType.LineGraph);
    this.addTab(TabType.Odometry);
    this.addTab(TabType.ThreeDimension);
    this.setSelected(1);

    // Scroll management
    this.tabsScrollSensor = new ScrollSensor(
      this.SCROLL_OVERLAY,
      (dx: number, dy: number) => {
        this.TAB_BAR.scrollLeft += dx + dy;
      },
      false
    );

    // Add timeline
    this.timeline = new Timeline(this.TIMELINE_CONTAINER);

    // Periodic function
    let periodic = () => {
      // Update tab bar
      this.SHADOW_LEFT.style.opacity = Math.floor(this.TAB_BAR.scrollLeft) <= 0 ? "0" : "1";
      this.SHADOW_RIGHT.style.opacity =
        Math.ceil(this.TAB_BAR.scrollLeft) >= this.TAB_BAR.scrollWidth - this.TAB_BAR.clientWidth ? "0" : "1";
      this.tabsScrollSensor.periodic();

      // Update timeline and controls
      this.timeline.periodic();
      this.updateControlsHeight();
      this.updateTimelineVisibility();

      // Render new frame
      this.tabList.forEach((tab, index) => {
        let activeLocal = index === this.selectedTab;
        let activeSatellite = this.activeSatellites.includes(tab.controller.UUID);
        let activeXR = tab.controller.UUID === this.activeXRUUID;
        if (activeLocal || activeSatellite || activeXR) {
          if (tab.type === TabType.Table) {
            // Update range from renderer
            let renderer = tab.renderer as TableRenderer;
            let controller = tab.controller as TableController;
            controller.addRendererRange(renderer.UUID, activeLocal ? renderer.getTimestampRange() : null);
          }
          let command = tab.controller.getCommand();
          if (activeLocal) {
            tab.renderer.render(command);
          }
          if (activeSatellite) {
            let title = tab.type === TabType.Documentation ? "Documentation" : tab.title;
            window.sendMainMessage("update-satellite", {
              uuid: tab.controller.UUID,
              command: command,
              title: title
            });
          }
          if (activeXR) {
            window.sendMainMessage("update-xr-command", command);
          }
        }
      });

      window.requestAnimationFrame(periodic);
    };
    window.requestAnimationFrame(periodic);
  }

  private updateControlsHeight() {
    let availableHeight = window.innerHeight - this.RENDERER_CONTENT.getBoundingClientRect().top;
    availableHeight -= 150;
    if (this.selectedTab < 0 || this.selectedTab >= this.tabList.length) return;
    let selectedTab = this.tabList[this.selectedTab];
    let tabConfig = this.FIXED_CONTROL_HEIGHTS.get(selectedTab.type);
    selectedTab.controlsHeight = Math.min(selectedTab.controlsHeight, availableHeight);

    let appliedHeight = Math.max(selectedTab.controlsHeight, 0);
    this.CONTROLS_HANDLE.hidden = tabConfig === 0;
    this.CONTROLS_CONTENT.hidden = appliedHeight === 0;
    document.documentElement.style.setProperty("--tab-controls-height", appliedHeight.toString() + "px");
    document.documentElement.style.setProperty("--show-tab-controls", appliedHeight === 0 ? "0" : "1");
  }

  /** Returns the current state. */
  saveState(): TabsState {
    return {
      selected: this.selectedTab,
      tabs: this.tabList.map((tab) => {
        return {
          type: tab.type,
          title: tab.title,
          controller: tab.controller.saveState(),
          controllerUUID: tab.controller.UUID,
          renderer: tab.renderer.saveState(),
          controlsHeight: tab.controlsHeight
        };
      })
    };
  }

  /** Restores to the provided state. */
  restoreState(state: TabsState) {
    this.tabList.forEach((tab) => {
      this.RENDERER_CONTENT.removeChild(tab.rendererElement);
      this.CONTROLS_CONTENT.removeChild(tab.controlsElement);
    });
    this.tabList = [];
    this.selectedTab = 0;
    state.tabs.forEach((tabState, index) => {
      this.addTab(tabState.type);
      if (tabState.title) this.renameTab(index, tabState.title);
      this.tabList[index].controller.UUID = tabState.controllerUUID;
      this.tabList[index].controller.restoreState(tabState.controller);
      this.tabList[index].renderer.restoreState(tabState.renderer);

      let tabConfig = this.FIXED_CONTROL_HEIGHTS.get(tabState.type);
      if (tabState.controlsHeight === 0 || tabConfig === undefined) {
        this.tabList[index].controlsHeight = tabState.controlsHeight;
      }
    });
    this.selectedTab = state.selected >= this.tabList.length ? this.tabList.length - 1 : state.selected;
    this.updateElements();
    this.updateControlsHeight();
  }

  /** Refresh based on new log data. */
  refresh() {
    this.tabList.forEach((tab) => {
      tab.controller.refresh();
    });
  }

  /** Refresh based on a new set of assets. */
  newAssets() {
    this.tabList.forEach((tab) => {
      tab.controller.newAssets();
    });
  }

  /** Returns the set of fields currently being displayed. */
  getActiveFields(): Set<string> {
    let activeFields = new Set<string>();
    this.tabList.forEach((tab) => {
      tab.controller.getActiveFields().forEach((field) => {
        activeFields.add(field);
      });
    });
    let enabledKey = getEnabledKey(window.log);
    if (enabledKey !== undefined) {
      activeFields.add(enabledKey);
    }
    let autonomousKey = getAutonomousKey(window.log);
    if (autonomousKey !== undefined) {
      activeFields.add(autonomousKey);
    }
    return activeFields;
  }

  /** Toggles the visibility of the tab controls. */
  toggleControlsVisible() {
    let fixedHeight = this.FIXED_CONTROL_HEIGHTS.get(this.tabList[this.selectedTab].type);
    if (this.tabList[this.selectedTab].controlsHeight === 0) {
      this.tabList[this.selectedTab].controlsHeight =
        fixedHeight === undefined ? this.DEFAULT_CONTROLS_HEIGHT : fixedHeight;
    } else {
      this.tabList[this.selectedTab].controlsHeight *= -1;
    }
    this.updateControlsHeight();
  }

  /** Creates a new tab. */
  addTab(type: TabType) {
    // Select existing metadata tab
    if (type === TabType.Metadata) {
      let existingIndex = this.tabList.findIndex((tab) => tab.type === TabType.Metadata);
      if (existingIndex >= 0) {
        this.setSelected(existingIndex);
        return;
      }
    }

    // Add tab
    let controlsElement = document.getElementById("controller" + type.toString())?.cloneNode(true) as HTMLElement;
    let rendererElement = document.getElementById("renderer" + type.toString())?.cloneNode(true) as HTMLElement;
    controlsElement.removeAttribute("id");
    rendererElement.removeAttribute("id");
    let controller: TabController;
    let renderer: TabRenderer;
    switch (type) {
      case TabType.Documentation:
        controller = new NoopController();
        renderer = new DocumentationRenderer(rendererElement);
        break;
      case TabType.LineGraph:
        controller = new LineGraphController(controlsElement);
        renderer = new LineGraphRenderer(rendererElement, true);
        break;
      case TabType.Odometry:
        controller = new OdometryController(controlsElement);
        renderer = new OdometryRenderer(rendererElement);
        break;
      case TabType.ThreeDimension:
        controller = new ThreeDimensionController(controlsElement);
        renderer = new ThreeDimensionRenderer(rendererElement);
        break;
      case TabType.Table:
        controller = new TableController(rendererElement);
        renderer = new TableRenderer(rendererElement, true);
        break;
      case TabType.Console:
        controller = new ConsoleController(rendererElement);
        renderer = new ConsoleRenderer(rendererElement, true);
        break;
      case TabType.Statistics:
        controller = new StatisticsController(controlsElement);
        renderer = new StatisticsRenderer(rendererElement);
        break;
      case TabType.Video:
        controller = new VideoController(controlsElement);
        renderer = new VideoRenderer(rendererElement);
        break;
      case TabType.Joysticks:
        controller = new JoysticksController(controlsElement);
        renderer = new JoysticksRenderer(rendererElement);
        break;
      case TabType.Swerve:
        controller = new SwerveController(controlsElement);
        renderer = new SwerveRenderer(rendererElement);
        break;
      case TabType.Mechanism:
        controller = new MechanismController(controlsElement);
        renderer = new MechanismRenderer(rendererElement);
        break;
      case TabType.Points:
        controller = new PointsController(controlsElement);
        renderer = new PointsRenderer(rendererElement);
        break;
      case TabType.CameraStream:
        controller = new CameraStreamController(controlsElement);
        renderer = new CameraStreamRenderer(rendererElement);
        break;
      case TabType.Metadata:
        controller = new MetadataController();
        renderer = new MetadataRenderer(rendererElement);
        break;
      default:
        controller = new NoopController();
        renderer = new NoopRenderer();
        break;
    }

    // Create title element
    let titleElement = document.createElement("div");
    titleElement.classList.add("tab");
    titleElement.innerText = getTabIcon(type) + " " + getDefaultTabTitle(type);

    // Save to tab list
    if (this.tabList.length === 0) {
      this.selectedTab = -1;
    }
    let controlsHeightConfig = this.FIXED_CONTROL_HEIGHTS.get(type);
    this.tabList.splice(this.selectedTab + 1, 0, {
      type: type,
      title: getDefaultTabTitle(type),
      titleElement: titleElement,
      controlsElement: controlsElement,
      rendererElement: rendererElement,
      controller: controller,
      renderer: renderer,
      controlsHeight: controlsHeightConfig === undefined ? this.DEFAULT_CONTROLS_HEIGHT : controlsHeightConfig
    });
    this.selectedTab += 1;
    this.CONTROLS_CONTENT.appendChild(controlsElement);
    this.RENDERER_CONTENT.appendChild(rendererElement);
    this.updateElements();
  }

  /** Create new sallite for current tab. */
  newSatellite() {
    if (this.selectedTab >= 0) {
      window.sendMainMessage("create-satellite", {
        uuid: this.tabList[this.selectedTab].controller.UUID,
        type: this.tabList[this.selectedTab].type
      });
    }
  }

  /** Closes the specified tab. */
  close(index: number, force = false) {
    if (index < 1 || index > this.tabList.length - 1) return;

    // If active XR, confirm before closing
    if (!force && this.tabList[index].controller.UUID === this.activeXRUUID) {
      window.sendMainMessage("confirm-xr-close", this.activeXRUUID);
    } else {
      this.RENDERER_CONTENT.removeChild(this.tabList[index].rendererElement);
      this.CONTROLS_CONTENT.removeChild(this.tabList[index].controlsElement);
      this.tabList.splice(index, 1);
      if (this.selectedTab > index) this.selectedTab--;
      if (this.selectedTab > this.tabList.length - 1) this.selectedTab = this.tabList.length - 1;
      this.updateElements();
    }
  }

  /** Returns the index of the selected tab. */
  getSelectedTab(): number {
    return this.selectedTab;
  }

  /** Changes which tab is currently selected. */
  setSelected(index: number) {
    if (index < 0 || index > this.tabList.length - 1) return;
    this.selectedTab = index;
    this.updateElements();
  }

  /** Moves the specified tab left or right. */
  shift(index: number, shift: number) {
    if (index === 0) return;
    if (index + shift < 1) shift = 1 - index;
    if (index + shift > this.tabList.length - 1) shift = this.tabList.length - 1 - index;
    if (this.selectedTab === index) {
      this.selectedTab += shift;
    } else if (index > this.selectedTab && shift <= this.selectedTab - index) {
      this.selectedTab++;
    } else if (index < this.selectedTab && shift >= this.selectedTab - index) {
      this.selectedTab--;
    }

    let tab = this.tabList.splice(index, 1)[0];
    this.tabList.splice(index + shift, 0, tab);
    this.updateElements();
  }

  /** Updates the list of active satellites for data publishing. */
  setActiveSatellites(activeSatellites: string[]) {
    this.activeSatellites = activeSatellites;
  }

  /** Updates the UUID for the tab broadcasting to XR. */
  setActiveXRUUID(uuid: string | null) {
    this.activeXRUUID = uuid;
    this.tabList.forEach((tab) => {
      if (tab.type === TabType.ThreeDimension) {
        (tab.controller as ThreeDimensionController).setXRActive(tab.controller.UUID === uuid);
      }
    });
  }

  /** Check whether the UUID is associated with a tab. */
  isValidUUID(uuid: string) {
    for (let i = 0; i < this.tabList.length; i++) {
      if (uuid === this.tabList[i].controller.UUID) {
        return true;
      }
    }
    return false;
  }

  /** Renames a single tab. */
  renameTab(index: number, name: string) {
    let tab = this.tabList[index];
    tab.title = name;
    tab.titleElement.innerText = getTabIcon(tab.type) + " " + name;
  }

  /** Adjusts the locked range and unit conversion for an axis on the selected line graph. */
  editAxis(
    legend: string,
    lockedRange: [number, number] | null,
    unitConversion: UnitConversionPreset,
    filter: LineGraphFilter
  ) {
    if (this.tabList[this.selectedTab].type === TabType.LineGraph) {
      (this.tabList[this.selectedTab].controller as LineGraphController).editAxis(
        legend,
        lockedRange,
        unitConversion,
        filter
      );
    }
  }

  /** Clear the fields for an axis on the selected line graph. */
  clearAxis(legend: string) {
    if (this.tabList[this.selectedTab].type === TabType.LineGraph) {
      (this.tabList[this.selectedTab].controller as LineGraphController).clearAxis(legend);
    }
  }

  /** Adds the enabled field to the discrete legend on the selected line graph. */
  addDiscreteEnabled() {
    if (this.tabList[this.selectedTab].type === TabType.LineGraph) {
      (this.tabList[this.selectedTab].controller as LineGraphController).addDiscreteEnabled();
    }
  }

  /** Switches the selected camera for the selected 3D field. */
  set3DCamera(index: number) {
    if (this.tabList[this.selectedTab].type === TabType.ThreeDimension) {
      (this.tabList[this.selectedTab].renderer as ThreeDimensionRenderer).set3DCamera(index);
    }
  }

  /** Switches the orbit FOV for the selected 3D field. */
  setFov(fov: number) {
    if (this.tabList[this.selectedTab].type === TabType.ThreeDimension) {
      (this.tabList[this.selectedTab].renderer as ThreeDimensionRenderer).setFov(fov);
    }
  }

  /** Switches the selected camera for the selected 3D field. */
  addTableRange(controllerUUID: string, rendererUUID: string, range: [number, number] | null) {
    this.tabList.forEach((tab) => {
      if (tab.type === TabType.Table && tab.controller.UUID === controllerUUID) {
        (this.tabList[this.selectedTab].controller as TableController).addRendererRange(rendererUUID, range);
      }
    });
  }

  /** Returns whether the selected tab is a video which
   * is unlocked (and thus requires access to the left
   * and right arrow keys) */
  isUnlockedVideoSelected(): boolean {
    if (this.tabList[this.selectedTab].type === TabType.Video) {
      return !(this.tabList[this.selectedTab].controller as VideoController).isLocked();
      return false;
    } else {
      return false;
    }
  }

  /** Sends video data to all video controllers. */
  processVideoData(data: any) {
    this.tabList.forEach((tab) => {
      if (tab.type === TabType.Video) {
        (tab.controller as VideoController).processVideoData(data);
      }
    });
  }

  /** Updates the displayed elements based on the tab list. */
  private updateElements() {
    // Remove old tabs
    while (this.TAB_BAR.firstChild) {
      this.TAB_BAR.removeChild(this.TAB_BAR.firstChild);
    }

    // Add title elements
    this.tabList.forEach((item, index) => {
      this.TAB_BAR.appendChild(item.titleElement);
      if (index === this.selectedTab) {
        item.titleElement.classList.add("tab-selected");
        item.rendererElement.hidden = false;
        item.controlsElement.hidden = false;
      } else {
        item.titleElement.classList.remove("tab-selected");
        item.rendererElement.hidden = true;
        item.controlsElement.hidden = true;
      }
    });

    // Update timeline
    this.updateTimelineVisibility();
  }

  /** Hides or shows the timeline based on the controller request. */
  private updateTimelineVisibility() {
    let show = this.tabList[this.selectedTab].controller.showTimeline();
    document.documentElement.style.setProperty("--show-timeline", show ? "1" : "0");
    this.TIMELINE_CONTAINER.hidden = !show;
  }
}
