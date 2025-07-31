// src/popup.js

// Функция для отображения списка слов
async function displayWords() {
  const wordListContainer = document.getElementById('wordList');
  wordListContainer.innerHTML = ''; // Очищаем список перед обновлением

  try {
    const response = await browser.runtime.sendMessage({
      action: 'getAllWords'
    });

    if (response.status === 'success' && response.words) {
      const words = response.words;
      // Сортируем слова по дате добавления (самые новые в начале)
      words.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

      if (words.length === 0) {
        wordListContainer.innerHTML = '<p>Словарь пуст. Выделите слово на странице и нажмите на иконку "+" для добавления.</p>';
        return;
      }

      words.forEach(word => {
        const wordElement = document.createElement('div');
        wordElement.className = 'word-item';

        // НОВОЕ: Создаем HTML для тегов
        // Убедимся, что tags - массив и не undefined. Если пустой - показываем placeholder.
        const hasTags = Array.isArray(word.tags) && word.tags.length > 0;
        const tagsHtml = hasTags
            ? `<span class="editable tags" data-field="tags" data-id="${word.id}">${word.tags.map(tag => `<span class="tag-item">${tag}</span>`).join('')}</span>`
            : `<span class="editable tags empty-tags" data-field="tags" data-id="${word.id}">Добавить теги</span>`;

        // Отображаем слово, транскрипцию и перевод, если они есть
        // СДЕЛАНО: ВСТАВЛЯЕМ tagsHtml СЮДА!
        wordElement.innerHTML = `
          <div class="word-content">
            <span class="editable word" data-field="word" data-id="${word.id}">${word.word}</span>
            <span class="editable transcription" data-field="transcription" data-id="${word.id}">${word.transcription ? `[${word.transcription}]` : ''}</span>
            <span class="editable translation" data-field="translation" data-id="${word.id}">${Array.isArray(word.translation) && word.translation.length > 0 ? word.translation.join(', ') : ''}</span>
            ${tagsHtml} </div>
          <button class="delete-button" data-id="${word.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </button>
        `;
        wordListContainer.appendChild(wordElement);
      });

      // Добавляем обработчики событий для кнопок удаления
      wordListContainer.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', async (event) => {
          let targetButton = event.target;
          while (targetButton && !targetButton.classList.contains('delete-button')) {
            targetButton = targetButton.parentNode;
          }
          if (!targetButton) return;

          const actualWordIdToDelete = targetButton.dataset.id;

          if (confirm(`Вы уверены, что хотите удалить слово "${actualWordIdToDelete}"?`)) {
            try {
              const deleteResponse = await browser.runtime.sendMessage({
                action: 'deleteWord',
                wordId: actualWordIdToDelete
              });
              if (deleteResponse.status === 'success') {
                console.log('Word deleted successfully:', actualWordIdToDelete);
                displayWords(); // Обновляем список после удаления
              } else {
                console.error('Error deleting word:', deleteResponse.message);
              }
            } catch (error) {
              console.error('Error sending delete message:', error);
            }
          }
        });
      });

      // Добавляем обработчики событий для редактируемых полей
      wordListContainer.querySelectorAll('.editable').forEach(field => {
        field.addEventListener('click', function() {
          if (this.contentEditable !== 'true') {
            const currentText = this.textContent;
            this.textContent = currentText.replace(/^\[|\]$/g, ''); // Удаляем квадратные скобки для транскрипции

            this.contentEditable = 'true';
            this.focus();

            // Специальная обработка для поля тегов
            if (this.dataset.field === 'tags') {
              // Если теги пустые, то очищаем текст, чтобы placeholder не мешал редактировать
              if (this.classList.contains('empty-tags')) {
                  this.textContent = '';
              } else {
                  // Преобразуем отображаемые теги обратно в формат "тег1, тег2" для редактирования
                  // Используем textContent, чтобы получить все теги как одну строку
                  const tagsArray = Array.from(this.querySelectorAll('.tag-item')).map(span => span.textContent.trim());
                  this.textContent = tagsArray.join(', ');
              }
            } else if (this.dataset.field === 'transcription') {
                this.textContent = currentText.replace(/^\[|\]$/g, ''); // Удаляем квадратные скобки для транскрипции
            }
            
            // Устанавливаем курсор в конец текста
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(this);
            range.collapse(false); // Сворачиваем диапазон в конец
            selection.removeAllRanges();
            selection.addRange(range);

            this.classList.add('editing');
            this.dataset.originalText = currentText; // Сохраняем оригинальный текст
          }
        });

        field.addEventListener('blur', async function() {
          this.contentEditable = 'false';
          this.classList.remove('editing');
          const newText = this.textContent;
          const wordId = this.dataset.id;
          const fieldName = this.dataset.field;
          const originalText = this.dataset.originalText;

          // // Восстанавливаем скобки для транскрипции, если поле - транскрипция
          // if (fieldName === 'transcription' && newText && !newText.startsWith('[') && !newText.endsWith(']')) {
          //     this.textContent = `[${newText}]`;
          // } else {
          //     this.textContent = newText;
          // }

          // Восстанавливаем скобки для транскрипции, если поле - транскрипция
          // Используем newText.trim() для проверки транскрипции, чтобы пустые строки не превращались в []
          // if (fieldName === 'transcription' && newText.trim() && !newText.startsWith('[') && !newText.endsWith(']')) {
          //   this.textContent = `[${newText.trim()}]`; // Trim для транскрипции, чтобы не было лишних пробелов
          // } else {
          //     this.textContent = newText;
          // }

          let valueToSend; // Переменная для значения, которое будет отправлено

          if (fieldName === 'transcription') {
              if (!newText.trim()) {
                  this.textContent = '';
                  valueToSend = '';
              } else if (!newText.startsWith('[') && !newText.endsWith(']')) {
                  this.textContent = `[${newText.trim()}]`;
                  valueToSend = newText.trim();
              } else {
                  this.textContent = newText.trim();
                  valueToSend = newText.trim();
              }
          } else if (fieldName === 'tags') { // НОВОЕ: Обработка тегов при потере фокуса
              const newTags = newText.split(',')
                                      .map(tag => tag.trim())
                                      .filter(tag => tag.length > 0);
              
              if (newTags.length === 0) {
                  this.innerHTML = 'Добавить теги'; // Устанавливаем placeholder
                  this.classList.add('empty-tags');
                  valueToSend = []; // Отправляем пустой массив
              } else {
                  this.innerHTML = newTags.map(tag => `<span class="tag-item">${tag}</span>`).join('');
                  this.classList.remove('empty-tags');
                  valueToSend = newTags; // Отправляем массив тегов
              }
          } else {
              this.textContent = newText;
              valueToSend = newText;
          }

          // Если текст не изменился, не отправляем запрос
          // if (this.textContent === originalText) {
          //   return;
          // }

          // Если текст не изменился, не отправляем запрос
          // Для тегов, сравниваем строковое представление текущих тегов с исходными
          if (fieldName === 'tags') {
            const currentTagsAsText = Array.from(this.querySelectorAll('.tag-item')).map(span => span.textContent.trim()).join(', ');
            const originalTagsAsText = originalText === 'Добавить теги' ? '' : Array.from(new DOMParser().parseFromString(originalText, 'text/html').querySelectorAll('.tag-item')).map(span => span.textContent.trim()).join(', ');
            if (currentTagsAsText === originalTagsAsText) {
                return;
            }
          } else if (this.textContent === originalText) {
            return;
          }

          // Обновляем слово в IndexedDB
          try {
            const updateResponse = await browser.runtime.sendMessage({
              action: 'updateWord',
              wordId: wordId,
              field: fieldName,
              // value: newText
              value: valueToSend // Отправляем подготовленное значение
            });

            if (updateResponse.status === 'success') {
              console.log(`Слово "${wordId}", поле "${fieldName}" обновлено.`);
            } else {
              console.error(`Ошибка при обновлении слова "${wordId}", поле "${fieldName}":`, updateResponse.message);
              // Можно откатить изменения в UI, если обновление не удалось
              // this.textContent = originalText; 

              // Для тегов, нужно восстановить оригинальный HTML, а не textContent
              if (fieldName === 'tags') {
                this.innerHTML = originalText;
                if (originalText === 'Добавить теги') {
                    this.classList.add('empty-tags');
                } else {
                    this.classList.remove('empty-tags');
                }
              } else {
                  this.textContent = originalText;
              }
            }
          } catch (error) {
            console.error('Ошибка при отправке сообщения об обновлении:', error);
            // this.textContent = originalText; 
            // Для тегов, нужно восстановить оригинальный HTML, а не textContent
            if (fieldName === 'tags') {
              this.innerHTML = originalText;
              if (originalText === 'Добавить теги') {
                  this.classList.add('empty-tags');
              } else {
                  this.classList.remove('empty-tags');
              }
            } else {
                this.textContent = originalText;
            }
          }
        });

        // Добавляем обработчик для Enter, чтобы он не создавал новую строку, а снимал фокус
        field.addEventListener('keydown', function(event) {
          if (event.key === 'Enter') {
            if (event.shiftKey) {
                // Если Shift + Enter, позволяем новую строку
                // Ничего не делаем, браузер вставит новую строку по умолчанию
            } else {
                // Если просто Enter, предотвращаем вставку новой строки и снимаем фокус
                event.preventDefault(); 
                this.blur(); 
            }
        }
        });
      });

    } else {
      wordListContainer.innerHTML = '<p>Ошибка при загрузке слов.</p>';
      console.error('Failed to get words:', response.message);
    }
  } catch (error) {
    wordListContainer.innerHTML = '<p>Не удалось связаться с фоновым скриптом.</p>';
    console.error('Error communicating with background script:', error);
  }
}

