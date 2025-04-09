/**
 * FICHIER TOUT-EN-UN POUR PUISSANCE 4 ONLINE
 * Ce fichier regroupe toutes les fonctionnalités (auth, game, leaderboard) pour éviter les problèmes d'importation
 */

// ============ VARIABLES GLOBALES ============
let currentUser = null;
let socket = null;
let gameBoard = null;
let currentTurn = null;
let gameInProgress = false;

// ============ ÉLÉMENTS DOM ============
// Containers principaux
const loginContainer = document.getElementById('login-container');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const gameOverContainer = document.getElementById('game-over-container');

// Formulaires d'authentification
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authTabs = document.querySelectorAll('.auth-tab');

// Inputs de connexion
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginErrorDiv = document.getElementById('login-error');

// Inputs d'inscription
const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');
const registerConfirmPasswordInput = document.getElementById('register-confirm-password');
const registerBtn = document.getElementById('register-btn');
const registerErrorDiv = document.getElementById('register-error');

// Éléments du lobby
const playerNameSpan = document.getElementById('player-name');
const playerRankSpan = document.getElementById('player-rank');
const playerEloSpan = document.getElementById('player-elo');
const playerGamesSpan = document.getElementById('player-games');
const playerRecordSpan = document.getElementById('player-record');
const findMatchBtn = document.getElementById('find-match-btn');
const matchStatusDiv = document.getElementById('match-status');
const leaderboardDiv = document.getElementById('leaderboard');
const logoutBtn = document.getElementById('logout-btn');

// Éléments du jeu
const player1NameSpan = document.getElementById('player1-name');
const player1RankSpan = document.getElementById('player1-rank');
const player2NameSpan = document.getElementById('player2-name');
const player2RankSpan = document.getElementById('player2-rank');
const boardDiv = document.getElementById('board');
const turnIndicatorDiv = document.getElementById('turn-indicator');
const forfeitBtn = document.getElementById('forfeit-btn');

// Éléments de fin de partie
const winnerMessageP = document.getElementById('winner-message');
const rankChangeP = document.getElementById('rank-change');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');

// ============ FONCTIONS D'INITIALISATION ============

// Fonction initiale appelée au chargement de la page
function initialize() {
    console.log('Initialisation de l\'application...');

    // Vérifier si l'utilisateur a une session active
    checkSession();

    // Attacher les événements
    setupEventListeners();

    console.log('Initialisation terminée!');
}

// Configurer tous les écouteurs d'événements
function setupEventListeners() {
    // Authentification
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);
    logoutBtn.addEventListener('click', handleLogout);

    // Onglets d'authentification
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });

    // Navigation au clavier dans les formulaires
    setupFormNavigation();

    // Matchmaking
    findMatchBtn.addEventListener('click', findMatch);

    // Jeu
    document.querySelectorAll('.column-selector').forEach(column => {
        column.addEventListener('click', handleColumnClick);
    });
    forfeitBtn.addEventListener('click', handleForfeit);
    backToLobbyBtn.addEventListener('click', navigateToLobby);
}

// Configuration de la navigation clavier dans les formulaires
function setupFormNavigation() {
    loginUsernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginPasswordInput.focus();
    });

    loginPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    registerUsernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') registerPasswordInput.focus();
    });

    registerPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') registerConfirmPasswordInput.focus();
    });

    registerConfirmPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

// Initialiser le socket avec le sessionId
function initializeSocket() {
    console.log('Initialisation du socket...');
    const sessionId = localStorage.getItem('sessionId');

    if (!sessionId) {
        console.warn('Pas de sessionId trouvé, impossible d\'initialiser le socket');
        return null;
    }

    socket = io({
        auth: { sessionId }
    });

    // Gestion des événements socket
    setupSocketEvents(socket);

    return socket;
}

