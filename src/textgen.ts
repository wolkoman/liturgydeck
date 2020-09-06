const sharp = require("sharp");
const path = require("path");
const PImage = require("pureimage");
const streamBuffers = require("stream-buffers");

PImage.registerFont(
  path.resolve(__dirname, "../fixtures/SourceSansPro-Regular.ttf"),
  "Source Sans Pro"
).load();

function wrapText(
  context: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: string
) {
  var words = text.split(" ");
  var line = "";
  context.font = `${lineHeight}pt "Source Sans Pro"`;
  context.fillStyle = color;

  for (var n = 0; n < words.length; n++) {
    var testLine = line + words[n] + " ";
    var metrics = context.measureText(testLine);
    var testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.textAlign = "center";
  context.font;
  context.fillText(line, x, y);
}

export enum TextgenType {
  SCENE,
  CAMERA,
  NEXT,
}
export default (streamDeck: any) => async (
  textString: string,
  type: TextgenType,
  active = false,
  warn = false
) => {
  const img = PImage.make(streamDeck.ICON_SIZE, streamDeck.ICON_SIZE);
  const ctx = img.getContext("2d");
  ctx.USE_FONT_GLYPH_CACHING = false;

  if (type === TextgenType.SCENE) {
    ctx.fillStyle = active ? "#ffffff" : "#000000";
    ctx.fillRect(0, 0, streamDeck.ICON_SIZE, streamDeck.ICON_SIZE);
    wrapText(ctx, "SCENE", 2, 16, 60, 15, active ? "#000000" : "#aaaaaa");
    wrapText(ctx, textString, 2, 30, 60, 16, active ? "#000000" : "#ffffff");
  } else if (type === TextgenType.CAMERA) {
    ctx.fillStyle = active ? "red" : warn ? "#ffff00" : "black";
    ctx.fillRect(0, 0, streamDeck.ICON_SIZE, streamDeck.ICON_SIZE);
    const border = 6;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#000000";
    ctx.fillRect(
      border,
      border,
      streamDeck.ICON_SIZE - border * 2,
      streamDeck.ICON_SIZE - border * 2 - 2
    );
    ctx.globalAlpha = 1;
    wrapText(ctx, textString, 6, 18, 60, 16, "#ffffff");
  } else if (type === TextgenType.NEXT) {
    wrapText(ctx, textString, 2, 16, 60, 15, "#aaaaaa");
  }

  const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
    initialSize: 20736, // Start at what should be the exact size we need
    incrementAmount: 1024, // Grow by 1 kilobyte each time buffer overflows.
  });

  try {
    await PImage.encodePNGToStream(img, writableStreamBuffer);

    const pngBuffer = await sharp({
      create: {
        width: streamDeck.ICON_SIZE,
        height: streamDeck.ICON_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([{ input: writableStreamBuffer.getContents() }])
      .png()
      .toBuffer();
    const finalBuffer = await sharp(pngBuffer).flatten().raw().toBuffer();
    return finalBuffer;
  } catch (error) {
    console.error(error);
  }
};
