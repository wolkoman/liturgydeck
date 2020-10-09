import OBSWebSocket from "obs-websocket-js";
import { StreamDeck } from "./streamDeck";
import textgenFile, { TextgenType } from "./textgen";
import imageFile from "./image";
import { WebServer } from "./webserver";
import { initAtem } from "./atem";

const { openStreamDeck } = require("elgato-stream-deck");
const fetch = require("node-fetch");
const obs = new OBSWebSocket();
let myStreamDeck: StreamDeck;
let webServer = new WebServer(80);

const CAMERA_SCENE_NAME = "KAMERA";
const AUDIO_SCENE_NAME = "TON";

var stdin = process.openStdin();

stdin.addListener("data", function (d) {
  let msg = d.toString().trim();
  let camera = +msg.split(" ")[0];
  let isCamera = [1, 2, 3].includes(camera);
  webServer.tell(isCamera ? msg.substring(2) : msg, camera);
});

try {
  initAtem(webServer);
} catch (e) {
  console.log("Error connecting to Atem");
  process.exit();
}

try {
  myStreamDeck = openStreamDeck();
} catch (e) {
  console.log("Error connecting to StreamDeck");
  process.exit();
}

const textgen = textgenFile(myStreamDeck);
const image = imageFile(myStreamDeck);

const fields = {
  scenes: [0, 1, 2, 5, 6, 7, 10, 11],
  up: 3,
  down: 4,
  nextPage: 12,
};

myStreamDeck.clearAllKeys();
const fieldsDown = Array(myStreamDeck.NUM_KEYS).fill(0);
let scenes: any[] = [],
  activeScene: any,
  currentPage = 0;

obs
  .connect({ address: "localhost:4444" })
  .then(() => updateScenes())
  .catch(() => console.log("OBS could not connect!"));
obs.on("ScenesChanged", () => updateScenes());
obs.on("SwitchScenes", (data: any) => setActiveScene(data));

const updateScenes = () => {
  obs.send("GetSceneList").then((info: any) => {
    scenes = info.scenes.map((scene: any, id: number) => ({
      ...scene,
      id,
    }));
    renderNext();
    renderPage(currentPage);
  });
};
const renderPage = (page: number) => {
  currentPage = page;
  const scenesPart = scenes.slice(
    currentPage * fields.scenes.length,
    (currentPage + 1) * fields.scenes.length
  );
  scenesPart.forEach((scene) => renderScene(scene));
  Array(fields.scenes.length - scenesPart.length)
    .fill(0)
    .forEach((x, i) =>
      myStreamDeck.fillColor(
        fields.scenes[fields.scenes.length - 1 - i],
        0,
        0,
        0
      )
    );
};
const renderScene = async (scene: any) => {
  let fieldIndex = scene.id - currentPage * fields.scenes.length;
  if (fieldIndex >= 0 && fieldIndex < fields.scenes.length) {
    myStreamDeck.fillImage(
      fields.scenes[fieldIndex],
      await textgen(
        scene.name,
        TextgenType.SCENE,
        activeScene && scene.id === activeScene.id
      )
    );
  }
};
const renderNext = async () => {
  myStreamDeck.fillImage(
    fields.nextPage,
    await textgen("NEXT", TextgenType.NEXT)
  );
};
let browser: any;
const setActiveScene = async (info: any) => {
  let lastActiveScene = activeScene;
  activeScene = scenes.find((scene) => scene.name === info.sceneName);
  if (lastActiveScene) renderScene(lastActiveScene);
  renderScene(activeScene);

  if (activeScene) {
    browser = activeScene.sources.find(
      (source: any) => source.type === "browser_source"
    );
    if (browser) {
      myStreamDeck.fillImage(fields.up, await image("../fixtures/left.png"));
      myStreamDeck.fillImage(fields.down, await image("../fixtures/right.png"));
    } else {
      myStreamDeck.fillColor(fields.up, 50, 50, 50);
      myStreamDeck.fillColor(fields.down, 50, 50, 50);
    }
  }
};

const nextPage = () =>
  renderPage(
    scenes.length > (currentPage + 1) * fields.scenes.length
      ? currentPage + 1
      : 0
  );

myStreamDeck.on("down", (keyIndex: number) => {
  fieldsDown[keyIndex] = new Date().getTime();
  if (fields.scenes.includes(keyIndex)) {
    let sceneIndex =
      currentPage * fields.scenes.length + fields.scenes.indexOf(keyIndex);
    if (sceneIndex < scenes.length) {
      obs.send("SetCurrentScene", { "scene-name": scenes[sceneIndex].name });
      setActiveScene({ sceneName: scenes[sceneIndex].name });
    }
  } else if (keyIndex === fields.up && browser) {
    webServer.emitBrowserSourceKeyDown("ArrowUp");
  } else if (keyIndex === fields.down && browser) {
    webServer.emitBrowserSourceKeyDown("ArrowDown");
  } else if (keyIndex === fields.nextPage) {
    nextPage();
  }
});
myStreamDeck.on("up", (keyIndex: number) => {
  if (keyIndex === fields.up && browser) {
    webServer.emitBrowserSourceKeyUp("ArrowUp");
  } else if (keyIndex === fields.down && browser) {
    webServer.emitBrowserSourceKeyUp("ArrowDown");
  }
});

myStreamDeck.on("error", (error: string) => {
  console.error(error);
});
