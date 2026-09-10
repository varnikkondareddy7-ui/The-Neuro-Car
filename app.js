import * as THREE from "three";

import {
  OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


const CAR_MODELS = {
  lite: {
    name: "NEUROCAR LITE",
    description: "Neural driving fundamentals",
    file: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb",
    scale: 0.94
  },

  sense: {
    name: "NEUROCAR SENSE",
    description: "Neural + environmental awareness",
    file: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb",
    scale: 1
  },

  x: {
    name: "NEUROCAR X",
    description: "Full research architecture",
    file: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb",
    scale: 1.06
  }
};


const REMOTE_GLB_FALLBACK =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb";


const config = {
  model: "sense",

  exterior: {
    color: "#F5C518",
    name: "Neural Yellow"
  },

  interior: {
    color: "#17181B",
    name: "Carbon Black"
  },

  wheels: "graphite",

  trim: "carbon",

  tint: 35,

  ambient: "#F5C518"
};


const state = {
  isSimulatingEEG: true,

  currentIntent: "FORWARD",

  confidence: 94,

  guardianApproved: true,

  obstacleActive: false,

  probs: {
    FORWARD: 94,
    "TURN LEFT": 2,
    "TURN RIGHT": 1,
    SLOW: 2,
    "EMERGENCY STOP": 1
  },

  carPos: {
    x: 450,
    y: 225,
    angle: 0,
    speed: 0
  }
};


let explorerContext = null;

let heroContext = null;


document.addEventListener(
  "DOMContentLoaded",
  () => {
    initNavigation();

    heroContext = createHeroViewer();

    explorerContext = createConfiguratorViewer();

    initConfigurator();

    initEEGCanvas();

    initEEGSimulation();

    initSimulator();

    initChart();

    updateConfigurationUI();
  }
);


/* NAVIGATION */

function initNavigation() {

  const toggle =
    document.getElementById("mobile-toggle");

  const drawer =
    document.getElementById("mobile-drawer");


  if (!toggle || !drawer) {
    return;
  }


  toggle.addEventListener(
    "click",
    () => {
      drawer.classList.toggle("active");
    }
  );


  document
    .querySelectorAll(".mobile-link")
    .forEach(
      link => {

        link.addEventListener(
          "click",
          () => {
            drawer.classList.remove("active");
          }
        );

      }
    );

}


/* MATERIAL DETECTION */

function materialCategory(
  mesh,
  material
) {

  const meshName =
    `${mesh.name} ${material.name}`
      .toLowerCase();


  if (
    meshName.includes("wheel") ||
    meshName.includes("rim") ||
    meshName.includes("tire")
  ) {
    return "wheel";
  }


  if (
    meshName.includes("glass") ||
    meshName.includes("window") ||
    meshName.includes("windshield")
  ) {
    return "glass";
  }


  if (
    meshName.includes("seat") ||
    meshName.includes("interior") ||
    meshName.includes("cabin") ||
    meshName.includes("leather") ||
    meshName.includes("dashboard")
  ) {
    return "interior";
  }


  if (
    meshName.includes("trim") ||
    meshName.includes("carbon") ||
    meshName.includes("wood") ||
    meshName.includes("aluminum")
  ) {
    return "trim";
  }


  if (
    meshName.includes("light") ||
    meshName.includes("led") ||
    meshName.includes("emissive")
  ) {
    return "light";
  }


  if (
    meshName.includes("body") ||
    meshName.includes("paint") ||
    meshName.includes("car") ||
    meshName.includes("chassis") ||
    meshName.includes("exterior")
  ) {
    return "body";
  }


  return "unknown";
}


/* MATERIAL STORAGE */

function prepareModelMaterials(
  model
) {

  model.userData.materialGroups = {
    body: [],
    wheel: [],
    glass: [],
    interior: [],
    trim: [],
    light: [],
    unknown: []
  };


  model.traverse(
    child => {

      if (!child.isMesh) {
        return;
      }


      child.castShadow = true;

      child.receiveShadow = true;


      const sourceMaterials =
        Array.isArray(child.material)
          ? child.material
          : [child.material];


      const clonedMaterials =
        sourceMaterials.map(
          material => material.clone()
        );


      child.material =
        Array.isArray(child.material)
          ? clonedMaterials
          : clonedMaterials[0];


      clonedMaterials.forEach(
        material => {

          const category =
            materialCategory(
              child,
              material
            );


          model
            .userData
            .materialGroups[category]
            .push(material);

        }
      );

    }
  );


  /*
   * Some GLB models use generic material names.
   * If nothing was identified as body paint,
   * use the largest visible standard materials.
   */

  if (
    model
      .userData
      .materialGroups
      .body
      .length === 0
  ) {

    model.traverse(
      child => {

        if (!child.isMesh) {
          return;
        }


        const materials =
          Array.isArray(child.material)
            ? child.material
            : [child.material];


        materials.forEach(
          material => {

            if (
              material.color &&
              !material.transparent
            ) {

              model
                .userData
                .materialGroups
                .body
                .push(material);

            }

          }
        );

      }
    );

  }

}


/* APPLY CONFIGURATION */

function applyConfiguration(
  model
) {

  if (
    !model ||
    !model.userData.materialGroups
  ) {
    return;
  }


  const groups =
    model.userData.materialGroups;


  groups.body.forEach(
    material => {

      if (!material.color) {
        return;
      }

      material.color.set(
        config.exterior.color
      );

      material.metalness =
        Math.max(
          material.metalness || 0,
          0.45
        );

      material.roughness = 0.28;

      material.needsUpdate = true;

    }
  );


  groups.interior.forEach(
    material => {

      if (!material.color) {
        return;
      }

      material.color.set(
        config.interior.color
      );

      material.roughness = 0.6;

      material.needsUpdate = true;

    }
  );


  let wheelColor =
    "#31343A";


  if (
    config.wheels === "silver"
  ) {
    wheelColor = "#A7AAAE";
  }


  if (
    config.wheels === "black"
  ) {
    wheelColor = "#090A0B";
  }


  groups.wheel.forEach(
    material => {

      if (!material.color) {
        return;
      }

      material.color.set(
        wheelColor
      );

      material.metalness = 0.85;

      material.roughness = 0.28;

      material.needsUpdate = true;

    }
  );


  const trimColors = {
    carbon: "#17191C",
    aluminum: "#A1A6AA",
    wood: "#5A3423"
  };


  groups.trim.forEach(
    material => {

      if (!material.color) {
        return;
      }

      material.color.set(
        trimColors[config.trim]
      );


      if (
        config.trim === "aluminum"
      ) {

        material.metalness = 0.9;

        material.roughness = 0.32;

      } else {

        material.metalness = 0.15;

        material.roughness = 0.55;

      }


      material.needsUpdate = true;

    }
  );


  const glassOpacity =
    Math.max(
      0.18,
      0.75 - config.tint / 100
    );


  groups.glass.forEach(
    material => {

      material.transparent = true;

      material.opacity =
        glassOpacity;

      material.color.set(
        "#101820"
      );

      material.roughness = 0.05;

      material.metalness = 0.1;

      material.depthWrite = false;

      material.needsUpdate = true;

    }
  );


  groups.light.forEach(
    material => {

      if (
        material.color
      ) {

        material.color.set(
          config.ambient
        );

      }


      if (
        material.emissive
      ) {

        material.emissive.set(
          config.ambient
        );

        material.emissiveIntensity = 2.5;

      }


      material.needsUpdate = true;

    }
  );

}


/* CENTER MODEL */

function normalizeModel(
  model
) {

  const box =
    new THREE.Box3()
      .setFromObject(model);


  const center =
    box.getCenter(
      new THREE.Vector3()
    );


  const size =
    box.getSize(
      new THREE.Vector3()
    );


  model.position.sub(center);


  return {
    box,
    size,
    maxDim:
      Math.max(
        size.x,
        size.y,
        size.z
      )
  };

}


/* HERO */

function createHeroViewer() {

  const canvas =
    document.getElementById(
      "hero-canvas"
    );


  if (!canvas) {
    return null;
  }


  const loader =
    document.getElementById(
      "hero-3d-loader"
    );


  const fallback =
    document.getElementById(
      "hero-3d-fallback"
    );


  const scene =
    new THREE.Scene();


  const camera =
    new THREE.PerspectiveCamera(
      34,
      window.innerWidth /
      window.innerHeight,
      0.1,
      500
    );


  const renderer =
    new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });


  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      2
    )
  );


  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );


  renderer.outputColorSpace =
    THREE.SRGBColorSpace;


  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;


  renderer.toneMappingExposure = 1.1;


  const hemi =
    new THREE.HemisphereLight(
      0xffffff,
      0x101927,
      2.3
    );


  scene.add(hemi);


  const key =
    new THREE.DirectionalLight(
      0xffffff,
      5
    );


  key.position.set(
    6,
    10,
    8
  );


  scene.add(key);


  const accent =
    new THREE.DirectionalLight(
      0xf5c518,
      3
    );


  accent.position.set(
    -7,
    4,
    -4
  );


  scene.add(accent);


  const controls =
    new OrbitControls(
      camera,
      renderer.domElement
    );


  controls.enableDamping = true;

  controls.enableZoom = false;

  controls.enablePan = false;

  controls.autoRotate = true;

  controls.autoRotateSpeed = 0.55;


  let model = null;


  const gltfLoader =
    new GLTFLoader();


  function load(
    url,
    fallbackAttempt = false
  ) {

    gltfLoader.load(

      url,

      gltf => {

        model =
          gltf.scene;


        prepareModelMaterials(
          model
        );


        const dimensions =
          normalizeModel(model);


        const scale =
          6 /
          dimensions.maxDim;


        model.scale.setScalar(
          scale
        );


        model.rotation.y =
          Math.PI * 0.73;


        model.position.y = -0.35;


        scene.add(model);


        camera.position.set(
          7,
          2.5,
          8
        );


        controls.target.set(
          0,
          0,
          0
        );


        applyConfiguration(
          model
        );


        if (loader) {
          loader.classList.add(
            "hidden"
          );
        }

      },

      undefined,

      () => {

        if (!fallbackAttempt) {

          load(
            REMOTE_GLB_FALLBACK,
            true
          );

        } else {

          if (loader) {
            loader.classList.add(
              "hidden"
            );
          }


          if (fallback) {
            fallback.classList.remove(
              "hidden"
            );
          }


          canvas.style.display =
            "none";

        }

      }

    );

  }


  load(
    CAR_MODELS.sense.file
  );


  function render() {

    requestAnimationFrame(
      render
    );


    controls.update();


    renderer.render(
      scene,
      camera
    );

  }


  render();


  window.addEventListener(
    "resize",
    () => {

      camera.aspect =
        window.innerWidth /
        window.innerHeight;


      camera.updateProjectionMatrix();


      renderer.setSize(
        window.innerWidth,
        window.innerHeight
      );

    }
  );


  return {
    scene,
    camera,
    renderer,

    get model() {
      return model;
    }
  };

}


