import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// Floor properties - defines name of floor, location of svg, which sections are extruded, and the locations on the floor
const floorProperties = [
  {
    name: "Basement",
    svg: "./Library-B.svg",
    svgScale: 0.01,
    position: [0, 0],
    extrudedSections: ["A-WALL-FULL"],
    floorLayer: "A-FLOOR-OUTLINE",
    extrudeDepth: 30,
    locations: [],
  },
  {
    name: "Floor 1",
    svg: "./Library-1.svg",
    svgScale: 0.01,
    position: [0.15, -0.05],
    extrudedSections: ["A-WALL-FULL"],
    floorLayer: "A-FLOOR-OUTLINE",
    extrudeDepth: 30,
    locations: [],
  },
  {
    name: "Floor 2",
    svg: "./Library-2.svg",
    svgScale: 0.01,
    position: [0.21, 0],
    extrudedSections: ["A-WALL-FULL"],
    floorLayer: "A-FLOOR-OUTLINE",
    extrudeDepth: 30,
    locations: [],
  },
  {
    name: "Floor 3",
    svg: "./Library-3.svg",
    svgScale: 0.01,
    position: [-0.05, 0.17],
    extrudedSections: ["A-WALL-FULL"],
    floorLayer: "A-FLOOR-OUTLINE",
    extrudeDepth: 30,
    locations: [],
  },
  {
    name: "Roof",
    svg: "./Library-4.svg",
    svgScale: 0.01,
    position: [0.2, -0.25],
    extrudedSections: [],
    floorLayer: "",
    extrudeDepth: 0,
    locations: [],
  },
];

// Initialize canvas and renderer, enable antialiasing
const canvas = document.querySelector("#c");
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

// Define camera and its properties
const fov = 75;
const aspect = 2;
const near = 0.01;
const far = 1000;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

// Initial camera position - away from origin, looking at origin
camera.position.y = 3;
camera.position.z = 3;
camera.lookAt(0, 0, 0);

// Define scene
const scene = new THREE.Scene();

scene.background = new THREE.Color(0xcfe2e3);

// Define orbit controls - render scene whenever camera moves
const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener("change", render);
controls.screenSpacePanning = true;

// Render when the window is resized
window.addEventListener("resize", render);

// White directional lighting
const directionalLightColor = 0xffffff;
const directionalLightIntensity = 2.5;
const directionalLight = new THREE.DirectionalLight(
  directionalLightColor,
  directionalLightIntensity
);
directionalLight.position.set(-1, 2, 4);
scene.add(directionalLight);

// Soft white ambient light
const ambientLight = new THREE.AmbientLight(0xcfe2e3);
scene.add(ambientLight);

// Example cube
// const cubeMaterial = new THREE.MeshPhongMaterial();
// const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
// const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
// scene.add(cube);

// Load floors
loadFloors(floorProperties)
  .then((floorGroups) => sortFloorsByName(floorGroups)) // Sort floors so they aren't out of order in the UI
  .then((floorGroups) => {
    populateFloorListUI(floorGroups); // Populate list of floors with enable/disable checkboxes
  });

function render() {
  // Check if window has been resized and update camera accordingly
  if (resizeRendererToDisplaySize(renderer)) {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera); // Render scene
}

function resizeRendererToDisplaySize(renderer) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height; // Check if canvas dimensions do not match client dimensions
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

