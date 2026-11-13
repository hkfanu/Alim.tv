// ==================== STATE & MULTI-TAB SYNC ====================
let currentUser = "Guest";
let currentRoomCode = "";
let isHost = true;
let roomPrivacy = "open"; 
const syncChannel = new BroadcastChannel("alim_tv_sync");

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const invitedRoom = params.get("room");
  const invitedPrivacy = params.get("privacy");

  if (invitedRoom) {
    currentRoomCode = invitedRoom;
    roomPrivacy = invitedPrivacy || "open";
    isHost = false;
    document.getElementById("joinCodeInput").value = invitedRoom;
  }
  initCanvas();
  initDraggableCam();
});

// ==================== 1. LOGIN & REGISTER ====================
function toggleAuthMode(mode, btn) {
  document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("authSubmitBtn").textContent =
    mode === "login" ? "Enter Alim.tv →" : "Create Account & Enter →";
}

function handleAuth(e) {
  e.preventDefault();
  currentUser = document.getElementById("authName").value.trim() || "Annu";
  document.getElementById("welcomeUserText").textContent = `Hi, ${currentUser}! ✨`;
  document.getElementById("camUsernameLabel").textContent = currentUser;

  if (!isHost && currentRoomCode) {
    enterInvitedRoom();
  } else {
    showScreen("lobby-screen");
  }
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

// ==================== 2. ROOM LOBBY & INVITE LINKS ====================
function createRoom() {
  isHost = true;
  const roomName = document.getElementById("roomNameInput").value.trim() || "Alim Hangout";
  roomPrivacy = document.getElementById("roomPrivacySelect").value;
  const customBg = document.getElementById("lobbyBgInput").value.trim();

  currentRoomCode = "ALIM-" + Math.floor(1000 + Math.random() * 9000);

  document.getElementById("displayRoomName").textContent = roomName;
  document.getElementById("roomCodeDisplay").textContent = `ID: ${currentRoomCode}`;
  document.getElementById("modalPrivacySelect").value = roomPrivacy;

  if (customBg) {
    document.body.style.backgroundImage = `url('${customBg}')`;
  }

  updateBrowserUrl();
  showScreen("room-screen");
  resizeCanvas();
}

function joinExistingRoom() {
  const code = document.getElementById("joinCodeInput").value.trim().toUpperCase();
  if (!code) return alert("Enter a Room Code!");
  currentRoomCode = code;
  isHost = false;
  updateBrowserUrl();
  enterInvitedRoom();
}

function updateBrowserUrl() {
  const cleanBase = window.location.origin + window.location.pathname;
  const newUrl = `${cleanBase}?room=${currentRoomCode}&privacy=${roomPrivacy}`;
  window.history.pushState({}, "", newUrl);
}

function enterInvitedRoom() {
  document.getElementById("displayRoomName").textContent = `Room ${currentRoomCode}`;
  document.getElementById("roomCodeDisplay").textContent = `ID: ${currentRoomCode}`;

  if (roomPrivacy === "approval") {
    document.getElementById("waitingRoomLabel").textContent = `Room Code: ${currentRoomCode}`;
    showScreen("waiting-screen");
    syncChannel.postMessage({ type: "knock", user: currentUser, room: currentRoomCode });
  } else {
    showScreen("room-screen");
    resizeCanvas();
    addChatMessage("System", `${currentUser} joined the room! 🎉`, true);
  }
}

function simulateHostApprove() {
  showScreen("room-screen");
  resizeCanvas();
}

function copyInviteLink() {
  const cleanBase = window.location.origin + window.location.pathname;
  const link = `${cleanBase}?room=${currentRoomCode}&privacy=${roomPrivacy}`;
  navigator.clipboard.writeText(link);
  const btn = document.getElementById("copyLinkBtn");
  btn.textContent = "✅ Link Copied!";
  setTimeout(() => (btn.textContent = "🔗 Copy Room Link"), 2500);
}

function approveGuest(allowed) {
  document.getElementById("knockBanner").style.display = "none";
  syncChannel.postMessage({ type: "knock_response", allowed, room: currentRoomCode });
}

// ==================== 3. ROBUST MEDIA PLAYER (YOUTUBE, BILIBILI, TWITCH) ====================
function loadMedia() {
  const platform = document.getElementById("platformSelect").value;
  const rawInput = document.getElementById("videoUrlInput").value.trim();
  const iframe = document.getElementById("mediaIframe");
  const screenVideo = document.getElementById("screenVideo");

  if (!rawInput) return alert("Paste a video link or ID first!");

  screenVideo.style.display = "none";
  iframe.style.display = "block";

  let embedUrl = "";

  if (platform === "youtube") {
    const ytMatch = rawInput.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    const videoId = ytMatch ? ytMatch[1] : rawInput;
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  } else if (platform === "bilibili") {
    const bvMatch = rawInput.match(/(BV[0-9A-Za-z]+)/i);
    const bvid = bvMatch ? bvMatch[1] : rawInput;
    embedUrl = `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1`;
  } else if (platform === "twitch") {
    const twitchMatch = rawInput.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
    const channel = twitchMatch ? twitchMatch[1] : rawInput;
    const parentHost = window.location.hostname || "localhost";
    embedUrl = `https://player.twitch.tv/?channel=${channel}&parent=${parentHost}`;
  }

  iframe.src = embedUrl;
  syncChannel.postMessage({ type: "media", embedUrl, room: currentRoomCode });
}

async function startScreenShare() {
  const iframe = document.getElementById("mediaIframe");
  const screenVideo = document.getElementById("screenVideo");
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    iframe.style.display = "none";
    screenVideo.style.display = "block";
    screenVideo.srcObject = stream;
  } catch (err) {
    console.log("Screen share stopped.");
  }
}