/* CONFIGURATOR VIEWER */

function createConfiguratorViewer() {

  const canvas =
    document.getElementById(
      "explorer-canvas"
    );


  if (!canvas) {
    return null;
  }


  const container =
    canvas.parentElement;


  const loader =
    document.getElementById(
      "explorer-3d-loader"
    );


  const fallback =
    document.getElementById(
      "explorer-fallback"
    );


  const scene =
    new THREE.Scene();


  scene.background =
    new THREE.Color(
      0x080d14
    );


  const camera =
    new THREE.PerspectiveCamera(
      36,
      container.clientWidth /
      container.clientHeight,
      0.1,
      500
    );


  const renderer =
    new THREE.WebGLRenderer({
      canvas,
      antialias: true
    });


  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      2
    )
  );


  renderer.setSize(
    container.clientWidth,
    container.clientHeight
  );


  renderer.outputColorSpace =
    THREE.SRGBColorSpace;


  renderer.toneMapping =
    THREE.ACESFilmicToneMapping;


  renderer.toneMappingExposure = 1.1;


  renderer.shadowMap.enabled =
    true;


  renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;


  const hemi =
    new THREE.HemisphereLight(
      0xffffff,
      0x07111d,
      2.5
    );


  scene.add(hemi);


  const key =
    new THREE.DirectionalLight(
      0xffffff,
      5
    );


  key.position.set(
    5,
    9,
    8
  );


  key.castShadow = true;


  scene.add(key);


  const rim =
    new THREE.DirectionalLight(
      0xf5c518,
      3.5
    );


  rim.position.set(
    -6,
    5,
    -4
  );


  scene.add(rim);


  const fill =
    new THREE.DirectionalLight(
      0x5c8dba,
      2
    );


  fill.position.set(
    6,
    2,
    -7
  );


  scene.add(fill);


  const floor =
    new THREE.Mesh(

      new THREE.CircleGeometry(
        10,
        80
      ),

      new THREE.MeshStandardMaterial({
        color: 0x080b0f,
        roughness: 0.72,
        metalness: 0.1
      })

    );


  floor.rotation.x =
    -Math.PI / 2;


  floor.position.y = -1.1;


  floor.receiveShadow = true;


  scene.add(floor);


  const grid =
    new THREE.GridHelper(
      18,
      30,
      0x23303d,
      0x111a24
    );


  grid.position.y = -1.08;


  scene.add(grid);


  const controls =
    new OrbitControls(
      camera,
      renderer.domElement
    );


  controls.enableDamping = true;

  controls.enablePan = false;

  controls.minDistance = 4.5;

  controls.maxDistance = 13;

  controls.minPolarAngle =
    Math.PI * 0.18;

  controls.maxPolarAngle =
    Math.PI * 0.48;


  const gltfLoader =
    new GLTFLoader();


  let model = null;


  function fitModel() {

    if (!model) {
      return;
    }


    const box =
      new THREE.Box3()
        .setFromObject(model);


    const size =
      box.getSize(
        new THREE.Vector3()
      );


    const maxDim =
      Math.max(
        size.x,
        size.y,
        size.z
      );


    const desired =
      5.4;


    const scale =
      desired /
      maxDim;


    model.scale.setScalar(
      scale *
      CAR_MODELS[
        config.model
      ].scale
    );


    model.position.y = -0.4;

  }


  function clearCurrentModel() {

    if (!model) {
      return;
    }


    scene.remove(model);


    model.traverse(
      child => {

        if (
          child.geometry
        ) {
          child.geometry.dispose();
        }


        if (
          child.material
        ) {

          const materials =
            Array.isArray(
              child.material
            )
              ? child.material
              : [child.material];


          materials.forEach(
            material => {
              material.dispose();
            }
          );

        }

      }
    );


    model = null;

  }


  function loadModel(
    modelKey,
    fallbackAttempt = false
  ) {

    const profile =
      CAR_MODELS[modelKey];


    if (!profile) {
      return;
    }


    if (loader) {
      loader.classList.remove(
        "hidden"
      );
    }


    clearCurrentModel();


    const url =
      fallbackAttempt
        ? REMOTE_GLB_FALLBACK
        : profile.file;


    gltfLoader.load(

      url,

      gltf => {

        model =
          gltf.scene;


        prepareModelMaterials(
          model
        );


        normalizeModel(
          model
        );


        fitModel();


        scene.add(
          model
        );


        applyConfiguration(
          model
        );


        camera.position.set(
          6.8,
          2.5,
          7.5
        );


        controls.target.set(
          0,
          -0.15,
          0
        );


        controls.update();


        if (loader) {
          loader.classList.add(
            "hidden"
          );
        }


        if (fallback) {
          fallback.classList.add(
            "hidden"
          );
        }

      },

      undefined,

      () => {

        if (!fallbackAttempt) {

          loadModel(
            modelKey,
            true
          );

        } else {

          if (loader) {
            loader.classList.add(
              "hidden"
            );
          }


          if (fallback) {
            fallback.classList.remove(
              "hidden"
            );
          }

        }

      }

    );

  }


  loadModel(
    config.model
  );


  function setView(
    view
  ) {

    const positions = {

      exterior:
        new THREE.Vector3(
          6.8,
          2.5,
          7.5
        ),

      front:
        new THREE.Vector3(
          0.25,
          1.6,
          8
        ),

      rear:
        new THREE.Vector3(
          0.2,
          1.7,
          -8
        ),

      interior:
        new THREE.Vector3(
          2.2,
          1.35,
          2.3
        )

    };


    const target =
      positions[view] ||
      positions.exterior;


    camera.position.copy(
      target
    );


    if (
      view === "interior"
    ) {

      controls.target.set(
        0,
        0.3,
        0
      );

    } else {

      controls.target.set(
        0,
        -0.15,
        0
      );

    }


    controls.update();

  }


  function render() {

    requestAnimationFrame(
      render
    );


    controls.update();


    renderer.render(
      scene,
      camera
    );

  }


  render();


  const resizeObserver =
    new ResizeObserver(
      () => {

        const width =
          container.clientWidth;


        const height =
          container.clientHeight;


        if (
          !width ||
          !height
        ) {
          return;
        }


        camera.aspect =
          width / height;


        camera.updateProjectionMatrix();


        renderer.setSize(
          width,
          height
        );

      }
    );


  resizeObserver.observe(
    container
  );


  return {

    scene,
    camera,
    renderer,
    controls,

    setView,

    loadModel,

    applyConfig() {

      applyConfiguration(
        model
      );

    },

    get model() {
      return model;
    }

  };

}


