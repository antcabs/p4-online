// Gestion de l'authentification
let currentUser = null;
let socket = null;

// DOM Elements
const loginContainer = document.getElementById('login-container');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const gameOverContainer = document.getElementById('game-over-container');

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

// Bouton de déconnexion
const logoutBtn = document.getElementById('logout-btn');

// Initialiser le socket avec le sessionId si disponible
function initializeSocket() {
    // Créer le socket avec les informations d'authentification
    socket = io({
        auth: {
            sessionId: localStorage.getItem('sessionId')
        }
    });

    // Gestion des erreurs de connexion socket
    socket.on('connect_error', (error) => {
        console.error('Erreur de connexion au socket:', error.message);

        if (error.message === 'Authentification requise' || error.message === 'Session invalide') {
            // Effacer les informations de session si elles sont invalides
            localStorage.removeItem('sessionId');
            showLoginForm();
        }
    });

    // Si la connexion est établie, vérifier la session
    socket.on('connect', () => {
        console.log('Connexion au socket établie');
    });

    // Gestion de la connexion réussie
    socket.on('login-success', (data) => {
        console.log('Événement socket login-success reçu:', data);
        handleLoginSuccess(data.player);
    });

    return socket;
}

// Vérifier si l'utilisateur a une session active
async function checkSession() {
    try {
        console.log('Vérification de la session...');
        const response = await fetch('/api/auth/session');

        if (response.ok) {
            const data = await response.json();
            if (data.valid) {
                console.log('Session valide trouvée:', data.player.username);
                currentUser = data.player;
                navigateToLobby();

                // Initialiser le socket après avoir vérifié la session
                return initializeSocket();
            } else {
                console.log('Session invalide');
                showLoginForm();
            }
        } else {
            console.log('Pas de session trouvée');
            showLoginForm();
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de la session:', error);
        showLoginForm();
    }

    // Si nous arrivons ici, aucune session valide n'a été trouvée
    return initializeSocket();
}

// Basculer entre les onglets de connexion et d'inscription
function switchTab(tabName) {
    // Mettre à jour les classes des onglets
    authTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Afficher le formulaire correspondant
    if (tabName === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }

    // Effacer les messages d'erreur
    loginErrorDiv.classList.add('hidden');
    registerErrorDiv.classList.add('hidden');
}

// Effectuer une tentative de connexion
async function login() {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!username || !password) {
        showError("Veuillez remplir tous les champs", 'login');
        return;
    }

    try {
        console.log('Tentative de connexion pour:', username);
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('Réponse de login:', data);

        if (data.success) {
            console.log('Connexion réussie pour:', username);

            // Stocker le sessionId dans le localStorage
            if (data.sessionId) {
                localStorage.setItem('sessionId', data.sessionId);
                console.log('SessionId stocké dans localStorage');
            }

            // Mettre à jour l'utilisateur actuel
            currentUser = data.player;
            console.log('Utilisateur actuel mis à jour:', currentUser);

            // Mettre à jour le socket avec le nouveau sessionId
            if (socket) {
                socket.auth = { sessionId: data.sessionId || localStorage.getItem('sessionId') };
                socket.connect();
                console.log('Socket mis à jour avec le nouveau sessionId');
            } else {
                socket = initializeSocket();
                console.log('Nouveau socket initialisé');
            }

            // FORCER la redirection vers le lobby
            console.log('Forçage de la redirection vers le lobby...');
            navigateToLobby();
        } else {
            showError(data.message || "Erreur de connexion", 'login');
        }
    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        showError("Erreur de connexion au serveur", 'login');
    }
}

// Effectuer une tentative d'inscription
async function register() {
    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value.trim();
    const confirmPassword = registerConfirmPasswordInput.value.trim();

    // Validation des champs
    if (!username || !password || !confirmPassword) {
        showError("Veuillez remplir tous les champs", 'register');
        return;
    }

    if (password !== confirmPassword) {
        showError("Les mots de passe ne correspondent pas", 'register');
        return;
    }

    if (password.length < 4) {
        showError("Le mot de passe doit contenir au moins 4 caractères", 'register');
        return;
    }

    try {
        console.log('Tentative d\'inscription pour:', username);
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('Réponse d\'inscription:', data);

        if (data.success) {
            console.log('Inscription réussie pour:', username);

            // Stocker le sessionId dans le localStorage
            if (data.sessionId) {
                localStorage.setItem('sessionId', data.sessionId);
                console.log('SessionId stocké dans localStorage');
            }

            // Mettre à jour l'utilisateur actuel
            currentUser = data.player;
            console.log('Utilisateur actuel mis à jour:', currentUser);

            // Mettre à jour le socket avec le nouveau sessionId
            if (socket) {
                socket.auth = { sessionId: data.sessionId || localStorage.getItem('sessionId') };
                socket.connect();
                console.log('Socket mis à jour avec le nouveau sessionId');
            } else {
                socket = initializeSocket();
                console.log('Nouveau socket initialisé');
            }

            // FORCER la redirection vers le lobby
            console.log('Forçage de la redirection vers le lobby...');
            navigateToLobby();
        } else {
            showError(data.message || "Erreur lors de l'inscription", 'register');
        }
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        showError("Erreur de connexion au serveur", 'register');
    }
}

