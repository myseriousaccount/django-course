# Сетап: віртуальне середовище і перший проєкт

Тут зібрані **всі команди**, щоб з нуля підняти Django-проєкт, з поясненням кожного прапорця. Більшість кроків ті самі, що й для Flask (бо це Python), плюс команди, унікальні для Django: `startproject`, `migrate`, `runserver`.

## Крок 1 — віртуальне середовище (venv)

**Визначення.** **venv** — це ізольоване середовище з пакетами для одного проєкту: у кожного проєкту свій окремий «ящик» із залежностями.

**Навіщо.** Щоб залежності цього проєкту не змішувались із системними та з іншими проєктами. Один проєкт може вимагати Django 5, інший — Django 6; без venv вони конфліктували б.

**Як це працює.**

```bash
# створити venv у папці проєкту (папка venv з'явиться поряд)
python3 -m venv venv

# активувати (macOS / Linux)
source venv/bin/activate

# активувати (Windows PowerShell)
venv\Scripts\Activate.ps1

# активувати (Windows cmd)
venv\Scripts\activate.bat
```

Розберемо команду створення по частинах:

- `python3 -m venv` — запустити вбудований модуль `venv`.
- перше `venv` після модуля — це **ім'я папки**, яку буде створено (конвенція — назвати її теж `venv` або `.venv`).

Після активації перед рядком терміналу з'явиться `(venv)`. Це знак, що ти «всередині ящика» — усі `pip install` тепер ідуть сюди, а не в систему.

> <i class="bi bi-lightbulb"></i> Аналогія з Flask: це той самий `python -m venv` — нічого нового. Django нічого не змінює в роботі venv.

Деактивувати, коли закінчила:

```bash
deactivate
```

> <i class="bi bi-info-circle"></i> Папку `venv/` **не додають у git** — її прописують у `.gitignore`. Замість неї версіонується `requirements.txt` (крок 6), за яким кожен відтворює середовище в себе.

## Крок 2 — встановити Django

Усередині активованого venv:

```bash
pip install django
```

Корисні варіанти цієї команди:

```bash
pip install django              # остання стабільна версія
pip install "django==6.0.*"     # конкретна серія версій
pip install --upgrade django    # оновити вже встановлений Django
```

Перевірити версію:

```bash
python -m django --version
# 6.0
```

## Крок 3 — створити проєкт (`startproject`)

**Визначення.** `django-admin startproject` — команда, якої не було у Flask: вона генерує кістяк проєкту (готову структуру папок і файлів).

**Як це працює.**

```bash
django-admin startproject config .
```

Розберемо по частинах:

- `django-admin` — універсальна утиліта Django (проєкту ще нема, тому не `manage.py`).
- `startproject` — підкоманда «створи новий проєкт».
- `config` — **ім'я проєкту**. Це стане іменем внутрішнього пакета з налаштуваннями (`config/settings.py`, `config/urls.py`). Часті імена: `config`, `core`, `root`, або назва самого сайту.
- `.` (крапка) — **«створи тут, у поточній папці»**. Без крапки Django зробив би зайвий вкладений рівень папок. Крапка — важлива деталь.

<i class="bi bi-exclamation-triangle"></i> **Типова помилка.** Якщо забути крапку, отримаєш `myproject/myproject/...` з подвійним вкладенням. Крапка каже: «пакет-налаштування створи прямо тут, не роби зайву обгортку».

> <i class="bi bi-lightbulb"></i> Порівняй зі своїм shop-app: там проєкт назвали `root`, тому пакет-налаштування — `root/`. Ім'я довільне, головне — крапку не забути.

## Крок 4 — запустити сервер розробки

```bash
python manage.py runserver
```

Побачиш приблизно:

```
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

Відкрий `http://127.0.0.1:8000/` — і Django покаже стартову сторінку з ракетою 🚀 (якщо ще не додані власні маршрути).

