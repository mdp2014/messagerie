// --- CONFIGURATION SUPABASE ---
const supabaseUrl = 'https://mlzkkljtvhlshtoujubm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1semtrbGp0dmhsc2h0b3VqdWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDMyOTMsImV4cCI6MjA1ODkxOTI5M30._fYLWHH0EHtTyvqslouIcrOFz8l-ZBaqraKAON7Ce8k';
// --- REACTIONS ---
const emojis = ['👍', '😂', '❤️', '🔥', '👏', '😮', '😢', '😡', '🎉', '🙏'];

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const userSelect = document.getElementById('user-select');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginContainer = document.getElementById('login-container');
const connectedUser = document.getElementById('connected-user');
const connectedUsername = document.getElementById('connected-username');
const logoutButton = document.getElementById('logout-button');

let users = {};
let currentUserId = null;

// Charger utilisateurs
async function getUsers() {
  const response = await fetch(`${supabaseUrl}/rest/v1/users?select=id,username,password`, {
    method: 'GET',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await response.json();
  if (response.ok) {
    userSelect.innerHTML = '';
    data.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.username;
      userSelect.appendChild(option);
      users[user.id] = user;
    });
  } else {
    console.error('Erreur chargement utilisateurs:', data);
  }
}

// Géolocalisation
function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }),
        reject
      );
    } else reject(new Error('Non supporté'));
  });
}

async function getCityFromCoordinates(latitude, longitude) {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
  const data = await response.json();
  return data.address.city || data.address.town || data.address.village || 'Inconnue';
}

// Envoi message
async function sendMessage(userId, content) {
  try {
    const geo = await getGeolocation();
    const city = await getCityFromCoordinates(geo.latitude, geo.longitude);
    const response = await fetch(`${supabaseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        id_sent: userId,
        user_id: userId,
        content,
        created_at: new Date().toISOString(),
        id_received: userSelect.value,
        latitude: geo.latitude,
        longitude: geo.longitude,
        city
      })
    });

    const data = await response.json();
    if (!response.ok) console.error('Erreur message:', data);
    else getMessages();
  } catch (e) {
    console.error('Erreur géoloc:', e);
  }
}

// Supprimer message
async function deleteMessage(messageId) {
  const response = await fetch(`${supabaseUrl}/rest/v1/messages?id=eq.${messageId}`, {
    method: 'DELETE',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  if (response.ok) getMessages();
  else console.error('Erreur suppression:', await response.json());
}

// --- REACTIONS ---
// Récupérer les réactions pour un message
async function getReactions(messageId) {
  const response = await fetch(`${supabaseUrl}/rest/v1/reactions?select=emoji,user_id&id=eq.${messageId}`, {
    method: 'GET',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  if (!response.ok) return [];
  return await response.json();
}

// Ajouter une réaction
async function addReaction(messageId, userId, emoji) {
  // Vérifier si l'utilisateur a déjà mis cette réaction (optionnel, à activer si tu veux empêcher le spam)
  // const existing = await fetch(`${supabaseUrl}/rest/v1/reactions?emoji=eq.${encodeURIComponent(emoji)}&message_id=eq.${messageId}&user_id=eq.${userId}`, { ... });
  // if ((await existing.json()).length > 0) return;

  await fetch(`${supabaseUrl}/rest/v1/reactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
      message_id: messageId,
      user_id: userId,
      emoji
    })
  });
  // Rafraîchir les messages pour mettre à jour les réactions
  getMessages();
}

// Générer les boutons de réactions et l'affichage des compteurs
function renderReactions(reactions, messageId, userId) {
  const container = document.createElement('div');
  container.className = 'reaction-buttons';
  emojis.forEach(emoji => {
    // Compter le nombre de fois que cet emoji a été utilisé pour ce message
    const count = reactions.filter(r => r.emoji === emoji).length;
    // Vérifier si l'utilisateur a déjà réagi avec cet emoji (optionnel)
    const userReacted = reactions.some(r => r.emoji === emoji && r.user_id === userId);

    const btn = document.createElement('button');
    btn.textContent = emoji + (count > 0 ? ` ${count}` : '');
    btn.disabled = !userId; // Désactiver si pas connecté

    // Optionnel : style si déjà réagi
    if (userReacted) btn.style.backgroundColor = "#e8e8e8";

    btn.onclick = () => {
      if (userId) addReaction(messageId, userId, emoji);
      else alert("Connecte-toi pour réagir !");
    };
    container.appendChild(btn);
  });
  return container;
}
// --- FIN REACTIONS ---

