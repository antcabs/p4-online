// Importer le système de classement
const RankSystem = require('./rankSystem');
const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.players = new Map();
        this.sessions = new Map();
        this.dataDir = path.join(__dirname, '../data');
        this.playersFile = path.join(this.dataDir, 'players.json');

        // S'assurer que le répertoire de données existe
        this.initializeDataDirectory();

        // Charger les données des joueurs depuis le fichier
        this.loadPlayers();
    }

    initializeDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            console.log(`Répertoire de données créé: ${this.dataDir}`);
        }

        if (!fs.existsSync(this.playersFile)) {
            fs.writeFileSync(this.playersFile, JSON.stringify({ players: [] }), 'utf8');
            console.log(`Fichier des joueurs créé: ${this.playersFile}`);
        }
    }

    loadPlayers() {
        try {
            const data = fs.readFileSync(this.playersFile, 'utf8');
            const parsedData = JSON.parse(data);

            if (parsedData.players && Array.isArray(parsedData.players)) {
                parsedData.players.forEach(player => {
                    this.players.set(player.id, player);
                });
                console.log(`${this.players.size} joueurs chargés depuis ${this.playersFile}`);
            }
        } catch (error) {
            console.error(`Erreur lors du chargement des joueurs:`, error);
        }
    }

    savePlayers() {
        try {
            const playersArray = Array.from(this.players.values());
            fs.writeFileSync(this.playersFile, JSON.stringify({ players: playersArray }, null, 2), 'utf8');
            console.log(`${playersArray.length} joueurs sauvegardés dans ${this.playersFile}`);
        } catch (error) {
            console.error(`Erreur lors de la sauvegarde des joueurs:`, error);
        }
    }

    async authenticatePlayer(username, password) {
        // Rechercher le joueur par nom d'utilisateur
        let player = this.findPlayerByUsername(username);

        if (!player) {
            // Si le joueur n'existe pas, on retourne une erreur
            return { success: false, message: "Nom d'utilisateur ou mot de passe incorrect" };
        } else {
            // Vérifier le mot de passe
            if (player.password === password) {
                // Créer une session pour ce joueur
                const sessionId = this.createSession(player.id);
                return { success: true, player, sessionId };
            } else {
                return { success: false, message: "Nom d'utilisateur ou mot de passe incorrect" };
            }
        }
    }

    createPlayer(username, password) {
        // Vérifier si le nom d'utilisateur est déjà pris
        if (this.findPlayerByUsername(username)) {
            return { success: false, message: "Ce nom d'utilisateur est déjà pris" };
        }

        // Créer un nouvel ID de joueur
        const id = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const defaultElo = 1000;
        const rankSystem = new RankSystem();

        // Créer le joueur
        const player = {
            id,
            username,
            password,
            elo: defaultElo,
            rank: rankSystem.getRank(defaultElo),
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            created: new Date().toISOString()
        };

        // Ajouter le joueur à la base de données
        this.players.set(id, player);

        // Sauvegarder les joueurs dans le fichier
        this.savePlayers();

        // Créer une session pour ce joueur
        const sessionId = this.createSession(id);

        return { success: true, player, sessionId };
    }

    createSession(playerId) {
        const sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.sessions.set(sessionId, {
            playerId,
            created: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        });

        return sessionId;
    }

    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return { valid: false, message: "Session non trouvée" };
        }

        // Mettre à jour la dernière activité
        session.lastActivity = new Date().toISOString();

        // Obtenir le joueur associé à cette session
        const player = this.getPlayer(session.playerId);

        if (!player) {
            this.sessions.delete(sessionId);
            return { valid: false, message: "Joueur non trouvé" };
        }

        return { valid: true, player };
    }

    getPlayer(id) {
        return this.players.get(id) || null;
    }

    findPlayerByUsername(username) {
        for (const player of this.players.values()) {
            if (player.username.toLowerCase() === username.toLowerCase()) {
                return player;
            }
        }
        return null;
    }

    updatePlayerRating(id, newElo) {
        const player = this.getPlayer(id);
        if (player) {
            player.elo = newElo;

            // Update rank based on new ELO
            const rankSystem = new RankSystem();
            player.rank = rankSystem.getRank(newElo);

            // Sauvegarder les modifications
            this.savePlayers();

            return true;
        }
        return false;
    }

    updatePlayerStats(id, result) {
        const player = this.getPlayer(id);
        if (player) {
            player.gamesPlayed = player.gamesPlayed || 0;
            player.wins = player.wins || 0;
            player.losses = player.losses || 0;
            player.draws = player.draws || 0;

            player.gamesPlayed++;

            if (result === 'win') {
                player.wins++;
            } else if (result === 'loss') {
                player.losses++;
            } else if (result === 'draw') {
                player.draws++;
            }

            // Sauvegarder les modifications
            this.savePlayers();

            return true;
        }
        return false;
    }

    getLeaderboard(limit = 10) {
        const players = Array.from(this.players.values());

        // Sort by ELO (highest first)
        players.sort((a, b) => b.elo - a.elo);

        // Return top players
        return players.slice(0, limit);
    }

    removeSession(sessionId) {
        return this.sessions.delete(sessionId);
    }
}

// Exporter la classe pour l'utiliser dans d'autres fichiers
module.exports = Database;