import { AdvantageScopeAssets } from "./shared/AdvantageScopeAssets";
import NamedMessage from "./shared/NamedMessage";
import Preferences from "./shared/Preferences";
import Selection, { SelectionMode } from "./shared/Selection";
import TabType, { getTabIcon } from "./shared/TabType";
import CameraStreamRenderer from "./shared/renderers/CameraStreamRenderer";
import ConsoleRenderer from "./shared/renderers/ConsoleRenderer";
import DocumentationRenderer from "./shared/renderers/DocumentationRenderer";
import JoysticksRenderer from "./shared/renderers/JoysticksRenderer";
import LineGraphRenderer from "./shared/renderers/LineGraphRenderer";
import MechanismRenderer from "./shared/renderers/MechanismRenderer";
import MetadataRenderer from "./shared/renderers/MetadataRenderer";
import OdometryRenderer from "./shared/renderers/OdometryRenderer";
import PointsRenderer from "./shared/renderers/PointsRenderer";
import StatisticsRenderer from "./shared/renderers/StatisticsRenderer";
import SwerveRenderer from "./shared/renderers/SwerveRenderer";
import TabRenderer from "./shared/renderers/TabRenderer";
import TableRenderer from "./shared/renderers/TableRenderer";
import ThreeDimensionRenderer from "./shared/renderers/ThreeDimensionRenderer";
import VideoRenderer from "./shared/renderers/VideoRenderer";
import { htmlEncode } from "./shared/util";

const MAX_ASPECT_RATIO = 5;
const SAVE_PERIOD_MS = 250;

declare global {
  interface Window {
    assets: AdvantageScopeAssets | null;
    preferences: Preferences | null;
    isBattery: boolean;
    selection: Selection;
    sendMainMessage: (name: string, data?: any) => void;
  }
}

window.isBattery = false;

let renderer: TabRenderer | null = null;
let type: TabType | null = null;
let title: string | null = null;
let messagePort: MessagePort | null = null;
let lastAspectRatio: number | null = null;
let lastCommand: any = null;

/** Updates the current visualizer based on the type. */
function updateVisualizer() {
  if (type === null) return;

  // Update visible elements
  for (let i = 0; i < document.body.childElementCount; i++) {
    let element = document.getElementById("renderer" + i.toString());
    if (element !== null) {
      element.hidden = type !== i;
    }
  }

  // Create renderer
  let root = document.getElementById("renderer" + type.toString()) as HTMLElement;
  switch (type) {
    case TabType.Documentation:
      renderer = new DocumentationRenderer(root);
      break;
    case TabType.LineGraph:
      renderer = new LineGraphRenderer(root, false);
      break;
    case TabType.Odometry:
      renderer = new OdometryRenderer(root);
      break;
    case TabType.ThreeDimension:
      renderer = new ThreeDimensionRenderer(root);
      break;
    case TabType.Table:
      renderer = new TableRenderer(root, false);
      break;
    case TabType.Console:
      renderer = new ConsoleRenderer(root, false);
      break;
    case TabType.Statistics:
      renderer = new StatisticsRenderer(root);
      break;
    case TabType.Video:
      renderer = new VideoRenderer(root);
      break;
    case TabType.Joysticks:
      renderer = new JoysticksRenderer(root);
      break;
    case TabType.Swerve:
      renderer = new SwerveRenderer(root);
      break;
    case TabType.Mechanism:
      renderer = new MechanismRenderer(root);
      break;
    case TabType.Points:
      renderer = new PointsRenderer(root);
      break;
    case TabType.CameraStream:
      renderer = new CameraStreamRenderer(root);
    case TabType.Metadata:
      renderer = new MetadataRenderer(root);
      break;
  }
}

window.sendMainMessage = (name: string, data?: any) => {
  if (messagePort !== null) {
    let message: NamedMessage = { name: name, data: data };
    messagePort.postMessage(message);
  }
};

window.addEventListener("message", (event) => {
  if (event.source === window && event.data === "port") {
    messagePort = event.ports[0];
    messagePort.onmessage = (event) => {
      let message: NamedMessage = event.data;
      switch (message.name) {
        case "set-assets":
          window.assets = message.data;
          break;

        case "set-preferences":
          window.preferences = message.data;
          break;

        case "set-battery":
          window.isBattery = message.data;
          break;

        case "set-type":
          type = message.data;
          updateVisualizer();
          break;

        case "restore-state":
          type = message.data.type;
          updateVisualizer();
          renderer?.restoreState(message.data.visualizer);
          break;

        case "render":
          // Update title
          let titleElement = document.getElementsByTagName("title")[0] as HTMLElement;
          let newTitle = message.data.title;
          if (newTitle !== title) {
            titleElement.innerHTML =
              (type !== null ? getTabIcon(type) + " " : "") + htmlEncode(newTitle) + " &mdash; AdvantageScope";
            title = newTitle;
          }

          // Render frame
          lastCommand = message.data.command;
          if (renderer) {
            renderer.render(message.data.command);
            let aspectRatio = renderer.getAspectRatio();
            processAspectRatio(aspectRatio);

            // Update table range
            if (type === TabType.Table) {
              let tableRenderer = renderer as TableRenderer;
              window.sendMainMessage("add-table-range", {
                uuid: tableRenderer.UUID,
                range: tableRenderer.getTimestampRange()
              });
            }
          }
          break;

        case "set-3d-camera":
          if (type === TabType.ThreeDimension) {
            (renderer as ThreeDimensionRenderer).set3DCamera(message.data);
          }
          break;

        case "edit-fov":
          if (type === TabType.ThreeDimension) {
            (renderer as ThreeDimensionRenderer).setFov(message.data);
          }
          break;

        default:
          console.warn("Unknown message from main process", message);
          break;
      }
    };
  }
});

