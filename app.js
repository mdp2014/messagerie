const supabaseUrl = 'https://sqnjzcqcmtjhbptjlixe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbmp6Y3FjbXRqaGJwdGpsaXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTY1ODcsImV4cCI6MjA2NDA5MjU4N30.lJIsRndHSS95pxJrH726jDaHANTaj_Q14IoZ4JNm-Rg';
const supabase = supabasejs.createClient(supabaseUrl, supabaseKey);

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

    if (response.ok) getMessages();
    else console.error('Erreur message:', await response.json());
  } catch (e) {
    console.error('Erreur géoloc:', e);
  }
}

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

async function getMessages() {
  if (!currentUserId || !userSelect.value) {
    chatMessages.innerHTML = '';
    return;
  }

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

function refreshMessages() {
  setInterval(getMessages, 1500);
}

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

function logout() {
  currentUserId = null;
  loginContainer.style.display = 'block';
  connectedUser.style.display = 'none';
  chatMessages.innerHTML = '';
}

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
  await getUsers();
  getMessages();
};

document.getElementById('signup-button')?.addEventListener('click', async () => {
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

// Connexion Google
document.getElementById('google-login-button').addEventListener('click', async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google'
  });
  if (error) alert('Erreur connexion Google : ' + error.message);
});

// Vérifie si un utilisateur est déjà connecté via Google
window.addEventListener('load', async () => {
  const { data: sessionData, error } = await supabase.auth.getUser();
  if (sessionData?.user) {
    const email = sessionData.user.email;
    if (!email) return;

    await getUsers();
    let user = Object.values(users).find(u => u.username === email);

    // S'il n'existe pas, on l'ajoute
    if (!user) {
      const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ username: email, password: '' })
      });

      const newUser = await response.json();
      if (response.ok) {
        user = newUser[0];
        await getUsers(); // pour mettre à jour users[]
      } else {
        console.error("Erreur ajout utilisateur Google :", newUser);
        return;
      }
    }

    currentUserId = user.id;
    loginContainer.style.display = 'none';
    connectedUser.style.display = 'block';
    connectedUsername.textContent = user.username;
    getMessages();
    refreshMessages();
  }
});
