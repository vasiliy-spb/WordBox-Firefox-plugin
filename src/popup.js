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
            <strong>${word.id}</strong>
            ${word.transcription ? `<span class="transcription">[${word.transcription}]</span>` : ''}
            ${Array.isArray(word.translation) && word.translation.length > 0 ? `<span class="translation">${word.translation.join(', ')}</span>` : ''}
          </div>
          <button class="delete-button" data-id="${word.id}">
            <!-- Feather Icon: X-Circle (для удаления) -->
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
          const wordIdToDelete = event.target.dataset.id;
          // Если клик был по SVG внутри кнопки, найдем родительскую кнопку
          let targetButton = event.target;
          while (targetButton && !targetButton.classList.contains('delete-button')) {
            targetButton = targetButton.parentNode;
          }
          if (!targetButton) return; // Если не нашли кнопку, выходим

          const actualWordIdToDelete = targetButton.dataset.id; // Используем dataset из кнопки

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
document.addEventListener('DOMContentLoaded', () => {
  displayWords();
  document.getElementById('exportButton').addEventListener('click', exportToCsv);

  // Инициализация темы при загрузке
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);

  // Обработчик для кнопки переключения темы
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
  }
});

console.log('WordBox popup.js loaded.');