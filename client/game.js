let gameBoard = null;
let currentTurn = null;
let gameInProgress = false;

// DOM Elements
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const gameOverContainer = document.getElementById('game-over-container');

const findMatchBtn = document.getElementById('find-match-btn');
const matchStatusDiv = document.getElementById('match-status');

const player1NameSpan = document.getElementById('player1-name');
const player1RankSpan = document.getElementById('player1-rank');
const player2NameSpan = document.getElementById('player2-name');
const player2RankSpan = document.getElementById('player2-rank');
const boardDiv = document.getElementById('board');
const turnIndicatorDiv = document.getElementById('turn-indicator');
const forfeitBtn = document.getElementById('forfeit-btn');

const winnerMessageP = document.getElementById('winner-message');
const rankChangeP = document.getElementById('rank-change');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');

// Matchmaking
findMatchBtn.addEventListener('click', () => {
    const socket = window.auth.getSocket();
    if (!socket) return;

    socket.emit('find-match');
    findMatchBtn.disabled = true;
    matchStatusDiv.textContent = 'Recherche d\'un adversaire...';
});

// Game
document.querySelectorAll('.column-selector').forEach(column => {
    column.addEventListener('click', (e) => {
        const socket = window.auth.getSocket();
        if (!socket) return;

        if (gameInProgress && currentTurn === window.auth.getCurrentUser().id) {
            const columnIndex = parseInt(e.target.dataset.column);
            socket.emit('make-move', { column: columnIndex });
        }
    });
});

forfeitBtn.addEventListener('click', () => {
    const socket = window.auth.getSocket();
    if (!socket) return;

    if (gameInProgress) {
        socket.emit('forfeit');
    }
});

backToLobbyBtn.addEventListener('click', () => {
    gameOverContainer.classList.add('hidden');
    lobbyContainer.classList.remove('hidden');
    findMatchBtn.disabled = false;
    matchStatusDiv.textContent = '';

    // Mettre à jour les infos joueur avec les nouvelles données
    window.auth.updatePlayerInfo();

    // Recharger le classement
    window.leaderboard.load();
});

// Render board
function renderBoard() {
    boardDiv.innerHTML = '';

    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';

            const value = gameBoard[row][col];
            if (value === 1) {
                cell.classList.add('player1');
            } else if (value === 2) {
                cell.classList.add('player2');
            }

            boardDiv.appendChild(cell);
        }
    }
}

// Update turn indicator
function updateTurnIndicator() {
    const currentUser = window.auth.getCurrentUser();
    if (!currentUser) return;

    if (currentTurn === currentUser.id) {
        turnIndicatorDiv.textContent = 'Votre tour';
        turnIndicatorDiv.classList.add('your-turn');
        turnIndicatorDiv.classList.remove('opponent-turn');
    } else {
        turnIndicatorDiv.textContent = 'Tour de l\'adversaire';
        turnIndicatorDiv.classList.add('opponent-turn');
        turnIndicatorDiv.classList.remove('your-turn');
    }
}

// Setup socket event listeners
function setupSocketListeners() {
    const socket = window.auth.getSocket();
    if (!socket) return;

    // Match found
    socket.on('match-found', (data) => {
        lobbyContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        gameInProgress = true;
        gameBoard = data.board;
        currentTurn = data.currentTurn;

        // Set player info
        const currentUser = window.auth.getCurrentUser();
        const players = data.players;
        const opponent = players.find(p => p.id !== currentUser.id);

        if (players[0].id === currentUser.id) {
            player1NameSpan.textContent = currentUser.username;
            player1RankSpan.textContent = currentUser.rank;
            player2NameSpan.textContent = opponent.username;
            player2RankSpan.textContent = opponent.rank;
        } else {
            player1NameSpan.textContent = opponent.username;
            player1RankSpan.textContent = opponent.rank;
            player2NameSpan.textContent = currentUser.username;
            player2RankSpan.textContent = currentUser.rank;
        }

        renderBoard();
        updateTurnIndicator();
    });

    // Game update
    socket.on('game-update', (data) => {
        gameBoard = data.board;
        currentTurn = data.currentTurn;

        renderBoard();
        updateTurnIndicator();
    });

    // Game over
    socket.on('game-over', (data) => {
        gameInProgress = false;
        gameContainer.classList.add('hidden');
        gameOverContainer.classList.remove('hidden');

        // Update currentUser with new data
        const currentUser = window.auth.getCurrentUser();
        Object.assign(currentUser, data.player);

        // Update winner message
        if (data.winner) {
            if (data.winner === currentUser.id) {
                winnerMessageP.textContent = 'Vous avez gagné !';
                winnerMessageP.className = 'win';
            } else {
                winnerMessageP.textContent = 'Vous avez perdu !';
                winnerMessageP.className = 'loss';
            }
        } else {
            winnerMessageP.textContent = 'Match nul !';
            winnerMessageP.className = 'draw';
        }

        // Display rank change
        if (data.eloChange > 0) {
            rankChangeP.textContent = `+${data.eloChange} points ELO`;
            rankChangeP.classList.add('positive-change');
            rankChangeP.classList.remove('negative-change');
        } else if (data.eloChange < 0) {
            rankChangeP.textContent = `${data.eloChange} points ELO`;
            rankChangeP.classList.add('negative-change');
            rankChangeP.classList.remove('positive-change');
        } else {
            rankChangeP.textContent = 'Aucun changement de points ELO';
            rankChangeP.classList.remove('positive-change', 'negative-change');
        }
    });

    // Error handling
    socket.on('matchmaking-error', (data) => {
        findMatchBtn.disabled = false;
        matchStatusDiv.textContent = data.message || 'Erreur de matchmaking';
        matchStatusDiv.classList.add('error');

        setTimeout(() => {
            matchStatusDiv.classList.remove('error');
            matchStatusDiv.textContent = '';
        }, 3000);
    });

    socket.on('move-error', (data) => {
        console.error('Erreur de coup:', data.message);
    });
}

// Initialize game module
document.addEventListener('DOMContentLoaded', () => {
    // Setup socket listeners after authentication is completed
    setTimeout(() => {
        setupSocketListeners();
    }, 500);
});