// src/lib/indexedDB.js
(function() {
  const DB_NAME = 'WordBoxDB';
  const DB_VERSION = 3; // *** УВЕЛИЧИЛИ ВЕРСИЮ БАЗЫ ДАННЫХ *** [cite: 655]
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
        // Больше не создаем хранилище для translation_dictionary
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
        console.log('IndexedDB (deleteWord): Word deleted successfully:', wordId);
        resolve();
      };

      request.onerror = event => {
        console.error('IndexedDB (deleteWord): Error deleting word:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Прикрепляем функции к глобальному объекту window, чтобы они были доступны в background.js
  window.WordBoxDB = {
    openDatabase,
    addWord,
    getAllWords,
    deleteWord,
    getWord, // Добавлено
    putWord // Добавлено
  };

})();