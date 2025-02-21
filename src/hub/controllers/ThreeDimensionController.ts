import { SourceListItemState, SourceListOptionValueConfig, SourceListState } from "../../shared/SourceListConfig";
import {
  APRIL_TAG_16H5_COUNT,
  APRIL_TAG_36H11_COUNT,
  AnnotatedPose3d,
  SwerveState,
  grabHeatmapData,
  grabPosesAuto,
  grabSwerveStates
} from "../../shared/geometry";
import {
  ALLIANCE_KEYS,
  DRIVER_STATION_KEYS,
  MechanismState,
  getDriverStation,
  getIsRedAlliance,
  getMechanismState,
  getOrDefault,
  mergeMechanismStates
} from "../../shared/log/LogUtil";
import LoggableType from "../../shared/log/LoggableType";
import {
  ThreeDimensionRendererCommand,
  ThreeDimensionRendererCommand_AnyObj
} from "../../shared/renderers/ThreeDimensionRenderer";
import { convert } from "../../shared/units";
import { clampValue, createUUID } from "../../shared/util";
import SourceList from "../SourceList";
import TabController from "./TabController";
import ThreeDimensionController_Config from "./ThreeDimensionController_Config";

export default class ThreeDimensionController implements TabController {
  UUID = createUUID();

  private ORIGIN_SWITCHER: HTMLElement;
  private XR_BUTTON: HTMLButtonElement;
  private GAME_SELECT: HTMLSelectElement;

  private sourceList: SourceList;
  private originSetting: "auto" | "blue" | "red" = "auto";

  constructor(root: HTMLElement) {
    this.sourceList = new SourceList(
      root.getElementsByClassName("three-dimension-sources")[0] as HTMLElement,
      ThreeDimensionController_Config,
      []
    );
    let settings = root.getElementsByClassName("three-dimension-settings")[0] as HTMLElement;
    this.ORIGIN_SWITCHER = settings.getElementsByClassName("origin-switcher")[0] as HTMLElement;
    this.XR_BUTTON = settings.getElementsByClassName("xr-button")[0] as HTMLButtonElement;
    this.GAME_SELECT = settings.getElementsByClassName("game-select")[0] as HTMLSelectElement;

    // Set up XR button
    this.XR_BUTTON.addEventListener("click", () => {
      window.sendMainMessage("open-xr", this.UUID);
    });

    // Set up game select
    this.GAME_SELECT.addEventListener("change", () => this.updateGameDependentControls());
    this.updateGameOptions();
    this.updateRobotOptions();

    // Set up switchers
    (["auto", "blue", "red"] as const).forEach((value, index) => {
      this.ORIGIN_SWITCHER.children[index].addEventListener("click", () => {
        this.originSetting = value;
        this.updateOriginSwitcher();
      });
    });
    this.updateOriginSwitcher();
  }

  /** Sets whether XR streamling is currently active for this tab. */
  setXRActive(active: boolean) {
    if (active) {
      this.XR_BUTTON.classList.add("active");
    } else {
      this.XR_BUTTON.classList.remove("active");
    }
  }

  /** Updates game select with the latest options. */
  private updateGameOptions() {
    let value = this.GAME_SELECT.value;
    while (this.GAME_SELECT.firstChild) {
      this.GAME_SELECT.removeChild(this.GAME_SELECT.firstChild);
    }
    let options: string[] = [];
    if (window.assets !== null) {
      options = [...window.assets.field3ds.map((game) => game.name), "Evergreen", "Axes"];
      options.forEach((title) => {
        let option = document.createElement("option");
        option.innerText = title;
        this.GAME_SELECT.appendChild(option);
      });
    }
    if (options.includes(value)) {
      this.GAME_SELECT.value = value;
    } else {
      this.GAME_SELECT.value = options[0];
    }
    this.updateGameDependentControls(this.GAME_SELECT.value === value); // Skip origin reset if game is unchanged
  }

  /** Updates source list with the latest robot models. */
  private updateRobotOptions() {
    let robotList: string[] = [];
    if (window.assets !== null) {
      robotList = window.assets.robots.map((robot) => robot.name);
    }
    if (robotList.length === 0) {
      robotList.push("KitBot");
    }
    let sourceListValues: SourceListOptionValueConfig[] = robotList.map((name) => {
      return { key: name, display: name };
    });
    this.sourceList.setOptionValues("robot", "model", sourceListValues);
    this.sourceList.setOptionValues("robotLegacy", "model", sourceListValues);
    this.sourceList.setOptionValues("ghost", "model", sourceListValues);
    this.sourceList.setOptionValues("ghostLegacy", "model", sourceListValues);
    this.sourceList.setOptionValues("ghostZebra", "model", sourceListValues);
  }