window.addEventListener("resize", () => {
  if (renderer === null || lastCommand === null) {
    return;
  }
  renderer.render(lastCommand);
  let aspectRatio = renderer.getAspectRatio();
  if (aspectRatio) processAspectRatio(aspectRatio);
});

function processAspectRatio(aspectRatio: number | null) {
  if (aspectRatio !== lastAspectRatio) {
    lastAspectRatio = aspectRatio;
    if (aspectRatio !== null) {
      if (aspectRatio > MAX_ASPECT_RATIO) aspectRatio = MAX_ASPECT_RATIO;
      if (aspectRatio < 1 / MAX_ASPECT_RATIO) aspectRatio = 1 / MAX_ASPECT_RATIO;
    }
    window.sendMainMessage("set-aspect-ratio", aspectRatio);
  }
}

window.addEventListener("beforeunload", () => {
  if (type === TabType.Table) {
    let tableRenderer = renderer as TableRenderer;
    window.sendMainMessage("add-table-range", {
      uuid: tableRenderer.UUID,
      range: null
    });
  }
});

window.addEventListener("keydown", (event) => {
  if (event.target !== document.body) return;
  switch (event.code) {
    case "Space":
      event.preventDefault();
      window.selection.togglePlayback();
      break;

    case "KeyL":
      event.preventDefault();
      window.selection.toggleLock();
      break;

    case "ArrowLeft":
    case "ArrowRight":
      event.preventDefault();
      window.selection.stepCycle(event.code === "ArrowRight");
      break;
  }
});

setInterval(() => {
  window.sendMainMessage("save-state", { type: type, visualizer: renderer?.saveState() });
}, SAVE_PERIOD_MS);

// Mock selection, send setter calls back to hub

class MockSelection implements Selection {
  getMode(): SelectionMode {
    throw new Error("Method not implemented.");
  }

  getHoveredTime(): number | null {
    throw new Error("Method not implemented.");
  }

  setHoveredTime(value: number | null): void {
    window.sendMainMessage("call-selection-setter", { name: "setHoveredTime", args: [value] });
  }

  getSelectedTime(): number | null {
    throw new Error("Method not implemented.");
  }

  setSelectedTime(time: number): void {
    window.sendMainMessage("call-selection-setter", { name: "setSelectedTime", args: [time] });
  }

  goIdle(): void {
    window.sendMainMessage("call-selection-setter", { name: "goIdle", args: [] });
  }

  play(): void {
    window.sendMainMessage("call-selection-setter", { name: "play", args: [] });
  }

  pause(): void {
    window.sendMainMessage("call-selection-setter", { name: "pause", args: [] });
  }

  togglePlayback(): void {
    window.sendMainMessage("call-selection-setter", { name: "togglePlayback", args: [] });
  }

  lock(): void {
    window.sendMainMessage("call-selection-setter", { name: "lock", args: [] });
  }

  unlock(): void {
    window.sendMainMessage("call-selection-setter", { name: "unlock", args: [] });
  }

  toggleLock(): void {
    window.sendMainMessage("call-selection-setter", { name: "toggleLock", args: [] });
  }

  stepCycle(isForward: boolean): void {
    window.sendMainMessage("call-selection-setter", { name: "stepCycle", args: [isForward] });
  }

  setLiveConnected(timeSupplier: () => number): void {
    throw new Error("Method not implemented.");
  }

  setLiveDisconnected(): void {
    throw new Error("Method not implemented.");
  }

  getCurrentLiveTime(): number | null {
    throw new Error("Method not implemented.");
  }

  getRenderTime(): number | null {
    throw new Error("Method not implemented.");
  }

  setPlaybackSpeed(speed: number): void {
    throw new Error("Method not implemented.");
  }

  setPlaybackLooping(looping: boolean): void {
    throw new Error("Method not implemented.");
  }

  setGrabZoomRange(range: [number, number] | null) {
    window.sendMainMessage("call-selection-setter", { name: "setGrabZoomRange", args: [range] });
  }

  getGrabZoomRange(): [number, number] | null {
    throw new Error("Method not implemented.");
  }

  finishGrabZoom() {
    window.sendMainMessage("call-selection-setter", { name: "finishGrabZoom" });
  }

  getTimelineRange(): [number, number] {
    throw new Error("Method not implemented.");
  }

  getTimelineIsMaxZoom(): boolean {
    throw new Error("Method not implemented.");
  }

  setTimelineRange(range: [number, number], lockMaxZoom: boolean) {
    throw new Error("Method not implemented.");
  }

  applyTimelineScroll(dx: number, dy: number, widthPixels: number): void {
    window.sendMainMessage("call-selection-setter", { name: "applyTimelineScroll", args: [dx, dy, widthPixels] });
  }
}

window.selection = new MockSelection();