// Configuration des événements socket
function setupSocketEvents(socket) {
    if (!socket) return;

    // Erreurs de connexion
    socket.on('connect_error', (error) => {
        console.error('Erreur de connexion socket:', error.message);

        if (error.message.includes('Authentification') || error.message.includes('Session')) {
            localStorage.removeItem('sessionId');
            navigateToLogin();
        }
    });

    // Connexion établie
    socket.on('connect', () => {
        console.log('Connexion socket établie, ID:', socket.id);
    });

    // Connexion réussie
    socket.on('login-success', (data) => {
        console.log('Événement login-success reçu:', data);
        if (data && data.player) {
            updateCurrentUser(data.player);
            navigateToLobby();
        }
    });

    // Événements du jeu
    socket.on('match-found', handleMatchFound);
    socket.on('game-update', handleGameUpdate);
    socket.on('game-over', handleGameOver);

    // Erreurs
    socket.on('matchmaking-error', (data) => {
        console.error('Erreur de matchmaking:', data.message);
        showMatchError(data.message);
    });

    socket.on('move-error', (data) => {
        console.error('Erreur de mouvement:', data.message);
    });
}

// ============ FONCTIONS D'AUTHENTIFICATION ============

// Vérifier si l'utilisateur a une session active
async function checkSession() {
    console.log('Vérification de la session...');

    try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();

        if (response.ok && data.valid) {
            console.log('Session valide trouvée:', data);
            updateCurrentUser(data.player);
            socket = initializeSocket();
            navigateToLobby();
        } else {
            console.log('Pas de session valide');
            navigateToLogin();
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de la session:', error);
        navigateToLogin();
    }
}

// Gérer la connexion
async function handleLogin() {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!username || !password) {
        showAuthError('Veuillez remplir tous les champs', 'login');
        return;
    }

    console.log('Tentative de connexion pour:', username);

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('Réponse de connexion:', data);

        if (data.success) {
            console.log('Connexion réussie!');

            // Sauvegarder la session
            if (data.sessionId) {
                localStorage.setItem('sessionId', data.sessionId);
            }

            // Mettre à jour l'utilisateur et rediriger
            updateCurrentUser(data.player);
            socket = initializeSocket();
            navigateToLobby();
        } else {
            showAuthError(data.message || 'Erreur de connexion', 'login');
        }
    } catch (error) {
        console.error('Erreur de connexion:', error);
        showAuthError('Erreur de serveur', 'login');
    }
}

// Gérer l'inscription
async function handleRegister() {
    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value.trim();
    const confirmPassword = registerConfirmPasswordInput.value.trim();

    // Validation
    if (!username || !password || !confirmPassword) {
        showAuthError('Veuillez remplir tous les champs', 'register');
        return;
    }

    if (password !== confirmPassword) {
        showAuthError('Les mots de passe ne correspondent pas', 'register');
        return;
    }

    if (password.length < 4) {
        showAuthError('Le mot de passe doit faire au moins 4 caractères', 'register');
        return;
    }

    console.log('Tentative d\'inscription pour:', username);

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('Réponse d\'inscription:', data);

        if (data.success) {
            console.log('Inscription réussie!');

            // Sauvegarder la session
            if (data.sessionId) {
                localStorage.setItem('sessionId', data.sessionId);
            }

            // Mettre à jour l'utilisateur et rediriger
            updateCurrentUser(data.player);
            socket = initializeSocket();
            navigateToLobby();
        } else {
            showAuthError(data.message || 'Erreur d\'inscription', 'register');
        }
    } catch (error) {
        console.error('Erreur d\'inscription:', error);
        showAuthError('Erreur de serveur', 'register');
    }
}

// Gérer la déconnexion
async function handleLogout() {
    console.log('Déconnexion...');

    try {
        await fetch('/api/auth/logout', { method: 'POST' });

        // Nettoyer la session
        localStorage.removeItem('sessionId');

        // Déconnecter le socket
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        // Réinitialiser l'utilisateur
        updateCurrentUser(null);

        // Rediriger vers la page de connexion
        navigateToLogin();
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    }
}

// Mettre à jour l'utilisateur actuel
function updateCurrentUser(user) {
    currentUser = user;
    console.log('Utilisateur actuel mis à jour:', currentUser);
}

// ============ FONCTIONS DE NAVIGATION ============