  /** Updates the alliance select, source button, and game pieces based on the selected value. */
  private updateGameDependentControls(skipOriginReset = false) {
    let fieldConfig = window.assets?.field3ds.find((game) => game.name === this.GAME_SELECT.value);

    if (fieldConfig !== undefined && !skipOriginReset) {
      this.originSetting = fieldConfig.defaultOrigin;
      this.updateOriginSwitcher();
    }

    let gamePieces: string[] = [];
    if (fieldConfig !== undefined) {
      gamePieces = fieldConfig.gamePieces.map((x) => x.name);
    }
    if (gamePieces.length === 0) {
      gamePieces.push("None");
    }
    let sourceListValues: SourceListOptionValueConfig[] = gamePieces.map((name) => {
      return { key: name, display: name };
    });
    this.sourceList.setOptionValues("gamePiece", "variant", sourceListValues);
    this.sourceList.setOptionValues("gamePieceLegacy", "variant", sourceListValues);
  }

  /** Updates the switcher elements to match the internal state. */
  private updateOriginSwitcher() {
    let selectedIndex = ["auto", "blue", "red"].indexOf(this.originSetting);
    if (selectedIndex === -1) selectedIndex = 0;
    for (let i = 0; i < 3; i++) {
      if (i === selectedIndex) {
        this.ORIGIN_SWITCHER.children[i].classList.add("selected");
      } else {
        this.ORIGIN_SWITCHER.children[i].classList.remove("selected");
      }
    }
  }

  saveState(): unknown {
    return {
      sources: this.sourceList.getState(),
      game: this.GAME_SELECT.value,
      origin: this.originSetting
    };
  }

  restoreState(state: unknown): void {
    if (typeof state !== "object" || state === null) return;

    this.updateGameOptions();
    if ("sources" in state) {
      this.sourceList.setState(state.sources as SourceListState);
    }
    if ("game" in state && typeof state.game === "string") {
      this.GAME_SELECT.value = state.game;
      if (this.GAME_SELECT.value === "") {
        this.GAME_SELECT.selectedIndex = 0;
      }
    }
    if ("origin" in state && (state.origin === "auto" || state.origin === "blue" || state.origin === "red")) {
      this.originSetting = state.origin;
    }
    this.updateGameDependentControls(true);
    this.updateOriginSwitcher();
  }

  refresh(): void {
    this.sourceList.refresh();
  }

  newAssets(): void {
    this.updateGameOptions();
    this.updateRobotOptions();
  }

  getActiveFields(): string[] {
    let allianceKeys: string[] = [];
    if (this.originSetting === "auto") {
      allianceKeys = ALLIANCE_KEYS;
    }
    return [...this.sourceList.getActiveFields(), ...allianceKeys, ...DRIVER_STATION_KEYS];
  }

  showTimeline(): boolean {
    return true;
  }

