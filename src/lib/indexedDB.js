// src/lib/indexedDB.js

(function() {
  const DB_NAME = 'WordBoxDB';
  // *** УВЕЛИЧИВАЕМ ВЕРСИЮ БАЗЫ ДАННЫХ ДО 4 ***
  const DB_VERSION = 4;
  const STORE_NAME_WORDS = 'words';

  let db = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = event => {
        console.error('IndexedDB error:', event.target.errorCode);
        reject(new Error('IndexedDB error: ' + event.target.errorCode));
      };

      request.onsuccess = event => {
        db = event.target.result;
        console.log('IndexedDB opened successfully.');
        resolve(db);
      };

      request.onupgradeneeded = event => {
        const database = event.target.result;

        // Создаем хранилище для слов, если его нет
        if (!database.objectStoreNames.contains(STORE_NAME_WORDS)) {
          const objectStore = database.createObjectStore(STORE_NAME_WORDS, {
            keyPath: 'id'
          });
          console.log('Object store created:', STORE_NAME_WORDS);
        }

        // *** УДАЛЯЕМ старое хранилище словаря, если оно существует ***
        // Это важно, чтобы очистить старые данные и избежать конфликтов
        if (database.objectStoreNames.contains('translation_dictionary')) {
          database.deleteObjectStore('translation_dictionary');
          console.log('Old object store "translation_dictionary" deleted.');
        }

        // *** ЛОГИКА МИГРАЦИИ для добавления поля 'tags' (новая версия DB_VERSION 4) ***
        // Если база данных обновляется до версии 4 (или выше), убедимся, что у всех слов есть поле 'tags'
        if (event.oldVersion < 4) {
          const objectStore = event.target.transaction.objectStore(STORE_NAME_WORDS);
          // Открываем курсор для итерации по всем существующим словам
          objectStore.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
              const word = cursor.value;
              // Если у слова нет поля tags, добавляем его как пустой массив
              if (!word.tags) {
                word.tags = [];
                cursor.update(word); // Обновляем слово в хранилище
                console.log(`IndexedDB: Добавлено поле 'tags' для слова "${word.word}"`);
              }
              cursor.continue();
            } else {
              console.log('IndexedDB: Миграция поля "tags" завершена.');
            }
          };
        }
      };
    });
  }

  /**
   * Добавляет новое слово или обновляет существующее.
   * Если слово уже есть (по id), обновляет его счетчик, дату последнего добавления
   * и список источников.
   * @param {IDBDatabase} db - Объект базы данных IndexedDB.
   * @param {object} newWordData - Данные нового слова.
   * @returns {Promise<object>} - Промис, который разрешается с добавленным/обновленным словом.
   */
  function addWord(db, newWordData) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not open.'));
        return;
      }

      const transaction = db.transaction([STORE_NAME_WORDS], 'readwrite');
      const store = transaction.objectStore(STORE_NAME_WORDS);

      const getRequest = store.get(newWordData.id);

      getRequest.onsuccess = event => {
        const existingWord = event.target.result;
        console.log('IndexedDB (addWord): Existing word check result:', existingWord);

        if (existingWord) {
          // Обновляем существующее слово
          existingWord.count = (existingWord.count || 0) + 1;
          existingWord.dateLastSeen = new Date().toISOString();
          if (!existingWord.sources.includes(newWordData.sources[0])) {
            existingWord.sources.push(newWordData.sources[0]);
          }
          // Обновляем перевод и транскрипцию, если они пришли новые
          if (newWordData.translation) {
            existingWord.translation = newWordData.translation;
          }
          if (newWordData.transcription) {
            existingWord.transcription = newWordData.transcription;
          }
          // *** Обновляем теги, если они пришли новые (при ручном добавлении/редактировании) ***
          // Если newWordData содержит tags, используем их. Иначе сохраняем существующие.
          if (Array.isArray(newWordData.tags)) {
              existingWord.tags = newWordData.tags;
          } else if (!existingWord.tags) {
              existingWord.tags = []; // Убедимся, что поле tags всегда существует
          }


          const putRequest = store.put(existingWord);

          putRequest.onsuccess = () => {
            console.log('IndexedDB (addWord): Word updated successfully:', existingWord);
            resolve(existingWord);
          };
          putRequest.onerror = event => {
            console.error('IndexedDB (addWord): Error updating word:', event.target.error);
            reject(event.target.error);
          };
        } else {
          // Добавляем новое слово
          // *** Убедимся, что newWordData.tags всегда массив ***
          if (!Array.isArray(newWordData.tags)) {
            newWordData.tags = [];
          }

          const addRequest = store.add(newWordData);

          addRequest.onsuccess = () => {
            console.log('IndexedDB (addWord): New word added successfully:', newWordData);
            resolve(newWordData);
          };
          addRequest.onerror = event => {
            console.error('IndexedDB (addWord): Error adding new word:', event.target.error);
            reject(event.target.error);
          };
        }
      };

      getRequest.onerror = event => {
        console.error('IndexedDB (addWord): Error getting word for check:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Получает слово по его уникальному ID.
   * @param {IDBDatabase} db - Объект базы данных IndexedDB.
   * @param {string} wordId - ID слова для получения.
   * @returns {Promise<object|undefined>} - Промис, который разрешается объектом слова или undefined, если слово не найдено.
   */
  function getWord(db, wordId) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not open.'));
        return;
      }
      const transaction = db.transaction([STORE_NAME_WORDS], 'readonly');
      const store = transaction.objectStore(STORE_NAME_WORDS);
      const request = store.get(wordId);

      request.onsuccess = event => {
        resolve(event.target.result);
      };
      request.onerror = event => {
        console.error('IndexedDB (getWord): Error getting word:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Обновляет существующее слово в хранилище.
   * @param {IDBDatabase} db - Объект базы данных IndexedDB.
   * @param {object} wordData - Данные слова для обновления (должно содержать keyPath 'id').
   * @returns {Promise<object>} - Промис, который разрешается с обновленным словом.
   */
  function putWord(db, wordData) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not open.'));
        return;
      }
      const transaction = db.transaction([STORE_NAME_WORDS], 'readwrite');
      const store = transaction.objectStore(STORE_NAME_WORDS);
      const request = store.put(wordData); // Используем put для обновления

      request.onsuccess = () => {
        console.log('IndexedDB (putWord): Word put successfully:', wordData);
        resolve(wordData);
      };
      request.onerror = event => {
        console.error('IndexedDB (putWord): Error putting word:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Получает все слова из хранилища.
   * @param {IDBDatabase} db - Объект базы данных IndexedDB.
   * @returns {Promise<Array<object>>} - Промис, который разрешается массивом слов.
   */
  function getAllWords(db) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not open.'));
        return;
      }

      const transaction = db.transaction([STORE_NAME_WORDS], 'readonly');
      const store = transaction.objectStore(STORE_NAME_WORDS);
      const request = store.getAll();

      request.onsuccess = event => {
        console.log('IndexedDB (getAllWords): Retrieved words:', event.target.result);
        resolve(event.target.result);
      };

      request.onerror = event => {
        console.error('IndexedDB (getAllWords): Error getting all words:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Удаляет слово по его уникальному ID.
   * @param {IDBDatabase} db - Объект базы данных IndexedDB.
   * @param {string} wordId - ID слова для удаления.
   * @returns {Promise<void>} - Промис, который разрешается при успешном удалении.
   */
  function deleteWord(db, wordId) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not open.'));
        return;
      }

      const transaction = db.transaction([STORE_NAME_WORDS], 'readwrite');
      const store = transaction.objectStore(STORE_NAME_WORDS);
      const request = store.delete(wordId);

      request.onsuccess = () => {
        console.log(`IndexedDB (deleteWord): Word with ID ${wordId} deleted successfully.`);
        resolve();
      };

      request.onerror = event => {
        console.error('IndexedDB (deleteWord): Error deleting word:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Делаем функции доступными глобально через window.WordBoxDB
  window.WordBoxDB = {
    openDatabase,
    addWord,
    getWord,
    putWord,
    getAllWords,
    deleteWord
  };
})();