// ==================== 4. MOVABLE / DRAGGABLE CAMERA & MIC ====================
let myCamStream = null;
let myMicStream = null;

async function toggleMyCam() {
  const videoElem = document.getElementById("userCamFeed");
  const avatarPlaceholder = document.getElementById("camAvatarPlaceholder");

  if (!myCamStream) {
    try {
      myCamStream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElem.srcObject = myCamStream;
      videoElem.style.display = "block";
      avatarPlaceholder.style.display = "none";
      document.getElementById("camToggleBtn").textContent = "🟢";
    } catch (err) {
      alert("Could not access camera. Check permissions.");
    }
  } else {
    myCamStream.getTracks().forEach(track => track.stop());
    myCamStream = null;
    videoElem.style.display = "none";
    avatarPlaceholder.style.display = "block";
    document.getElementById("camToggleBtn").textContent = "📷";
  }
}

async function toggleMyMic() {
  const micBtn = document.getElementById("micToggleBtn");
  if (!myMicStream) {
    try {
      myMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micBtn.textContent = "🟢";
    } catch (err) {
      alert("Could not access microphone.");
    }
  } else {
    myMicStream.getTracks().forEach(track => track.stop());
    myMicStream = null;
    micBtn.textContent = "🎙️";
  }
}

// Draggable Logic for Camera Bubble
function initDraggableCam() {
  const bubble = document.getElementById("draggableCamBubble");
  const container = document.getElementById("playerFrameContainer");
  let isDragging = false, startX, startY, initialX, initialY;

  bubble.addEventListener("mousedown", e => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = bubble.getBoundingClientRect();
    const parentRect = container.getBoundingClientRect();
    initialX = rect.left - parentRect.left;
    initialY = rect.top - parentRect.top;
    bubble.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    bubble.style.left = `${initialX + dx}px`;
    bubble.style.top = `${initialY + dy}px`;
    bubble.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    bubble.style.cursor = "grab";
  });
}

