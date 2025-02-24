import { AnnotatedPose3d, SwerveState } from "../geometry";
import { MechanismState } from "../log/LogUtil";
import TabRenderer from "./TabRenderer";
import ThreeDimensionRendererImpl, { StreamSettings } from "./ThreeDimensionRendererImpl";

export default class ThreeDimensionRenderer implements TabRenderer {
  private CANVAS: HTMLCanvasElement;
  private CANVAS_CONTAINER: HTMLElement;
  private ANNOTATIONS_DIV: HTMLElement;
  private ALERT: HTMLElement;
  private SPINNER: HTMLElement;

  private implementation: ThreeDimensionRendererImpl | null = null;
  private lastMode: "cinematic" | "standard" | "low-power" | null = null;
  private stateRestoreCache: unknown | null = null;

  constructor(root: HTMLElement) {
    this.CANVAS = root.getElementsByClassName("three-dimension-canvas")[0] as HTMLCanvasElement;
    this.CANVAS_CONTAINER = root.getElementsByClassName("three-dimension-canvas-container")[0] as HTMLElement;
    this.ANNOTATIONS_DIV = root.getElementsByClassName("three-dimension-annotations")[0] as HTMLElement;
    this.ALERT = root.getElementsByClassName("three-dimension-alert")[0] as HTMLElement;
    this.SPINNER = root.getElementsByClassName("spinner-cubes-container")[0] as HTMLElement;
    this.updateImplementation();
  }

  saveState(): unknown {
    return this.implementation === null ? null : this.implementation.saveState();
  }

  restoreState(state: unknown): void {
    if (state !== null) {
      if (this.implementation === null) {
        this.stateRestoreCache = state;
      } else {
        this.implementation.restoreState(state);
      }
    }
  }

  /** Switches the selected camera. */
  set3DCamera(index: number) {
    this.implementation?.set3DCamera(index);
  }

  /** Updates the orbit FOV. */
  setFov(fov: number) {
    this.implementation?.setFov(fov);
  }

  /** Updates stream settings. */
  setStreamSettings(settings: StreamSettings) {
    this.implementation?.setStreamSettings(settings);
  }

  private updateImplementation() {
    // Get current mode
    let mode: "cinematic" | "standard" | "low-power" | null = null;
    if (window.preferences) {
      if (window.isBattery && window.preferences.threeDimensionModeBattery !== "") {
        mode = window.preferences.threeDimensionModeBattery;
      } else {
        mode = window.preferences.threeDimensionModeAc;
      }
    }

    // Recreate visualizer if necessary
    if (mode !== this.lastMode && mode !== null) {
      this.lastMode = mode;
      let state: any = null;
      if (this.implementation !== null) {
        state = this.implementation.saveState();
        this.implementation.stop();
      }
      {
        let newCanvas = document.createElement("canvas");
        this.CANVAS.classList.forEach((className) => {
          newCanvas.classList.add(className);
        });
        newCanvas.id = this.CANVAS.id;
        this.CANVAS.replaceWith(newCanvas);
        this.CANVAS = newCanvas;
      }
      {
        let newDiv = document.createElement("div");
        this.ANNOTATIONS_DIV.classList.forEach((className) => {
          newDiv.classList.add(className);
        });
        newDiv.id = this.ANNOTATIONS_DIV.id;
        this.ANNOTATIONS_DIV.replaceWith(newDiv);
        this.ANNOTATIONS_DIV = newDiv;
      }
      this.implementation = new ThreeDimensionRendererImpl(
        mode,
        this.CANVAS,
        this.CANVAS_CONTAINER,
        this.ANNOTATIONS_DIV,
        this.ALERT,
        this.SPINNER
      );
      if (this.stateRestoreCache !== null) {
        this.implementation.restoreState(this.stateRestoreCache);
        this.stateRestoreCache = null;
      } else if (state !== null) {
        this.implementation.restoreState(state);
      }
    }
  }

  getAspectRatio(): number | null {
    return this.implementation === null ? null : this.implementation.getAspectRatio();
  }

  render(command: ThreeDimensionRendererCommand): void {
    this.updateImplementation();
    this.implementation?.render(command);
  }
}

export type ThreeDimensionRendererCommand = {
  game: string;
  origin: "blue" | "red";
  objects: ThreeDimensionRendererCommand_AnyObj[];
  cameraOverride: AnnotatedPose3d | null;
  autoDriverStation: number;
  allRobotModels: string[];
};

export type ThreeDimensionRendererCommand_AnyObj =
  | ThreeDimensionRendererCommand_RobotObj
  | ThreeDimensionRendererCommand_GhostObj
  | ThreeDimensionRendererCommand_GamePieceObj
  | ThreeDimensionRendererCommand_TrajectoryObj
  | ThreeDimensionRendererCommand_HeatmapObj
  | ThreeDimensionRendererCommand_AprilTagObj
  | ThreeDimensionRendererCommand_AxesObj
  | ThreeDimensionRendererCommand_ConeObj
  | ThreeDimensionRendererCommand_ZebraMarkerObj;

export type ThreeDimensionRendererCommand_GenericRobotObj = {
  model: string;
  poses: AnnotatedPose3d[];
  components: AnnotatedPose3d[];
  mechanism: MechanismState | null;
  visionTargets: AnnotatedPose3d[];
  swerveStates: {
    values: SwerveState[];
    color: string;
  }[];
};

export type ThreeDimensionRendererCommand_RobotObj = ThreeDimensionRendererCommand_GenericRobotObj & {
  type: "robot";
};

export type ThreeDimensionRendererCommand_GhostObj = ThreeDimensionRendererCommand_GenericRobotObj & {
  type: "ghost";
  color: string;
};

export type ThreeDimensionRendererCommand_GamePieceObj = {
  type: "gamePiece";
  variant: string;
  poses: AnnotatedPose3d[];
};

export type ThreeDimensionRendererCommand_TrajectoryObj = {
  type: "trajectory";
  color: string;
  size: string;
  poses: AnnotatedPose3d[];
};

export type ThreeDimensionRendererCommand_HeatmapObj = {
  type: "heatmap";
  poses: AnnotatedPose3d[];
};

export type ThreeDimensionRendererCommand_AprilTagObj = {
  type: "aprilTag";
  poses: AnnotatedPose3d[];
  family: "36h11" | "16h5";
};

export type ThreeDimensionRendererCommand_AxesObj = {
  type: "axes";
  poses: AnnotatedPose3d[];
};

export type ThreeDimensionRendererCommand_ConeObj = {
  type: "cone";
  color: string;
  position: "center" | "back" | "front";
  poses: AnnotatedPose3d[];
};

export type ThreeDimensionRendererCommand_ZebraMarkerObj = {
  type: "zebra";
  poses: AnnotatedPose3d[];
};
