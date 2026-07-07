# Папка root/: settings, urls, wsgi/asgi

Це внутрішня папка-пакет проєкту (у shop-app вона зветься `root/`, тому шлях виходить `root/root/`). Тут живе «мозок» проєкту — глобальні налаштування і головний роутер. На відміну від apps (кожен відповідає за свою тему), ця папка керує **всім** проєктом одразу. Розберемо кожен файл і кожне ключове налаштування.

## __init__.py

> **`__init__.py`** — порожній файл, єдина роль якого — зробити папку `root/` **Python-пакетом**, щоб можна було писати `root.settings`, `root.urls`, `root.wsgi`.

Точно так само, як у Flask порожній `__init__.py` робив `app/` пакетом. Не чіпаємо.

## settings.py — налаштування всього проєкту

> **settings.py** — найважливіший файл проєкту: звичайний Python-модуль, де кожне налаштування — це змінна на верхньому рівні (у ВЕЛИКИХ літерах за конвенцією). Тут зібрано все: безпека, список apps, шаблони, база, статика, мова й час.

Пройдемось по всіх ключових блоках. Порядок — приблизно такий, як їх генерує сам Django.

### BASE_DIR — корінь проєкту

```python
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
```

Коренева папка, від якої будуються всі інші шляхи (до бази, шаблонів, статики). `Path(__file__)` — це сам `settings.py`; два `.parent` піднімають на два рівні вгору — до кореня проєкту. Далі шляхи зручно збирати через `/`: `BASE_DIR / 'templates'`.

### SECRET_KEY, DEBUG, ALLOWED_HOSTS — безпека і режим

```python
SECRET_KEY = 'django-insecure-...'   # підпис сесій, токенів, cookies
DEBUG = True                         # детальні сторінки помилок
ALLOWED_HOSTS = []                   # домени, з яких приймати запити
```

- **`SECRET_KEY`** — унікальний ключ, яким Django підписує сесії, CSRF-токени, посилання на скидання пароля. Якщо він витече — зловмисник зможе підробити ці підписи.
- **`DEBUG`** — режим розробки. При `True` Django на помилці показує повний traceback зі змінними. Зручно тобі, але **небезпечно** для чужих очей.
- **`ALLOWED_HOSTS`** — білий список доменів. При `DEBUG = False` він **обов'язковий**: Django відкидає запити з доменів не зі списку.

> <i class="bi bi-exclamation-triangle"></i> `DEBUG = True` показує повний traceback і фрагменти коду — на бойовому сервері це витік даних. На проді завжди `DEBUG = False`, а `ALLOWED_HOSTS` — з реальними доменами (`['maydanchyk.ua']`).

### INSTALLED_APPS — перелік модулів

```python
INSTALLED_APPS = [
    'django.contrib.admin',      # адмін-панель
    'django.contrib.auth',       # користувачі, права, групи
    'django.contrib.contenttypes',
    'django.contrib.sessions',   # сесії
    'django.contrib.messages',   # flash-повідомлення
    'django.contrib.staticfiles',# роздача CSS/JS
    # ↑ «батарейки» Django ↓ твої модулі
    'home',
    'catalog',
    'accounts',
    'carts',
    'orders',
]
```

Перелік **усіх** модулів — і вбудованих (`django.contrib.*`), і твоїх власних. Django обходить цей список, щоб знайти моделі, шаблони, теги, команди.

> <i class="bi bi-exclamation-triangle"></i> **Найпоширеніша помилка новачка.** Створила app через `startapp`, написала моделі — а `makemigrations` каже «no changes». Причина майже завжди: app не додано в `INSTALLED_APPS`, тож Django його просто не бачить.

### MIDDLEWARE — ланцюжок прошарків

```python
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

> **Middleware** — це «прошарки», через які проходить **кожен** запит по дорозі до view і кожна відповідь на зворотному шляху.

Порядок важливий: запит іде згори вниз, відповідь — знизу вгору. Саме звідси береться `request.user` (це робить `AuthenticationMiddleware`) і захист CSRF. Django заповнює цей список сам — руками чіпаєш рідко (хіба додати сторонній прошарок, напр. для мови чи кешу).

### ROOT_URLCONF — де головний роутер

```python
ROOT_URLCONF = 'root.urls'   # головні маршрути шукати в root/urls.py
```

Django, отримавши запит, дивиться саме сюди, щоб дізнатися, з якого файлу починати розбір адрес.

### TEMPLATES — звідки брати HTML

```python
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],  # спільна папка шаблонів проєкту
    'APP_DIRS': True,                  # + шукати templates/ всередині кожного app
    'OPTIONS': {
        'context_processors': [        # що додавати в КОЖЕН шаблон автоматично
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ],
    },
}]
```

- **`DIRS`** — де лежать спільні шаблони (base.html, головна).
- **`APP_DIRS: True`** — крім того, шукати папку `templates/` **всередині кожного app**. Саме тому працює `render(request, 'blog/post.html')`.
- **`context_processors`** — функції, що додають змінні в **кожен** шаблон (напр. `user`, `messages`), щоб не передавати їх щоразу вручну.

### DATABASES — підключення до бази

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```

У shop-app — SQLite: уся база в одному файлі `db.sqlite3`. Зручно для навчання, нічого не треба ставити.

