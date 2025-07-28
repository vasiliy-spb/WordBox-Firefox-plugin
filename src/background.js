// src/background.js

// Переменная для хранения объекта базы данных IndexedDB
let db = null;

// Функция для инициализации IndexedDB
function initializeDatabase() {
  // Проверяем, что window.WordBoxDB уже доступен
  if (typeof window.WordBoxDB === 'undefined') {
    console.error('WordBox background.js: window.WordBoxDB is not defined. Retrying initialization...');
    setTimeout(initializeDatabase, 100); // Повторить попытку через 100 мс
    return;
  }

  window.WordBoxDB.openDatabase()
    .then(database => {
      db = database;
      console.log('WordBox background.js: IndexedDB database opened successfully in background script.');
    })
    .catch(error => {
      console.error('WordBox background.js: Error opening IndexedDB in background script:', error);
    });
}

// Запускаем инициализацию с небольшой задержкой, чтобы гарантировать,
// что indexedDB.js успел полностью выполниться и прикрепить WordBoxDB к window.
setTimeout(initializeDatabase, 0);


// Обработчик сообщений от content-скрипта или popup-скрипта
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('WordBox background.js: Получено сообщение:', message); // Лог: получено сообщение
  console.log('WordBox background.js: Действие:', message.action); // Лог: действие сообщения

  // Проверяем, что база данных уже открыта
  if (!db) {
    console.error('WordBox background.js: Database not initialized. Cannot process action:', message.action);
    sendResponse({
      status: 'error',
      message: 'Database not initialized.'
    });
    return true; // Важно вернуть true для асинхронной отправки ответа
  }

  // Используем switch для обработки различных действий
  switch (message.action) {
    case 'addWord':
      const wordData = {
        id: message.word.toLowerCase(), // Используем слово в нижнем регистре как ID для уникальности
        word: message.word,
        translation: "",
        transcription: "",
        dateAdded: new Date().toISOString(),
        dateLastSeen: new Date().toISOString(),
        sources: [message.sourceUrl],
        count: 1,
        tags: []
      };

      console.log('WordBox background.js: Попытка добавить слово:', wordData); // Лог: данные для добавления
      window.WordBoxDB.addWord(db, wordData) // Используем глобальную функцию
        .then(updatedWord => {
          console.log('WordBox background.js: Слово успешно добавлено/обновлено:', updatedWord); // Лог: успех добавления
          sendResponse({
            status: 'success',
            word: updatedWord
          });
        })
        .catch(error => {
          console.error('WordBox background.js: Ошибка при добавлении слова:', error); // Лог: ошибка добавления
          sendResponse({
            status: 'error',
            message: error.message
          });
        });
      return true; // Важно вернуть true для асинхронной отправки ответа

    case 'getAllWords':
      console.log('WordBox background.js: Запрос всех слов.'); // Лог: запрос всех слов
      window.WordBoxDB.getAllWords(db) // Используем глобальную функцию
        .then(words => {
          console.log('WordBox background.js: Получены слова:', words); // Лог: полученные слова
          sendResponse({
            status: 'success',
            words: words
          });
        })
        .catch(error => {
          console.error('WordBox background.js: Ошибка при получении всех слов:', error); // Лог: ошибка получения слов
          sendResponse({
            status: 'error',
            message: error.message
          });
        });
      return true;

    case 'deleteWord':
      console.log('WordBox background.js: Запрос на удаление слова с ID:', message.wordId); // Лог: запрос на удаление
      window.WordBoxDB.deleteWord(db, message.wordId) // Используем глобальную функцию
        .then(() => {
          console.log(`WordBox background.js: Слово с ID ${message.wordId} успешно удалено.`); // Лог: успех удаления
          sendResponse({
            status: 'success'
          });
        })
        .catch(error => {
          console.error('WordBox background.js: Ошибка при удалении слова:', error); // Лог: ошибка удаления
          sendResponse({
            status: 'error',
            message: error.message
          });
        });
      return true;

    default:
      console.warn('WordBox background.js: Неизвестное действие:', message.action);
      return false; // Для неизвестных действий
  }
});

// Обработка клика по иконке плагина (если нужна дополнительная логика перед открытием popup)
browser.browserAction.onClicked.addListener(() => {
  console.log('WordBox background.js: Browser action clicked. Popup will open.');
});

console.log('WordBox background.js loaded.');