Корисні варіанти `runserver`:

```bash
python manage.py runserver              # за замовчуванням 127.0.0.1:8000
python manage.py runserver 8080         # інший порт
python manage.py runserver 0.0.0.0:8000 # доступ з інших пристроїв у мережі
```

> <i class="bi bi-lightbulb"></i> `runserver` — це аналог `flask run` / `app.run()`. Це сервер **лише для розробки**, не для продакшну (для бою — Gunicorn/uWSGI + WSGI, або Uvicorn + ASGI).

## Крок 5 — застосувати початкові міграції

**Як це працює.** Django з коробки має таблиці (користувачі, сесії, адмінка, права). При першому запуску він попросить їх створити:

```bash
python manage.py migrate
```

Це створить файл БД `db.sqlite3` у корені проєкту. Детальніше про міграції — у пізніших розділах; поки достатньо знати: ця команда «накатує» структуру таблиць у базу.

## Крок 6 — зафіксувати залежності

**Навіщо.** Щоб інша людина (чи ти на іншому комп'ютері) могла відтворити середовище точно з тими самими версіями.

```bash
pip freeze > requirements.txt
```

Це збереже список пакетів з версіями у файл. Відтворити середовище потім:

```bash
pip install -r requirements.txt
```

> <i class="bi bi-info-circle"></i> `requirements.txt` **додають у git**, а `venv/` — ні. Так репозиторій лишається легким, а середовище — відтворюваним.

## Уся послідовність одним блоком

```bash
python3 -m venv venv               # 1. створити середовище
source venv/bin/activate           # 2. активувати
pip install django                 # 3. встановити Django
django-admin startproject config . # 4. створити проєкт ТУТ
python manage.py migrate           # 5. створити базові таблиці
python manage.py runserver         # 6. запустити сервер
```

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **`django-admin: command not found`** → або venv не активований, або Django не встановлено. Перевір, що видно `(venv)` у рядку, і виконай `pip install django`.

> <i class="bi bi-exclamation-triangle"></i> **Забута крапка в `startproject`** → зайвий вкладений рівень папок. Ознака: `config/config/...` замість очікуваного одного рівня.

> <i class="bi bi-exclamation-triangle"></i> **`That port is already in use`** → сервер уже запущений в іншому вікні, або порт зайнятий. Запусти на іншому порту (`runserver 8080`) або зупини попередній процес.

> <i class="bi bi-info-circle"></i> **`django-admin` vs `manage.py`.** `startproject` роблять через `django-admin` (проєкту ще нема). Усе решта (`runserver`, `migrate`, `startapp`) — через `python manage.py`.

## А де `startapp`?

Ми підняли **проєкт**, але ще не створили жодного **модуля (app)**. Це наступний крок — команда `python manage.py startapp <ім'я>` (наприклад `startapp blog`). Її свідомо лишено на потім: спершу треба зрозуміти, що таке app і навіщо ділити проєкт на модулі. Коротко `startapp` згадується в розділі «manage.py», а повноцінно — у розділі «Модулі (apps)».

## Підсумок

- `python3 -m venv venv` + `source venv/bin/activate` — те саме ізольоване середовище, що й у Flask; `venv/` не версіонують.
- `pip install django` (можна `"django==6.0.*"`); перевірка — `python -m django --version`.
- `django-admin startproject config .` — **крапка** означає «створити в поточній папці», без неї буде зайве вкладення; ім'я проєкту довільне.
- `python manage.py runserver` — сервер розробки (аналог `flask run`), за замовчуванням `127.0.0.1:8000`; порт і хост можна змінити.
- `migrate` — створює базові таблиці й `db.sqlite3`; `pip freeze > requirements.txt` фіксує залежності, а `pip install -r requirements.txt` їх відновлює.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/intro/tutorial01/" target="_blank" rel="noopener">Writing your first Django app <i class="bi bi-box-arrow-up-right"></i></a></div></div>
