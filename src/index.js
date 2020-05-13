const statusPage = require('fs').readFileSync('./public/status.html');
const app = require('http').createServer((req, res) => {
    res.write(statusPage);
    res.end();
});
const { openStreamDeck } = require('elgato-stream-deck')
const OBSWebSocket = require('obs-websocket-js');
const obs = new OBSWebSocket();
const fetch = require('node-fetch');
const ip = require("ip");
const port = 8080;
let myStreamDeck;

try{
    myStreamDeck = openStreamDeck();
}catch(e){
    console.log("Error connecting to StreamDeck");
    process.exit();
}
myStreamDeck.clearAllKeys();

const io = require('socket.io')(app);
const textgen = require("./textgen.js")(myStreamDeck);
const image = require("./image.js")(myStreamDeck);
app.listen(port);
console.log(`Camera status can be viewed on: ${ip.address()}:${port}`);

const fields = {
    scenes: [0,1,2,5,6,7,10,11],
    camera: [8,9],
    up: 3,
    down: 4,
    nextPage: 12,
};
const fieldsDown = Array(myStreamDeck.NUM_KEYS).fill(0);
let scenes = [], activeCameraIndex = 0, warnCameraIndex = 0, cameraScene, activeScene, currentPage = 0;

obs
    .connect({ address: 'localhost:4444'})
    .then(() => updateScenes())
    .catch(() => console.log("OBS could not connect!"));
obs.on('ScenesChanged', () => updateScenes());
obs.on('SwitchScenes', (data) => setActiveScene(data));

const updateScenes = (info) => {
    obs.send('GetSceneList').then(info => {
        scenes = info.scenes.map((scene,id) => ({...scene, id }));
        cameraScene = scenes.find(scene => scene.name === 'KAMERA');
        renderCamera();
        renderPage(currentPage);
    });
};
const renderPage = (page) => {
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
        cameraScene.sources.forEach(async (source,i) => myStreamDeck.fillImage(
            fields.camera[i],
            await textgen('KAMERA '+source.name, activeCameraIndex === i ? 1 : (warnCameraIndex === i ? 2 : 0))
        ));
    }
}
const renderScene = async (scene) => {
    let fieldIndex = scene.id - currentPage * fields.scenes.length;
    if(fieldIndex >= 0 && fieldIndex < fields.scenes.length){
        myStreamDeck.fillImage(
            fields.scenes[fieldIndex],
            await textgen(scene.name, (activeScene && scene.id === activeScene.id) ? 1 : 0)
        );
    }
}
let browser;
const setActiveScene = async (info) => {
    let lastActiveScene = activeScene;
    activeScene = scenes.find(scene => scene.name === info.sceneName);
    if(lastActiveScene) renderScene(lastActiveScene);
    renderScene(activeScene);

    if(activeScene){
        browser = activeScene.sources.find(source => source.type === 'browser_source');
        if(browser){
            myStreamDeck.fillImage(fields.up, await image('../fixtures/left.png'));
            myStreamDeck.fillImage(fields.down, await image('../fixtures/right.png'));
        }else{
            myStreamDeck.fillColor(fields.up, ...Array(3).fill(150));
            myStreamDeck.fillColor(fields.down, ...Array(3).fill(150));
        }
    }
}

const nextPage = () => renderPage((scenes.length > (currentPage+1) * fields.scenes.length) ? (currentPage + 1) : 0);

myStreamDeck.on('down', keyIndex => {

    fieldsDown[keyIndex] = new Date().getTime();
    if(fields.scenes.includes(keyIndex)){
        let sceneIndex = currentPage * fields.scenes.length + fields.scenes.indexOf(keyIndex);
        if(sceneIndex < scenes.length){
            obs.send('SetCurrentScene', {'scene-name': scenes[sceneIndex].name})
            setActiveScene({sceneName: scenes[sceneIndex].name});
        }
    }else if(keyIndex === fields.up && browser){
        io.emit('keydown', {key: 'ArrowUp'});
    }else if(keyIndex === fields.down && browser){
        io.emit('keydown', {key: 'ArrowDown'});
    }else if(keyIndex === fields.nextPage){
        nextPage();
    }
});
myStreamDeck.on('up', keyIndex => {
    if(fields.camera.includes(keyIndex)){
        let time = new Date().getTime() - fieldsDown[keyIndex];

        if(cameraScene && cameraScene.sources.length > activeCameraIndex){
            if(time < 200){
                activeCameraIndex = fields.camera.findIndex(i => i === keyIndex);
                warnCameraIndex = -1;
                cameraScene.sources
                    .filter((source,i) => i !== activeCameraIndex)
                    .forEach(source => obs.send('SetSceneItemProperties', {item: source.name,"scene-name":"KAMERA", visible: false}).catch(console.log));
                obs.send('SetSceneItemProperties', {item: cameraScene.sources[activeCameraIndex].name,"scene-name":"KAMERA", visible: true});
                io.emit('camera', activeCameraIndex);
            }else{
                warnCameraIndex = fields.camera.findIndex(i => i === keyIndex);
                fetch('https://liturgy.wolko.at/camera/warn/' + warnCameraIndex).then(x => x.text());
                io.emit('camerawarn', warnCameraIndex);
            }
            renderCamera();
        }
    }
});
myStreamDeck.on('error', error => {
	console.error(error)
});

