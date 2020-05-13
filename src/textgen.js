const sharp = require('sharp')
const path = require('path')
const PImage = require('pureimage')
const streamBuffers = require('stream-buffers')

PImage.registerFont(path.resolve(__dirname, '../fixtures/SourceSansPro-Regular.ttf'), 'Source Sans Pro').load();


function wrapText(context, text, x, y, maxWidth, lineHeight) {
    var words = text.split(' ');
    var line = '';

    for(var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + ' ';
      var metrics = context.measureText(testLine);
      var testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      }
      else {
        line = testLine;
      }
    }
    context.textAlign = "center";
    context.fillText(line, x, y);
  }

module.exports = (streamDeck) => async (textString, style = 0) => {

    const img = PImage.make(streamDeck.ICON_SIZE, streamDeck.ICON_SIZE)
    const ctx = img.getContext('2d');
    ctx.fillStyle = ['#000022', '#223377', '#888800'][style];
    ctx.fillRect(0, 0, streamDeck.ICON_SIZE, streamDeck.ICON_SIZE) // As of v0.1, pureimage fills the canvas with black by default.
    ctx.font = '16pt "Source Sans Pro"'
    ctx.USE_FONT_GLYPH_CACHING = false
    ctx.fillStyle = ['#ffffff', '#ffffff', '#ffffff'][style];
    wrapText(ctx, textString, 2, 18, 60, 16);

    const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
        initialSize: 20736, // Start at what should be the exact size we need
        incrementAmount: 1024 // Grow by 1 kilobyte each time buffer overflows.
    })

    try {
        await PImage.encodePNGToStream(img, writableStreamBuffer)

        const pngBuffer = await sharp({
          create: {
          width: streamDeck.ICON_SIZE,
          height: streamDeck.ICON_SIZE,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 }
          }
        })
          .composite([{input: writableStreamBuffer.getContents()}])
          .png()
          .toBuffer()
        const finalBuffer = await sharp(pngBuffer)
          .flatten()
          .raw()
          .toBuffer()
        return (finalBuffer);
    } catch (error) {
        console.error(error)
    }
};