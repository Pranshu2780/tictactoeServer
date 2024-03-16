const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "https://papaya-druid-056eaf.netlify.app",
  "http://localhost:5173",
];

const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: "GET,POST", // Allow only GET and POST requests
    allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
  },
});

let currentPlayer = "X";
const connectedClients = [];

let player1;
let player2;

const initialBoard = Array(9).fill(null);

let board = initialBoard;

const checkWinner = () => {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // Rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // Columns
    [0, 4, 8],
    [2, 4, 6], // Diagonals
  ];

  for (let line of lines) {
    //console.log(line);
    const [a, b, c] = line;
    //   console.log(board[a]);
    //   console.log(board[b]);
    //   console.log(board[c]);
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      console.log(line + "is made");
      return true;
    }
  }

  return false;
};

const makeMoveOnBoard = (index, symbol) => {
  const newBoard = [...board];
  newBoard[index] = symbol;
  board = newBoard;
};

const restartGame = (socket) => {
  board = initialBoard;
  [player1, player2] = [player2, player1];
  socket.broadcast.emit("newGame", "true");
  io.to(player1).emit("beginData", { turn: true, symbol: "X" });
  io.to(player2).emit("beginData", { turn: false, symbol: "O" });
};

const initializeBoard = () => {
  const firstIndex = Math.floor(Math.random() * 2);
  const firstTurnClientId = connectedClients[firstIndex];

  connectedClients.forEach((clientId) => {
    board = initialBoard;
    if (clientId === firstTurnClientId) {
      io.to(clientId).emit("beginData", { turn: true, symbol: "X" });
      player1 = clientId;
    } else {
      io.to(clientId).emit("beginData", { turn: false, symbol: "O" });
      player2 = clientId;
    }
  });
};

io.on("connection", (socket) => {
  connectedClients.push(socket.id);
  console.log("A user connected: " + socket.id);

  if (connectedClients.length === 2) {
    initializeBoard();
  }

  io.emit("ConnectedClients", connectedClients.length);

  if (connectedClients.length > 2) {
    let spBoard = [...board];
    console.log(spBoard);
    socket.emit("beginData", {
      turn: false,
      symbol: "Spectator",
      specBoard: spBoard,
    });
  }

  console.log("A user connected: " + socket.id);

  socket.on("restartGame", (data) => {
    restartGame(socket);
  });
  // Handle game-related events here
  socket.on("makeMove", (data) => {
    const { index, symbol } = data;
    console.log(index);
    console.log(symbol);
    makeMoveOnBoard(index, symbol);

    if (checkWinner()) {
      socket.broadcast.emit("moveMade", { index, symbol });
      socket.emit("endgame", { gameOver: true, winner: true });
      socket.broadcast.emit("endgame", { gameOver: true, winner: false });
    } else {
      //const moveData = { index, symbol };
      socket.broadcast.emit("moveMade", { index, symbol });
      let nextplayer = player1 === socket.id ? player2 : player1;

      connectedClients.forEach((clientId) => {
        if (clientId === nextplayer) {
          io.to(clientId).emit("turnData", true);
        } else {
          io.to(clientId).emit("turnData", false);
        }
      });
    }
  });

  socket.on("disconnect", () => {
    const index = connectedClients.indexOf(socket.id);
    if (index > -1) {
      connectedClients.splice(index, 1);
      console.log("User disconnected");
    }
    io.emit("ConnectedClients", connectedClients.length);
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => console.log(`Server listening on port ${port}`));