// Функция для экспорта словаря в CSV
async function exportToCsv() {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'getAllWords'
    });

    if (response.status === 'success' && response.words) {
      const words = response.words;
      if (words.length === 0) {
        alert('Словарь пуст, нечего экспортировать.');
        return;
      }

      // Заголовки CSV
      const headers = ['word', 'translation', 'transcription', 'dateAdded', 'dateLastSeen', 'sources', 'count', 'tags'];
      // Формируем строки CSV
      const csvRows = [];
      csvRows.push(headers.join(',')); // Добавляем заголовки

      // words.forEach(word => {
      //   const row = headers.map(header => {
      //     let value = word[header];
      //     // Обработка специальных символов и массивов для CSV
      //     if (Array.isArray(value)) {
      //       value = value.join(';'); // Разделяем элементы массива точкой с запятой
      //     }
      //     if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
      //       value = `"${value.replace(/"/g, '""')}"`; // Экранирование кавычек и оборачивание в кавычки
      //     }
      //     return value;
      //   });
      //   csvRows.push(row.join(','));
      // });

      words.forEach(word => {
        const wordValue = `"${word.word.replace(/"/g, '""')}"`;
        const transcriptionValue = `"${word.transcription ? word.transcription.replace(/"/g, '""') : ''}"`;
        // Перевод сохраняем как есть (с запятыми, если они есть)
        const translationValue = `"${Array.isArray(word.translation) ? word.translation.join(', ').replace(/"/g, '""') : ''}"`;
        // НОВОЕ: Добавляем теги в CSV (разделенные точкой с запятой)
        const tagsValue = `"${Array.isArray(word.tags) ? word.tags.join('; ').replace(/"/g, '""') : ''}"`;
        const dateAddedValue = word.dateAdded;
        const dateLastSeenValue = word.dateLastSeen;
        const sourcesValue = `"${Array.isArray(word.sources) ? word.sources.join('; ').replace(/"/g, '""') : ''}"`;
        const countValue = word.count;

        csvRows.push([wordValue, translationValue, transcriptionValue, dateAddedValue, dateLastSeenValue, sourcesValue, countValue, tagsValue].join(','));
      });

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const filename = `wordbox_dictionary_${new Date().toISOString().slice(0, 10)}.csv`; // Имя файла: wordbox_dictionary_YYYY-MM-DD.csv

      // Создаем невидимую ссылку и кликаем по ней для скачивания
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url); // Очищаем URL объекта

    } else {
      console.error('Failed to get words for export:', response.message);
      alert('Ошибка при подготовке данных для экспорта.');
    }
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    alert('Произошла ошибка при экспорте словаря.');
  }
}

