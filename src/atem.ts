import { WebServer } from "./webserver";

const ip = "192.168.8.240";
var Atem = require("atem");

export const initAtem = (webServer: WebServer) => {
  var myAtemDevice = new Atem(ip);
  let program: number, preview: number;

  const update = () => {
    webServer.updateCameras(program, preview);
  };

  myAtemDevice.on("connectionStateChange", function (state: any) {
    console.log("Atem: ", state.description);
  });

  myAtemDevice.on("previewBus", (state: number) => {
    preview = state;
    update();
  });

  myAtemDevice.on("programBus", (state: number) => {
    program = state;
  });
};
