// src/content.js

let selectedText = '';
let addIcon = null; // Переменная для хранения элемента иконки

// Создает SVG элемент для иконки
function createAddIcon() {
  // Если иконка уже существует, не создаем новую
  if (addIcon) {
    return addIcon;
  }

  const icon = document.createElement('div');
  icon.id = 'wordbox-add-icon';
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M17 13h-4v4h-2v-4H7v-2h4V7h2v4h4m2-8H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2"/></svg>`;
  icon.style.cursor = 'pointer';
  icon.style.position = 'absolute';
  icon.style.zIndex = '99999';
  icon.style.backgroundColor = 'white';
  icon.style.border = '1px solid #ccc';
  icon.style.borderRadius = '4px';
  icon.style.padding = '2px';
  icon.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  icon.style.display = 'flex';
  icon.style.alignItems = 'center';
  icon.style.justifyContent = 'center';
  icon.style.color = '#333'; // Цвет иконки
  icon.title = 'Добавить слово в WordBox';

  icon.addEventListener('click', (event) => {
    event.stopPropagation(); // Предотвращаем всплытие события, чтобы не срабатывали другие обработчики документа
    event.preventDefault(); // Предотвращаем действие по умолчанию (например, снятие выделения)
    console.log('WordBox content.js: Иконка "+" нажата.');
    console.log('WordBox content.js: Значение selectedText при клике:', selectedText);

    // Убедимся, что selectedText не пуст перед отправкой
    if (selectedText && selectedText.length > 0) {
      const currentUrl = window.location.href;
      console.log(`WordBox content.js: Отправка слова "${selectedText}" с URL "${currentUrl}" в background.`);
      browser.runtime.sendMessage({
          action: 'addWord',
          word: selectedText,
          sourceUrl: currentUrl
        })
        .then(response => {
          console.log('WordBox content.js: Получен ответ от background:', response);
          if (response.status === 'success') {
            console.log('Word added successfully:', response.word);
            // Можно добавить временное визуальное подтверждение для пользователя
          } else {
            console.error('Failed to add word:', response.message);
          }
        })
        .catch(error => {
          console.error('WordBox content.js: Ошибка при отправке сообщения в background script:', error);
        })
        .finally(() => {
          // Всегда удаляем иконку после попытки добавления
          removeAddIcon();
          // Сбрасываем selectedText после добавления
          selectedText = '';
          // Снимаем выделение, чтобы иконка не появилась снова
          window.getSelection().removeAllRanges();
        });
    } else {
      console.warn('WordBox content.js: selectedText пуст при нажатии на иконку. Слово не отправлено.');
      removeAddIcon(); // Удаляем иконку, если слово почему-то невалидно
      window.getSelection().removeAllRanges(); // Снимаем выделение
    }
  });
  return icon;
}

// Удаляет иконку из DOM
function removeAddIcon() {
  if (addIcon && addIcon.parentNode) {
    addIcon.parentNode.removeChild(addIcon);
    addIcon = null;
    console.log('WordBox content.js: Иконка "+" удалена.');
  }
}

// Обрабатывает событие выделения текста
document.addEventListener('mouseup', (event) => {
  // Если mouseup произошел на самой иконке, игнорируем его здесь.
  // Обработчик клика иконки позаботится об остальном.
  if (addIcon && addIcon.contains(event.target)) {
    return;
  }

  const selection = window.getSelection();
  const text = selection.toString().trim();
  const isEnglishWord = /^[a-zA-Z']+$/.test(text);

  if (text.length > 0 && isEnglishWord && selection.rangeCount > 0) {
    // Если есть валидное выделение и иконки еще нет, создаем и показываем ее
    if (!addIcon) {
      selectedText = text; // Устанавливаем selectedText только при новом выделении
      addIcon = createAddIcon();
      document.body.appendChild(addIcon);

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      addIcon.style.left = `${rect.right + window.scrollX + 5}px`;
      addIcon.style.top = `${rect.top + window.scrollY}px`;
      console.log(`WordBox content.js: Выделено слово "${selectedText}", иконка "+" показана.`);
    }
  } else {
    // Если выделение невалидно или пусто, удаляем иконку
    removeAddIcon();
    selectedText = ''; // Сбрасываем selectedText
    console.log('WordBox content.js: Выделение не является словом или пусто. Иконка скрыта.');
  }
});

// Обрабатывает mousedown для удаления иконки, если клик вне её
document.addEventListener('mousedown', (event) => {
  // Если mousedown был на самой иконке, ничего не делаем здесь.
  // Ее click-обработчик позаботится об удалении.
  if (addIcon && addIcon.contains(event.target)) {
    return;
  }
  // Если mousedown где-либо еще, удаляем иконку
  removeAddIcon();
});

console.log('WordBox content.js loaded.');