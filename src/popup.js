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
        // Отображаем слово, транскрипцию и перевод, если они есть
        // Слово отображаем в нижнем регистре (word.id)
        wordElement.innerHTML = `
          <div class="word-content">
            <span class="editable word" data-field="word" data-id="${word.id}">${word.word}</span>
            <span class="editable transcription" data-field="transcription" data-id="${word.id}">${word.transcription ? `[${word.transcription}]` : ''}</span>
            <span class="editable translation" data-field="translation" data-id="${word.id}">${Array.isArray(word.translation) && word.translation.length > 0 ? word.translation.join(', ') : ''}</span>
          </div>
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
          if (fieldName === 'transcription' && newText.trim() && !newText.startsWith('[') && !newText.endsWith(']')) {
            this.textContent = `[${newText.trim()}]`; // Trim для транскрипции, чтобы не было лишних пробелов
          } else {
              this.textContent = newText;
          }

          // Если текст не изменился, не отправляем запрос
          if (this.textContent === originalText) {
            return;
          }

          // Обновляем слово в IndexedDB
          try {
            const updateResponse = await browser.runtime.sendMessage({
              action: 'updateWord',
              wordId: wordId,
              field: fieldName,
              value: newText
            });

            if (updateResponse.status === 'success') {
              console.log(`Слово "${wordId}", поле "${fieldName}" обновлено.`);
            } else {
              console.error(`Ошибка при обновлении слова "${wordId}", поле "${fieldName}":`, updateResponse.message);
              // Можно откатить изменения в UI, если обновление не удалось
              this.textContent = originalText; 
            }
          } catch (error) {
            console.error('Ошибка при отправке сообщения об обновлении:', error);
            this.textContent = originalText; 
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

      words.forEach(word => {
        const row = headers.map(header => {
          let value = word[header];
          // Обработка специальных символов и массивов для CSV
          if (Array.isArray(value)) {
            value = value.join(';'); // Разделяем элементы массива точкой с запятой
          }
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            value = `"${value.replace(/"/g, '""')}"`; // Экранирование кавычек и оборачивание в кавычки
          }
          return value;
        });
        csvRows.push(row.join(','));
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

// Запускаем отображение слов и инициализируем тему при загрузке попапа
// document.addEventListener('DOMContentLoaded', () => {
//   displayWords();
//   document.getElementById('exportButton').addEventListener('click', exportToCsv);

//   // Инициализация темы при загрузке
//   const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
//   applyTheme(savedTheme);

//   // Обработчик для кнопки переключения темы
//   const themeToggle = document.getElementById('themeToggle');
//   if (themeToggle) {
//       themeToggle.addEventListener('click', toggleTheme);
//   }
// });

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