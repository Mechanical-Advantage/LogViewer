import { SourceListState } from "../../shared/SourceListConfig";
import { getOrDefault } from "../../shared/log/LogUtil";
import LoggableType from "../../shared/log/LoggableType";
import { CameraStream, CameraStreamRendererCommand } from "../../shared/renderers/CameraStreamRenderer";
import { createUUID } from "../../shared/util";
import SourceList from "../SourceList";
import CameraStreamController_Config from "./CameraStreamController_Config";
import TabController from "./TabController";

export default class CameraStreamController implements TabController {
  UUID = createUUID();

  private WIDTH: HTMLInputElement;
  private HEIGHT: HTMLInputElement;
  private FPS: HTMLInputElement;
  private COMPRESSION: HTMLInputElement;
  private COLUMNS: HTMLInputElement;

  private sourceList: SourceList;

  public static constructUrl(
    baseUrl: string,
    resolution: { width: number; height: number },
    fps: number,
    compression: number
  ): string {
    if (fps !== -1) baseUrl += `&fps=${fps}`;
    if (compression !== -1) baseUrl += `&compression=${compression}`;
    if (resolution.width !== -1 && resolution.height !== -1)
      baseUrl += `&resolution=${resolution.width}x${resolution.height}`;
    return baseUrl;
  }

  constructor(root: HTMLElement) {
    this.sourceList = new SourceList(root.firstElementChild as HTMLElement, CameraStreamController_Config, []);
    let settings = root.getElementsByClassName("camerastream-settings")[0] as HTMLElement;
    this.WIDTH = settings.getElementsByClassName("resolution-width")[0] as HTMLInputElement;
    this.HEIGHT = settings.getElementsByClassName("resolution-height")[0] as HTMLInputElement;
    this.FPS = settings.getElementsByClassName("fps")[0] as HTMLInputElement;
    this.COMPRESSION = settings.getElementsByClassName("compression")[0] as HTMLInputElement;
    this.COLUMNS = settings.getElementsByClassName("columns")[0] as HTMLInputElement;

    // Enforce number ranges (> 0 integers)
    [this.WIDTH, this.HEIGHT, this.COLUMNS].forEach((input) => {
      input.addEventListener("change", () => {
        if (Number(input.value) % 1 !== 0) input.value = Math.round(Number(input.value)).toString();
        if (Number(input.value) <= 0) input.value = "1";
      });
    });
    // Enforce number ranges (100 > x > -1 integers)
    [this.FPS, this.COMPRESSION].forEach((input) => {
      input.addEventListener("change", () => {
        if (Number(input.value) % 1 !== 0) input.value = Math.round(Number(input.value)).toString();
        if (Number(input.value) < -1) input.value = "-1";
        if (Number(input.value) > 100) input.value = "100";
      });
    });
  }

  getCommand(): CameraStreamRendererCommand {
    let time = window.selection.getRenderTime();
    if (time === null) time = window.log.getTimestampRange()[1];

    let sources = this.sourceList.getState(true);
    return {
      columns: Number(this.COLUMNS.value),
      streams: sources
        .map((source) => {
          if (source.type === "stream") {
            let baseUrl = getOrDefault(window.log, source.logKey, LoggableType.String, time, "", this.UUID);
            baseUrl = baseUrl.replace("mjpg:", "");
            let resolution = { width: Number(this.WIDTH.value), height: Number(this.HEIGHT.value) };
            let fps = Number(this.FPS.value);
            let compression = Number(this.COMPRESSION.value);
            return {
              source: baseUrl,
              url: CameraStreamController.constructUrl(baseUrl, resolution, fps, compression)
            };
          }
        })
        .filter((url): url is CameraStream => url !== undefined)
    };
  }

  saveState(): unknown {
    return {
      sources: this.sourceList.getState(),
      width: Number(this.WIDTH.value),
      height: Number(this.HEIGHT.value),
      fps: Number(this.FPS.value),
      compression: Number(this.COMPRESSION.value),
      columns: Number(this.COLUMNS.value)
    };
  }

  restoreState(state: unknown): void {
    if (typeof state !== "object" || state === null) return;

    if ("sources" in state) {
      this.sourceList.setState(state.sources as SourceListState);
    }
    if ("width" in state && typeof state.width === "number") {
      this.WIDTH.value = state.width.toString();
    }
    if ("height" in state && typeof state.height === "number") {
      this.HEIGHT.value = state.height.toString();
    }
    if ("fps" in state && typeof state.fps === "number") {
      this.FPS.value = state.fps.toString();
    }
    if ("compression" in state && typeof state.compression === "number") {
      this.COMPRESSION.value = state.compression.toString();
    }
    if ("columns" in state && typeof state.columns === "number") {
      this.COLUMNS.value = state.columns.toString();
    }
  }

  refresh(): void {
    this.sourceList.refresh();
  }

  newAssets(): void {}

  getActiveFields(): string[] {
    return this.sourceList.getActiveFields();
  }

  showTimeline(): boolean {
    return false;
  }
}