// --- Логика переключения темы ---
const THEME_KEY = 'wordbox_theme'; // Ключ для хранения темы в localStorage
const DARK_THEME_CLASS = 'dark-theme'; // Класс для тёмной темы

function applyTheme(theme) {
    const body = document.body;
    body.classList.toggle(DARK_THEME_CLASS, theme === 'dark'); // Добавляем/удаляем класс

    // Обновляем видимость отдельных SVG-иконок
    const sunIconSvg = document.querySelector('.sun-icon-svg');
    const moonIconSvg = document.querySelector('.moon-icon-svg');

    if (sunIconSvg && moonIconSvg) {
        // ЕСЛИ ТЕМА СВЕТЛАЯ, ПОКАЗЫВАЕМ ЛУНУ (предлагаем перейти на темную)
        sunIconSvg.style.display = theme === 'light' ? 'none' : 'block'; // Скрываем солнце в светлой, показываем в темной
        moonIconSvg.style.display = theme === 'light' ? 'block' : 'none'; // Показываем луну в светлой, скрываем в темной
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem(THEME_KEY) || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);
    console.log(`WordBox popup.js: Тема переключена на: ${newTheme}`);
}

// ДОБАВЛЯЕМ КНОПКУ РУЧНОГО ДОБАВЛЕНИЯ СЛОВА

