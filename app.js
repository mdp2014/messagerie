// --- CONFIGURATION SUPABASE ---
const supabaseUrl = 'https://sqnjzcqcmtjhbptjlixe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbmp6Y3FjbXRqaGJwdGpsaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTY1ODcsImV4cCI6MjA2NDA5MjU4N30.lJIsRndHSS95pxJrH726jDaHANTaj_Q14IoZ4JNm-Rg';
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
    if (!response.ok) {
      console.error('Erreur message:', data);
    } else {
      // Affiche immédiatement le message envoyé
      renderSingleMessage(data[0]);
    }
  } catch (e) {
    console.error('Erreur géoloc:', e);
  }
}

// Affiche un seul message dans la fenêtre de chat
async function renderSingleMessage(msg) {
  const msgDate = new Date(msg.created_at).toLocaleDateString();
  const msgTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sender = users[msg.id_sent]?.username || 'Inconnu';
  const city = msg.city ? ` (${msg.city} - ${msgTime})` : '';

  // Ajoute la date si elle n'existe pas encore
  const existingDates = [...chatMessages.querySelectorAll('.date')].map(el => el.textContent);
  if (!existingDates.includes(msgDate)) {
    const dateEl = document.createElement('div');
    dateEl.textContent = msgDate;
    dateEl.classList.add('date');
    chatMessages.appendChild(dateEl);
  }

  const msgEl = document.createElement('div');
  msgEl.textContent = `${sender}${city}: ${msg.content}`;
  msgEl.classList.add('message');
  msgEl.dataset.messageId = msg.id;

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

  const reactionsDiv = document.createElement('div');
  reactionsDiv.className = 'reactions';
  const reactions = await getReactions(msg.id);
  const reactionsBtn = renderReactions(reactions, msg.id, currentUserId);
  reactionsDiv.appendChild(reactionsBtn);
  msgEl.appendChild(reactionsDiv);

  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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

// Ajouter une réaction (rafraîchit localement sans recharger tout)
async function addReaction(messageId, userId, emoji) {
  const res = await fetch(`${supabaseUrl}/rest/v1/reactions`, {
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
  const data = await res.json();
  if (!res.ok) {
    console.error('Erreur Supabase:', data);
    alert('Erreur lors de l\'enregistrement de la réaction');
  } else {
    refreshReactionsForMessage(messageId, userId);
  }
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
    const existingMenu = container.querySelector('.emoji-menu');
    if(existingMenu) { existingMenu.remove(); return; }
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

// Afficher messages (intègre les réactions)
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
      msgEl.dataset.messageId = msg.id;

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

      const reactionsDiv = document.createElement('div');
      reactionsDiv.className = 'reactions';
      const reactions = await getReactions(msg.id);
      const reactionsBtn = renderReactions(reactions, msg.id, currentUserId);
      reactionsDiv.appendChild(reactionsBtn);
      msgEl.appendChild(reactionsDiv);

      chatMessages.appendChild(msgEl);
    }
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
    if(reactionsDiv && messageId) {
      getReactions(messageId).then(reactions => {
        const newReactionsBtn = renderReactions(reactions, messageId, currentUserId);
        reactionsDiv.innerHTML = '';
        reactionsDiv.appendChild(newReactionsBtn);
      });
    }
  });
}

// --- GESTION CONNEXION ---
async function login(username, password) {
  await getUsers();
  const found = Object.values(users).find(u => u.username === username && u.password === password);
  if (found) {
    currentUserId = found.id;
    loginContainer.style.display = 'none';
    connectedUser.style.display = 'block';
    connectedUsername.textContent = username;
    messageInput.disabled = false;
    sendButton.disabled = false;
    await getMessages();
    setInterval(refreshAllReactionsInBackground, 10000);
  } else {
    alert('Identifiants invalides');
  }
}

function logout() {
  currentUserId = null;
  loginContainer.style.display = 'block';
  connectedUser.style.display = 'none';
  messageInput.disabled = true;
  sendButton.disabled = true;
  chatMessages.innerHTML = '';
}

loginButton.onclick = () => login(loginUsername.value, loginPassword.value);
logoutButton.onclick = logout;

sendButton.onclick = async () => {
  const content = messageInput.value.trim();
  if (content.length > 0) {
    await sendMessage(currentUserId, content);
    messageInput.value = '';
  }
};

userSelect.onchange = () => getMessages();

// --- Initialisation ---
(async () => {
  await getUsers();
  messageInput.disabled = true;
  sendButton.disabled = true;
})();
