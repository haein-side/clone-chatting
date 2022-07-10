import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
// import { WebSocketServer } from "ws";
import express from "express";
import path from "path";
import { SocketAddress } from "net";

const app  = express();
const __dirname = path.resolve();

app.set("view engine", "pug");
app.set("views", __dirname + "/src/views");
app.use("/public", express.static(__dirname + "/src/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));


const httpServer = http.createServer(app);
const wsServer = new Server(httpServer , {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true
    },
});

instrument(wsServer, {
    auth: false
});

// 서버에 열려 있는 publicRooms의 이름 배열
function publicRooms(){
    const {
        sockets: {
            adapter: { sids, rooms },
        },
    } = wsServer;

    const publicRooms = [];
    rooms.forEach((_, key) => {
        if(sids.get(key) === undefined) {
            publicRooms.push(key);
        }
    })
    return publicRooms;
}

// room에 존재하는 user count
function countRoom(roomName) {
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}


wsServer.on("connection", socket => { // connection을 받을 준비가 됨
    socket["nickname"] = "Anon";
    socket.onAny((event) => {
        console.log(wsServer.sockets.adapter);
        console.log(`Socket Event:${event}`);
    });
    socket.on("enter_room", (roomName, done) => {
        socket.join(roomName); // 방에 들어갈 수 있음
        done(); // front의 showRoom 호출
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName)); // roomName에 있는 모든 사람에게 보냄
        wsServer.sockets.emit("room_change", publicRooms());  // 새로 업데이트된 모든 방의 list를 front에 줌 -> 리스트 업데이트
    });
    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname, countRoom(room)-1));
    });
    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms());  // 서버에 있는 모든 방의 array를 줌
    });
    socket.on("new_message1", (msg, room, done) => {
        socket.to(room).emit("new_message2", `${socket.nickname}: ${msg}`);
        done();
    });
    socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
});


/*
const wss = new WebSocketServer({ server });
// 몇 명이 연결되었는지 모름
const sockets = [];

wss.on("connection", (socket) => {
    sockets.push(socket); // 연결될 때 array에 넣어줌 -> 받은 메시지를 sockets에 있는 모든 socket에 전달 가능 
    socket["nickname"] = "Anon"; // 소켓 안에 정보를 줄 수 있음!!
    console.log("Connected to Browser");
    socket.on("close", () =>  console.log("Disconnected from the Browser")); // 브라우저 탭 끄면 실행됨
    socket.on("message", (msg) => { // 특정 socket에서 메시지(모든 것 가능) 받았을 때 발생
        const message = JSON.parse(msg.toString('utf8')); // String -> JSON Object
        switch (message.type) {
            case "new_message":
                // 자신과 다른 브라우저에 전송
                // nickname property를 socket object에 저장
                sockets.forEach(aSocket => aSocket.send(`${socket.nickname.toString('utf8')} : ${message.payload.toString('utf8')}`)); // 연결된 모든 socket에 메시지를 보낼 것
            case "nickname":
                socket["nickname"] = message.payload; // 받은 닉네임을 소켓에 넣어줌 (소켓도 객체)
        }
    });
});
*/

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);