/* CONFIGURATOR UI */

function initConfigurator() {

  document
    .querySelectorAll(
      ".model-option"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectModel(
              button.dataset.model
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".trim-select"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const model =
              button.dataset.model;


            selectModel(
              model
            );

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".paint-swatch"
    )
    .forEach(
      swatch => {

        swatch.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".paint-swatch"
              )
              .forEach(
                item =>
                  item
                    .classList
                    .remove("active")
              );


            swatch
              .classList
              .add("active");


            config.exterior.color =
              swatch.dataset.color;


            config.exterior.name =
              swatch.dataset.name;


            refresh3DConfiguration();


            updateConfigurationUI();

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".interior-swatch"
    )
    .forEach(
      swatch => {

        swatch.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".interior-swatch"
              )
              .forEach(
                item =>
                  item
                    .classList
                    .remove("active")
              );


            swatch
              .classList
              .add("active");


            config.interior.color =
              swatch.dataset.color;


            config.interior.name =
              swatch.dataset.name;


            refresh3DConfiguration();


            updateConfigurationUI();

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-wheel]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                "[data-wheel]"
              )
              .forEach(
                item =>
                  item
                    .classList
                    .remove("active")
              );


            button
              .classList
              .add("active");


            config.wheels =
              button.dataset.wheel;


            refresh3DConfiguration();


            updateConfigurationUI();

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-trim]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                "[data-trim]"
              )
              .forEach(
                item =>
                  item
                    .classList
                    .remove("active")
              );


            button
              .classList
              .add("active");


            config.trim =
              button.dataset.trim;


            refresh3DConfiguration();


            updateConfigurationUI();

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".ambient-swatch"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".ambient-swatch"
              )
              .forEach(
                item =>
                  item
                    .classList
                    .remove("active")
              );


            button
              .classList
              .add("active");


            config.ambient =
              button.dataset.ambient;


            refresh3DConfiguration();

          }
        );

      }
    );


  const tintSlider =
    document.getElementById(
      "tint-slider"
    );


  if (tintSlider) {

    tintSlider.addEventListener(
      "input",
      () => {

        config.tint =
          Number(
            tintSlider.value
          );


        refresh3DConfiguration();


        updateConfigurationUI();

      }
    );

  }


  document
    .querySelectorAll(
      ".view-button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".view-button"
              )
              .forEach(
                item =>
                  item
                    .classList
                    .remove("active")
              );


            button
              .classList
              .add("active");


            if (
              explorerContext
            ) {

              explorerContext.setView(
                button.dataset.view
              );

            }

          }
        );

      }
    );


  const resetButton =
    document.getElementById(
      "reset-config"
    );


  if (resetButton) {

    resetButton.addEventListener(
      "click",
      resetConfiguration
    );

  }

}


