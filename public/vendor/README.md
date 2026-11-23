# Telegram Web App SDK

`telegram-web-app.baa788a6.js` — неизменённая копия официального SDK:
https://telegram.org/js/telegram-web-app.js

Получен 2026-11-23. SHA-256:
`baa788a6f686f4238db1b82ce8e76470930af7411b18b521ebb95a2c1480a267`.

SDK обслуживается с origin приложения: недоступность `telegram.org` у провайдера
не должна блокировать HTML-парсер и запуск web-версии. Скрипт остаётся синхронным,
чтобы Telegram Mini App получал `initData` до определения платформы в React.

При обновлении скачайте SDK с официального URL, проверьте содержимое и SHA-256,
используйте первые восемь символов нового хеша в имени файла и обновите ссылку
в `index.html`. Проверьте сборку и вход как в браузере, так и в Telegram Mini App.

Telegram Login Widget загружается отдельно при выборе входа через Telegram;
его доступность по-прежнему зависит от `telegram.org`.
