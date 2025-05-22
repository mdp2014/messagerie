// --- CONFIGURATION SUPABASE ---
const supabaseUrl = 'https://mlzkkljtvhlshtoujubm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1semtrbGp0dmhsc2h0b3VqdWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDMyOTMsImV4cCI6MjA1ODkxOTI5M30._fYLWHH0EHtTyvqslouIcrOFz8l-ZBaqraKAON7Ce8k';
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

// Rafraîchir les réactions d'un seul message
async function refreshReactionsForMessage(messageId, userId) {
  // Trouve la div .reactions associée au message
  const msgDiv = [...document.getElementsByClassName('message')].find(div => {
    return div.dataset && div.dataset.messageId == messageId;
  });
  if (msgDiv) {
    const reactionsDiv = msgDiv.querySelector('.reactions');
    if (reactionsDiv) {
      const reactions = await getReactions(messageId);
      const reactionsBtn = renderReactions(reactions, messageId, userId);
      reactionsDiv.innerHTML = '';
      reactionsDiv.appendChild(reactionsBtn);
    }
  }
}

// Ajouter une réaction (corrigé)
async function addReaction(messageId, userId, emoji) {
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
  refreshReactionsForMessage(messageId, userId);
}

// Générer le bouton unique + menu emoji
function renderReactions(reactions, messageId, userId) {
  const container = document.createElement('div');
  container.className = 'reaction-buttons';
  // --- BOUTON UNIQUE ---
  const triggerBtn = document.createElement('button');
  triggerBtn.textContent = "😀";
  triggerBtn.className = "trigger-emoji-btn";
  triggerBtn.onclick = (e) => {
    e.stopPropagation();
    // Enlève le menu ouvert s'il existe déjà
    const existingMenu = container.querySelector('.emoji-menu');
    if(existingMenu) { existingMenu.remove(); return; }
    // Crée le menu
    const menu = document.createElement('div');
    menu.className = 'emoji-menu';
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.className = 'emoji-choice-btn';
      btn.onclick = (ev) => {
        ev.stopPropagation();
        if (userId) addReaction(messageId, userId, emoji);
        else alert("Connecte-toi pour réagir !");
        menu.remove();
      };
      menu.appendChild(btn);
    });
    container.appendChild(menu);
    // Ferme le menu si clic ailleurs
    document.addEventListener('click', function closeMenuFn() {
      if(menu) menu.remove();
      document.removeEventListener('click', closeMenuFn);
    });
  };
  container.appendChild(triggerBtn);

  // --- Affiche les réactions déjà ajoutées (avec le compteur) ---
  emojis.forEach(emoji => {
    const count = reactions.filter(r => r.emoji === emoji).length;
    if(count > 0) {
      const span = document.createElement('span');
      span.textContent = `${emoji} ${count}`;
      span.className = "shown-reaction";
      container.appendChild(span);
    }
  });

  return container;
}

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
      msgEl.dataset.messageId = msg.id; // Pour retrouver ce message lors du refresh des réactions

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

      // --- REACTIONS ---
      const reactionsDiv = document.createElement('div');
      reactionsDiv.className = 'reactions';
      getReactions(msg.id).then(reactions => {
        const reactionsBtn = renderReactions(reactions, msg.id, currentUserId);
        reactionsDiv.innerHTML = '';
        reactionsDiv.appendChild(reactionsBtn);
      });
      msgEl.appendChild(reactionsDiv);
      // --- FIN REACTIONS ---

      chatMessages.appendChild(msgEl);
    }
    // Scroll en bas à chaque nouveau message/affichage
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } else {
    console.error('Erreur chargement messages:', data);
  }
}

// --- ACTUALISATION CACHÉE DES RÉACTIONS ---
function refreshAllReactionsInBackground() {
  const messageDivs = document.querySelectorAll('.message');
  messageDivs.forEach(msgDiv => {
    const messageId = msgDiv.dataset.messageId;
    const reactionsDiv = msgDiv.querySelector('.reactions');
    if (messageId && reactionsDiv) {
      getReactions(messageId).then(reactions => {
        const reactionsBtn = renderReactions(reactions, messageId, currentUserId);
        reactionsDiv.innerHTML = '';
        reactionsDiv.appendChild(reactionsBtn);
      });
    }
  });
}
setInterval(refreshAllReactionsInBackground, 2000); // Toutes les 2 secondes

// Rafraîchissement automatique global désactivé (optionnel)
// function refreshMessages() {
//   setInterval(getMessages, 1500);
// }

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
      // refreshMessages();
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
userSelect.addEventListener('change', getMessages);

window.onload = () => {
  getUsers().then(() => {
    getMessages();
  });
};