  getCommand(): ThreeDimensionRendererCommand {
    // Get timestamp
    let time = window.selection.getRenderTime();

    // Get game data
    let gameData = window.assets?.field2ds.find((game) => game.name === this.GAME_SELECT.value);
    let fieldWidth = gameData === undefined ? 0 : convert(gameData.widthInches, "inches", "meters");
    let fieldHeight = gameData === undefined ? 0 : convert(gameData.heightInches, "inches", "meters");

    // Get alliance
    let autoRedAlliance = time === null ? false : getIsRedAlliance(window.log, time);
    let origin: "blue" | "red" =
      (this.originSetting === "auto" && autoRedAlliance) || this.originSetting === "red" ? "red" : "blue";

    let objects: ThreeDimensionRendererCommand_AnyObj[] = [];
    let cameraOverride: AnnotatedPose3d | null = null;
    let sources = this.sourceList.getState(true);
    for (let i = 0; i < sources.length; i++) {
      let source = sources[i];
      let typeConfig = ThreeDimensionController_Config.types.find((typeConfig) => typeConfig.key === source.type);
      if (typeConfig?.childOf !== undefined) continue; // This is a child, don't render

      // Find children
      let children: SourceListItemState[] = [];
      while (
        sources.length > i + 1 &&
        ThreeDimensionController_Config.types.find((typeConfig) => typeConfig.key === sources[i + 1].type)?.childOf !==
          undefined
      ) {
        i++;
        children.push(sources[i]);
      }

      // Get pose data
      let numberArrayFormat: "Translation2d" | "Translation3d" | "Pose2d" | "Pose3d" = "Pose3d";
      let numberArrayUnits: "radians" | "degrees" = "radians";
      if ("format" in source.options) {
        let formatRaw = source.options.format;
        numberArrayFormat =
          formatRaw === "Pose2d" ||
          formatRaw === "Pose3d" ||
          formatRaw === "Translation2d" ||
          formatRaw === "Translation3d"
            ? formatRaw
            : "Pose3d";
      }
      if ("units" in source.options) {
        numberArrayUnits = source.options.units === "degrees" ? "degrees" : "radians";
      }
      let isHeatmap = source.type === "heatmap" || source.type === "heatmapLegacy";
      let poses: AnnotatedPose3d[] = [];

      if (!isHeatmap) {
        if (time !== null) {
          poses = grabPosesAuto(
            window.log,
            source.logKey,
            source.logType,
            time,
            this.UUID,
            numberArrayFormat,
            numberArrayUnits,
            origin,
            fieldWidth,
            fieldHeight
          );
        }
      } else {
        let timeRange: "enabled" | "auto" | "teleop" | "teleop-no-endgame" | "full" | "visible" = "enabled";
        if ("timeRange" in source.options) {
          let timeRangeRaw = source.options.timeRange;
          timeRange =
            timeRangeRaw === "enabled" ||
            timeRangeRaw === "auto" ||
            timeRangeRaw === "teleop" ||
            timeRangeRaw === "teleop-no-endgame" ||
            timeRangeRaw === "full" ||
            timeRangeRaw === "visible"
              ? timeRangeRaw
              : "enabled";
        }
        poses = grabHeatmapData(
          window.log,
          source.logKey,
          source.logType,
          timeRange,
          this.UUID,
          numberArrayFormat,
          numberArrayUnits,
          origin,
          fieldWidth,
          fieldHeight
        );
      }

      // Add data from children
      let components: AnnotatedPose3d[] = [];
      let mechanisms: MechanismState[] = [];
      let visionTargets: AnnotatedPose3d[] = [];
      let swerveStates: {
        values: SwerveState[];
        color: string;
      }[] = [];
      if (time !== null) {
        children.forEach((child) => {
          switch (child.type) {
            case "component":
            case "componentLegacy": {
              // Components are always 3D poses so assume number array format
              components = components.concat(
                grabPosesAuto(window.log, child.logKey, child.logType, time!, this.UUID, "Pose3d")
              );
              break;
            }

            case "mechanism": {
              let state = getMechanismState(window.log, child.logKey, time!, child.options.axis);
              if (state !== null) {
                mechanisms.push(state);
              }
              break;
            }

            case "rotationOverride":
            case "rotationOverrideLegacy": {
              let numberArrayUnits: "radians" | "degrees" = "radians";
              if ("units" in child.options) {
                numberArrayUnits = child.options.units === "degrees" ? "degrees" : "radians";
              }
              let rotations = grabPosesAuto(
                window.log,
                child.logKey,
                child.logType,
                time!,
                this.UUID,
                undefined,
                numberArrayUnits
              );
              if (rotations.length > 0) {
                poses.forEach((value) => {
                  value.pose.rotation = rotations[0].pose.rotation;
                });
              }
              break;
            }

            case "vision":
            case "visionLegacy": {
              let numberArrayFormat: "Translation2d" | "Translation3d" | "Pose2d" | "Pose3d" | undefined = undefined;
              if ("format" in child.options) {
                let formatRaw = child.options.format;
                numberArrayFormat =
                  formatRaw === "Pose2d" ||
                  formatRaw === "Pose3d" ||
                  formatRaw === "Translation2d" ||
                  formatRaw === "Translation3d"
                    ? formatRaw
                    : "Pose2d";
              }
              let newVisionTargets = grabPosesAuto(
                window.log,
                child.logKey,
                child.logType,
                time!,
                this.UUID,
                numberArrayFormat,
                "radians"
              );
              newVisionTargets.forEach((annotatedPose) => {
                annotatedPose.annotation.visionColor = child.options.color;
                annotatedPose.annotation.visionSize = child.options.size;
              });
              visionTargets = visionTargets.concat(newVisionTargets);
              break;
            }

            case "swerveStates":
            case "swerveStatesLegacy": {
              let numberArrayUnits: "radians" | "degrees" = "radians";
              if ("units" in child.options) {
                numberArrayUnits = child.options.units === "degrees" ? "degrees" : "radians";
              }
              let states = grabSwerveStates(
                window.log,
                child.logKey,
                child.logType,
                time!,
                child.options.arrangement,
                numberArrayUnits,
                this.UUID
              );
              swerveStates.push({
                values: states,
                color: child.options.color
              });
              break;
            }

            case "aprilTagIDs": {
              let values: number[] = getOrDefault(
                window.log,
                child.logKey,
                LoggableType.NumberArray,
                time!,
                [],
                this.UUID
              );
              let tagCount = source.options.family === "36h11" ? APRIL_TAG_36H11_COUNT : APRIL_TAG_16H5_COUNT;
              values.forEach((id) => {
                id = clampValue(Math.floor(id), 0, tagCount - 1);
                let index = poses.findIndex((value) => value.annotation.aprilTagId === undefined);
                if (index !== -1) {
                  poses[index].annotation.aprilTagId = id;
                }
              });
              break;
            }
          }
        });
      }
      let mechanism = mechanisms.length === 0 ? null : mergeMechanismStates(mechanisms);
      visionTargets.reverse();
      swerveStates.reverse();

      // Add object
      switch (source.type) {
        case "robot":
        case "robotLegacy":
          objects.push({
            type: "robot",
            model: source.options.model,
            poses: poses,
            components: components,
            mechanism: mechanism,
            visionTargets: visionTargets,
            swerveStates: swerveStates
          });
          break;
        case "ghost":
        case "ghostLegacy":
        case "ghostZebra":
          objects.push({
            type: "ghost",
            color: source.options.color,
            model: source.options.model,
            poses: poses,
            components: components,
            mechanism: mechanism,
            visionTargets: visionTargets,
            swerveStates: swerveStates
          });
          break;
        case "gamePiece":
        case "gamePieceLegacy":
          objects.push({
            type: "gamePiece",
            variant: source.options.variant,
            poses: poses
          });
          break;
        case "trajectory":
        case "trajectoryLegacy":
          objects.push({
            type: "trajectory",
            color: source.options.color,
            size: source.options.size,
            poses: poses
          });
          break;
        case "heatmap":
        case "heatmapLegacy":
          objects.push({
            type: "heatmap",
            poses: poses
          });
          break;
        case "aprilTag":
        case "aprilTagLegacy":
          let familyRaw = source.options.family;
          let family: "36h11" | "16h5" = familyRaw === "36h11" || familyRaw === "16h5" ? familyRaw : "36h11";
          objects.push({
            type: "aprilTag",
            poses: poses,
            family: family
          });
          break;
        case "axes":
        case "axesLegacy":
          objects.push({
            type: "axes",
            poses: poses
          });
          break;
        case "cone":
        case "coneLegacy":
          let positionRaw = source.options.position;
          let position: "center" | "back" | "front" =
            positionRaw === "center" || positionRaw === "back" || positionRaw === "front" ? positionRaw : "center";
          objects.push({
            type: "cone",
            color: source.options.color,
            position: position,
            poses: poses
          });
          break;
        case "cameraOverride":
        case "cameraOverrideLegacy":
          if (cameraOverride === null) {
            cameraOverride = poses[0];
          }
          break;
        case "zebra":
          objects.push({
            type: "zebra",
            poses: poses
          });
          break;
      }
    }

    // Get all robot models
    let allRobotModels: Set<string> = new Set();
    let allSources = this.sourceList.getState();
    allSources.forEach((source) => {
      if (["robot", "robotLegacy", "ghost", "ghostLegacy", "ghostZebra"].includes(source.type)) {
        allRobotModels.add(source.options.model);
      }
    });

    return {
      game: this.GAME_SELECT.value,
      origin: origin,
      objects: objects,
      cameraOverride: cameraOverride,
      autoDriverStation: getDriverStation(window.log, time!),
      allRobotModels: [...allRobotModels]
    };
  }
}
