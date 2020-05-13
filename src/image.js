const path = require('path');
const sharp = require('sharp') // See http://sharp.dimens.io/en/stable/ for full docs on this great library!

module.exports = (streamDeck) => (img) => sharp(path.resolve(__dirname, img))
	.flatten() // Eliminate alpha channel, if any.
	.resize(streamDeck.ICON_SIZE, streamDeck.ICON_SIZE) // Scale up/down to the right size, cropping if necessary.
	.raw() // Give us uncompressed RGB.
	.toBuffer()