function selectModel(
  modelKey
) {

  if (
    !CAR_MODELS[modelKey]
  ) {
    return;
  }


  config.model =
    modelKey;


  document
    .querySelectorAll(
      ".model-option"
    )
    .forEach(
      button => {

        button
          .classList
          .toggle(
            "active",
            button.dataset.model ===
              modelKey
          );

      }
    );


  if (
    explorerContext
  ) {

    explorerContext.loadModel(
      modelKey
    );

  }


  updateConfigurationUI();

}


function refresh3DConfiguration() {

  if (
    explorerContext
  ) {

    explorerContext.applyConfig();

  }


  if (
    heroContext &&
    heroContext.model
  ) {

    applyConfiguration(
      heroContext.model
    );

  }

}


function updateConfigurationUI() {

  const model =
    CAR_MODELS[
      config.model
    ];


  setText(
    "active-model-label",
    model.name
  );


  setText(
    "active-model-description",
    model.description
  );


  setText(
    "paint-name",
    config.exterior.name
  );


  setText(
    "interior-name",
    config.interior.name
  );


  setText(
    "tint-value",
    `${config.tint}%`
  );


  const summary =
    `${model.name.replace(
      "NEUROCAR ",
      ""
    )} · ${config.exterior.name} · ${config.interior.name}`;


  setText(
    "configuration-summary",
    summary
  );


  const code =
    createBuildCode();


  setText(
    "build-code",
    code
  );

}


