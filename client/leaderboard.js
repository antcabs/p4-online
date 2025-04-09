// Gestion du classement
const leaderboardDiv = document.getElementById('leaderboard');

// Charger le classement depuis le serveur
async function loadLeaderboard() {
    try {
        console.log('Chargement du classement...');
        const response = await fetch('/api/leaderboard?limit=10');

        if (response.ok) {
            const data = await response.json();
            console.log('Données du classement reçues:', data);
            renderLeaderboard(data.leaderboard);
        } else {
            console.error('Erreur lors du chargement du classement:', await response.text());
        }
    } catch (error) {
        console.error('Erreur lors du chargement du classement:', error);
    }
}

// Afficher le classement
function renderLeaderboard(players) {
    if (!leaderboardDiv) {
        console.error('Élément leaderboard introuvable');
        return;
    }

    console.log('Affichage du classement avec', players.length, 'joueurs');

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

    // Créer le corps
    const tbody = document.createElement('tbody');

    if (players && players.length > 0) {
        players.forEach((player, index) => {
            const row = document.createElement('tr');

            // Ajouter la classe "current-user" si c'est l'utilisateur actuel
            const currentUser = window.auth && window.auth.getCurrentUser ? window.auth.getCurrentUser() : null;
            if (currentUser && player.id === currentUser.id) {
                row.classList.add('current-user');
            }

            // Position
            const posCell = document.createElement('td');
            posCell.textContent = index + 1;
            row.appendChild(posCell);

            // Nom du joueur
            const nameCell = document.createElement('td');
            nameCell.textContent = player.username || 'Inconnu';
            row.appendChild(nameCell);

            // ELO
            const eloCell = document.createElement('td');
            eloCell.textContent = player.elo || '0';
            row.appendChild(eloCell);

            // Rang
            const rankCell = document.createElement('td');
            rankCell.textContent = player.rank || 'Inconnu';
            row.appendChild(rankCell);

            // Statistiques
            const statsCell = document.createElement('td');
            statsCell.textContent = `${player.wins || 0}/${player.losses || 0}/${player.draws || 0}`;
            row.appendChild(statsCell);

            tbody.appendChild(row);
        });
    } else {
        // Afficher un message si aucun joueur n'est trouvé
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

// Exporter les fonctions
window.leaderboard = {
    load: loadLeaderboard
};