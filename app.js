const supabaseUrl = 'https://sqnjzcqcmtjhbptjlixe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbmp6Y3FjbXRqaGJwdGpsaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTY1ODcsImV4cCI6MjA2NDA5MjU4N30.lJIsRndHSS95pxJrH726jDaHANTaj_Q14IoZ4JNm-Rg';
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

// Charger utilisateurs une seule fois
async function getUsers() {
  const response = await fetch(`${supabaseUrl}/rest/v1/users?select=id,username,password`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await response.json();
  if (response.ok) {
    users = {};
    userSelect.innerHTML = '';
    data.forEach(user => {
      users[user.id] = user;
      const option = document.createElement('option');
      option.value = user.id;
      option.dataset.baseName = user.username;
      option.textContent = user.username;
      userSelect.appendChild(option);
    });
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
        city,
        read: false
      })
    });

    if (response.ok) {
      getMessages();
    } else {
      console.error('Erreur message:', await response.json());
    }
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

// Marquer messages comme lus
async function markMessagesAsRead(fromUserId) {
  const response = await fetch(`${supabaseUrl}/rest/v1/messages?read=eq.false&id_sent=eq.${fromUserId}&id_received=eq.${currentUserId}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ read: true })
  });
  if (!response.ok) {
    console.error("Erreur lors du marquage des messages comme lus", await response.json());
  }
}

// Afficher messages
async function getMessages() {
  if (!currentUserId || !userSelect.value) {
    chatMessages.innerHTML = '';
    return;
  }

  await markMessagesAsRead(userSelect.value);

  const response = await fetch(`${supabaseUrl}/rest/v1/messages?select=*&order=created_at.asc&or=(and(id_sent.eq.${currentUserId},id_received.eq.${userSelect.value}),and(id_sent.eq.${userSelect.value},id_received.eq.${currentUserId}))`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  const data = await response.json();

  if (response.ok) {
    chatMessages.innerHTML = '';
    let lastDate = null;
    data.forEach(msg => {
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
      chatMessages.appendChild(msgEl);
    });
  } else {
    console.error('Erreur chargement messages:', data);
  }
}

// Rafraîchissement automatique des messages
function refreshMessages() {
  setInterval(getMessages, 1500);
}

// Mise à jour des pastilles 🔴
async function updateUnreadCounts() {
  for (const [id, user] of Object.entries(users)) {
    if (id === currentUserId) continue;

    const response = await fetch(`${supabaseUrl}/rest/v1/messages?select=id&read=eq.false&id_sent=eq.${id}&id_received=eq.${currentUserId}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (response.ok) {
      const unread = await response.json();
      const count = unread.length;

      const option = [...userSelect.options].find(opt => opt.value === id);
      if (option) {
        const baseName = option.dataset.baseName;
        option.textContent = count > 0 ? `${baseName} 🔴 (${count})` : baseName;
      }
    }
  }
}

function startUnreadRefresh() {
  setInterval(updateUnreadCounts, 2000);
}

// Connexion
async function login() {
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
      await getUsers();
      await getMessages();
      refreshMessages();
      startUnreadRefresh();
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

window.onload = async () => {
  await getUsers(); // Charge liste utilisateurs une fois pour l'écran de login
};