function createBuildCode() {

  const modelCodes = {
    lite: "LITE",
    sense: "SENSE",
    x: "X"
  };


  const paint =
    config.exterior.name
      .replace(/\s/g, "")
      .slice(0, 3)
      .toUpperCase();


  const interior =
    config.interior.name
      .replace(/\s/g, "")
      .slice(0, 2)
      .toUpperCase();


  return (
    `NC-${modelCodes[config.model]}-${paint}${interior}`
  );

}


function resetConfiguration() {

  config.model = "sense";


  config.exterior = {
    color: "#F5C518",
    name: "Neural Yellow"
  };


  config.interior = {
    color: "#17181B",
    name: "Carbon Black"
  };


  config.wheels =
    "graphite";


  config.trim =
    "carbon";


  config.tint = 35;


  config.ambient =
    "#F5C518";


  document
    .querySelectorAll(
      ".model-option"
    )
    .forEach(
      item => {

        item.classList.toggle(
          "active",
          item.dataset.model ===
            "sense"
        );

      }
    );


  setActiveByDataset(
    ".paint-swatch",
    "name",
    "Neural Yellow"
  );


  setActiveByDataset(
    ".interior-swatch",
    "name",
    "Carbon Black"
  );


  setActiveByDataset(
    "[data-wheel]",
    "wheel",
    "graphite"
  );


  setActiveByDataset(
    "[data-trim]",
    "trim",
    "carbon"
  );


  setActiveByDataset(
    ".ambient-swatch",
    "ambient",
    "#F5C518"
  );


  const slider =
    document.getElementById(
      "tint-slider"
    );


  if (slider) {
    slider.value = 35;
  }


  if (
    explorerContext
  ) {

    explorerContext.loadModel(
      "sense"
    );

  }


  refresh3DConfiguration();


  updateConfigurationUI();

}


function setActiveByDataset(
  selector,
  field,
  value
) {

  document
    .querySelectorAll(
      selector
    )
    .forEach(
      item => {

        item.classList.toggle(
          "active",
          item.dataset[field] ===
            value
        );

      }
    );

}


