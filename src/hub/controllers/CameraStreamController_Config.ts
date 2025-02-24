import { SourceListConfig } from "../../shared/SourceListConfig";

const CameraStreamController_Config: SourceListConfig = {
  title: "Sources",
  autoAdvance: false,
  allowChildrenFromDrag: false,
  typeMemoryId: "camerastream",
  types: [
    {
      key: "stream",
      display: "Camera Stream",
      symbol: "camera.fill",
      showInTypeName: true,
      color: "#000000",
      darkColor: "#ffffff",
      sourceTypes: ["String"],
      showDocs: true,
      options: [],
      previewType: null
    }
  ]
};

export default CameraStreamController_Config;
