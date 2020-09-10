const express = require("express");
const ip = require("ip");
const io = require("socket.io");
const fs = require("fs");

export class WebServer {
  app: any;
  socket: SocketIO.Server;
  server: any;

  constructor(port: number) {
    this.app = express();
    this.app.get("*", express.static("public"));
    this.server = require("http").Server(this.app);
    this.socket = io(this.server);
    this.server.listen(port);
    console.log(`Camera status can be viewed on: ${ip.address()}:${port}`);
  }

  setProgram(index: number) {
    this.socket.emit("program", index);
  }
  setPreview(index: number) {
    this.socket.emit("preview", index);
  }
  updateCameras(program: number, preview: number) {
    this.socket.emit("update", { program, preview });
  }
  emitBrowserSource(key: "ArrowUp" | "ArrowDown") {
    this.socket.emit("keydown", { key });
  }
}