// Переменные для модального окна
const addWordModal = document.getElementById('addWordModal');
const addWordButton = document.getElementById('addWordButton');
const closeButton = document.querySelector('.modal .close-button');
const manualWordInput = document.getElementById('manualWordInput');
const manualTagsInput = document.getElementById('manualTagsInput'); // НОВОЕ: поле для тегов
const submitManualWordButton = document.getElementById('submitManualWord');
const manualWordError = document.getElementById('manualWordError');

// Открытие модального окна
addWordButton.addEventListener('click', () => {
    addWordModal.style.display = 'flex'; // Используем flex для центрирования
    manualWordInput.value = ''; // Очищаем поле ввода слова
    manualTagsInput.value = ''; // НОВОЕ: Очищаем поле ввода тегов
    manualWordError.textContent = ''; // Очищаем сообщение об ошибке
    manualWordError.style.display = 'none'; // Скрываем сообщение об ошибке
    manualWordInput.focus(); // Устанавливаем фокус на поле ввода слова
});

// Закрытие модального окна по клику на "x"
closeButton.addEventListener('click', () => {
    addWordModal.style.display = 'none';
});

// Закрытие модального окна по клику вне его (на сером фоне)
window.addEventListener('click', (event) => {
    if (event.target === addWordModal) {
        addWordModal.style.display = 'none';
    }
});

// Обработка отправки слова из модального окна
submitManualWordButton.addEventListener('click', async () => {
    const word = manualWordInput.value.trim();
    // НОВОЕ: Парсим теги
    const tags = manualTagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    if (word === '') {
        manualWordError.textContent = 'Пожалуйста, введите слово.';
        manualWordError.style.display = 'block';
        return;
    }

    // Простая проверка на английские буквы. Можно улучшить.
    const isEnglishWord = /^[a-zA-Z']+$/.test(word);
    if (!isEnglishWord) {
        manualWordError.textContent = 'Пожалуйста, введите корректное английское слово (только буквы и апострофы).';
        manualWordError.style.display = 'block';
        return;
    }

    manualWordError.style.display = 'none'; // Скрываем ошибку, если все ок

    // Отправляем слово в background скрипт для обработки
    try {
        // Мы не можем получить sourceUrl для вручную введенных слов
        const response = await browser.runtime.sendMessage({
            action: 'addWord',
            word: word,
            sourceUrl: 'manual_entry', // Указываем, что это ручной ввод
            tags: tags // НОВОЕ: Передаем теги
        });

        if (response.status === 'success') {
            console.log('Слово успешно добавлено вручную:', response.word);
            addWordModal.style.display = 'none'; // Закрываем модальное окно
            displayWords(); // Обновляем список слов в словаре
        } else {
            console.error('Ошибка при ручном добавлении слова:', response.message);
            manualWordError.textContent = `Ошибка: ${response.message}`;
            manualWordError.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка при отправке слова для ручного добавления:', error);
        manualWordError.textContent = 'Произошла ошибка при добавлении слова.';
        manualWordError.style.display = 'block';
    }
});

// Добавляем обработчик Enter на поле ввода
manualWordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Предотвращаем дефолтное поведение (например, отправку формы)
        submitManualWordButton.click(); // Имитируем клик по кнопке "Добавить"
    }
});
manualTagsInput.addEventListener('keydown', (event) => { // НОВОЕ: Enter для поля тегов
  if (event.key === 'Enter') {
      event.preventDefault();
      submitManualWordButton.click();
  }
});

// Вызываем displayWords при загрузке попапа
document.addEventListener('DOMContentLoaded', displayWords);

// Обработчик для кнопки экспорта
document.getElementById('exportButton').addEventListener('click', exportToCsv);

// Обработчик для кнопки переключения темы
document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  browser.storage.local.set({
    darkMode: isDark
  });
});

// Загрузка сохраненной темы
browser.storage.local.get('darkMode').then(data => {
  if (data.darkMode) {
    document.body.classList.add('dark-theme');
  }
});

console.log('WordBox popup.js loaded.');