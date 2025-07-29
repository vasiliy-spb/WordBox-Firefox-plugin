// src/background.js

let db = null;

// Функция для инициализации IndexedDB
function initializeDatabase() {
  if (typeof window.WordBoxDB === 'undefined') {
    console.error('WordBox background.js: window.WordBoxDB is not defined. Retrying initialization...');
    setTimeout(initializeDatabase, 100);
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

// Запускаем инициализацию с небольшой задержкой
setTimeout(initializeDatabase, 0);


/**
 * Асинхронная функция для перевода слова с использованием Skyeng Dictionary API.
 * @param {string} word - Слово для перевода.
 * @returns {Promise<{translation: string[], transcription: string}>} - Промис, который разрешается объектом с массивом переводов и транскрипцией.
 */
async function translateWord(word) {
  const url = `https://dictionary.skyeng.ru/api/public/v1/words/search?search=${encodeURIComponent(word)}`;

  try {
    console.log(`WordBox background.js: Попытка перевести слово через Skyeng API: "${word}"`);
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log(`WordBox background.js: Ответ от Skyeng API для "${word}":`, data);

    let translations = []; // Изменено на массив
    let transcription = '';

    // Skyeng API возвращает массив слов, берем первое совпадение
    if (data && data.length > 0 && data[0].meanings && data[0].meanings.length > 0) {
      // Собираем все переводы из всех значений (meanings)
      translations = data[0].meanings
        .filter(meaning => meaning.translation && meaning.translation.text)
        .map(meaning => meaning.translation.text);

      // Транскрипцию берем из первого значения (обычно она одинакова)
      if (data[0].meanings[0].transcription) {
        transcription = data[0].meanings[0].transcription;
      }

      console.log(`WordBox background.js: Найдены переводы для "${word}": "${translations.join(', ')}" (Транскрипция: "${transcription}")`);
    } else {
      console.log(`WordBox background.js: Перевод для "${word}" не найден в Skyeng API.`);
    }

    return {
      translation: translations, // Теперь это массив
      transcription
    };

  } catch (error) {
    console.error(`WordBox background.js: Ошибка при переводе слова "${word}" через Skyeng API:`, error);
    return {
      translation: [], // Возвращаем пустой массив
      transcription: ''
    }; // Возвращаем пустые строки в случае ошибки
  }
}


// Обработчик сообщений от content-скрипта или popup-скрипта
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('WordBox background.js: Получено сообщение:', message);
  console.log('WordBox background.js: Действие:', message.action);

  if (!db) {
    console.error('WordBox background.js: Database not initialized. Cannot process action:', message.action);
    sendResponse({
      status: 'error',
      message: 'Database not initialized.'
    });
    return true;
  }

  switch (message.action) {
    case 'addWord':
      (async () => {
        const {
          translation: translatedTexts, // Теперь это массив
          transcription: wordTranscription
        } = await translateWord(message.word);

        const wordData = {
          id: message.word.toLowerCase(), // ID всегда в нижнем регистре
          word: message.word, // Оригинальное слово сохраняем как есть
          translation: translatedTexts, // Сохраняем массив переводов
          transcription: wordTranscription,
          dateAdded: new Date().toISOString(),
          dateLastSeen: new Date().toISOString(),
          sources: [message.sourceUrl],
          count: 1,
          tags: []
        };

        console.log('WordBox background.js: Попытка добавить слово в основной словарь:', wordData);
        window.WordBoxDB.addWord(db, wordData)
          .then(updatedWord => {
            console.log('WordBox background.js: Слово успешно добавлено/обновлено:', updatedWord);
            sendResponse({
              status: 'success',
              word: updatedWord
            });
          })
          .catch(error => {
            console.error('WordBox background.js: Ошибка при добавлении слова:', error);
            sendResponse({
              status: 'error',
              message: error.message
            });
          });
      })();
      return true;

    case 'getAllWords':
      console.log('WordBox background.js: Запрос всех слов.');
      window.WordBoxDB.getAllWords(db)
        .then(words => {
          console.log('WordBox background.js: Получены слова:', words);
          sendResponse({
            status: 'success',
            words: words
          });
        })
        .catch(error => {
          console.error('WordBox background.js: Ошибка при получении всех слов:', error);
          sendResponse({
            status: 'error',
            message: error.message
          });
        });
      return true;

    case 'deleteWord':
      console.log('WordBox background.js: Запрос на удаление слова с ID:', message.wordId);
      window.WordBoxDB.deleteWord(db, message.wordId)
        .then(() => {
          console.log(`WordBox background.js: Слово с ID ${message.wordId} успешно удалено.`);
          sendResponse({
            status: 'success'
          });
        })
        .catch(error => {
          console.error('WordBox background.js: Ошибка при удалении слова:', error);
          sendResponse({
            status: 'error',
            message: error.message
          });
        });
      return true;

    default:
      console.warn('WordBox background.js: Неизвестное действие:', message.action);
      return false;
  }
});

browser.browserAction.onClicked.addListener(() => {
  console.log('WordBox background.js: Browser action clicked. Popup will open.');
});

console.log('WordBox background.js loaded.');