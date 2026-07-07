# manage.py — твій пульт керування

Кожна команда, яку ти набираєш у Django, починається з `python manage.py ...`. Розберемось, що це за файл, чому він такий важливий, і які команди ти будеш використовувати.

## Що таке manage.py

> **manage.py** — це невеликий Python-скрипт у корені проєкту (у shop-app: `root/manage.py`), що запускає адміністративні команди Django у контексті саме твого проєкту.

**Як це працює.** Технічно `manage.py` робить одну ключову річ: вказує Django, де лежать твої налаштування.

```python
# manage.py (спрощено)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'root.settings')
```

Цей рядок каже: «налаштування шукай у `root/settings.py`». Тому будь-яка команда через `manage.py` автоматично знає про твою БД, твої apps, твої шаблони.

> <i class="bi bi-lightbulb"></i> Аналогія: `manage.py` — це **пульт від конкретного телевізора**. Існує універсальна команда `django-admin`, але `manage.py` — це той самий інструмент, уже «налаштований» на твій проєкт (через `DJANGO_SETTINGS_MODULE`). Тому в роботі ти майже завжди користуєшся `manage.py`, а не голим `django-admin`.

## Як викликати команди

Формат завжди однаковий:

```bash
python manage.py <команда> [аргументи]
```

Подивитись усі доступні команди:

```bash
python manage.py help
```

Довідку по конкретній команді (усі її прапорці):

```bash
python manage.py help migrate
python manage.py runserver --help
```

## Команди, які ти будеш використовувати найчастіше

| Команда | Що робить |
|---|---|
| `runserver` | Запускає сервер розробки (порт 8000) |
| `startapp <ім'я>` | Створює новий модуль (app) |
| `makemigrations` | Готує міграції з твоїх змін у моделях |
| `migrate` | Застосовує міграції до бази |
| `createsuperuser` | Створює адміна для `/admin` |
| `shell` | Інтерактивний Python із доступом до моделей |
| `dbshell` | Відкриває клієнт самої БД (SQL напряму) |
| `collectstatic` | Збирає статику для продакшну |
| `test` | Запускає тести |
| `check` | Перевіряє проєкт на типові проблеми |

І кілька команд, що трапляються рідше, але корисні знати:

| Команда | Що робить |
|---|---|
| `showmigrations` | Показує, які міграції застосовані, а які ні |
| `sqlmigrate <app> <номер>` | Показує SQL, який згенерує міграція (без виконання) |
| `flush` | Очищає всі дані з БД (структуру лишає) |
| `dumpdata` / `loaddata` | Експорт / імпорт даних (фікстури) |
| `changepassword <user>` | Змінює пароль користувача |
| `makemessages` / `compilemessages` | Робота з перекладами (i18n) |

## Найважливіша пара: makemigrations + migrate

**Навіщо.** Це те, що в Flask ти робила через Flask-Migrate. У Django — вбудовано і у два кроки:

```bash
# 1. Ти змінила models.py → Django готує "інструкцію" зміни БД
python manage.py makemigrations

# 2. Django виконує цю інструкцію — реально змінює таблиці
python manage.py migrate
```

**Як це працює — поділ ролей:**

- `makemigrations` — **пише план** (створює файл у папці `migrations/`), базу ще не чіпає.
- `migrate` — **виконує план** у реальній базі.

Приклад: додала до моделі `Book` бібліотеки нове поле `isbn`. `makemigrations` створить файл `0002_book_isbn.py` з описом зміни, а `migrate` реально додасть колонку `isbn` у таблицю.

> <i class="bi bi-info-circle"></i> Чому два кроки? Бо файл-міграція потрапляє в git, і вся команда накатує однакові зміни через `migrate`. Це акуратна історія змін схеми БД. `showmigrations` покаже, що вже застосовано, а `sqlmigrate` — який саме SQL виконається.

## startapp — створити модуль

**Як це працює.** Коли в проєкті з'являється новий розділ, для нього створюють окремий app. Приклади з різних доменів:

```bash
python manage.py startapp blog       # блог-платформа: пости, коментарі
python manage.py startapp movies     # кіно-довідник: фільми, актори
python manage.py startapp library    # бібліотека: книги, читачі
```

Django згенерує папку з усіма потрібними файлами (`models.py`, `views.py`, `admin.py`, `apps.py`, `tests.py`, `migrations/`). Далі модуль треба «увімкнути» — додати в `INSTALLED_APPS` (про це — у розділі про apps).

## shell — Python з доступом до моделей

**Навіщо.** Швидко перевірити запит до БД чи створити об'єкт без написання view.

```bash
python manage.py shell
```

Усередині вже налаштований доступ до твоїх моделей:

```python
>>> from blog.models import Post
>>> Post.objects.count()
42
>>> Post.objects.create(title='Привіт', body='Перший пост')
```

> <i class="bi bi-info-circle"></i> Це саме `manage.py shell`, а не звичайний `python`: перший знає про `DJANGO_SETTINGS_MODULE`, тому моделі й БД доступні одразу.

## createsuperuser — доступ до адмінки

Django має готову адмін-панель на `/admin`. Щоб зайти, потрібен суперкористувач:

```bash
python manage.py createsuperuser
# далі введеш username, email, пароль
```

Після цього `http://127.0.0.1:8000/admin/` пустить тебе у вбудовану панель керування даними — без жодного рядка коду.

## manage.py vs django-admin

| | `django-admin` | `manage.py` |
|---|---|---|
| Прив'язка до проєкту | **Не знає** про конкретний проєкт | Прив'язаний через `DJANGO_SETTINGS_MODULE` |
| Коли використовуєш | Лише `startproject` (проєкту ще нема) | Усе решта |

**Нюанс.** `startproject` ти запускаєш через `django-admin` (бо проєкту ще нема). А **все інше** — через `manage.py`.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **`No changes detected` після зміни моделі** → app не в `INSTALLED_APPS`, або файл не збережено. Django «не бачить» модель, тому й міграцію не робить.

> <i class="bi bi-exclamation-triangle"></i> **Забула `migrate` після `makemigrations`** → міграція є, але база не змінена. Помилки типу `no such column`. Правило: змінила модель → `makemigrations` → `migrate`.

> <i class="bi bi-exclamation-triangle"></i> **`python manage.py` без активованого venv** → або «command not found», або запуск не тим Python. Спочатку активуй середовище (`(venv)` у рядку).

> <i class="bi bi-info-circle"></i> **Забула, як зветься команда?** `python manage.py help` дасть повний список, а `help <команда>` — усі її прапорці.

## Підсумок

- `manage.py` — скрипт-«пульт», що виконує команди в контексті твого проєкту (знає про `root.settings` через `DJANGO_SETTINGS_MODULE`).
- Формат: `python manage.py <команда>`; `help` — список команд, `help <команда>` — її прапорці.
- Щоденні: `runserver`, `startapp`, `makemigrations` + `migrate`, `createsuperuser`, `shell`.
- Корисні рідше: `showmigrations`, `sqlmigrate`, `check`, `dbshell`, `dumpdata`/`loaddata`, `collectstatic`, `test`.
- `makemigrations` пише план змін БД, `migrate` його виконує — два окремі кроки.
- `startproject` → через `django-admin`; усе решта → через `manage.py`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/django-admin/" target="_blank" rel="noopener">django-admin and manage.py <i class="bi bi-box-arrow-up-right"></i></a></div></div>
