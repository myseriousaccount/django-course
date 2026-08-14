# Головні файли проєкту

Пакет проєкту — це папка з налаштуваннями, яку створив `startproject` (у прикладах нижче вона зветься `config`). На відміну від застосунків, що відповідають кожен за свою область, ці файли керують проєктом цілком: конфігурацією, маршрутизацією та точками входу для сервера.

## settings.py

Звичайний Python-модуль, у якому кожне налаштування — змінна верхнього рівня у верхньому регістрі. Django читає його один раз при старті.

### BASE_DIR

```python
# config/settings.py
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
```

Корінь проєкту, від якого будуються решта шляхів: `BASE_DIR / 'templates'`, `BASE_DIR / 'db.sqlite3'`. Два виклики `.parent` піднімають на два рівні: від файла `settings.py` до папки `config`, далі до кореня.

### SECRET_KEY, DEBUG, ALLOWED_HOSTS

```python
# config/settings.py
SECRET_KEY = 'django-insecure-...'
DEBUG = True
ALLOWED_HOSTS = []
```

| Налаштування | Що робить |
|---|---|
| `SECRET_KEY` | ключ, яким підписуються сесії, CSRF-токени й посилання на скидання пароля |
| `DEBUG` | режим розробки: детальні сторінки помилок зі значеннями змінних |
| `ALLOWED_HOSTS` | домени, з яких приймаються запити; при `DEBUG = False` список обов'язковий |

> <i class="bi bi-exclamation-triangle"></i> `DEBUG = True` на бойовому сервері показує трасування, фрагменти коду й частину налаштувань будь-якому відвідувачу сторінки з помилкою. Витік `SECRET_KEY` дозволяє підробити сесію будь-якого користувача. Обидва значення на продакшні беруть із середовища — про це в уроці «dev vs prod і секрети».

### INSTALLED_APPS

```python
# config/settings.py
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'blog',
    'accounts',
]
```

Django обходить цей список, коли шукає моделі, міграції, шаблони, статику, теги й команди. Застосунок, якого тут немає, для фреймворку не існує.

### MIDDLEWARE

```python
# config/settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

Обробники, через які проходить кожен запит на шляху до view і кожна відповідь назад. Порядок значущий: `AuthenticationMiddleware` заповнює `request.user` і тому мусить стояти після `SessionMiddleware`, з якого бере сесію. Детально — в уроці «Цикл запиту й middleware».

### ROOT_URLCONF і TEMPLATES

```python
# config/settings.py
ROOT_URLCONF = 'config.urls'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ],
    },
}]
```

- `ROOT_URLCONF` — з якого модуля починається розбір адрес.
- `DIRS` — спільні шаблони проєкту.
- `APP_DIRS: True` — додатково шукати `templates/` усередині кожного застосунку.
- `context_processors` — функції, що додають змінні в кожен шаблон: саме звідси в шаблонах беруться `user` і `messages`.

### DATABASES

```python
# config/settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```

SQLite зберігає всю базу в одному файлі й не потребує встановлення — тому він стоїть за замовчуванням. PostgreSQL — окремий сервер, тож підключення описує не шлях, а параметри з'єднання:

```python
# config/settings.py
import os

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ['DB_NAME'],          # назва бази, а не файл
        'USER': os.environ['DB_USER'],
        'PASSWORD': os.environ['DB_PASSWORD'],
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}
```

Для PostgreSQL потрібен драйвер: `pip install "psycopg[binary]"`. Пароль тримають у змінних середовища, а не в коді, який потрапляє в git.

> <i class="bi bi-info-circle"></i> SQLite не підходить для продакшну з паралельними записами: він блокує файл цілком і на конкурентних запитах видає `database is locked`. Для навчального проєкту цього обмеження не видно, для бойового — переходять на PostgreSQL.

### Паролі, мова, час

```python
# config/settings.py
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'uk'
TIME_ZONE = 'Europe/Kyiv'
USE_I18N = True
USE_TZ = True
```

`AUTH_PASSWORD_VALIDATORS` застосовуються формами автентифікації й функцією `validate_password()`, але не спрацьовують при прямому `create_user()`. `USE_TZ = True` означає, що в базі час зберігається в UTC, а перетворюється при виведенні — тому в коді використовують `timezone.now()`, а не `datetime.now()`.