function setText(
  id,
  text
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {
    element.textContent = text;
  }

}


/* EEG CANVAS */

function initEEGCanvas() {

  const canvas =
    document.getElementById(
      "eeg-canvas"
    );


  if (!canvas) {
    return;
  }


  const context =
    canvas.getContext("2d");


  let phase = 0;


  function resize() {

    const bounds =
      canvas
        .parentElement
        .getBoundingClientRect();


    canvas.width =
      Math.max(
        300,
        Math.floor(
          bounds.width
        )
      );


    canvas.height =
      Math.max(
        200,
        Math.floor(
          bounds.height
        )
      );

  }


  resize();


  window.addEventListener(
    "resize",
    resize
  );


  function draw() {

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    const channels = 8;

    const channelHeight =
      canvas.height /
      channels;


    for (
      let channel = 0;
      channel < channels;
      channel++
    ) {

      const centerY =
        channel *
        channelHeight +
        channelHeight / 2;


      context.beginPath();


      context.lineWidth =
        channel === 0
          ? 1.7
          : 1;


      context.strokeStyle =
        channel === 0
          ? "#F5C518"
          : "rgba(215,222,230,.33)";


      for (
        let x = 0;
        x <= canvas.width;
        x += 3
      ) {

        const frequency =
          0.018 +
          channel * 0.002;


        const baseAmplitude =
          state.isSimulatingEEG
            ? 7 +
              (channel % 3) * 2
            : 1.5;


        const wave =
          Math.sin(
            x * frequency +
            phase +
            channel * 0.7
          );


        const secondary =
          Math.sin(
            x *
            frequency *
            2.8 +
            phase *
            0.5
          ) * 0.25;


        const noise =
          state.isSimulatingEEG
            ? (
                Math.random() -
                0.5
              ) *
              1.5
            : 0;


        const y =
          centerY +
          (
            wave +
            secondary
          ) *
          baseAmplitude +
          noise;


        if (x === 0) {

          context.moveTo(
            x,
            y
          );

        } else {

          context.lineTo(
            x,
            y
          );

        }

      }


      context.stroke();

    }


    if (
      state.isSimulatingEEG
    ) {
      phase += 0.075;
    }


    requestAnimationFrame(
      draw
    );

  }


  draw();

}


/* EEG SIMULATION */

function initEEGSimulation() {

  const toggle =
    document.getElementById(
      "toggle-sim-btn"
    );


  const calibrate =
    document.getElementById(
      "calibrate-btn"
    );


  if (toggle) {

    toggle.addEventListener(
      "click",
      () => {

        state.isSimulatingEEG =
          !state.isSimulatingEEG;


        toggle.textContent =
          state.isSimulatingEEG
            ? "Pause EEG Stream"
            : "Resume EEG Stream";

      }
    );

  }


  if (calibrate) {

    calibrate.addEventListener(
      "click",
      () => {

        calibrate.textContent =
          "Calibrating";


        setTimeout(
          () => {

            calibrate.textContent =
              "Recalibrate";


            addHistory(
              "Driver calibration updated",
              true
            );

          },
          1000
        );

      }
    );

  }


  const intents = [
    "FORWARD",
    "TURN LEFT",
    "TURN RIGHT",
    "SLOW",
    "EMERGENCY STOP"
  ];


  setInterval(
    () => {

      if (
        !state.isSimulatingEEG
      ) {
        return;
      }


      if (
        Math.random() > 0.55
      ) {
        return;
      }


      const intent =
        intents[
          Math.floor(
            Math.random() *
            intents.length
          )
        ];


      const confidence =
        Math.floor(
          76 +
          Math.random() *
          22
        );


      state.currentIntent =
        intent;


      state.confidence =
        confidence;


      state.guardianApproved =
        confidence >= 80 &&
        !state.obstacleActive;


      intents.forEach(
        item => {

          state.probs[item] =
            Math.floor(
              Math.random() *
              6
            );

        }
      );


      state.probs[intent] =
        confidence;


      updateTelemetry();


      addHistory(
        `${intent} ${confidence}%`,
        state.guardianApproved
      );

    },
    2300
  );

}


function updateTelemetry() {

  setText(
    "current-intent-text",
    state.currentIntent
  );


  setText(
    "current-confidence-text",
    `${state.confidence}%`
  );


  const badge =
    document.getElementById(
      "guardian-badge"
    );


  if (badge) {

    badge.textContent =
      state.guardianApproved
        ? "GUARDIAN APPROVED"
        : "GUARDIAN REJECTED";


    badge.className =
      state.guardianApproved
        ? "badge badge-success"
        : "badge badge-rejected";

  }


  const mappings = {

    FORWARD: "forward",

    "TURN LEFT": "left",

    "TURN RIGHT": "right",

    SLOW: "slow",

    "EMERGENCY STOP": "stop"

  };


  Object.entries(
    mappings
  ).forEach(
    ([intent, slug]) => {

      const probability =
        state.probs[intent];


      setText(
        `prob-val-${slug}`,
        `${probability}%`
      );


      const bar =
        document.getElementById(
          `prob-bar-${slug}`
        );


      if (bar) {

        bar.style.width =
          `${probability}%`;

      }

    }
  );

}


