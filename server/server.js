const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS 설정: 일렉트론(클라이언트)에서 오는 접속을 허용합니다.
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// 사용자가 연결되었을 때 실행
io.on('connection', (socket) => {
    console.log('새로운 사용자 접속:', socket.id);

    // 1. 방 입장 (초대 시스템의 기초)
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`사용자(${socket.id})가 방(${roomId})에 입장했습니다.`);
    });

    // 2. 그림 데이터 중계 (핵심 기능)
    socket.on('draw-data', (data) => {
        // data 예시: { roomId: 'room123', x: 100, y: 150, color: 'red', isDrawing: true }
        
        // 해당 방에 있는 다른 사람들에게만 좌표를 전달 (나 제외)
        socket.to(data.roomId).emit('render-draw', data);
    });

    // 접속 종료 시
    socket.on('disconnect', () => {
        console.log('사용자 접속 종료:', socket.id);
    });
});

const PORT = process.env.PORT || 3000; // 서버 포트 또는 3000번

server.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});