### Статика й медіа

```python
# config/settings.py
STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']     # вихідні файли проєкту
STATIC_ROOT = BASE_DIR / 'staticfiles'       # куди collectstatic збере все для сервера

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'              # файли, завантажені користувачами
```

Статика — файли, які пишеш ти (CSS, JS, іконки). Медіа — те, що завантажують користувачі (фото товарів, аватари). Їх розділяють, бо перші версіонуються разом із кодом, а другі — ні.

### DEFAULT_AUTO_FIELD

```python
# config/settings.py
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
```

Тип поля `id`, яке Django додає моделям автоматично. `BigAutoField` — 64-бітне ціле; зміна цього значення в наявному проєкті потребує міграцій усіх таблиць.

## urls.py

Точка входу для маршрутизації. Головна таблиця не описує всі адреси сама, а делегує їх застосункам:

```python
# config/urls.py
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('home.urls')),
    path('blog/', include('blog.urls')),
    path('accounts/', include('accounts.urls')),
]
```

У режимі розробки сюди ж додають роздачу медіафайлів — на продакшні цим займається вебсервер:

```python
# config/urls.py
from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

## wsgi.py і asgi.py

Точки входу для бойового сервера. `wsgi.py` — синхронний інтерфейс, з ним працюють Gunicorn і uWSGI. `asgi.py` — асинхронний, потрібен для WebSocket, довгих з'єднань і `async def` view; його використовує Uvicorn.

```python
# config/wsgi.py
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
application = get_wsgi_application()
```

Сервер імпортує саме об'єкт `application`. У розробці ці файли не задіяні: `runserver` піднімає власний сервер.

## Як файли пов'язані

```
запит → wsgi.py або asgi.py (на сервері)
            ↓
        settings.py — які застосунки, де маршрути, яка база
            ↓
        config/urls.py → include() → app/urls.py → view
```

`manage.py` лежить рівнем вище й до пакета проєкту не належить: він лише вказує на `config.settings` і виконує команди. Детально — в уроці «Команди manage.py».

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `SECRET_KEY` і `DEBUG` жорстко в коді | Ключ потрапляє в git і стає загальнодоступним; на продакшні `DEBUG` показує трасування. Значення беруть зі змінних середовища |
| `DEBUG = False` без `ALLOWED_HOSTS` | Кожен запит відхиляється з помилкою `DisallowedHost` |
| Застосунок не в `INSTALLED_APPS` | Моделі не потрапляють у міграції, шаблони й теги не знаходяться |
| Довільний порядок `MIDDLEWARE` | `request.user` або CSRF перестають працювати: обробники залежать від попередніх у списку |
| Плутати `STATICFILES_DIRS` і `STATIC_ROOT` | Перше — де лежать вихідні файли, друге — куди `collectstatic` їх збирає. Якщо переплутати, у розробці статика зникає |
| Медіа й статика в одній папці | Завантажені користувачами файли потрапляють у git і перезаписуються при деплої |
| `datetime.now()` при `USE_TZ = True` | Наївний час дає попередження й неправильні порівняння; використовують `timezone.now()` |

## Підсумок

- `settings.py` тримає всю конфігурацію: `BASE_DIR`, безпеку (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`), `INSTALLED_APPS`, `MIDDLEWARE`, `ROOT_URLCONF`, `TEMPLATES`, `DATABASES`, валідатори паролів, локаль, статику й медіа.
- `INSTALLED_APPS` — єдине джерело, з якого Django дізнається про застосунки; `MIDDLEWARE` чутливий до порядку.
- SQLite підходить для розробки, PostgreSQL — для продакшну; параметри з'єднання й паролі беруть зі змінних середовища.
- `STATICFILES_DIRS` — вихідна статика, `STATIC_ROOT` — результат `collectstatic`, `MEDIA_ROOT` — файли користувачів; це три різні речі.
- `urls.py` делегує маршрути застосункам через `include()`, у режимі `DEBUG` додатково роздає медіа.
- `wsgi.py` і `asgi.py` — точки входу для бойового сервера; у розробці не використовуються.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/settings/" target="_blank" rel="noopener">Settings reference <i class="bi bi-box-arrow-up-right"></i></a></div></div>
