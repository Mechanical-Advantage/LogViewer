import { Encoder } from "@msgpack/msgpack";
import fs from "fs";
import http from "http";
import { networkInterfaces } from "os";
import path from "path";
import { WebSocketServer } from "ws";
import { AdvantageScopeAssets } from "../shared/AdvantageScopeAssets";
import { ThreeDimensionRendererCommand } from "../shared/renderers/ThreeDimensionRenderer";
import { XRSettings } from "../shared/XRSettings";
import { XR_SERVER_PORT, XR_URL_PREFIX } from "./Constants";

export namespace XRServer {
  let httpServer: http.Server | null = null;
  let wsServer: WebSocketServer | null = null;
  let xrSettings: XRSettings | null = null;
  const msgpackEncoder = new Encoder();
  export let assetsSupplier: () => AdvantageScopeAssets;

  export function getQRText(): string {
    const interfaces = networkInterfaces();
    let ipAddresses: Set<string> = new Set();
    Object.values(interfaces).forEach((addressSet) => {
      if (addressSet === undefined) return;
      addressSet.forEach((addressData) => {
        if (!addressData.internal && addressData.family === "IPv4") {
          ipAddresses.add(addressData.address);
        }
      });
    });
    return XR_URL_PREFIX + Array.from(ipAddresses).join("_");
  }

  export function start() {
    // Create HTTP server
    httpServer = http
      .createServer(async (request, response) => {
        if (request.url !== undefined) {
          let url: URL;
          try {
            url = new URL("http://localhost" + request.url);
          } catch {
            response.writeHead(400, { "Content-Type": "text/html" });
            response.end("Bad request");
            return;
          }
          switch (url.pathname) {
            case "/":
              response.writeHead(200, { "Content-Type": "text/html" });
              response.end(fs.readFileSync(path.join(__dirname, "../www/xrClient.html"), { encoding: "utf-8" }));
              return;
            case "/index.css":
              response.writeHead(200, { "Content-Type": "text/css" });
              response.end(fs.readFileSync(path.join(__dirname, "../www/xrClient.css"), { encoding: "utf-8" }));
              return;
            case "/index.js":
              response.writeHead(200, { "Content-Type": "text/javascript" });
              response.end(fs.readFileSync(path.join(__dirname, "../bundles/xrClient.js"), { encoding: "utf-8" }));
              return;
            case "/loadField.js":
              response.writeHead(200, { "Content-Type": "text/javascript" });
              response.end(
                fs.readFileSync(path.join(__dirname, "../bundles/xrClient$loadField.js"), { encoding: "utf-8" })
              );
              return;
            case "/loadRobot.js":
              response.writeHead(200, { "Content-Type": "text/javascript" });
              response.end(
                fs.readFileSync(path.join(__dirname, "../bundles/xrClient$loadRobot.js"), { encoding: "utf-8" })
              );
              return;
            case "/asset":
              let assetPath = url.searchParams.get("path");
              if (assetPath === null) {
                response.writeHead(400);
                response.end("Asset path not provided");
                return;
              }

              // Clean requested path
              if (!assetPath!.endsWith(".glb")) {
                response.writeHead(400);
                response.end("Asset path is invalid");
                return;
              }
              let assetPathSimplified = assetPath!.substring(0, assetPath!.length - ".glb".length);
              while (
                assetPathSimplified.length > 0 &&
                !isNaN(Number(assetPathSimplified[assetPathSimplified.length - 1]))
              ) {
                assetPathSimplified = assetPathSimplified.substring(0, assetPathSimplified.length - 1);
              }
              if (assetPathSimplified.endsWith("_")) {
                assetPathSimplified = assetPathSimplified.substring(0, assetPathSimplified.length - 1);
              }

              // Check if path is for a valid 3D asset
              // (Prevent requests for other files)
              let allAssets = assetsSupplier();
              let isValid = false;
              [...allAssets.field3ds, ...allAssets.robots].forEach((fieldConfig) => {
                let referencePathNoExtension = fieldConfig.path.substring(0, fieldConfig.path!.length - ".glb".length);
                if (assetPathSimplified === referencePathNoExtension) {
                  isValid = true;
                }
              });
              if (!isValid) {
                response.writeHead(400);
                response.end("Asset path is invalid");
                return;
              }

              // Read file
              response.writeHead(200, { "Content-Type": "application/octet-stream" });
              response.end(fs.readFileSync(decodeURIComponent(assetPath)));
              return;
          }
        }

        response.writeHead(404);
        response.end("Not found");
      })
      .listen(XR_SERVER_PORT);

    // Create WebSocket server
    wsServer = new WebSocketServer({ server: httpServer, path: "/ws" });
  }

  export function stop() {
    httpServer?.close();
    wsServer?.close();
    xrSettings = null;
  }

  export function setXRSettings(settings: XRSettings) {
    xrSettings = settings;
  }

  export function setHubCommand(command: ThreeDimensionRendererCommand, assets: AdvantageScopeAssets) {
    if (xrSettings === null) return;
    let message = msgpackEncoder.encode({
      settings: xrSettings,
      command: command,
      assets: assets
    });
    wsServer?.clients.forEach((client) => {
      client.send(message);
    });
  }
}
