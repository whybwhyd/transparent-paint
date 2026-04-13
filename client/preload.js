// client/preload.js

const { contextBridge, ipcRenderer } = require('electron');
const { io } = require("socket.io-client");
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

let socket; // 소켓 인스턴스를 preload 내부에서 관리

contextBridge.exposeInMainWorld('socketIO', {
    connect: (url) => {
        socket = io(url); // 소켓 생성
    },
    // 필요한 기능을 직접 노출
    on: (eventName, callback) => {
        if (socket) socket.on(eventName, (data) => callback(data));
    },
    emit: (eventName, data) => {
        if (socket) socket.emit(eventName, data);
    }
});

contextBridge.exposeInMainWorld('env', {
    SERVER_URL: process.env.SERVER_URL || "http://localhost:3000"
});

contextBridge.exposeInMainWorld('electronAPI', {
    sendIgnoreMouse: (ignore, options) => ipcRenderer.send('set-ignore-mouse', ignore, options)
});