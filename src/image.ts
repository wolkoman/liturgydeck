import * as path from "path";
const sharp = require("sharp");

export default (streamDeck: any) => (img: string) =>
  sharp(path.resolve(__dirname, img))
    .flatten()
    .resize(streamDeck.ICON_SIZE, streamDeck.ICON_SIZE)
    .raw()
    .toBuffer();