// Naviguer vers la page de connexion
function navigateToLogin() {
    console.log('Navigation vers la page de connexion');

    // Cacher tous les autres conteneurs
    hideAllContainers();

    // Afficher le conteneur de connexion
    loginContainer.classList.remove('hidden');

    // Réinitialiser les formulaires
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
    registerUsernameInput.value = '';
    registerPasswordInput.value = '';
    registerConfirmPasswordInput.value = '';

    // Afficher l'onglet de connexion par défaut
    switchAuthTab('login');
}

// Naviguer vers le lobby
function navigateToLobby() {
    console.log('Navigation vers le lobby');

    if (!currentUser) {
        console.warn('Tentative de navigation vers le lobby sans utilisateur connecté');
        return;
    }

    // Cacher tous les autres conteneurs
    hideAllContainers();

    // Afficher le conteneur du lobby
    lobbyContainer.classList.remove('hidden');

    // Mettre à jour les informations du joueur
    updatePlayerInfo();

    // Charger le classement
    loadLeaderboard();

    // Réinitialiser le statut de recherche de match
    findMatchBtn.disabled = false;
    matchStatusDiv.textContent = '';
    matchStatusDiv.classList.remove('error');
}

// Cacher tous les conteneurs principaux
function hideAllContainers() {
    loginContainer.classList.add('hidden');
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.add('hidden');
    gameOverContainer.classList.add('hidden');
}

// Changer d'onglet d'authentification
function switchAuthTab(tabName) {
    console.log('Changement d\'onglet vers:', tabName);

    // Mise à jour des onglets
    authTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Affichage du formulaire correspondant
    if (tabName === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }

    // Cacher les messages d'erreur
    loginErrorDiv.classList.add('hidden');
    registerErrorDiv.classList.add('hidden');
}

// ============ FONCTIONS D'AFFICHAGE ET D'ERREUR ============

// Afficher une erreur d'authentification
function showAuthError(message, form) {
    const errorDiv = form === 'login' ? loginErrorDiv : registerErrorDiv;

    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');

    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 3000);
}

// Afficher une erreur de matchmaking
function showMatchError(message) {
    findMatchBtn.disabled = false;
    matchStatusDiv.textContent = message;
    matchStatusDiv.classList.add('error');

    setTimeout(() => {
        matchStatusDiv.classList.remove('error');
        matchStatusDiv.textContent = '';
    }, 3000);
}

// Mettre à jour les informations du joueur dans le lobby
function updatePlayerInfo() {
    if (!currentUser) return;

    playerNameSpan.textContent = currentUser.username || 'Inconnu';
    playerRankSpan.textContent = currentUser.rank || 'Inconnu';
    playerEloSpan.textContent = currentUser.elo || '0';
    playerGamesSpan.textContent = currentUser.gamesPlayed || '0';
    playerRecordSpan.textContent = `${currentUser.wins || '0'}/${currentUser.losses || '0'}/${currentUser.draws || '0'}`;
}

// ============ FONCTIONS DU LEADERBOARD ============

// Charger le classement depuis le serveur
async function loadLeaderboard() {
    console.log('Chargement du classement...');

    try {
        const response = await fetch('/api/leaderboard?limit=10');

        if (response.ok) {
            const data = await response.json();
            renderLeaderboard(data.leaderboard);
        } else {
            console.error('Erreur lors du chargement du classement');
            renderLeaderboard([]);
        }
    } catch (error) {
        console.error('Erreur lors du chargement du classement:', error);
        renderLeaderboard([]);
    }
}