**Як це виглядає для PostgreSQL.** SQLite — це файл, тож йому досить шляху. PostgreSQL — окремий **сервер**, тому до нього треба «під'єднатися»: вказати користувача, пароль і адресу.

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),        # назва бази, а не файл
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}
```

Що змінюється проти SQLite: `ENGINE` → `...postgresql`; `NAME` — тепер **назва бази**, а не шлях до файлу; додаються `USER`, `PASSWORD`, `HOST`, `PORT`.

> <i class="bi bi-exclamation-triangle"></i> Пароль від бази — секрет, тому його читають з env-змінних (`os.environ.get(...)`), а не пишуть прямо в коді (див. урок «Settings: dev проти prod і секрети»).

> <i class="bi bi-info-circle"></i> Django не говорить із PostgreSQL без драйвера — його треба поставити: `pip install "psycopg[binary]"` (для Django 6.0).

### AUTH_PASSWORD_VALIDATORS — правила паролів

```python
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    # ...
]
```

Набір перевірок для паролів при реєстрації: мінімальна довжина, заборона надто поширених паролів тощо. Спрацьовують автоматично у формах реєстрації/зміни пароля.

### Мова, час, статика і медіа

```python
LANGUAGE_CODE = 'uk'                 # мова інтерфейсу (напр. української адмінки)
TIME_ZONE = 'Europe/Kyiv'            # часовий пояс
USE_I18N = True                      # увімкнути переклади
USE_TZ = True                        # зберігати час у базі в UTC

STATIC_URL = 'static/'               # префікс URL для CSS/JS
STATICFILES_DIRS = [BASE_DIR / 'static']  # де лежать ТВОЇ CSS/JS у розробці
STATIC_ROOT = BASE_DIR / 'staticfiles'    # куди collectstatic збере все для прода

MEDIA_URL = 'media/'                 # префікс URL для завантажених файлів
MEDIA_ROOT = BASE_DIR / 'media'      # куди складати аватарки, фото товарів тощо
```

- **`STATICFILES_DIRS`** — твої вихідні статичні файли; **`STATIC_ROOT`** — куди команда `collectstatic` збирає їх усі в одну папку для бойового сервера.
- **`MEDIA_*`** — окремо для файлів, які завантажують **користувачі** (не плутай зі статикою розробника).

### DEFAULT_AUTO_FIELD — тип первинного ключа

```python
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
```

Який тип поля Django ставить для автоматичного `id` у моделях. `BigAutoField` — велике ціле, вистачає надовго. Задається один раз, більше не думаєш.

## urls.py — головний роутер

> **urls.py** — вхідна точка для всіх маршрутів проєкту. Django, отримавши запит, дивиться спершу сюди (бо `ROOT_URLCONF = 'root.urls'`).

Ось `root/urls.py` shop-app:

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('home.urls')),
    path('accounts/', include('accounts.urls')),
    path('carts/', include('carts.urls')),
    path('catalog/', include('catalog.urls')),
    path('orders/', include('orders.urls')),
]
```

**Як це працює.** Ключова ідея — головний роутер **не описує всі маршрути сам**, а **делегує** їх модулям через `include()`. Наприклад, усе, що починається з `catalog/`, передається в `catalog/urls.py`. Це і є модульність. Детально — у наступному розділі про URL.

## wsgi.py і asgi.py — точки входу для деплою

**Навіщо.** Ці два файли потрібні, коли проєкт виходить на **справжній** сервер (не `runserver`).

- **wsgi.py** — класична, синхронна точка входу. Бойовий сервер (наприклад Gunicorn) бере `root.wsgi.application` і через нього спілкується з твоїм Django.
- **asgi.py** — асинхронна версія (для WebSocket, довгих з'єднань, async-view).

> <i class="bi bi-info-circle"></i> У розробці ти їх не чіпаєш — `runserver` працює без них. Вони «оживають» тільки на деплої. Просто знай: `wsgi.py` — це двері, через які бойовий сервер заходить у твій додаток.

## manage.py — пульт керування (для порівняння)

`manage.py` лежить **не** в `root/`, а на рівень вище, поруч із папкою проєкту. Це твій «пульт»: саме через нього ти запускаєш усі команди (`runserver`, `startapp`, `makemigrations`, `migrate`). Він читає `root/settings.py` і виконує потрібну дію. Тобто зв'язок такий: ти → `manage.py` → `settings.py`.

## Як файли пов'язані між собою

```
запит → wsgi.py (на проді) → settings.py (конфіг) → root/urls.py (роутер)
                                                          │
                                          include() → app/urls.py → view
```

Усе тримається на `settings.py`: він каже, де роутер (`ROOT_URLCONF`), які apps увімкнені (`INSTALLED_APPS`), де шаблони, база, статика і мова.

## Підсумок

- `__init__.py` — робить `root/` пакетом (порожній, не чіпаємо).
- `settings.py` — серце проєкту. Ключові блоки: `BASE_DIR`, `SECRET_KEY`/`DEBUG`/`ALLOWED_HOSTS` (безпека), `INSTALLED_APPS`, `MIDDLEWARE`, `ROOT_URLCONF`, `TEMPLATES`, `DATABASES`, `AUTH_PASSWORD_VALIDATORS`, мова/час, `STATIC_*`/`MEDIA_*`, `DEFAULT_AUTO_FIELD`.
- `urls.py` — головний роутер; делегує маршрути модулям через `include()`.
- `wsgi.py` / `asgi.py` — точки входу для бойового сервера; у розробці не чіпаєш.
- `manage.py` (рівнем вище) — пульт для команд; читає `settings.py`.

> <i class="bi bi-book"></i> Повний довідник усіх параметрів `settings.py` — у розділі «Settings» офіційної документації (docs.djangoproject.com).
