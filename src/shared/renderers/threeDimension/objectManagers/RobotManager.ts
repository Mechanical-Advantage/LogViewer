import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import WorkerManager from "../../../../hub/WorkerManager";
import { AdvantageScopeAssets } from "../../../AdvantageScopeAssets";
import { SwerveState } from "../../../geometry";
import { convert } from "../../../units";
import { transformPx } from "../../../util";
import {
  ThreeDimensionRendererCommand_GhostObj,
  ThreeDimensionRendererCommand_RobotObj
} from "../../ThreeDimensionRenderer";
import {
  getQuaternionFromRotSeq,
  quaternionToRotation3d,
  rotation3dToQuaternion
} from "../../ThreeDimensionRendererImpl";
import ObjectManager from "../ObjectManager";
import { XR_MAX_RADIUS } from "../OptimizeGeometries";
import ResizableInstancedMesh from "../ResizableInstancedMesh";

export default class RobotManager extends ObjectManager<
  ThreeDimensionRendererCommand_RobotObj | ThreeDimensionRendererCommand_GhostObj
> {
  private SWERVE_CANVAS_PX = 1000;
  private SWERVE_CANVAS_METERS = 3;
  private SWERVE_BUMPER_OFFSET = 0.15;
  private MECHANISM_WIDTH_PER_WEIGHT = 0.01;

  private loadingStart: () => void;
  private loadingEnd: () => void;

  private meshes: ResizableInstancedMesh[] = [];
  private dimensions: [number, number, number, number] = [0, 0, 0, 0]; // Distance to each side
  private ghostMaterial = new THREE.MeshPhongMaterial({
    transparent: true,
    opacity: 0.35,
    specular: this.materialSpecular,
    shininess: this.materialShininess
  });
  private visionLines: Line2[] = [];
  private mechanismLines: {
    mesh: ResizableInstancedMesh;
    geometry: THREE.BoxGeometry;
    scale: THREE.Vector3;
    translation: THREE.Vector3;
    material: THREE.MeshPhongMaterial;
  }[] = [];

  private swerveContainer: HTMLElement | null = null;
  private swerveCanvas: HTMLCanvasElement | null = null;
  private swerveTexture: THREE.CanvasTexture | null = null;

  private loadingCounter = 0;
  private shouldLoadNewModel = false;
  private isLoading = false;
  private dummyConfigPose = new THREE.Object3D();
  private dummyUserPose = new THREE.Group().add(this.dummyConfigPose);
  private dummyRobotPose = new THREE.Group().add(this.dummyUserPose);
  private assetsOverride: AdvantageScopeAssets | null = null;
  private hideRobotModels = false;
  private hasNewAssets = false;
  private lastModel = "";
  private lastColor = "";
  private lastHadSwerveStates = false;
  private lastHideRobotModels = false;

  constructor(
    root: THREE.Object3D,
    materialSpecular: THREE.Color,
    materialShininess: number,
    mode: "low-power" | "standard" | "cinematic",
    isXR: boolean,
    requestRender: () => void,
    loadingStart: () => void,
    loadingEnd: () => void
  ) {
    super(root, materialSpecular, materialShininess, mode, isXR, requestRender);
    this.loadingStart = loadingStart;
    this.loadingEnd = loadingEnd;

    if (!isXR) {
      this.swerveContainer = document.createElement("div");
      this.swerveCanvas = document.createElement("canvas");
      this.swerveTexture = new THREE.CanvasTexture(this.swerveCanvas);

      this.swerveContainer.hidden = true;
      this.swerveContainer.appendChild(this.swerveCanvas);
      this.swerveContainer.style.width = this.SWERVE_CANVAS_PX.toString() + "px";
      this.swerveContainer.style.height = this.SWERVE_CANVAS_PX.toString() + "px";
      this.swerveCanvas.width = this.SWERVE_CANVAS_PX;
      this.swerveCanvas.height = this.SWERVE_CANVAS_PX;
      document.body.appendChild(this.swerveContainer);
    }
  }

  dispose(): void {
    this.meshes.forEach((mesh) => {
      mesh.dispose();
    });
    this.mechanismLines.forEach((entry) => {
      entry.mesh.dispose();
    });
    while (this.visionLines.length > 0) {
      this.visionLines[0].geometry.dispose();
      this.visionLines[0].material.dispose();
      this.root.remove(this.visionLines[0]);
      this.visionLines.shift();
    }
    this.swerveTexture?.dispose();
    if (!this.isXR) {
      document.body.removeChild(this.swerveContainer!);
    }
  }

  setResolution(resolution: THREE.Vector2) {
    super.setResolution(resolution);
    this.visionLines.forEach((line) => (line.material.resolution = resolution));
  }

  newAssets() {
    this.hasNewAssets = true;
  }

  setAssetsOverride(assets: AdvantageScopeAssets | null) {
    this.assetsOverride = assets;
  }

  setHideRobotModels(hide: boolean) {
    this.hideRobotModels = hide;
  }

  getModel(): string {
    return this.lastModel;
  }

  setObjectData(object: ThreeDimensionRendererCommand_RobotObj | ThreeDimensionRendererCommand_GhostObj): void {
    let assets = this.assetsOverride ?? window.assets;
    let robotConfig = assets?.robots.find((robotData) => robotData.name === object.model);

    // Load new robot model
    if (object.model !== this.lastModel || this.hideRobotModels !== this.lastHideRobotModels || this.hasNewAssets) {
      this.shouldLoadNewModel = true;
      this.lastModel = object.model;
      this.hasNewAssets = false;
      this.lastHideRobotModels = this.hideRobotModels;
    }
    if (this.shouldLoadNewModel && !this.isLoading) {
      this.shouldLoadNewModel = false;
      this.meshes.forEach((mesh) => {
        mesh.dispose();
      });
      this.meshes = [];

      if (robotConfig !== undefined && !this.hideRobotModels) {
        this.loadingCounter++;
        let loadingCounter = this.loadingCounter;
        this.loadingStart();
        if (this.isLoading) this.loadingEnd();
        this.isLoading = true;

        if (this.isXR) {
          // XR, load models directly
          const urlTransformer: (path: string) => string = (url) => "/asset?path=" + encodeURIComponent(url);
          const gltfLoader = new GLTFLoader();
          Promise.all([
            new Promise((resolve) => {
              gltfLoader.load(urlTransformer(robotConfig.path), resolve);
            }),
            ...robotConfig.components.map(
              (_, index) =>
                new Promise((resolve) => {
                  gltfLoader.load(
                    urlTransformer(robotConfig.path.slice(0, -4) + "_" + index.toString() + ".glb"),
                    resolve
                  );
                })
            )
          ]).then(async (gltfs) => {
            if (loadingCounter !== this.loadingCounter) {
              // Model was switched, throw away the data :(
              return;
            }

            this.meshes = [];
            this.dimensions = [0, 0, 0, 0];

            let gltfScenes = (gltfs as GLTF[]).map((gltf) => gltf.scene);
            for (let index = 0; index < gltfScenes.length; index++) {
              let scene = gltfScenes[index];
              if (index === 0) {
                scene.rotation.setFromQuaternion(getQuaternionFromRotSeq(robotConfig.rotations));
                scene.position.set(...robotConfig.position);
              }

              let sceneMeshes: THREE.Mesh[] = [];
              scene.traverse((object) => {
                let mesh = object as THREE.Mesh;
                if (!mesh.isMesh) return;
                if (mesh.material instanceof THREE.MeshStandardMaterial) {
                  mesh.material.metalness = 0;
                  mesh.material.roughness = 1;
                }

                // Check if too small
                let vertices: THREE.Vector3[] = [];
                let center = new THREE.Vector3();
                for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
                  let vertex = new THREE.Vector3(
                    mesh.geometry.attributes.position.getX(i),
                    mesh.geometry.attributes.position.getY(i),
                    mesh.geometry.attributes.position.getZ(i)
                  );
                  vertices.push(vertex);
                  center.add(vertex);
                }
                center.divideScalar(vertices.length);
                let maxRadius = vertices.reduce((prev, vertex) => {
                  let dist = vertex.distanceTo(center);
                  return dist > prev ? dist : prev;
                }, 0);
                let enableSimplification = !robotConfig.disableSimplification && !mesh.name.includes("NOSIMPLIFY");
                if (maxRadius >= XR_MAX_RADIUS || !enableSimplification) {
                  // Apply world matrix to geometry
                  let geometry = mesh.geometry.clone();
                  mesh.updateWorldMatrix(true, false);
                  geometry.applyMatrix4(mesh.matrixWorld);
                  mesh.geometry = geometry;
                  sceneMeshes.push(mesh);
                }
              });

              sceneMeshes.forEach((mesh) => {
                if (index === 0) {
                  mesh.geometry.computeBoundingBox();
                  let box = mesh.geometry.boundingBox;
                  if (box !== null) {
                    this.dimensions[0] = Math.max(this.dimensions[0], box.max.x);
                    this.dimensions[1] = Math.max(this.dimensions[1], box.max.y);
                    this.dimensions[2] = Math.max(this.dimensions[2], -box.min.x);
                    this.dimensions[3] = Math.max(this.dimensions[3], -box.min.y);
                  }
                }

                if (object.type === "ghost") {
                  if (!Array.isArray(mesh.material)) {
                    mesh.material.dispose();
                  }
                  mesh.material = this.ghostMaterial;
                }
              });

              let castShadow = new Array(sceneMeshes.length).fill(true);
              castShadow[castShadow.length - 1] = false;
              this.meshes.push(new ResizableInstancedMesh(this.root, sceneMeshes, castShadow));
            }

            this.requestRender();
            this.loadingEnd();
            this.isLoading = false;
          });
        } else {
          // Desktop, load models with worker and mesh merging
          WorkerManager.request("../bundles/shared$loadRobot.js", {
            robotConfig: robotConfig!,
            mode: this.mode,
            materialSpecular: this.materialSpecular.toArray(),
            materialShininess: this.materialShininess
          }).then((result: THREE.MeshJSON[][]) => {
            if (loadingCounter !== this.loadingCounter) {
              // Model was switched, throw away the data :(
              return;
            }

            const loader = new THREE.ObjectLoader();
            this.meshes = [];
            this.dimensions = [0, 0, 0, 0];

            result.forEach((sceneMeshJSONs, index) => {
              // Load meshes
              let sceneMeshes: THREE.Mesh[] = sceneMeshJSONs.map((json) => loader.parse(json) as THREE.Mesh);
              sceneMeshes.forEach((mesh) => {
                if (index === 0) {
                  mesh.geometry.computeBoundingBox();
                  let box = mesh.geometry.boundingBox;
                  if (box !== null) {
                    this.dimensions[0] = Math.max(this.dimensions[0], box.max.x);
                    this.dimensions[1] = Math.max(this.dimensions[1], box.max.y);
                    this.dimensions[2] = Math.max(this.dimensions[2], -box.min.x);
                    this.dimensions[3] = Math.max(this.dimensions[3], -box.min.y);
                  }
                }

                if (object.type === "ghost") {
                  if (!Array.isArray(mesh.material)) {
                    mesh.material.dispose();
                  }
                  mesh.material = this.ghostMaterial;
                }
              });

              // Add swerve mesh
              if (index === 0) {
                let swerveMesh = new THREE.Mesh(
                  new THREE.PlaneGeometry(this.SWERVE_CANVAS_METERS, this.SWERVE_CANVAS_METERS).translate(0, 0, 0.1),
                  new THREE.MeshPhongMaterial({
                    map: this.swerveTexture,
                    transparent: true,
                    side: THREE.DoubleSide
                  })
                );
                swerveMesh.renderOrder = 999;
                swerveMesh.material.depthTest = false;
                swerveMesh.material.transparent = true;
                sceneMeshes.push(swerveMesh);
              }

              let castShadow = new Array(sceneMeshes.length).fill(true);
              castShadow[castShadow.length - 1] = false;
              this.meshes.push(new ResizableInstancedMesh(this.root, sceneMeshes, castShadow));
            });

            this.requestRender();
            this.loadingEnd();
            this.isLoading = false;
          });
        }
      }
    }

    // Update color
    if (object.type === "ghost" && object.color !== this.lastColor) {
      this.lastColor = object.color;
      this.ghostMaterial.color = new THREE.Color(object.color);
    }

    // Update primary model
    if (this.meshes.length > 0) {
      this.meshes[0].setPoses(object.poses.map((x) => x.pose));
    }

    // Update components
    for (let i = 1; i < this.meshes.length; i++) {
      this.meshes[i].setPoses(
        object.poses
          .map((x) => x.pose)
          .map((robotPose) => {
            this.dummyRobotPose.rotation.setFromQuaternion(rotation3dToQuaternion(robotPose.rotation));
            this.dummyRobotPose.position.set(...robotPose.translation);

            let userPose =
              i - 1 < object.components.length && robotConfig !== undefined ? object.components[i - 1].pose : null;
            if (userPose === null) {
              this.dummyUserPose.rotation.set(0, 0, 0);
              this.dummyUserPose.position.set(0, 0, 0);
            } else {
              this.dummyUserPose.rotation.setFromQuaternion(rotation3dToQuaternion(userPose.rotation));
              this.dummyUserPose.position.set(...userPose.translation);
            }

            let configRotations =
              userPose === null ? robotConfig!.rotations : robotConfig!.components[i - 1].zeroedRotations;
            let configPosition =
              userPose === null ? robotConfig!.position : robotConfig!.components[i - 1].zeroedPosition;
            this.dummyConfigPose.rotation.setFromQuaternion(getQuaternionFromRotSeq(configRotations));
            this.dummyConfigPose.position.set(...configPosition);

            return {
              translation: this.dummyConfigPose.getWorldPosition(new THREE.Vector3()).toArray(),
              rotation: quaternionToRotation3d(this.dummyConfigPose.getWorldQuaternion(new THREE.Quaternion()))
            };
          })
      );
    }

    // Update vision lines
    if (object.poses.length === 0) {
      // Remove all lines
      while (this.visionLines.length > 0) {
        this.root.remove(this.visionLines[0]);
        this.visionLines.shift();
      }
    } else {
      while (this.visionLines.length > object.visionTargets.length) {
        // Remove extra lines
        this.visionLines[0].geometry.dispose();
        this.visionLines[0].material.dispose();
        this.root.remove(this.visionLines[0]);
        this.visionLines.shift();
      }
      while (this.visionLines.length < object.visionTargets.length) {
        // Add new lines
        let line = new Line2(
          new LineGeometry(),
          new LineMaterial({
            linewidth: 1,
            resolution: this.resolution
          })
        );
        this.visionLines.push(line);
        this.root.add(line);
      }
      for (let i = 0; i < this.visionLines.length; i++) {
        // Update poses
        let translation = object.visionTargets[i].pose.translation;
        if (object.visionTargets[i].annotation.is2DSource) {
          // 2D targets shouldn't be rendered in the floor
          translation[2] = 0.5;
        }
        this.visionLines[i].geometry.setPositions([
          object.poses[0].pose.translation[0],
          object.poses[0].pose.translation[1],
          object.poses[0].pose.translation[2] + 0.5,
          translation[0],
          translation[1],
          translation[2]
        ]);
        this.visionLines[i].geometry.attributes.position.needsUpdate = true;
        let color = object.visionTargets[i].annotation.visionColor;
        if (color !== undefined) {
          this.visionLines[i].material.color = new THREE.Color(color);
        }
        let size = object.visionTargets[i].annotation.visionSize;
        if (size !== undefined) {
          this.visionLines[i].material.linewidth = size === "bold" ? 3 : 1;
        }
      }
    }

    // Update mechanism
    if (object.mechanism === null) {
      // No mechanism data, remove all meshes
      while (this.mechanismLines.length > 0) {
        this.mechanismLines[0].mesh.dispose(true, object.type === "robot"); // Ghost material is shared, don't dispose
        this.mechanismLines.shift();
      }
    } else {
      // Filter to visible lines
      let mechanismLines = object.mechanism?.lines.filter(
        (line) =>
          Math.hypot(line.end[1] - line.start[1], line.end[0] - line.start[0]) >= 1e-3 &&
          line.weight * this.MECHANISM_WIDTH_PER_WEIGHT >= 1e-3
      );

      // Remove extra lines
      while (this.mechanismLines.length > mechanismLines.length) {
        this.mechanismLines[0].mesh.dispose(true, object.type === "robot"); // Ghost material is shared, don't dispose
        this.mechanismLines.shift();
      }

      // Add new lines
      while (this.mechanismLines.length < mechanismLines.length) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material =
          object.type === "ghost"
            ? this.ghostMaterial
            : new THREE.MeshPhongMaterial({ specular: this.materialSpecular, shininess: this.materialShininess });
        this.mechanismLines.push({
          mesh: new ResizableInstancedMesh(this.root, [{ geometry: geometry, material: material }]),
          geometry: geometry,
          scale: new THREE.Vector3(1, 1, 1),
          translation: new THREE.Vector3(),
          material: material
        });
      }

      // Update children
      for (let i = 0; i < mechanismLines.length; i++) {
        const line = mechanismLines[i];
        const meshEntry = this.mechanismLines[i];

        const length = Math.hypot(line.end[1] - line.start[1], line.end[0] - line.start[0]);
        const angle = Math.atan2(line.end[1] - line.start[1], line.end[0] - line.start[0]);

        // Update length
        const newScale = new THREE.Vector3(
          object.mechanism.axis == "x" ? length : line.weight * this.MECHANISM_WIDTH_PER_WEIGHT,
          object.mechanism.axis == "x" ? line.weight * this.MECHANISM_WIDTH_PER_WEIGHT : length,
          line.weight * this.MECHANISM_WIDTH_PER_WEIGHT
        );
        const newTranslation =
          object.mechanism.axis == "x" ? new THREE.Vector3(length / 2, 0, 0) : new THREE.Vector3(0, length / 2, 0);
        if (!newScale.equals(meshEntry.scale) || !newTranslation.equals(meshEntry.translation)) {
          meshEntry.geometry.translate(-meshEntry.translation.x, -meshEntry.translation.y, -meshEntry.translation.z);
          meshEntry.geometry.scale(1 / meshEntry.scale.x, 1 / meshEntry.scale.y, 1 / meshEntry.scale.z);
          meshEntry.geometry.scale(newScale.x, newScale.y, newScale.z);
          meshEntry.geometry.translate(newTranslation.x, newTranslation.y, newTranslation.z);
          meshEntry.scale = newScale;
          meshEntry.translation = newTranslation;
        }

        // Update color
        if (object.type !== "ghost") {
          meshEntry.material.color = new THREE.Color(line.color);
        }

        // Update pose
        meshEntry.mesh.setPoses(
          object.poses
            .map((x) => x.pose)
            .map((robotPose) => {
              this.dummyRobotPose.rotation.setFromQuaternion(rotation3dToQuaternion(robotPose.rotation));
              this.dummyRobotPose.position.set(...robotPose.translation);

              if (object.mechanism?.axis == "x") {
                this.dummyUserPose.position.set(line.start[0] - object.mechanism!.dimensions[0] / 2, 0, line.start[1]);
                this.dummyUserPose.rotation.set(0, -angle, 0);
              } else {
                this.dummyUserPose.position.set(0, line.start[0] - object.mechanism!.dimensions[0] / 2, line.start[1]);
                this.dummyUserPose.rotation.set(angle, 0, 0);
              }
              return {
                translation: this.dummyUserPose.getWorldPosition(new THREE.Vector3()).toArray(),
                rotation: quaternionToRotation3d(this.dummyUserPose.getWorldQuaternion(new THREE.Quaternion()))
              };
            })
        );
      }
    }

    // Update swerve canvas (disabled in XR)
    if (!this.isXR) {
      let context = this.swerveCanvas?.getContext("2d")!;
      context.clearRect(0, 0, this.SWERVE_CANVAS_PX, this.SWERVE_CANVAS_PX);
      const pxPerMeter = this.SWERVE_CANVAS_PX / this.SWERVE_CANVAS_METERS;
      const moduleX = (Math.min(this.dimensions[0], this.dimensions[2]) - this.SWERVE_BUMPER_OFFSET) * pxPerMeter;
      const moduleY = (Math.min(this.dimensions[1], this.dimensions[3]) - this.SWERVE_BUMPER_OFFSET) * pxPerMeter;
      const centerPx = [this.SWERVE_CANVAS_PX / 2, this.SWERVE_CANVAS_PX / 2];
      (
        [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1]
        ] as const
      ).forEach((cornerMultipliers, index) => {
        let moduleCenterPx = [
          centerPx[0] + moduleX * cornerMultipliers[0],
          centerPx[1] - moduleY * cornerMultipliers[1]
        ] as [number, number];

        // Draw module data
        let drawModuleData = (state: SwerveState, color: string) => {
          context.lineWidth = 0.03 * pxPerMeter;
          context.strokeStyle = color;
          context.lineCap = "round";
          context.lineJoin = "round";

          // Draw speed
          if (Math.abs(state.speed) <= 0.001) return;
          let vectorSpeed = state.speed / 5;
          let vectorRotation = state.angle;
          if (state.speed < 0) {
            vectorSpeed *= -1;
            vectorRotation += Math.PI;
          }
          if (vectorSpeed < 0.05) return;
          let vectorLength = pxPerMeter * convert(36, "inches", "meters") * vectorSpeed;
          let arrowBack = transformPx(moduleCenterPx, vectorRotation, [0, 0]);
          let arrowFront = transformPx(moduleCenterPx, vectorRotation, [vectorLength, 0]);
          let arrowLeft = transformPx(moduleCenterPx, vectorRotation, [
            vectorLength - pxPerMeter * 0.1,
            pxPerMeter * 0.1
          ]);
          let arrowRight = transformPx(moduleCenterPx, vectorRotation, [
            vectorLength - pxPerMeter * 0.1,
            pxPerMeter * -0.1
          ]);
          context.beginPath();
          context.moveTo(...arrowBack);
          context.lineTo(...arrowFront);
          context.moveTo(...arrowLeft);
          context.lineTo(...arrowFront);
          context.lineTo(...arrowRight);
          context.stroke();
        };
        object.swerveStates.forEach((set) => {
          if (index < set.values.length) {
            drawModuleData(set.values[index], set.color);
          }
        });
      });
      let hasSwerveStates = object.swerveStates.length > 0;
      this.swerveTexture!.needsUpdate = hasSwerveStates || this.lastHadSwerveStates;
      this.lastHadSwerveStates = hasSwerveStates;
    }
  }
}