// ==================== 5. STAGE TABS & CUSTOMIZATION ====================
function switchStageTab(tabName, btn) {
  document.querySelectorAll(".stage-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`tab-${tabName}`).classList.add("active");
  btn.classList.add("active");
  if (tabName === "draw") resizeCanvas();
}

function changeTheme(themeName) {
  document.body.className = `theme-${themeName}`;
  document.getElementById("lobbyThemeSelect").value = themeName;
  document.getElementById("modalThemeSelect").value = themeName;
}

function toggleCustomizeModal() {
  const modal = document.getElementById("customizeModal");
  modal.style.display = modal.style.display === "none" ? "flex" : "none";
}

function applyCustomBg() {
  const url = document.getElementById("modalBgInput").value.trim();
  document.body.style.backgroundImage = url ? `url('${url}')` : "none";
}

function updatePrivacy(val) {
  roomPrivacy = val;
  updateBrowserUrl();
}

// ==================== 6. DRAWING CANVAS ====================
let canvas, ctx, isDrawing = false;
let currentColor = "#ff4d8d";

function initCanvas() {
  canvas = document.getElementById("drawCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");

  canvas.addEventListener("mousedown", e => {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });

  canvas.addEventListener("mousemove", e => {
    if (!isDrawing) return;
    const size = document.getElementById("brushSize").value;
    drawStroke(e.offsetX, e.offsetY, currentColor, size);
    syncChannel.postMessage({
      type: "draw",
      x: e.offsetX,
      y: e.offsetY,
      color: currentColor,
      size,
      room: currentRoomCode
    });
  });

  canvas.addEventListener("mouseup", () => (isDrawing = false));
  canvas.addEventListener("mouseleave", () => (isDrawing = false));
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
}

function drawStroke(x, y, color, size) {
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.lineTo(x, y);
  ctx.stroke();
}

function setColor(hex) {
  currentColor = hex;
  document.getElementById("brushColor").value = hex;
}

document.addEventListener("input", e => {
  if (e.target.id === "brushColor") currentColor = e.target.value;
});

function setEraser() {
  currentColor = "#ffffff";
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  syncChannel.postMessage({ type: "clear_canvas", room: currentRoomCode });
}

// ==================== 7. TIC-TAC-TOE ====================
let tttBoard = ["", "", "", "", "", "", "", "", ""];
let tttTurn = "X";

function playTTT(idx) {
  if (tttBoard[idx] !== "") return;
  tttBoard[idx] = tttTurn;
  renderTTT();
  tttTurn = tttTurn === "X" ? "O" : "X";
  document.getElementById("tttStatus").textContent = `Player ${tttTurn}'s Turn`;
  syncChannel.postMessage({ type: "ttt", board: tttBoard, turn: tttTurn, room: currentRoomCode });
}

function renderTTT() {
  const cells = document.querySelectorAll(".ttt-cell");
  tttBoard.forEach((val, i) => {
    cells[i].textContent = val;
    cells[i].style.color = val === "X" ? "#8b5cf6" : "#ec4899";
  });
}

function resetTTT() {
  tttBoard = ["", "", "", "", "", "", "", "", ""];
  tttTurn = "X";
  renderTTT();
  document.getElementById("tttStatus").textContent = "Player X's Turn";
}

// ==================== 8. CHAT & EMOJIS ====================
function sendChat(e) {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  addChatMessage(currentUser, msg, false);
  syncChannel.postMessage({ type: "chat", user: currentUser, msg, room: currentRoomCode });
  input.value = "";
}

function addChatMessage(sender, text, isSystem) {
  const ul = document.getElementById("chatList");
  const li = document.createElement("li");
  if (isSystem) {
    li.className = "sys";
    li.textContent = text;
  } else {
    li.innerHTML = `<strong>${sender}:</strong> ${text}`;
  }
  ul.appendChild(li);
  ul.scrollTop = ul.scrollHeight;
}

function triggerFloatingEmoji(emoji) {
  const container = document.getElementById("floatingEmojiContainer");
  const span = document.createElement("span");
  span.className = "float-emoji";
  span.textContent = emoji;
  span.style.left = Math.random() * 80 + "px";
  container.appendChild(span);
  setTimeout(() => span.remove(), 2000);
}

function addCustomEmoji() {
  const custom = prompt("Paste any emoji or cute kaomoji (e.g., 🧸, 🍓, (≧◡≦)):");
  if (custom && custom.trim()) {
    const dock = document.getElementById("emojiDock");
    const btn = document.createElement("button");
    btn.textContent = custom.trim();
    btn.onclick = () => triggerFloatingEmoji(custom.trim());
    dock.insertBefore(btn, dock.lastElementChild);
  }
}

// ==================== BROADCAST SYNC LISTENER ====================
syncChannel.onmessage = event => {
  const data = event.data;
  if (data.room !== currentRoomCode) return;

  if (data.type === "chat") addChatMessage(data.user, data.msg, false);
  if (data.type === "media") document.getElementById("mediaIframe").src = data.embedUrl;
  if (data.type === "clear_canvas") ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (data.type === "ttt") {
    tttBoard = data.board;
    tttTurn = data.turn;
    renderTTT();
    document.getElementById("tttStatus").textContent = `Player ${tttTurn}'s Turn`;
  }
  if (data.type === "knock" && isHost) {
    document.getElementById("knockText").textContent = `👋 ${data.user} is knocking to enter!`;
    document.getElementById("knockBanner").style.display = "flex";
  }
  if (data.type === "knock_response" && !isHost) {
    if (data.allowed) {
      showScreen("room-screen");
      resizeCanvas();
    } else {
      alert("The host declined your request to enter.");
      showScreen("lobby-screen");
    }
  }
};