// Afficher le classement
function renderLeaderboard(players) {
    if (!leaderboardDiv) return;

    // Vider le contenu actuel
    leaderboardDiv.innerHTML = '';

    // Créer le tableau
    const table = document.createElement('table');
    table.className = 'leaderboard-table';

    // Créer l'en-tête
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    ['Pos.', 'Joueur', 'ELO', 'Rang', 'V/D/N'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Créer le corps du tableau
    const tbody = document.createElement('tbody');

    if (players && players.length > 0) {
        players.forEach((player, index) => {
            const row = document.createElement('tr');

            // Mettre en évidence l'utilisateur actuel
            if (currentUser && player.id === currentUser.id) {
                row.classList.add('current-user');
            }

            // Position
            const posCell = document.createElement('td');
            posCell.textContent = index + 1;
            row.appendChild(posCell);

            // Nom
            const nameCell = document.createElement('td');
            nameCell.textContent = player.username;
            row.appendChild(nameCell);

            // ELO
            const eloCell = document.createElement('td');
            eloCell.textContent = player.elo;
            row.appendChild(eloCell);

            // Rang
            const rankCell = document.createElement('td');
            rankCell.textContent = player.rank;
            row.appendChild(rankCell);

            // Stats
            const statsCell = document.createElement('td');
            statsCell.textContent = `${player.wins || 0}/${player.losses || 0}/${player.draws || 0}`;
            row.appendChild(statsCell);

            tbody.appendChild(row);
        });
    } else {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 5;
        emptyCell.textContent = 'Aucun joueur dans le classement';
        emptyCell.className = 'empty-leaderboard';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
    }

    table.appendChild(tbody);
    leaderboardDiv.appendChild(table);
    console.log('Classement affiché avec succès');
}

// ============ FONCTIONS DU JEU ============

// Rechercher un match
function findMatch() {
    if (!socket) return;

    console.log('Recherche d\'un match...');
    socket.emit('find-match');

    findMatchBtn.disabled = true;
    matchStatusDiv.textContent = 'Recherche d\'un adversaire...';
}

// Gérer un clic sur une colonne
function handleColumnClick(e) {
    if (!socket || !gameInProgress || currentTurn !== currentUser.id) return;

    const columnIndex = parseInt(e.target.dataset.column);
    console.log('Tentative de jouer dans la colonne:', columnIndex);

    socket.emit('make-move', { column: columnIndex });
}

// Gérer l'abandon
function handleForfeit() {
    if (!socket || !gameInProgress) return;

    console.log('Abandon de la partie');
    socket.emit('forfeit');
}

// Gérer la recherche de match réussie
function handleMatchFound(data) {
    console.log('Match trouvé:', data);
    gameInProgress = true;
    gameBoard = data.board;
    currentTurn = data.currentTurn;

    // Cacher tous les autres conteneurs
    hideAllContainers();

    // Afficher le conteneur du jeu
    gameContainer.classList.remove('hidden');

    // Configurer les informations des joueurs
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
}

// Gérer une mise à jour du jeu
function handleGameUpdate(data) {
    console.log('Mise à jour du jeu:', data);
    gameBoard = data.board;
    currentTurn = data.currentTurn;

    renderBoard();
    updateTurnIndicator();
}

// Gérer la fin d'une partie
function handleGameOver(data) {
    console.log('Fin de partie:', data);
    gameInProgress = false;

    // Cacher tous les autres conteneurs
    hideAllContainers();

    // Afficher le conteneur de fin de partie
    gameOverContainer.classList.remove('hidden');

    // Mettre à jour l'utilisateur actuel
    updateCurrentUser(data.player);

    // Afficher le résultat
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

    // Afficher le changement d'ELO
    if (data.eloChange > 0) {
        rankChangeP.textContent = `+${data.eloChange} points ELO`;
        rankChangeP.className = 'positive-change';
    } else if (data.eloChange < 0) {
        rankChangeP.textContent = `${data.eloChange} points ELO`;
        rankChangeP.className = 'negative-change';
    } else {
        rankChangeP.textContent = 'Aucun changement de points ELO';
        rankChangeP.className = '';
    }
}

// Afficher le plateau de jeu
function renderBoard() {
    if (!gameBoard) return;

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

// Mettre à jour l'indicateur de tour
function updateTurnIndicator() {
    if (!currentUser) return;

    if (currentTurn === currentUser.id) {
        turnIndicatorDiv.textContent = 'Votre tour';
        turnIndicatorDiv.className = 'your-turn';
    } else {
        turnIndicatorDiv.textContent = 'Tour de l\'adversaire';
        turnIndicatorDiv.className = 'opponent-turn';
    }
}

// ============ INITIALISATION ============
document.addEventListener('DOMContentLoaded', initialize);