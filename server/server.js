const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

// Создаем Express приложение
const app = express();
app.use(cors());

// Настраиваем статические файлы
app.use(express.static(path.join(__dirname, '..')));

// Создаем HTTP сервер
const server = http.createServer(app);

// Создаем WebSocket сервер
const wss = new WebSocket.Server({ server });

// Хранилище пользователей
const users = new Map();
// Очередь ожидающих пользователей
const waitingUsers = {
    any: [],
    male: [],
    female: []
};

// Обработка WebSocket соединений
wss.on('connection', (ws) => {
    console.log('Новое соединение');
    
    // Генерируем уникальный ID для пользователя
    const userId = generateUserId();
    users.set(ws, { id: userId });
    
    // Обработка сообщений от клиента
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
        }
    });
    
    // Обработка отключения
    ws.on('close', () => {
        const user = users.get(ws);
        if (user && user.partner) {
            // Уведомляем партнера об отключении
            const partnerWs = findUserById(user.partner);
            if (partnerWs) {
                partnerWs.send(JSON.stringify({
                    type: 'disconnected'
                }));
                
                // Удаляем связь с партнером
                const partner = users.get(partnerWs);
                if (partner) {
                    delete partner.partner;
                }
            }
        }
        
        // Удаляем пользователя из очереди ожидания
        removeFromWaitingQueue(ws);
        
        // Удаляем пользователя
        users.delete(ws);
        console.log('Соединение закрыто');
    });
});

// Обработка сообщений
function handleMessage(ws, data) {
    const user = users.get(ws);
    
    switch(data.type) {
        case 'search':
            // Сохраняем данные пользователя
            user.gender = data.data.gender;
            user.age = data.data.age;
            user.searchGender = data.data.searchGender;
            
            // Ищем подходящего собеседника
            findPartner(ws);
            break;
            
        case 'message':
            // Отправляем сообщение партнеру
            if (user.partner) {
                const partnerWs = findUserById(user.partner);
                if (partnerWs) {
                    partnerWs.send(JSON.stringify({
                        type: 'message',
                        text: data.text
                    }));
                }
            }
            break;
            
        case 'disconnect':
            // Отключаем от партнера
            if (user.partner) {
                const partnerWs = findUserById(user.partner);
                if (partnerWs) {
                    partnerWs.send(JSON.stringify({
                        type: 'disconnected'
                    }));
                    
                    // Удаляем связь с партнером
                    const partner = users.get(partnerWs);
                    if (partner) {
                        delete partner.partner;
                    }
                }
                
                delete user.partner;
            }
            break;
    }
}

// Поиск партнера
function findPartner(ws) {
    const user = users.get(ws);
    
    // Определяем очередь для поиска
    let searchQueue;
    if (user.searchGender === 'any') {
        searchQueue = waitingUsers.any;
    } else {
        searchQueue = waitingUsers[user.searchGender];
    }
    
    // Ищем подходящего партнера в очереди
    let partnerWs = null;
    
    if (searchQueue.length > 0) {
        // Берем первого пользователя из очереди
        partnerWs = searchQueue.shift();
        
        // Проверяем, что соединение все еще активно
        if (!users.has(partnerWs)) {
            // Если соединение закрыто, ищем следующего
            return findPartner(ws);
        }
        
        const partner = users.get(partnerWs);
        
        // Устанавливаем связь между пользователями
        user.partner = partner.id;
        partner.partner = user.id;
        
        // Отправляем уведомление о соединении обоим пользователям
        ws.send(JSON.stringify({
            type: 'connected',
            partner: {
                gender: partner.gender,
                age: partner.age
            }
        }));
        
        partnerWs.send(JSON.stringify({
            type: 'connected',
            partner: {
                gender: user.gender,
                age: user.age
            }
        }));
    } else {
        // Если нет подходящего партнера, добавляем в очередь ожидания
        if (user.gender === 'male' || user.gender === 'female') {
            waitingUsers[user.gender].push(ws);
        }
        waitingUsers.any.push(ws);
    }
}

// Удаление из очереди ожидания
function removeFromWaitingQueue(ws) {
    for (const queue of Object.values(waitingUsers)) {
        const index = queue.indexOf(ws);
        if (index !== -1) {
            queue.splice(index, 1);
        }
    }
}

// Поиск пользователя по ID
function findUserById(userId) {
    for (const [ws, user] of users.entries()) {
        if (user.id === userId) {
            return ws;
        }
    }
    return null;
}

// Генерация уникального ID
function generateUserId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});