// Afficher messages (modifié pour intégrer les réactions)
async function getMessages() {
  if (!currentUserId || !userSelect.value) {
    chatMessages.innerHTML = '';
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/messages?select=*&order=created_at.asc&or=(and(id_sent.eq.${currentUserId},id_received.eq.${userSelect.value}),and(id_sent.eq.${userSelect.value},id_received.eq.${currentUserId}))`, {
    method: 'GET',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await response.json();

  if (response.ok) {
    chatMessages.innerHTML = '';
    let lastDate = null;
    // --- REACTIONS --- On charge toutes les réactions d'un coup pour optimiser (facultatif)
    // const reactionsAll = await fetch(`${supabaseUrl}/rest/v1/reactions?select=emoji,user_id,message_id`, { ... });
    // const reactionsData = reactionsAll.ok ? await reactionsAll.json() : [];
    // --- FIN facultatif
    for (const msg of data) {
      const msgDate = new Date(msg.created_at).toLocaleDateString();
      const msgTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sender = users[msg.id_sent]?.username || 'Inconnu';
      const city = msg.city ? ` (${msg.city} - ${msgTime})` : '';

      if (msgDate !== lastDate) {
        const dateEl = document.createElement('div');
        dateEl.textContent = msgDate;
        dateEl.classList.add('date');
        chatMessages.appendChild(dateEl);
        lastDate = msgDate;
      }

      const msgEl = document.createElement('div');
      msgEl.textContent = `${sender}${city}: ${msg.content}`;
      msgEl.classList.add('message');
      if (msg.id_sent === currentUserId) {
        msgEl.classList.add('sent');
        const delBtn = document.createElement('span');
        delBtn.textContent = '✖';
        delBtn.classList.add('delete-button');
        delBtn.onclick = () => deleteMessage(msg.id);
        msgEl.appendChild(delBtn);
      } else {
        msgEl.classList.add('received');
      }

      // --- REACTIONS --- Ajout des boutons de réactions
      const reactionsDiv = document.createElement('div');
      reactionsDiv.className = 'reactions';
      // Récupérer puis afficher les réactions pour ce message
      getReactions(msg.id).then(reactions => {
        const reactionsBtn = renderReactions(reactions, msg.id, currentUserId);
        reactionsDiv.innerHTML = '';
        reactionsDiv.appendChild(reactionsBtn);
      });
      msgEl.appendChild(reactionsDiv);
      // --- FIN REACTIONS ---

      chatMessages.appendChild(msgEl);
    }
  } else {
    console.error('Erreur chargement messages:', data);
  }
}

// Rafraîchissement automatique
function refreshMessages() {
  setInterval(getMessages, 1500);
}

// Connexion
function login() {
  const username = loginUsername.value;
  const password = loginPassword.value;
  const user = Object.values(users).find(u => u.username === username);

  if (user) {
    if (user.password === '' || user.password === password) {
      currentUserId = user.id;
      alert('Connecté !');
      loginContainer.style.display = 'none';
      connectedUser.style.display = 'block';
      connectedUsername.textContent = user.username;
      getMessages();
      refreshMessages();
    } else alert('Mot de passe incorrect');
  } else alert('Utilisateur introuvable');
}

// Déconnexion
function logout() {
  currentUserId = null;
  loginContainer.style.display = 'block';
  connectedUser.style.display = 'none';
  chatMessages.innerHTML = '';
}

// Événements
sendButton.addEventListener('click', () => {
  if (currentUserId) {
    const content = messageInput.value.trim();
    if (content) {
      sendMessage(currentUserId, content);
      messageInput.value = '';
    }
  } else {
    alert('Connectez-vous pour envoyer un message');
  }
});

loginButton.addEventListener('click', login);
logoutButton.addEventListener('click', logout);

window.onload = () => {
  getUsers().then(() => {
    getMessages();
  });
};

userSelect.addEventListener('change', getMessages);

// 🔐 Système d'inscription
document.getElementById('signup-button').addEventListener('click', async () => {
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;

  if (!username || !password || !confirmPassword) {
    alert("Tous les champs sont requis.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Les mots de passe ne correspondent pas.");
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ username, password })
  });

  if (response.ok) {
    alert("Compte créé !");
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signup-confirm-password').value = '';
    await getUsers();
  } else {
    const errorData = await response.json();
    alert("Erreur : " + (errorData.message || "Impossible de créer le compte."));
  }
});
