import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
// import { WebSocketServer } from "ws";
import express from "express";
import path from "path";
import { SocketAddress } from "net";
import { doesNotReject } from "assert";

const app  = express();
const __dirname = path.resolve();

app.set("view engine", "pug");
app.set("views", __dirname + "/src/views");
app.use("/public", express.static(__dirname + "/src/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer);

wsServer.on("connection", socket => {
    socket.on("join_room", (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit("welcome"); // 발신자(firefox) 제외하고 roomName인 방의 모든 소켓(brave)이 이벤트 받음
    });
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer); // 발신자(brave) 제외하고 firefox가 이벤트 받음
    });
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer); // brave가 이벤트 받음
    });
    socket.on("ice", (ice, roomName) => { // 서버에서 icecandidate 받고 
        socket.to(roomName).emit("ice", ice); // 발신자를 제외한 모든 roomName을 가진 소켓에 icecandidate 보냄
    });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);