# liturgy-deck

## Purpose

This software should make controlling a livestream easier through automatically listing all scenes on the stream deck. With a push of a button the scene can be switched to. When a "KAMERA" scene exists, all visibility of all its sources can be easily controlled, useful when using a multi-camera setup. Moreover when there is a browser-source in the active scene, the application provides control button on which events are emitted on the exposed socket.io-server. It can be used to control the browser, if the website displayed is properly programmed.

## Setup

- Install NodeJS
- Download this repository
- Install all dependencies with `npm i`
- Execute the program with `npm run start`