function addHistory(
  message,
  approved
) {

  const log =
    document.getElementById(
      "history-log-list"
    );


  if (!log) {
    return;
  }


  const item =
    document.createElement(
      "div"
    );


  item.className =
    "log-entry";


  item.innerHTML = `
    <span>${message}</span>
    <strong style="
      color:${
        approved
          ? "#74d58b"
          : "#ff7373"
      }
    ">
      ${
        approved
          ? "APPROVED"
          : "REJECTED"
      }
    </strong>
  `;


  log.prepend(
    item
  );


  while (
    log.children.length > 8
  ) {

    log.removeChild(
      log.lastChild
    );

  }

}


/* SIMULATOR */

function initSimulator() {

  const canvas =
    document.getElementById(
      "sim-canvas"
    );


  if (!canvas) {
    return;
  }


  const context =
    canvas.getContext("2d");


  const speedDisplay =
    document.getElementById(
      "sim-hud-speed"
    );


  const obstacleDisplay =
    document.getElementById(
      "sim-hud-obstacle"
    );


  function drawRoad() {

    context.fillStyle =
      "#060a0f";


    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    context.strokeStyle =
      "rgba(255,255,255,.035)";


    context.lineWidth = 1;


    for (
      let x = 0;
      x < canvas.width;
      x += 40
    ) {

      context.beginPath();

      context.moveTo(
        x,
        0
      );

      context.lineTo(
        x,
        canvas.height
      );

      context.stroke();

    }


    for (
      let y = 0;
      y < canvas.height;
      y += 40
    ) {

      context.beginPath();

      context.moveTo(
        0,
        y
      );

      context.lineTo(
        canvas.width,
        y
      );

      context.stroke();

    }


    context.fillStyle =
      "#101b28";


    context.fillRect(
      80,
      90,
      canvas.width - 160,
      canvas.height - 180
    );


    context.strokeStyle =
      "rgba(245,197,24,.22)";


    context.lineWidth = 2;


    context.strokeRect(
      80,
      90,
      canvas.width - 160,
      canvas.height - 180
    );


    context.setLineDash([
      18,
      16
    ]);


    context.strokeStyle =
      "rgba(255,255,255,.18)";


    context.beginPath();


    context.moveTo(
      100,
      canvas.height / 2
    );


    context.lineTo(
      canvas.width - 100,
      canvas.height / 2
    );


    context.stroke();


    context.setLineDash([]);

  }


  function drawObstacle() {

    if (
      !state.obstacleActive
    ) {
      return;
    }


    context.fillStyle =
      "#8d2e2e";


    context.fillRect(
      640,
      190,
      38,
      62
    );


    context.fillStyle =
      "#ff9c9c";


    context.font =
      "10px Inter";


    context.fillText(
      "HAZARD",
      635,
      178
    );

  }


  function drawCar() {

    context.save();


    context.translate(
      state.carPos.x,
      state.carPos.y
    );


    context.rotate(
      state.carPos.angle
    );


    context.shadowColor =
      config.exterior.color;


    context.shadowBlur = 18;


    context.fillStyle =
      config.exterior.color;


    roundRect(
      context,
      -25,
      -13,
      50,
      26,
      7
    );


    context.fill();


    context.shadowBlur = 0;


    context.fillStyle =
      "#10151b";


    roundRect(
      context,
      1,
      -10,
      18,
      20,
      5
    );


    context.fill();


    context.fillStyle =
      config.ambient;


    context.fillRect(
      -23,
      -11,
      4,
      4
    );


    context.fillRect(
      -23,
      7,
      4,
      4
    );


    context.restore();

  }


  function updateCar() {

    state.carPos.x +=
      Math.cos(
        state.carPos.angle
      ) *
      state.carPos.speed;


    state.carPos.y +=
      Math.sin(
        state.carPos.angle
      ) *
      state.carPos.speed;


    if (
      state.carPos.x < 105 ||
      state.carPos.x >
        canvas.width - 105 ||
      state.carPos.y < 115 ||
      state.carPos.y >
        canvas.height - 115
    ) {

      state.carPos.speed = 0;

    }


    if (
      state.obstacleActive &&
      state.carPos.x > 570 &&
      state.carPos.x < 690 &&
      state.carPos.y > 160 &&
      state.carPos.y < 280
    ) {

      state.carPos.speed = 0;

      state.guardianApproved =
        false;

    }


    if (speedDisplay) {

      speedDisplay.textContent =
        `${Math.round(
          state.carPos.speed *
          14
        )} MPH`;

    }

  }


  function draw() {

    drawRoad();

    drawObstacle();

    drawCar();

    updateCar();


    requestAnimationFrame(
      draw
    );

  }


  draw();


  bindButton(
    "btn-cmd-forward",
    () => {

      state.carPos.speed =
        2.2;

    }
  );


  bindButton(
    "btn-cmd-slow",
    () => {

      state.carPos.speed =
        0.8;

    }
  );


  bindButton(
    "btn-cmd-stop",
    () => {

      state.carPos.speed =
        0;

    }
  );


  bindButton(
    "btn-cmd-left",
    () => {

      state.carPos.angle -=
        0.18;

    }
  );


  bindButton(
    "btn-cmd-right",
    () => {

      state.carPos.angle +=
        0.18;

    }
  );


  bindButton(
    "btn-toggle-obstacle",
    button => {

      state.obstacleActive =
        !state.obstacleActive;


      button.textContent =
        state.obstacleActive
          ? "Remove Obstacle"
          : "Spawn Obstacle";


      if (obstacleDisplay) {

        obstacleDisplay
          .classList
          .toggle(
            "hidden",
            !state.obstacleActive
          );

      }

    }
  );


  bindButton(
    "btn-trigger-eeg-cmd",
    () => {

      state.currentIntent =
        "FORWARD";


      state.confidence =
        96;


      state.guardianApproved =
        !state.obstacleActive;


      if (
        state.guardianApproved
      ) {

        state.carPos.speed =
          2.2;

      } else {

        state.carPos.speed =
          0;

      }


      updateTelemetry();


      addHistory(
        "EEG FORWARD 96%",
        state.guardianApproved
      );

    }
  );


  window.addEventListener(
    "keydown",
    event => {

      const key =
        event.key.toLowerCase();


      if (
        key === "arrowup" ||
        key === "w"
      ) {

        state.carPos.speed =
          2.2;

      }


      if (
        key === "arrowdown" ||
        key === "s"
      ) {

        state.carPos.speed =
          0.6;

      }


      if (
        key === "arrowleft" ||
        key === "a"
      ) {

        state.carPos.angle -=
          0.12;

      }


      if (
        key === "arrowright" ||
        key === "d"
      ) {

        state.carPos.angle +=
          0.12;

      }


      if (
        key === " "
      ) {

        state.carPos.speed = 0;

      }

    }
  );

}


