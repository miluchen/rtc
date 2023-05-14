var name,
    connectedUser;
var connection = new WebSocket('ws://localhost:8888');
connection.onopen = function () {
    console.log("Connected");
};
// Handle all messages through this callback
connection.onmessage = function (message) {
    console.log("Got message", message.data);
    var data = JSON.parse(message.data);
    switch (data.type) {
        case "login":
            onLogin(data.success);
            break;
        case "offer":
            onOffer(data.offer, data.name);
            break;
        case "answer":
            onAnswer(data.answer);
            break;
        case "candidate":
            onCandidate(data.candidate);
            break;
        case "leave":
            onLeave();
            break;
        default:
            break;
    }
};
connection.onerror = function (err) {
    console.log("Got error", err);
};
// Alias for sending messages in JSON format
function send(message) {
    if (connectedUser) {
        message.name = connectedUser;
    }
    connection.send(JSON.stringify(message));
};

var loginPage = document.querySelector('#login-page'),
    usernameInput = document.querySelector('#username'),
    loginButton = document.querySelector('#login'),
    callPage = document.querySelector('#call-page'),
    theirUsernameInput = document.querySelector('#their-username'),
    callButton = document.querySelector('#call'),
    hangUpButton = document.querySelector('#hang-up'),
    sendButton = document.querySelector('#send'),
    messageInput = document.querySelector('#message'),
    received = document.querySelector('#received');
callPage.style.display = "none";
// Login when the user clicks the button
loginButton.addEventListener("click", function (event) {
    name = usernameInput.value;
    if (name.length > 0) {
        send({
            type: "login",
            name: name
        });
    }
});

function onLogin(success) {
    if (success === false) {
        alert("Login unsuccessful, please try a different name.");
    } else {
        loginPage.style.display = "none";
        callPage.style.display = "block";
        // Get the plumbing ready for a call
        startConnection();
    }
};

var yourVideo = document.querySelector('#yours'),
    theirVideo = document.querySelector('#theirs'),
    yourConnection, connectedUser, stream, dataChannel;

function startConnection() {
    if (hasUserMedia()) {
        navigator.getUserMedia({ video: true, audio: false }, function (myStream) {
            stream = myStream;
            // yourVideo.src = window.URL.createObjectURL(stream);
            yourVideo.srcObject = stream;
            if (hasRTCPeerConnection()) {
                setupPeerConnection(stream);
            } else {
                alert("Sorry, your browser does not support WebRTC.");
            }
        }, function (error) {
            console.log(error);
        });
    } else {
        alert("Sorry, your browser does not support WebRTC.");
    }
}

function setupPeerConnection(stream) {
    var configuration = {
        "iceServers": [{ "url": "stun:stun.1.google.com:19302" }]
    };
    yourConnection = new RTCPeerConnection(configuration);
    // openDataChannel()
    // Setup stream listening
    yourConnection.addStream(stream);
    yourConnection.onaddstream = function (e) {
        // theirVideo.src = window.URL.createObjectURL(e.stream);
        theirVideo.srcObject = e.stream;
    };
    // Setup ice handling
    yourConnection.onicecandidate = function (event) {
        if (event.candidate) {
            send({
                type: "candidate",
                candidate: event.candidate
            });
        }
    };
    yourConnection.ondatachannel = function (event) {
        console.log("peer creates a data channel");
        dataChannel = event.channel;
        setupDataChannel()
        // openDataChannel();
    }

    // start data channel
    var dataChannelOptions = {
        reliable: true
    };
    console.log("create data channel");
    // var dataChannelOptions = new RTCDataChannelInit(true);
    dataChannel = yourConnection.createDataChannel("myLabel", dataChannelOptions);
    setupDataChannel();
    console.log("create data channel - finish");
}

function hasUserMedia() {
    navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;
    return !!navigator.getUserMedia;
}

function hasRTCPeerConnection() {
    window.RTCPeerConnection = window.RTCPeerConnection ||
        window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    window.RTCSessionDescription = window.RTCSessionDescription ||
        window.webkitRTCSessionDescription ||
        window.mozRTCSessionDescription;
    window.RTCIceCandidate = window.RTCIceCandidate ||
        window.webkitRTCIceCandidate || window.mozRTCIceCandidate;
    return !!window.RTCPeerConnection;
}

callButton.addEventListener("click", function () {
    var theirUsername = theirUsernameInput.value;
    if (theirUsername.length > 0) {
        startPeerConnection(theirUsername);
    }
});
function startPeerConnection(user) {
    connectedUser = user;
    // Begin the offer
    yourConnection.createOffer(function (offer) {
        send({
            type: "offer",
            offer: offer
        });
        yourConnection.setLocalDescription(offer);
    }, function (error) {
        alert("An error has occurred.", error);
    });
};

function onOffer(offer, name) {
    connectedUser = name;
    yourConnection.setRemoteDescription(new RTCSessionDescription(offer));
    yourConnection.createAnswer(function (answer) {
        yourConnection.setLocalDescription(answer);
        send({
            type: "answer",
            answer: answer
        });
    }, function (error) {
        alert("An error has occurred", error);
    });
};

function onAnswer(answer) {
    yourConnection.setRemoteDescription(new RTCSessionDescription(answer));
};

function onCandidate(candidate) {
    yourConnection.addIceCandidate(new RTCIceCandidate(candidate));
};

hangUpButton.addEventListener("click", function () {
    send({
        type: "leave"
    });
    onLeave();
});

function onLeave() {
    connectedUser = null;
    theirVideo.src = null;
    yourConnection.close();
    yourConnection.onicecandidate = null;
    yourConnection.onaddstream = null;
    setupPeerConnection(stream);
};

function setupDataChannel() {
    dataChannel.onerror = function (error) {
        console.log("Data Channel Error:", error);
    };
    dataChannel.onmessage = function (event) {
        console.log("Got Data Channel Message:", event.data);
        received.innerHTML += "recv: " + event.data + "<br />";
        received.scrollTop = received.scrollHeight;
    };
    dataChannel.onopen = function () {
        dataChannel.send(name + " has connected.");
    };
    dataChannel.onclose = function () {
        console.log("The Data Channel is Closed");
    };
}

// Bind our text input and received area
sendButton.addEventListener("click", function (event) {
    var val = messageInput.value;
    received.innerHTML += "send: " + val + "<br />";
    received.scrollTop = received.scrollHeight;
    dataChannel.send(val);
});
