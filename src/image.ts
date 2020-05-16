import * as path from 'path';
const sharp = require('sharp');

export default (streamDeck: any) => (img: string) => sharp(path.resolve(__dirname, img))
	.flatten() // Eliminate alpha channel, if any.
	.resize(streamDeck.ICON_SIZE, streamDeck.ICON_SIZE) // Scale up/down to the right size, cropping if necessary.
	.raw() // Give us uncompressed RGB.
	.toBuffer()