// Load the floor SVGs, create meshes, and return groups out of them
function loadFloors(floorProperties) {
  // Return promise so UI doesn't load until finished
  return new Promise((resolve, reject) => {
    const loader = new SVGLoader();

    let floorGroups = [];

    floorProperties.forEach((floorProperty, i, arr) => {
      const geometries = {
        extruded: {}, // Object for extruded sections geometries
        nonExtruded: { other: [] }, // Object for non-extruded sections geometries - for now, all in one set of geometries
        floorGeometries: [], // Array of geometries for floor and ceiling
      };

      // For each extruded section in the floor, create two arrays of geometries for that section
      floorProperty.extrudedSections.forEach((el) => {
        geometries.extruded[el] = {
          pathGeometries: [], // One array for the SVG paths of the section
          extrudeGeometries: [], // One array for the extruded mesh portion of the section
        };
      });

      loader.load(
        floorProperty.svg,
        function (data) {
          // Loop through paths in svg data
          for (const path of data.paths) {
            const fillColor = path.userData.style.fill; // Get fill color of SVG path

            // Get parent group id to identify the current section of the SVG
            const pathNode = path.userData.node;
            const parentGroup = pathNode.parentElement.parentElement;
            const id = parentGroup.id;

            if (fillColor !== undefined && fillColor !== "none") {
              // If SVG path is not empty
              // Create shapes from filled SVG shapes
              const shapes = SVGLoader.createShapes(path);

              for (const shape of shapes) {
                // Create geometry from SVG shape
                const pathGeometry = new THREE.ShapeGeometry(
                  shape
                ).toNonIndexed();

                // Check if current path section should be extruded
                if (floorProperty.extrudedSections.includes(id)) {
                  // Add geometry to extruded geometries paths array
                  geometries.extruded[id].pathGeometries.push(pathGeometry);
                } else if (
                  floorProperty.floorLayer.length > 0 &&
                  floorProperty.floorLayer == id
                ) {
                  // Add floor geometry to array
                  geometries.floorGeometries.push(pathGeometry);
                } else {
                  geometries.nonExtruded.other.push(pathGeometry); // Add geometry to non-extruded geometries array
                }
              }
            }

            const strokeColor = path.userData.style.stroke; // Get stroke color of SVG path

            if (strokeColor !== undefined && strokeColor !== "none") {
              // If stroke is not empty
              for (const subPath of path.subPaths) {
                // Create geometry from subpath
                const geometry = SVGLoader.pointsToStroke(
                  subPath.getPoints(),
                  path.userData.style
                );

                if (geometry) {
                  // If geometry exists
                  // Check if current path section should be extruded
                  if (floorProperty.extrudedSections.includes(id)) {
                    geometries.extruded[id].pathGeometries.push(geometry);
                    // Add geometry to extruded geometries array
                  } else if (
                    floorProperty.floorLayer.length > 0 &&
                    floorProperty.floorLayer == id
                  ) {
                    // Add floor geometry to array
                    geometries.floorGeometries.push(geometry);
                  } else {
                    geometries.nonExtruded.other.push(geometry); // Add geometry to non-extruded geometries array
                  }
                }
              }
            }

            const shapes = SVGLoader.createShapes(path);

            shapes.forEach((shape, j) => {
              if (floorProperty.extrudedSections.includes(id)) {
                // Create extruded geometry
                const extrudedGeometry = new THREE.ExtrudeGeometry(shape, {
                  depth: floorProperty.extrudeDepth,
                  bevelEnabled: false,
                });
                extrudedGeometry.computeVertexNormals();

                // Add geometry to extruded geometries meshes array
                geometries.extruded[id].extrudeGeometries.push(
                  extrudedGeometry
                );
              }
            });
          }

          // Create Group for the floor
          const floorGroup = new THREE.Group();
          floorGroup.name = floorProperty.name;

          let pathMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            side: THREE.DoubleSide,
          });

          // if (i > 0) {
          //   pathMaterial = new THREE.MeshStandardMaterial({
          //     color: 0x34cfeb,
          //     side: THREE.DoubleSide,
          //   });
          // }

          const extrudeMaterial = new THREE.MeshPhongMaterial({
            //   color: 0x7d7d7d,
            //   transparent: true,
            //   depthWrite: false,
            opacity: 0.5,
          });

          floorProperty.extrudedSections.forEach((id) => {
            // Loop through each extruded section
            // Merge array of extruded geometries into single geometry for performance
            const extrudeGeometry = BufferGeometryUtils.mergeGeometries(
              geometries.extruded[id].extrudeGeometries
            );
            extrudeGeometry.computeBoundingSphere();

            // Merge array of extruded path geometries into single geometry
            const pathGeometry = BufferGeometryUtils.mergeGeometries(
              geometries.extruded[id].pathGeometries
            );
            pathGeometry.computeBoundingSphere();

            // Create meshes from extruded geometry and path geometry
            const extrudeMesh = new THREE.Mesh(
              extrudeGeometry,
              extrudeMaterial
            );
            const pathMesh = new THREE.Mesh(pathGeometry, pathMaterial);

            // Scale meshes to appropriate size
            extrudeMesh.scale.multiplyScalar(floorProperty.svgScale);
            extrudeMesh.scale.y *= -1;

            pathMesh.scale.multiplyScalar(floorProperty.svgScale);
            pathMesh.position.z = floorProperty.extrudeDepth / 100 + 1 / 100; // Shift path mesh up to be at top of extrusion
            pathMesh.scale.y *= -1;

            floorGroup.add(extrudeMesh);
            floorGroup.add(pathMesh);
          });

          // Merge array of geometries for non-extruded sections
          const otherPathGeometry = BufferGeometryUtils.mergeGeometries(
            geometries.nonExtruded.other
          );
          otherPathGeometry.computeBoundingSphere();

          // Create mesh from path geometry
          const otherPathMesh = new THREE.Mesh(otherPathGeometry, pathMaterial);
          otherPathMesh.scale.multiplyScalar(floorProperty.svgScale);
          otherPathMesh.scale.y *= -1;
          otherPathMesh.position.z += 1 / 100;

          floorGroup.add(otherPathMesh);

          if (geometries.floorGeometries.length > 0) {
            // Merge array of floor geometries
            const floorGeometry = BufferGeometryUtils.mergeGeometries(
              geometries.floorGeometries
            );
            floorGeometry.computeBoundingSphere();

            // Create mesh from floor geometry
            const floorMesh = new THREE.Mesh(floorGeometry, extrudeMaterial);
            floorMesh.scale.multiplyScalar(floorProperty.svgScale);
            floorMesh.scale.y *= -1;

            floorGroup.add(floorMesh);

            const upperFloorMesh = floorMesh.clone();
            upperFloorMesh.position.z += floorProperty.extrudeDepth / 100;

            floorGroup.add(upperFloorMesh);
          }

          floorGroup.rotateX(-Math.PI / 2); // Rotate group so it is horizontal

          // Get bounding box of group
          const boundingBox = new THREE.Box3().setFromObject(floorGroup);
          const size = boundingBox.getSize(new THREE.Vector3());

          // Center floor group based on bounding box
          floorGroup.position.x = -size.x / 2;
          floorGroup.position.z = -size.z / 2;

          // Shift floor group to align with others
          floorGroup.position.x += floorProperty.position[0];
          floorGroup.position.z -= floorProperty.position[1];

          // Change y position so levels are stacked on top of each other
          if (i > 0) {
            let sum = 0;
            for (let j = 0; j < i; j++) {
              sum += arr[j].extrudeDepth / 100 + 3 / 100;
            }
            floorGroup.position.y = sum;
          }

          // Add group to scene and to array for later use
          scene.add(floorGroup);
          floorGroups.push(floorGroup);

          // Resolve promise if all floors have been loaded and added to the array
          if (floorGroups.length == arr.length) {
            resolve(floorGroups);
          }

          render();
        },
        function (xhr) {
          console.log("SVG " + (xhr.loaded / xhr.total) * 100 + "% loaded");
        },
        function (error) {
          console.log("An error happened: " + error);
        }
      );
    });
  });
  // return floorGroups;
}

