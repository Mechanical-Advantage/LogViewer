import { dialog } from "electron";
import express from "express";
import { StreamSettings } from "../shared/renderers/ThreeDimensionRendererImpl";

export class MJPEGServer {
  private static latestFrames: Map<string, string | null> = new Map();
  private static serverPort: number | null = null;

  /** Updates active streams */
  public static updateStreamIds(oldStream: StreamSettings, newStream: StreamSettings): void {
    // delete oldstream if has become disabled
    if (!newStream.streamEnable && this.latestFrames.has(oldStream.streamId)) {
      this.latestFrames.delete(oldStream.streamId);
    }
    if (oldStream.streamId !== newStream.streamId) {
      if (this.latestFrames.has(oldStream.streamId)) {
        this.latestFrames.delete(oldStream.streamId);
      }
      // If the new stream exists, warn that it's already in use
      if (this.latestFrames.has(newStream.streamId)) {
        dialog.showMessageBox({
          type: "warning",
          title: "MJPEG Server",
          message: `Stream ID ${newStream.streamId} is already in use. The new stream will conflict with the old one. Please set a different stream ID.`
        });
      }
    }
  }

  /** Updates the latest frame for a stream */
  public static update(stream_id: string, frame: string | null): void {
    this.startIfNotStarted();
    this.latestFrames.set(stream_id, frame);
  }

  /** Starts an express server for serving MJPEG streams */
  private static startIfNotStarted(): void {
    if (this.serverPort === null) {
      const app = express();

      const startServer = (port: number) => {
        const server = app.listen(port, () => {
          console.log(`MJPEG server running at http://localhost:${port}/`);
          this.serverPort = port;

          dialog.showMessageBox({
            type: "info",
            title: "MJPEG Server",
            message: `MJPEG server running at http://localhost:${port}/<stream_id>.\n\nYou can use this URL to view streams in a browser or other MJPEG-compatible viewer.\n\nTo stop the server, close AdvantageScope.`
          });
        });

        server.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            if (port < 1189) {
              console.warn(`Port ${port} in use, trying port ${port + 1}...`);
              startServer(port + 1); // Try the next port
            } else {
              console.error("Failed to start MJPEG server: All ports in range are in use.");
            }
          } else {
            console.error("Failed to start MJPEG server:", err);
          }
        });
      };
      app.get("/", (req, res) => {
        const stream_ids = Array.from(this.latestFrames.keys());
        res.send(
          "<h1>AdvantageScope MJPEG Server</h1><p>Currently active streams:</p><ul>" +
            stream_ids.map((stream_id) => `<li><a href="/${stream_id}">${stream_id}</a></li>`).join("") +
            "</ul>"
        );
      });

      app.get("/:stream_id", (req, res) => {
        const fps = req.query.fps ? Number(req.query.fps) : 30;

        res.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=frame");

        const sendFrame = () => {
          // Check if the stream is still active
          if (this.latestFrames.has(req.params.stream_id) && this.latestFrames.get(req.params.stream_id) !== null) {
            // Extract base64 data
            const base64Data = this.latestFrames.get(req.params.stream_id)!.split(",")[1];

            // Convert to binary buffer
            const imageBuffer = Buffer.from(base64Data, "base64");

            // Write MJPEG frame
            res.write(`--frame\r\n`);
            res.write(`Content-Type: image/jpeg\r\n`);
            res.write(`Content-Length: ${imageBuffer.length}\r\n\r\n`);
            res.write(imageBuffer);
            res.write(`\r\n`);
          } else {
            // Write empty frame
            res.write(`--frame\r\n`);
            res.write(`Content-Type: image/jpeg\r\n`);
            res.write(`Content-Length: 0\r\n\r\n`);
          }

          // Schedule next frame
          setTimeout(sendFrame, 1000 / fps);
        };

        sendFrame();

        // Handle client disconnect
        res.on("close", () => {
          res.end();
        });
      });

      // Start from port 1181
      startServer(1181);
    }
  }
}
