import OBSWebSocket from 'obs-websocket-js';
import { StreamDeck } from './streamDeck';
import textgenFile from './textgen';
import imageFile from './image';
import { WebServer } from './webserver';

const { openStreamDeck } = require('elgato-stream-deck')
const fetch = require('node-fetch');
const obs = new OBSWebSocket();
let myStreamDeck: StreamDeck;
let webServer = new WebServer(80);

try{
    myStreamDeck = openStreamDeck();
}catch(e){
    console.log("Error connecting to StreamDeck");
    process.exit();
}

const textgen = textgenFile(myStreamDeck);
const image = imageFile(myStreamDeck);

const fields = {
    scenes: [0,1,2,5,6,7,10,11],
    camera: [8,9],
    up: 3,
    down: 4,
    nextPage: 12,
};

myStreamDeck.clearAllKeys();
const fieldsDown = Array(myStreamDeck.NUM_KEYS).fill(0);
let scenes: any[] = [], activeCameraIndex = 0, warnCameraIndex = 0, cameraScene: any, activeScene: any, currentPage = 0;

obs
    .connect({ address: 'localhost:4444'})
    .then(() => updateScenes())
    .catch(() => console.log("OBS could not connect!"));
obs.on('ScenesChanged', () => updateScenes());
obs.on('SwitchScenes', (data: any) => setActiveScene(data));

const updateScenes = () => {
    obs.send('GetSceneList').then((info: any) => {
        scenes = info.scenes.map((scene: number, id: number) => ({...(scene as any), id }));
        cameraScene = scenes.find(scene => scene.name === 'KAMERA');
        renderCamera();
        renderPage(currentPage);
    });
};
const renderPage = (page: number) => {
    currentPage = page;
    const scenesPart = scenes.slice(currentPage * fields.scenes.length,(currentPage+1) * fields.scenes.length);
    scenesPart.forEach(scene => renderScene(scene));
    Array(fields.scenes.length - scenesPart.length).fill(0).forEach((x,i) => 
        myStreamDeck.fillColor(fields.scenes[fields.scenes.length-1-i], 0, 0, 0)
    );
}
const renderCamera = () => {
    if(cameraScene){
        Array(fields.camera.length - cameraScene.sources.length).fill(0).forEach((x,i) => 
            myStreamDeck.fillColor(fields.camera[fields.camera.length-1-i], 0, 0, 0)
        );
        cameraScene.sources.forEach(async (source: any, i: number) => myStreamDeck.fillImage(
            fields.camera[i],
            await textgen('KAMERA '+source.name, activeCameraIndex === i ? 1 : (warnCameraIndex === i ? 2 : 0))
        ));
    }
}
const renderScene = async (scene: any) => {
    let fieldIndex = scene.id - currentPage * fields.scenes.length;
    if(fieldIndex >= 0 && fieldIndex < fields.scenes.length){
        myStreamDeck.fillImage(
            fields.scenes[fieldIndex],
            await textgen(scene.name, (activeScene && scene.id === activeScene.id) ? 1 : 0)
        );
    }
}
let browser: any;
const setActiveScene = async (info: any) => {
    let lastActiveScene = activeScene;
    activeScene = scenes.find(scene => scene.name === info.sceneName);
    if(lastActiveScene) renderScene(lastActiveScene);
    renderScene(activeScene);

    if(activeScene){
        browser = activeScene.sources.find((source: any) => source.type === 'browser_source');
        if(browser){
            myStreamDeck.fillImage(fields.up, await image('../fixtures/left.png'));
            myStreamDeck.fillImage(fields.down, await image('../fixtures/right.png'));
        }else{
            myStreamDeck.fillColor(fields.up, 150, 150, 150);
            myStreamDeck.fillColor(fields.down, 150, 150, 150);
        }
    }
}

const nextPage = () => renderPage((scenes.length > (currentPage+1) * fields.scenes.length) ? (currentPage + 1) : 0);

myStreamDeck.on('down', (keyIndex: number) => {

    fieldsDown[keyIndex] = new Date().getTime();
    if(fields.scenes.includes(keyIndex)){
        let sceneIndex = currentPage * fields.scenes.length + fields.scenes.indexOf(keyIndex);
        if(sceneIndex < scenes.length){
            obs.send('SetCurrentScene', {'scene-name': scenes[sceneIndex].name})
            setActiveScene({sceneName: scenes[sceneIndex].name});
        }
    }else if(keyIndex === fields.up && browser){
        webServer.emitBrowserSource('ArrowUp');
    }else if(keyIndex === fields.down && browser){
        webServer.emitBrowserSource('ArrowDown');
    }else if(keyIndex === fields.nextPage){
        nextPage();
    }
});
myStreamDeck.on('up', (keyIndex: number) => {
    if(fields.camera.includes(keyIndex)){
        let time = new Date().getTime() - fieldsDown[keyIndex];

        if(cameraScene && cameraScene.sources.length > activeCameraIndex){
            if(time < 200){
                activeCameraIndex = fields.camera.findIndex(i => i === keyIndex);
                warnCameraIndex = -1;
                cameraScene.sources
                    .filter((source: any, i: number) => i !== activeCameraIndex)
                    //@ts-ignore
                    .forEach((source: any) => obs.send('SetSceneItemProperties', {item: source.name as string,"scene-name":"KAMERA", visible: false}).catch(console.log));
                //@ts-ignore
                obs.send('SetSceneItemProperties', {item: cameraScene.sources[activeCameraIndex].name as string,"scene-name":"KAMERA", visible: true});
                webServer.setActiveCamera(activeCameraIndex);
            }else{
                warnCameraIndex = fields.camera.findIndex(i => i === keyIndex);
                webServer.setWarnCamera(activeCameraIndex);
            }
            renderCamera();
        }
    }
});
myStreamDeck.on('error', (error: string) => {
	console.error(error)
});