// Sort floors by name so they are in the correct order in UI
function sortFloorsByName(floorList) {
  let sortedGroups = floorList.slice().sort(function (a, b) {
    // Sorted based on the order of "name" properties in the floorProperties array
    let indexOfA = floorProperties.findIndex((elem) => elem["name"] == a.name);
    let indexOfB = floorProperties.findIndex((elem) => elem["name"] == b.name);
    return indexOfA - indexOfB;
  });

  return sortedGroups;
}

// Populate list of floors with enable/disable checkboxes
function populateFloorListUI(floorList) {
  const ul = document.getElementById("floor-list");

  // For each floor, add an element to the list
  floorList.forEach((floor) => {
    let li = document.createElement("li");

    // Add checkbox to list element to enable/disable floor
    let checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.checked = true;
    li.appendChild(checkbox);

    checkbox.onclick = () => {
      // Change visibility of floor Group based on status of checkbox
      if (checkbox.checked) floor.visible = true;
      else floor.visible = false;
      render();
    };

    // Append list element to list
    li.appendChild(document.createTextNode(floor.name));
    ul.appendChild(li);
  });
}

function readSVG(url) {
  return (
    fetch(url)
      // Get SVG response as text
      .then((response) => response.text())
      // Parse to a DOM tree using DOMParser
      .then((str) => new window.DOMParser().parseFromString(str, "text/xml"))
      .then((xml) => {
        // console.log(xml);
        // let textGroup = xml.getElementById("A-ANNO-TEXT");

        // for (let i = 1; i < textGroup.childNodes.length; i += 2) {
        //   // console.log(
        //   //   textGroup.childNodes[i].childNodes[1].getAttribute("transform")
        //   // );
        //   let currentText = "";
        //   textGroup.childNodes[i].childNodes[1].childNodes.forEach(
        //     (textNode) => {
        //       currentText += textNode.textContent;
        //     }
        //   );
        //   console.log(currentText);
        // }

        let textGroup = xml.getElementById("A-AREA-IDEN");

        for (let i = 1; i < textGroup.childNodes.length; i += 2) {
          let transform =
            textGroup.childNodes[i].childNodes[1].getAttribute("transform");
          transform = transform.substring(10, transform.length - 1);
          let position = transform.split(" ").map((el) => {
            let n = Number(el);
            return n === 0 ? n : n || el;
          });

          let currentText = "";
          textGroup.childNodes[i].childNodes[1].childNodes.forEach(
            (textNode) => {
              currentText += textNode.textContent;
            }
          );
          let locationObject = {
            name: currentText,
            position: position,
          };
          console.log(locationObject);
        }
      })
  );
}

readSVG("./Library-1.svg");
