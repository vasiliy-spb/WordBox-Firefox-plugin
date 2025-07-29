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
            <!-- SVG ИКОНКА КРЕСТИКА -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
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


// Запускаем отображение слов при загрузке попапа
document.addEventListener('DOMContentLoaded', () => {
  displayWords();
  document.getElementById('exportButton').addEventListener('click', exportToCsv);
});

console.log('WordBox popup.js loaded.');