# Ритм — папка для хостинга

Эти три файла — готовый статический сайт. Сборка и сервер не нужны.

```
deploy/
├── index.html   ← точка входа
├── styles.css
├── app.js
├── .nojekyll    ← для GitHub Pages
└── README.md
```

## GitHub Pages

Развёрнутая пошаговая инструкция лежит в корне рабочей папки: `../GITHUB_PAGES.md` (в саму заливаемую папку она не входит).

1. Создайте **публичный** репозиторий.
2. Залейте содержимое этой папки в корень ветки `main`.
3. Settings → Pages → Deploy from a branch → `main` / `/ (root)`.
4. Откройте выданный HTTPS-адрес.

GitHub Pages ищет `index.html`, `index.md` или `README.md` как точку входа; здесь используется `index.html`. Документация: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Cloudflare Pages

Можно подключить Git-репозиторий или использовать **Direct Upload** и загрузить эту папку целиком. Документация: https://developers.cloudflare.com/pages/get-started/

## Netlify Drop

Перетащите всю папку `deploy` на https://app.netlify.com/drop — сайт сразу получит HTTPS-адрес. Документация: https://docs.netlify.com/start/choose-your-path/

## Важно

- Нужен именно **HTTPS**: шифрование использует Web Crypto API, доступный только в безопасном контексте. Все перечисленные хостинги выдают SSL бесплатно.
- Не открывайте `index.html` через `file://`. Для локальной проверки: `python3 -m http.server 8000` и `http://localhost:8000`.
- Записи хранятся в `localStorage` конкретного домена. При переезде сделайте «Экспорт» на старом адресе и «Импорт» на новом.
- Пароль не восстанавливается. Храните резервную копию JSON отдельно и не публикуйте её в публичном репозитории.
- Автономная однофайловая версия лежит рядом в `/home/user/planner.html`; она не нужна для этого варианта деплоя, но удобна для локального открытия.
