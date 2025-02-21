import { NeonColors, NeonColors_RedStart } from "../../shared/Colors";
import { SourceListConfig } from "../../shared/SourceListConfig";
import { SwerveArrangementValues } from "./SwerveController_Config";

const ThreeDimensionController_Config: SourceListConfig = {
  title: "Poses",
  autoAdvance: true,
  allowChildrenFromDrag: false,
  typeMemoryId: "threeDimension",
  types: [
    {
      key: "robot",
      display: "Robot",
      symbol: "location.fill",
      showInTypeName: false,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: [
        "Pose2d",
        "Pose3d",
        "Pose2d[]",
        "Pose3d[]",
        "Transform2d",
        "Transform3d",
        "Transform2d[]",
        "Transform3d[]",
        "ZebraTranslation"
      ],
      showDocs: true,
      options: [
        {
          key: "model",
          display: "Model",
          showInTypeName: true,
          values: []
        }
      ],
      initialSelectionOption: "model",
      parentKey: "robot",
      previewType: "Pose3d"
    },
    {
      key: "robotLegacy",
      display: "Robot",
      symbol: "location.fill",
      showInTypeName: false,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "model",
          display: "Model",
          showInTypeName: true,
          values: []
        },
        {
          key: "format",
          display: "Format",
          showInTypeName: false,
          values: [
            { key: "Pose2d", display: "2D Pose(s)" },
            { key: "Pose3d", display: "3D Pose(s)" },
            { key: "Translation2d", display: "2D Translation(s)" },
            { key: "Translation3d", display: "3D Translation(s)" }
          ]
        },
        {
          key: "units",
          display: "Rotation Units",
          showInTypeName: false,
          values: [
            { key: "radians", display: "Radians" },
            { key: "degrees", display: "Degrees" }
          ]
        }
      ],
      initialSelectionOption: "model",
      numberArrayDeprecated: true,
      parentKey: "robot",
      previewType: "Pose3d"
    },
    {
      key: "ghost",
      display: "Ghost",
      symbol: "location.fill.viewfinder",
      showInTypeName: true,
      color: "color",
      sourceTypes: [
        "Pose2d",
        "Pose3d",
        "Pose2d[]",
        "Pose3d[]",
        "Transform2d",
        "Transform3d",
        "Transform2d[]",
        "Transform3d[]",
        "ZebraTranslation"
      ],
      showDocs: true,
      options: [
        {
          key: "model",
          display: "Model",
          showInTypeName: true,
          values: []
        },
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors
        }
      ],
      initialSelectionOption: "model",
      parentKey: "robot",
      previewType: "Pose3d"
    },
    {
      key: "ghostLegacy",
      display: "Ghost",
      symbol: "location.fill.viewfinder",
      showInTypeName: true,
      color: "color",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "model",
          display: "Model",
          showInTypeName: true,
          values: []
        },
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors
        },
        {
          key: "format",
          display: "Format",
          showInTypeName: false,
          values: [
            { key: "Pose2d", display: "2D Pose(s)" },
            { key: "Pose3d", display: "3D Pose(s)" },
            { key: "Translation2d", display: "2D Translation(s)" },
            { key: "Translation3d", display: "3D Translation(s)" }
          ]
        },
        {
          key: "units",
          display: "Rotation Units",
          showInTypeName: false,
          values: [
            { key: "radians", display: "Radians" },
            { key: "degrees", display: "Degrees" }
          ]
        }
      ],
      initialSelectionOption: "model",
      parentKey: "robot",
      numberArrayDeprecated: true,
      previewType: "Pose3d"
    },
    {
      key: "component",
      display: "Component",
      symbol: "puzzlepiece.extension.fill",
      showInTypeName: true,
      color: "#9370db",
      sourceTypes: ["Pose3d", "Pose3d[]", "Transform3d", "Transform3d[]"],
      showDocs: true,
      options: [],
      childOf: "robot",
      previewType: "Pose3d"
    },
    {
      key: "componentLegacy",
      display: "Component",
      symbol: "puzzlepiece.extension.fill",
      showInTypeName: true,
      color: "#9370db",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [],
      childOf: "robot",
      numberArrayDeprecated: true,
      previewType: "Pose3d"
    },
    {
      key: "mechanism",
      display: "Mechanism",
      symbol: "gearshape.fill",
      showInTypeName: true,
      color: "#888888",
      sourceTypes: ["Mechanism2d"],
      showDocs: true,
      options: [
        {
          key: "axis",
          display: "Axis",
          showInTypeName: true,
          values: [
            { key: "x", display: "XZ axis" },
            { key: "y", display: "YZ axis" }
          ]
        }
      ],
      childOf: "robot"
    },
    {
      key: "vision",
      display: "Vision Target",
      symbol: "scope",
      showInTypeName: true,
      color: "color",
      sourceTypes: [
        "Pose2d",
        "Pose3d",
        "Pose2d[]",
        "Pose3d[]",
        "Transform2d",
        "Transform3d",
        "Transform2d[]",
        "Transform3d[]",
        "Translation2d",
        "Translation3d",
        "Translation2d[]",
        "Translation3d[]"
      ],
      showDocs: true,
      options: [
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors
        },
        {
          key: "size",
          display: "Thickness",
          showInTypeName: false,
          values: [
            { key: "normal", display: "Normal" },
            { key: "bold", display: "Bold" }
          ]
        }
      ],
      childOf: "robot",
      previewType: "Translation3d"
    },
    {
      key: "visionLegacy",
      display: "Vision Target",
      symbol: "scope",
      showInTypeName: true,
      color: "color",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors
        },
        {
          key: "size",
          display: "Thickness",
          showInTypeName: false,
          values: [
            { key: "normal", display: "Normal" },
            { key: "bold", display: "Bold" }
          ]
        },
        {
          key: "format",
          display: "Format",
          showInTypeName: false,
          values: [
            { key: "Pose2d", display: "2D Pose(s)" },
            { key: "Pose3d", display: "3D Pose(s)" },
            { key: "Translation2d", display: "2D Translation(s)" },
            { key: "Translation3d", display: "3D Translation(s)" }
          ]
        }
      ],
      numberArrayDeprecated: true,
      childOf: "robot",
      previewType: "Translation3d"
    },
    {
      key: "swerveStates",
      display: "Swerve States",
      symbol: "arrow.up.left.and.down.right.and.arrow.up.right.and.down.left",
      showInTypeName: true,
      color: "color",
      sourceTypes: ["SwerveModuleState[]"],
      showDocs: true,
      options: [
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors_RedStart
        },
        {
          key: "arrangement",
          display: "Arrangement",
          showInTypeName: false,
          values: SwerveArrangementValues
        }
      ],
      initialSelectionOption: "color",
      childOf: "robot",
      previewType: "SwerveModuleState[]"
    },
    {
      key: "swerveStatesLegacy",
      display: "Swerve States",
      symbol: "arrow.up.left.and.down.right.and.arrow.up.right.and.down.left",
      showInTypeName: true,
      color: "color",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors_RedStart
        },
        {
          key: "arrangement",
          display: "Arrangement",
          showInTypeName: false,
          values: SwerveArrangementValues
        },
        {
          key: "units",
          display: "Rotation Units",
          showInTypeName: false,
          values: [
            { key: "radians", display: "Radians" },
            { key: "degrees", display: "Degrees" }
          ]
        }
      ],
      initialSelectionOption: "color",
      numberArrayDeprecated: true,
      childOf: "robot",
      previewType: "SwerveModuleState[]"
    },
    {
      key: "rotationOverride",
      display: "Rotation Override",
      symbol: "angle",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["Rotation2d", "Rotation3d"],
      showDocs: true,
      options: [],
      childOf: "robot",
      previewType: "Rotation3d"
    },
    {
      key: "rotationOverrideLegacy",
      display: "Rotation Override",
      symbol: "angle",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["Number"],
      showDocs: false,
      options: [
        {
          key: "units",
          display: "Rotation Units",
          showInTypeName: false,
          values: [
            { key: "radians", display: "Radians" },
            { key: "degrees", display: "Degrees" }
          ]
        }
      ],
      childOf: "robot",
      previewType: "Rotation3d"
    },
    {
      key: "gamePiece",
      display: "Game Piece",
      symbol: "star.fill",
      showInTypeName: false,
      color: "#ffd700",
      sourceTypes: ["Pose3d", "Pose3d[]", "Transform3d", "Transform3d[]", "Translation3d", "Translation3d[]"],
      showDocs: true,
      options: [
        {
          key: "variant",
          display: "Variant",
          showInTypeName: true,
          values: [
            { key: "Note", display: "Note" },
            { key: "High Note", display: "High Note" }
          ]
        }
      ],
      initialSelectionOption: "variant",
      previewType: "Pose3d"
    },
    {
      key: "gamePieceLegacy",
      display: "Game Piece",
      symbol: "star.fill",
      showInTypeName: false,
      color: "#ffd700",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "variant",
          display: "Variant",
          showInTypeName: true,
          values: [
            { key: "Note", display: "Note" },
            { key: "High Note", display: "High Note" }
          ]
        },
        {
          key: "format",
          display: "Format",
          showInTypeName: false,
          values: [
            { key: "Pose3d", display: "3D Pose(s)" },
            { key: "Translation3d", display: "3D Translation(s)" }
          ]
        }
      ],
      initialSelectionOption: "variant",
      numberArrayDeprecated: true,
      previewType: "Pose3d"
    },
    {
      key: "trajectory",
      display: "Trajectory",
      symbol: "point.bottomleft.forward.to.point.topright.scurvepath.fill",
      showInTypeName: true,
      color: "color",
      sourceTypes: [
        "Pose2d[]",
        "Pose3d[]",
        "Transform2d[]",
        "Transform3d[]",
        "Translation2d[]",
        "Translation3d[]",
        "SwerveSample[]",
        "DifferentialSample[]",
        "Trajectory"
      ],
      showDocs: true,
      options: [
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors
        },
        {
          key: "size",
          display: "Thickness",
          showInTypeName: false,
          values: [
            { key: "normal", display: "Normal" },
            { key: "bold", display: "Bold" }
          ]
        }
      ],
      previewType: "Translation3d"
    },
    {
      key: "trajectoryLegacy",
      display: "Trajectory",
      symbol: "point.bottomleft.forward.to.point.topright.scurvepath.fill",
      showInTypeName: true,
      color: "color",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors
        },
        {
          key: "size",
          display: "Thickness",
          showInTypeName: false,
          values: [
            { key: "normal", display: "Normal" },
            { key: "bold", display: "Bold" }
          ]
        },
        {
          key: "format",
          display: "Format",
          showInTypeName: false,
          values: [
            { key: "Pose2d", display: "2D Pose(s)" },
            { key: "Pose3d", display: "3D Pose(s)" },
            { key: "Translation2d", display: "2D Translation(s)" },
            { key: "Translation3d", display: "3D Translation(s)" }
          ]
        }
      ],
      numberArrayDeprecated: true,
      previewType: "Translation3d"
    },
    {
      key: "heatmap",
      display: "Heatmap",
      symbol: "map.fill",
      showInTypeName: true,
      color: "#ff0000",
      sourceTypes: [
        "Pose2d",
        "Pose3d",
        "Pose2d[]",
        "Pose3d[]",
        "Transform2d",
        "Transform3d",
        "Transform2d[]",
        "Transform3d[]",
        "Translation2d",
        "Translation3d",
        "Translation2d[]",
        "Translation3d[]",
        "ZebraTranslation"
      ],
      showDocs: true,
      options: [
        {
          key: "timeRange",
          display: "Time Range",
          showInTypeName: false,
          values: [
            { key: "enabled", display: "Enabled" },
            { key: "auto", display: "Auto" },
            { key: "teleop", display: "Teleop" },
            { key: "teleop-no-endgame", display: "Teleop (No Endgame)" },
            { key: "full", display: "Full Log" },
            { key: "visible", display: "Visible Range" }
          ]
        }
      ],
      initialSelectionOption: "timeRange",
      previewType: null
    },
    {
      key: "heatmapLegacy",
      display: "Heatmap",
      symbol: "map.fill",
      showInTypeName: true,
      color: "#ff0000",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "timeRange",
          display: "Time Range",
          showInTypeName: false,
          values: [
            { key: "enabled", display: "Enabled" },
            { key: "auto", display: "Auto" },
            { key: "teleop", display: "Teleop" },
            { key: "teleop-no-endgame", display: "Teleop (No Endgame)" },
            { key: "full", display: "Full Log" },
            { key: "visible", display: "Visible Range" }
          ]
        },
        {
          key: "format",
          display: "Format",
          showInTypeName: false,
          values: [
            { key: "Pose2d", display: "2D Pose(s)" },
            { key: "Pose3d", display: "3D Pose(s)" },
            { key: "Translation2d", display: "2D Translation(s)" },
            { key: "Translation3d", display: "3D Translation(s)" }
          ]
        }
      ],
      initialSelectionOption: "timeRange",
      numberArrayDeprecated: true,
      previewType: null
    },
    {
      key: "aprilTag",
      display: "AprilTag",
      symbol: "qrcode",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["Pose3d", "Pose3d[]", "Transform3d", "Transform3d[]", "Trajectory"],
      showDocs: true,
      options: [
        {
          key: "family",
          display: "Family",
          showInTypeName: true,
          values: [
            { key: "36h11", display: "36h11" },
            { key: "16h5", display: "16h5" }
          ]
        }
      ],
      parentKey: "aprilTag",
      initialSelectionOption: "family",
      previewType: "Pose3d"
    },
    {
      key: "aprilTagLegacy",
      display: "AprilTag",
      symbol: "qrcode",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "family",
          display: "Family",
          showInTypeName: true,
          values: [
            { key: "36h11", display: "36h11" },
            { key: "16h5", display: "16h5" }
          ]
        }
      ],
      numberArrayDeprecated: true,
      parentKey: "aprilTag",
      initialSelectionOption: "family",
      previewType: "Pose3d"
    },
    {
      key: "aprilTagIDs",
      display: "AprilTag IDs",
      symbol: "number",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["NumberArray"],
      showDocs: true,
      options: [],
      childOf: "aprilTag",
      previewType: null
    },
    {
      key: "axes",
      display: "Axes",
      symbol: "move.3d",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["Pose3d", "Pose3d[]", "Transform3d", "Transform3d[]", "Trajectory"],
      showDocs: true,
      options: [],
      previewType: "Pose3d"
    },
    {
      key: "axesLegacy",
      display: "Axes",
      symbol: "move.3d",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [],
      numberArrayDeprecated: true,
      previewType: "Pose3d"
    },
    {
      key: "cone",
      display: "Cone",
      symbol: "cone.fill",
      showInTypeName: true,
      color: "color",
      sourceTypes: [
        "Pose2d",
        "Pose3d",
        "Pose2d[]",
        "Pose3d[]",
        "Transform2d",
        "Transform3d",
        "Transform2d[]",
        "Transform3d[]",
        "Trajectory"
      ],
      showDocs: true,
      options: [
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors
        },
        {
          key: "position",
          display: "Position",
          showInTypeName: true,
          values: [
            { key: "center", display: "Center" },
            { key: "back", display: "Back" },
            { key: "front", display: "Front" }
          ]
        }
      ],
      initialSelectionOption: "color",
      previewType: "Pose3d"
    },
    {
      key: "coneLegacy",
      display: "Cone",
      symbol: "cone.fill",
      showInTypeName: true,
      color: "color",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [
        {
          key: "color",
          display: "Color",
          showInTypeName: false,
          values: NeonColors
        },
        {
          key: "position",
          display: "Position",
          showInTypeName: true,
          values: [
            { key: "center", display: "Center" },
            { key: "back", display: "Back" },
            { key: "front", display: "Front" }
          ]
        },
        {
          key: "format",
          display: "Format",
          showInTypeName: false,
          values: [
            { key: "Pose2d", display: "2D Pose(s)" },
            { key: "Pose3d", display: "3D Pose(s)" },
            { key: "Translation2d", display: "2D Translation(s)" },
            { key: "Translation3d", display: "3D Translation(s)" }
          ]
        },
        {
          key: "units",
          display: "Rotation Units",
          showInTypeName: false,
          values: [
            { key: "radians", display: "Radians" },
            { key: "degrees", display: "Degrees" }
          ]
        }
      ],
      initialSelectionOption: "color",
      numberArrayDeprecated: true,
      previewType: "Pose3d"
    },
    {
      key: "cameraOverride",
      display: "Camera Override",
      symbol: "camera.fill",
      showInTypeName: true,
      color: "#888888",
      sourceTypes: ["Pose3d", "Transform3d"],
      showDocs: true,
      options: [],
      previewType: "Pose3d"
    },
    {
      key: "cameraOverrideLegacy",
      display: "Camera Override",
      symbol: "camera.fill",
      showInTypeName: true,
      color: "#888888",
      sourceTypes: ["NumberArray"],
      showDocs: false,
      options: [],
      numberArrayDeprecated: true,
      previewType: "Pose3d"
    },
    {
      key: "zebra",
      display: "Zebra Marker",
      symbol: "mappin.circle.fill",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["ZebraTranslation"],
      showDocs: true,
      options: [],
      previewType: "Translation2d"
    }
  ]
};

export default ThreeDimensionController_Config;