function bindButton(
  id,
  callback
) {

  const button =
    document.getElementById(
      id
    );


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    () => {
      callback(button);
    }
  );

}


function roundRect(
  context,
  x,
  y,
  width,
  height,
  radius
) {

  context.beginPath();

  context.roundRect(
    x,
    y,
    width,
    height,
    radius
  );

}


/* CHART */

function initChart() {

  const canvas =
    document.getElementById(
      "ai-chart"
    );


  if (
    !canvas ||
    typeof Chart ===
      "undefined"
  ) {
    return;
  }


  new Chart(
    canvas,
    {

      type: "scatter",

      data: {

        datasets: [

          {
            label:
              "EEG Models",

            data: [

              {
                x: 12,
                y: 89.4,
                model:
                  "EEG-Conformer"
              },

              {
                x: 8,
                y: 84.2,
                model:
                  "EEGNet"
              },

              {
                x: 18,
                y: 81,
                model:
                  "Bi-LSTM"
              },

              {
                x: 3,
                y: 68.5,
                model:
                  "SVM"
              }

            ],

            pointRadius: 8,

            pointHoverRadius: 10,

            backgroundColor:
              "#C49D15",

            borderColor:
              "#80670B",

            borderWidth: 1.5

          }

        ]

      },

      options: {

        responsive: true,

        maintainAspectRatio:
          false,

        plugins: {

          legend: {
            display: false
          },

          tooltip: {

            callbacks: {

              label(context) {

                const point =
                  context.raw;


                return (
                  `${point.model}: ` +
                  `${point.y}% accuracy, ` +
                  `${point.x}ms`
                );

              }

            }

          }

        },

        scales: {

          x: {

            title: {
              display: true,
              text:
                "Inference latency (ms)"
            },

            grid: {
              color:
                "rgba(0,0,0,.06)"
            },

            ticks: {
              color: "#777"
            }

          },

          y: {

            min: 60,

            max: 95,

            title: {
              display: true,
              text:
                "Accuracy (%)"
            },

            grid: {
              color:
                "rgba(0,0,0,.06)"
            },

            ticks: {
              color: "#777"
            }

          }

        }

      }

    }
  );

}