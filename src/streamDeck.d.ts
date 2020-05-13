type StreamDeckCallback = (data: string & number) => void;
export interface StreamDeck {
    clearAllKeys: () => void;
    fillColor(field: number, r: number, g: number, b: number);
    fillImage(field: number, image: Buffer);
    on(event: 'up' | 'down' | 'error', callback: StreamDeckCallback);
    NUM_KEYS: number;
}
