// src/lib/indexedDB.js

(function() { // Оборачиваем в IIFE, чтобы избежать конфликтов и сделать функции доступными глобально

    const DB_NAME = 'WordBoxDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'words';
  
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
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            const objectStore = database.createObjectStore(STORE_NAME, {
              keyPath: 'id'
            });
            console.log('Object store created:', STORE_NAME);
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
  
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
  
        const getRequest = store.get(newWordData.id);
  
        getRequest.onsuccess = event => {
          const existingWord = event.target.result;
  
          if (existingWord) {
            existingWord.count = (existingWord.count || 0) + 1;
            existingWord.dateLastSeen = new Date().toISOString();
            if (!existingWord.sources.includes(newWordData.sources[0])) {
              existingWord.sources.push(newWordData.sources[0]);
            }
  
            const putRequest = store.put(existingWord);
  
            putRequest.onsuccess = () => {
              resolve(existingWord);
            };
            putRequest.onerror = event => {
              console.error('Error updating word:', event.target.error);
              reject(event.target.error);
            };
          } else {
            const addRequest = store.add(newWordData);
  
            addRequest.onsuccess = () => {
              resolve(newWordData);
            };
            addRequest.onerror = event => {
              console.error('Error adding new word:', event.target.error);
              reject(event.target.error);
            };
          }
        };
  
        getRequest.onerror = event => {
          console.error('Error getting word for check:', event.target.error);
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
  
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
  
        request.onsuccess = event => {
          resolve(event.target.result);
        };
  
        request.onerror = event => {
          console.error('Error getting all words:', event.target.error);
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
  
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(wordId);
  
        request.onsuccess = () => {
          resolve();
        };
  
        request.onerror = event => {
          console.error('Error deleting word:', event.target.error);
          reject(event.target.error);
        };
      });
    }
  
    // Прикрепляем функции к глобальному объекту window, чтобы они были доступны в background.js
    window.WordBoxDB = {
      openDatabase,
      addWord,
      getAllWords,
      deleteWord
    };
  
  })(); // Вызываем IIFE сразу же