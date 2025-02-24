import TabRenderer from "./TabRenderer";

export default class CameraStreamRenderer implements TabRenderer {
  private VIEWER_CONTAINER: HTMLDivElement;
  private VIEWERS: HTMLDivElement[] = [];

  constructor(root: HTMLElement) {
    this.VIEWER_CONTAINER = root.getElementsByClassName("camerastream-container")[0] as HTMLDivElement;
    this.VIEWERS = [];
  }

  getAspectRatio(): number | null {
    return null;
  }

  private clearStreams(): void {
    this.VIEWERS.forEach((stream) => {
      let img = stream.getElementsByTagName("img")[0]; // Stop loading the image
      img.src = "";
      stream.remove();
    });
    this.VIEWERS = [];
  }

  render(command: CameraStreamRendererCommand): void {
    if (this.VIEWER_CONTAINER.style.gridTemplateColumns !== `repeat(${command.columns}, 1fr)`) {
      this.VIEWER_CONTAINER.style.gridTemplateColumns = `repeat(${command.columns}, 1fr)`;
    }
    if (
      this.VIEWER_CONTAINER.style.gridTemplateRows !==
      `repeat(${Math.ceil(command.streams.length / command.columns)}, minmax(0, 1fr))`
    ) {
      this.VIEWER_CONTAINER.style.gridTemplateRows = `repeat(${Math.ceil(
        command.streams.length / command.columns
      )}, minmax(0, 1fr))`;
    }

    var streamsChanged = false;

    if (this.VIEWERS.length !== command.streams.length) {
      // Index mismatch
      streamsChanged = true;
    } else {
      // We check one by one if the streams have changed
      this.VIEWERS.forEach((stream, index) => {
        let span = stream.getElementsByTagName("span")[0];
        if (span.textContent !== command.streams[index].url) {
          streamsChanged = true;
        }
      });
    }

    if (streamsChanged) {
      this.clearStreams();

      // Add new streams
      command.streams.forEach((stream) => {
        let viewer = this.VIEWER_CONTAINER.appendChild(document.createElement("div"));
        viewer.className = "camerastream-viewer";
        let sourceText = viewer.appendChild(document.createElement("p"));
        sourceText.textContent = stream.source;
        let img = viewer.appendChild(document.createElement("img"));
        img.src = stream.url;
        img.onerror = () => {
          img.src = "symbols/exclamationmark.triangle.fill.svg";
        };
        // add a hidden span to store the full url
        let urlSpan = viewer.appendChild(document.createElement("span"));
        urlSpan.textContent = stream.url;
        urlSpan.style.display = "none";

        this.VIEWERS.push(viewer);
      });
    }
  }

  saveState(): unknown {
    return null;
  }

  restoreState(state: unknown): void {}
}

export type CameraStream = {
  url: string;
  source: string;
};

export type CameraStreamRendererCommand = {
  streams: CameraStream[];
  columns: number;
};
