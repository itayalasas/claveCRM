(function() {
  if (typeof window.CRMRapidoChatSettings === 'undefined') return;
  const settings = window.CRMRapidoChatSettings;
  if (!settings.widgetEnabled) return;

  let visitorId = null;
  let currentSessionId = null;
  let db = null;
  let unsubscribeMessages = null;

  let assignedAgent = {
    name: settings.agentName || "Asistente Virtual",
    avatar: settings.agentAvatarUrl || "https://cdn-icons-png.flaticon.com/512/4712/4712027.png"
  };

  function getInitials(name, isVisitor = false) {
    if (isVisitor) return 'V';
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function createAvatarElement(initials, bgColor = '#ccc') {
    const avatar = document.createElement('div');
    avatar.textContent = initials;
    Object.assign(avatar.style, {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      backgroundColor: bgColor,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '12px',
      marginRight: '8px'
    });
    return avatar;
  }
  
  

  const firebaseConfig = {
    apiKey: "AIzaSyA1PIzHg0qgOhXvHIp5duq6VgbuV3WIniE",
    authDomain: "minicrm-express.firebaseapp.com",
    projectId: "minicrm-express",
    storageBucket: "minicrm-express.firebasestorage.app",
    messagingSenderId: "600153365017",
    appId: "1:600153365017:web:7be7b7109ddc0ccab4e888",
    measurementId: "G-XXXXXXXXXX"
  };

  function initializeFirebase() {
    if (typeof firebase === 'undefined') {
      const s1 = document.createElement('script');
      s1.src = 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js';
        s2.onload = () => {
          firebase.initializeApp(firebaseConfig);
          db = firebase.firestore();
          setupWidget();
        };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
      return false;
    }
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    return true;
  }

  function setupWidget() {
    visitorId = getOrSetVisitorId();
    createChatWindow();
    appendToggleButton();
  }

  function createChatWindow() {
    const chatWindow = document.createElement('div');
    chatWindow.id = 'crm-rapido-chat-window';
    Object.assign(chatWindow.style, {
      position: 'fixed', bottom: '86px', right: settings.widgetPosition === 'bottom-left' ? '' : '20px',
      left: settings.widgetPosition === 'bottom-left' ? '20px' : '',
      width: '350px', maxWidth: 'calc(100% - 40px)',
      height: '500px', maxHeight: 'calc(100% - 90px)',
      backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
      display: 'none', flexDirection: 'column', overflow: 'hidden', zIndex: '9998',
      opacity: '0', transform: 'translateY(20px)', transition: 'opacity 0.3s, transform 0.3s'
    });

    const header = document.createElement('div');
    Object.assign(header.style, { display: 'flex', alignItems: 'center', padding: '12px', backgroundColor: settings.primaryColor, color: '#fff', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' });
    const avatar = document.createElement('img');
    avatar.src = assignedAgent.avatar;
    Object.assign(avatar.style, { width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px' });
    const name = document.createElement('span');
    name.id = 'crm-rapido-agent-name';
    name.textContent = assignedAgent.name;
    name.style.fontWeight = '600';
    header.appendChild(avatar);
    header.appendChild(name);
    if (settings.showAgentStatus) {
      const dot = document.createElement('span');
      Object.assign(dot.style, { display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#4CAF50', borderRadius: '50%', marginLeft: '8px' });
      header.appendChild(dot);
    }
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    Object.assign(closeBtn.style, { marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' });
    closeBtn.onclick = toggleChatWindow;
    header.appendChild(closeBtn);

    const chatBody = document.createElement('div');
    chatBody.id = 'crm-rapido-chat-body';
    Object.assign(chatBody.style, { flexGrow: '1', padding: '10px', overflowY: 'auto', backgroundColor: '#f9f9f9' });

    const inputContainer = document.createElement('div');
    Object.assign(inputContainer.style, { padding: '10px', borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center', backgroundColor: '#fff' });
    const chatInput = document.createElement('input');
    chatInput.id = 'crm-rapido-chat-input';
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
      }
    });
    chatInput.type = 'text';
    chatInput.placeholder = 'Escribe tu mensaje...';
    Object.assign(chatInput.style, { flexGrow: '1', padding: '8px', border: '1px solid #ccc', borderRadius: '20px', outline: 'none' });
    const sendBtn = document.createElement('button');
    sendBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>`;
    Object.assign(sendBtn.style, { marginLeft: '8px', padding: '8px', backgroundColor: settings.primaryColor, border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#fff' });
    sendBtn.onclick = handleSendMessage;
    inputContainer.appendChild(chatInput);
    inputContainer.appendChild(sendBtn);

    chatWindow.appendChild(header);
    chatWindow.appendChild(chatBody);
    chatWindow.appendChild(inputContainer);
    document.body.appendChild(chatWindow);

    if (settings.welcomeMessage) {
      setTimeout(() => addSystemMessage(settings.welcomeMessage), 500);
    }
  }

  function appendToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'crm-rapido-chat-toggle';
    btn.textContent = '💬';
    Object.assign(btn.style, { position: 'fixed', bottom: '20px', right: '20px', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: settings.primaryColor, color: '#fff', border: 'none', fontSize: '24px', cursor: 'pointer', zIndex: '10000' });
    btn.onclick = toggleChatWindow;
    document.body.appendChild(btn);
  }

  function toggleChatWindow() {
    const chat = document.getElementById('crm-rapido-chat-window');
    if (!chat) return;
    const open = chat.style.display === 'none' || chat.style.display === '';
    chat.style.display = open ? 'flex' : 'none';
    chat.style.opacity = open ? '1' : '0';
    chat.style.transform = open ? 'translateY(0)' : 'translateY(20px)';
  }

  function addSystemMessage(text) {
    const body = document.getElementById('crm-rapido-chat-body');
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.margin = '8px 0';
    div.style.color = '#555';
    div.style.fontStyle = 'italic';
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  async function handleSendMessage() {
    const input = document.getElementById('crm-rapido-chat-input');
    const text = input.value.trim();
    if (!text || !db) return;
    input.value = '';
    const sessionId = await getOrCreateChatSession(text);
    await db.collection('chatSessions').doc(sessionId).collection('messages').add({
      senderType: 'visitor',
      text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('chatSessions').doc(sessionId).update({
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    addVisitorMessage(text);
  }

  function addVisitorMessage(text, timestamp = new Date()) {
    const body = document.getElementById('crm-rapido-chat-body');
  
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.justifyContent = 'flex-end';
    wrap.style.alignItems = 'flex-end';
    wrap.style.margin = '8px';
  
    const content = document.createElement('div');
    content.style.maxWidth = '70%';
    content.style.textAlign = 'right';
  
    const bubble = document.createElement('div');
    bubble.style.background = settings.primaryColor;
    bubble.style.color = '#fff';
    bubble.style.padding = '8px';
    bubble.style.borderRadius = '10px';
    bubble.style.wordWrap = 'break-word';
    bubble.textContent = text;
  
    const time = document.createElement('div');
    time.style.fontSize = '10px';
    time.style.color = '#fff';
    time.style.marginTop = '4px';
    time.style.textAlign = 'right';
  
    try {
      const t = typeof timestamp === 'string' ? new Date(timestamp) :
                timestamp.toDate ? timestamp.toDate() : timestamp;
      time.textContent = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      time.textContent = '';
    }
  
    content.appendChild(bubble);
    content.appendChild(time);
    wrap.appendChild(content);
  
    const visitorAvatar = createAvatarElement(getInitials(null, true), settings.primaryColor);
    visitorAvatar.style.marginLeft = '8px';
    wrap.appendChild(visitorAvatar);
  
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }
  

  async function getOrCreateChatSession(initialText) {
    if (currentSessionId) return currentSessionId;
    const q = await db.collection('chatSessions')
      .where('visitorId','==',visitorId)
      .where('status','in',['pending','active'])
      .limit(1)
      .get();
    if (!q.empty) {
      currentSessionId = q.docs[0].id;
      listenForMessages(currentSessionId);
      return currentSessionId;
    }
    const doc = await db.collection('chatSessions').add({
      visitorId,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      initialMessage: initialText,
      currentPageUrl: window.location.href,
      visitorName: localStorage.getItem('crmRapidoVisitorName') || settings.defaultVisitorName || ("Visitante " + visitorId.substring(0, 4))
    });
    currentSessionId = doc.id;
    listenForMessages(currentSessionId);
    return currentSessionId;
  }

  function getOrSetVisitorId() {
    let id = localStorage.getItem('crmRapidoVisitorId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('crmRapidoVisitorId', id);
    }
    return id;
  }

  function listenForMessages(sessionId) {
    const chatBody = document.getElementById('crm-rapido-chat-body');
    if (!chatBody || !db) return;
    if (unsubscribeMessages) unsubscribeMessages();

    const sessionRef = db.collection('chatSessions').doc(sessionId);

    sessionRef.onSnapshot(doc => {
      const data = doc.data();
      if (data.agentName && data.agentAvatar) {
        assignedAgent.name = data.agentName;
        assignedAgent.avatar = data.agentAvatar;
        const headerName = document.getElementById('crm-rapido-agent-name');
        if (headerName) headerName.textContent = assignedAgent.name;
      }
    });

    const messagesRef = sessionRef.collection('messages').orderBy('timestamp', 'asc');
    unsubscribeMessages = messagesRef.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          if (msg.senderType === 'visitor') {
            addVisitorMessage(msg.text, msg.timestamp);
          } else if (msg.senderType === 'agent') {
            addAgentMessage(msg.text, msg.timestamp);
          } else if (msg.senderType === 'system') {
            addSystemMessage(msg.text);
          }
        }
      });
    });
  }

  function addAgentMessage(text, timestamp = new Date()) {
    const body = document.getElementById('crm-rapido-chat-body');
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'flex-start';
    wrap.style.margin = '10px';

    const avatar = createAvatarElement(getInitials(assignedAgent.name), '#007bff');
    avatar.src = assignedAgent.avatar;
    Object.assign(avatar.style, {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      marginRight: '8px'
    });

    const content = document.createElement('div');
    content.style.maxWidth = '80%';

    const name = document.createElement('div');
    name.textContent = assignedAgent.name;
    name.style.fontSize = '12px';
    name.style.fontWeight = 'bold';
    name.style.marginBottom = '4px';
    name.style.color = '#333';

    const bubble = document.createElement('div');
    bubble.style.background = '#e5f1fb';
    bubble.style.color = '#333';
    bubble.style.padding = '10px';
    bubble.style.borderRadius = '10px';
    bubble.style.wordWrap = 'break-word';
    bubble.textContent = text;

    const time = document.createElement('div');
    time.style.fontSize = '10px';
    time.style.color = '#777';
    time.style.marginTop = '4px';
    time.style.textAlign = 'right';

    try {
      const t = typeof timestamp === 'string' ? new Date(timestamp) :
                timestamp.toDate ? timestamp.toDate() : timestamp;
      time.textContent = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      time.textContent = '';
    }

    content.appendChild(name);
    content.appendChild(bubble);
    content.appendChild(time);
    wrap.appendChild(avatar);
    wrap.appendChild(content);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  if (initializeFirebase()) {
    setupWidget();
  }
})();
