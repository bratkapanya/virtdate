// Элементы интерфейса
const mainScreen = document.getElementById('main-screen');
const chatScreen = document.getElementById('chat-screen');
const connectingScreen = document.getElementById('connecting-screen');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const findBtn = document.getElementById('find-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const cancelBtn = document.getElementById('cancel-btn');
const partnerInfo = document.getElementById('partner-info');

// Данные пользователя
let userData = {
    gender: '',
    age: 0,
    searchGender: ''
};

// WebSocket соединение
let socket = null;
let chatPartner = null;

// Инициализация приложения
function init() {
    // Обработчики событий
    findBtn.addEventListener('click', startSearch);
    disconnectBtn.addEventListener('click', disconnect);
    cancelBtn.addEventListener('click', cancelSearch);
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Начать поиск собеседника
function startSearch() {
    // Получаем данные пользователя
    userData.gender = document.getElementById('gender').value;
    userData.age = document.getElementById('age').value;
    userData.searchGender = document.getElementById('search-gender').value;
    
    // Валидация возраста
    if (userData.age < 18 || userData.age > 100) {
        alert('Пожалуйста, укажите корректный возраст (от 18 до 100)');
        return;
    }
    
    // Показываем экран поиска
    mainScreen.style.display = 'none';
    connectingScreen.style.display = 'block';
    
    // Подключаемся к WebSocket серверу
    connectToServer();
}

// Подключение к серверу
function connectToServer() {
    // Создаем WebSocket соединение
    // Для локального тестирования используем ws://localhost:3000
    // Для продакшена используем wss://virtdate.ru/ws
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsUrl = isLocal ? 'ws://localhost:3000' : 'wss://virtdate.ru/ws';
    socket = new WebSocket(wsUrl);
    
    // Обработчики событий WebSocket
    socket.onopen = function() {
        console.log('Соединение установлено');
        // Отправляем данные пользователя для поиска
        socket.send(JSON.stringify({
            type: 'search',
            data: userData
        }));
    };
    
    socket.onmessage = function(event) {
        const message = JSON.parse(event.data);
        
        switch(message.type) {
            case 'connected':
                // Соединение с собеседником установлено
                chatPartner = message.partner;
                showChatScreen();
                break;
                
            case 'message':
                // Получено новое сообщение
                displayMessage(message.text, false);
                break;
                
            case 'disconnected':
                // Собеседник отключился
                alert('Собеседник отключился');
                returnToMainScreen();
                break;
        }
    };
    
    socket.onclose = function() {
        console.log('Соединение закрыто');
    };
    
    socket.onerror = function(error) {
        console.error('Ошибка WebSocket:', error);
        alert('Ошибка соединения с сервером');
        returnToMainScreen();
    };
}

// Показать экран чата
function showChatScreen() {
    connectingScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    
    // Отображаем информацию о собеседнике
    if (chatPartner) {
        const genderText = chatPartner.gender === 'male' ? 'М' : 'Ж';
        partnerInfo.textContent = `${genderText}, ${chatPartner.age}`;
    } else {
        partnerInfo.textContent = 'Собеседник';
    }
    
    // Очищаем историю сообщений
    chatMessages.innerHTML = '';
    
    // Фокус на поле ввода
    messageInput.focus();
}

// Отправить сообщение
function sendMessage() {
    const text = messageInput.value.trim();
    
    if (text && socket && socket.readyState === WebSocket.OPEN) {
        // Отправляем сообщение на сервер
        socket.send(JSON.stringify({
            type: 'message',
            text: text
        }));
        
        // Отображаем отправленное сообщение
        displayMessage(text, true);
        
        // Очищаем поле ввода
        messageInput.value = '';
    }
}

// Отобразить сообщение в чате
function displayMessage(text, isSent) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isSent ? 'message-sent' : 'message-received');
    messageElement.textContent = text;
    
    chatMessages.appendChild(messageElement);
    
    // Прокручиваем чат вниз
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Отключиться от чата
function disconnect() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'disconnect'
        }));
    }
    
    returnToMainScreen();
}

// Отменить поиск
function cancelSearch() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    returnToMainScreen();
}

// Вернуться на главный экран
function returnToMainScreen() {
    chatScreen.style.display = 'none';
    connectingScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    
    // Закрываем соединение если оно открыто
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    socket = null;
    chatPartner = null;
}

// Запускаем приложение после загрузки страницы
document.addEventListener('DOMContentLoaded', init);