// Déconnexion
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST'
        });

        // Supprimer la session du localStorage
        localStorage.removeItem('sessionId');

        // Déconnecter le socket
        if (socket) {
            socket.disconnect();
        }

        // Réinitialiser l'utilisateur courant
        currentUser = null;

        // Afficher le formulaire de connexion
        showLoginForm();
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    }
}

// Gérer la connexion réussie
function handleLoginSuccess(player) {
    console.log('Fonction handleLoginSuccess appelée avec:', player);
    if (!player) {
        console.error('Données de joueur invalides');
        return;
    }

    currentUser = player;
    console.log('Utilisateur actuel mis à jour:', currentUser);

    // FORCER la redirection vers le lobby
    navigateToLobby();
}

// Navigation vers le lobby
function navigateToLobby() {
    console.log('Navigation vers le lobby...');
    console.log('État avant la navigation:');
    console.log('- loginContainer visible:', !loginContainer.classList.contains('hidden'));
    console.log('- lobbyContainer visible:', !lobbyContainer.classList.contains('hidden'));

    // Cacher tous les autres conteneurs
    loginContainer.classList.add('hidden');
    gameContainer.classList.add('hidden');
    gameOverContainer.classList.add('hidden');

    // Afficher le lobby
    lobbyContainer.classList.remove('hidden');

    console.log('État après la navigation:');
    console.log('- loginContainer visible:', !loginContainer.classList.contains('hidden'));
    console.log('- lobbyContainer visible:', !lobbyContainer.classList.contains('hidden'));

    // Mettre à jour les informations du joueur
    updatePlayerInfo();

    // Charger le classement
    try {
        if (window.leaderboard && typeof window.leaderboard.load === 'function') {
            console.log('Chargement du classement...');
            window.leaderboard.load();
        } else {
            console.warn('Module leaderboard non disponible');
        }
    } catch (error) {
        console.error('Erreur lors du chargement du classement:', error);
    }
}

// Afficher une erreur de connexion ou d'inscription
function showError(message, form) {
    const errorDiv = form === 'login' ? loginErrorDiv : registerErrorDiv;

    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');

    // Cacher le message d'erreur après 3 secondes
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 3000);
}

// Afficher le formulaire de connexion
function showLoginForm() {
    console.log('Affichage du formulaire de connexion');

    // Cacher tous les autres conteneurs
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.add('hidden');
    gameOverContainer.classList.add('hidden');

    // Afficher le formulaire de connexion
    loginContainer.classList.remove('hidden');

    // Afficher l'onglet de connexion par défaut
    switchTab('login');

    // Vider les champs
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
    registerUsernameInput.value = '';
    registerPasswordInput.value = '';
    registerConfirmPasswordInput.value = '';
}

// Mettre à jour les informations du joueur dans le lobby
function updatePlayerInfo() {
    if (!currentUser) {
        console.warn('Pas d\'utilisateur connecté pour mettre à jour les infos');
        return;
    }

    console.log('Mise à jour des informations du joueur:', currentUser);

    try {
        document.getElementById('player-name').textContent = currentUser.username || 'Inconnu';
        document.getElementById('player-rank').textContent = currentUser.rank || 'Inconnu';
        document.getElementById('player-elo').textContent = currentUser.elo || '0';
        document.getElementById('player-games').textContent = currentUser.gamesPlayed || '0';
        document.getElementById('player-record').textContent =
            `${currentUser.wins || '0'}/${currentUser.losses || '0'}/${currentUser.draws || '0'}`;
    } catch (error) {
        console.error('Erreur lors de la mise à jour des informations du joueur:', error);
    }
}

// Événements
loginBtn.addEventListener('click', function() {
    console.log('Bouton de connexion cliqué');
    login();
});

registerBtn.addEventListener('click', function() {
    console.log('Bouton d\'inscription cliqué');
    register();
});

logoutBtn.addEventListener('click', function() {
    console.log('Bouton de déconnexion cliqué');
    logout();
});

// Changer d'onglet lorsqu'on clique sur un onglet
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        console.log('Onglet cliqué:', tab.dataset.tab);
        switchTab(tab.dataset.tab);
    });
});

// Connexion à la touche "Entrée" dans les champs de formulaire
loginUsernameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        loginPasswordInput.focus();
    }
});

loginPasswordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        login();
    }
});

// Inscription à la touche "Entrée" dans les champs de formulaire
registerUsernameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        registerPasswordInput.focus();
    }
});

registerPasswordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        registerConfirmPasswordInput.focus();
    }
});

registerConfirmPasswordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        register();
    }
});

// Initialisation - Vérifier si l'utilisateur a une session active au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initialisation de l\'authentification');
    socket = checkSession();
});

// Exporter les fonctions et variables nécessaires
window.auth = {
    getSocket: () => socket,
    getCurrentUser: () => currentUser,
    updatePlayerInfo
};