const socket = io(); // 알아서 socket.io를 실행하는 서버 찾을 것

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

const call = document.getElementById("call");

call.hidden = true; 

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label == camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        })
    } catch (e) {
        console.log(e);
    }
}

async function getMedia(deviceId) { // 유저의 카메라와 오디오를 가져옴
    const initialConstraints = { // deviceId가 없을 때 실행됨 (cameras 만들기 전)
        audio: true,
        video: { facingMode: "user" },
    };
    const cameraConstraints = { // deviceId가 있을 때 실행됨
        audio: true,
        video: { deviceId: {exact: deviceId} }
    };
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints : initialConstraints
        );
        myFace.srcObject = myStream;
        if(!deviceId){
            await getCameras();
        }
    } catch (e) {
        console.log(e);
    }
}

function handleMuteClick() {
    myStream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
    if(!muted) {
        muteBtn.innerText = "Unmute";
        muted = true;
    } else {
        muteBtn.innerText = "Mute";
        muted = false;
    }
}

function handleCameraClick() {
    myStream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
    if(cameraOff){
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value);
    if (myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection
            .getSenders()
            .find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);


/* Welcome Form (join a room) */
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true; // 소켓이 방에 입장했으므로 form을 숨김
    call.hidden = false;   // call을 보여줌
    await getMedia();      // 카메라, 마이크 다 불러오는 시작 함수
    makeConnection();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value); // 1
    roomName = input.value; // 방에 join 했을 때 나중에 쓸 수 있도록 현재 있는 방 이름을 변수에 저장함
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);


/* Socket Code */
// Brave 브라우저에서만 실행됨
socket.on("welcome", async ()=> { // 다른 브라우저가 연결했으면 Brave 브라우저에서 offer 만듦! 2
    myDataChannel = myPeerConnection.createDataChannel("chat");
    myDataChannel.addEventListener("message", (event) => console.log(event.data));
    console.log("made data channel");
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, roomName); // 어떤 방이 offer를 emit할지 알려줘야 함
});

// FireFox 브라우저에서만 실행됨
socket.on("offer", async (offer) => { // Brave 브라우저에서 FireFox 브라우저에 offer 보냄 3
    myPeerConnection.addEventListener("datachannel", (event) => {
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", (event) => console.log(event.data));
    })
    console.log("received the offer");
    myPeerConnection.setRemoteDescription(offer); 
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
});

// Brave 브라우저에서 실행됨
socket.on("answer", (answer) => {
    console.log("received the answer");
    myPeerConnection.setRemoteDescription(answer); 
});

// 서버에서 보낸 icecandidate을 받음
socket.on("ice", (ice) => {
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
})

/* RTC Code */
// 각각의 브라우저가 연결할 때 필요한 설정(영상과 오디오)을 myPeerConnection에 넣음
function makeConnection() {
    myPeerConnection = new RTCPeerConnection(
        // {
        // iceServers: [
        //   {
        //     urls: [
        //         "stun:stun.l.google.com:19302",
        //         "stun:stun1.l.google.com:19302",
        //         "stun:stun2.l.google.com:19302",
        //         "stun:stun3.l.google.com:19302",
        //         "stun:stun4.l.google.com:19302",
        //     ],
        //   },
        // ],
        // }
      );

    myPeerConnection.addEventListener("icecandidate", handleIce); // icecandidate 이벤트 발생 시 handleIce 함수 호출
    myPeerConnection.addEventListener("addstream", handleAddStream); // stream을 주고 받음 -> data로 상대방의 stream이 들어옴
    myStream
        .getTracks()
        .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) { // icecandidate 이벤트 발생 시 호출됨 -> icecandidate을 서버로 보냄
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
}