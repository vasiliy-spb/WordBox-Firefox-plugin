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
        wordElement.innerHTML = `
          <span>
            <strong>${word.word}</strong>
            ${word.transcription ? `<br><small>Транскрипция: ${word.transcription}</small>` : ''}
            ${word.translation ? `<br><small>Перевод: ${word.translation}</small>` : ''}
          </span>
          <button class="delete-button" data-id="${word.id}">Удалить</button>
        `;
        wordListContainer.appendChild(wordElement);
      });

      // Добавляем обработчики событий для кнопок удаления
      wordListContainer.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', async (event) => {
          const wordIdToDelete = event.target.dataset.id;
          if (confirm(`Вы уверены, что хотите удалить слово "${wordIdToDelete}"?`)) {
            try {
              const deleteResponse = await browser.runtime.sendMessage({
                action: 'deleteWord',
                wordId: wordIdToDelete
              });
              if (deleteResponse.status === 'success') {
                console.log('Word deleted successfully:', wordIdToDelete);
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