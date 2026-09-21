# Settings: dev проти prod і секрети

`settings.py` — єдиний файл, що описує весь проєкт. Але одна й та сама конфігурація **не може** однаково підходити і для твого ноутбука, і для бойового сервера. Це архітектурна тема: як розділити «налаштування для розробки» і «налаштування для продакшну», і де зберігати секрети. Приклади доменів різні (блог, магазин, бібліотека) — щоб було видно: тема універсальна.

## Три параметри, що поводяться по-різному в dev і prod

Глянь на початок будь-якого свіжого `settings.py`:

```python
# config/settings.py
SECRET_KEY = 'django-insecure-dmjwu01l=c@ewk...'
DEBUG = True
ALLOWED_HOSTS = []
```

| Параметр | Розробка (dev) | Продакшн (prod) |
|---|---|---|
| `DEBUG` | `True` | **`False`** |
| `ALLOWED_HOSTS` | `[]` (працює за `DEBUG=True`) | `['myblog.com', ...]` — обов'язково |
| `SECRET_KEY` | можна тестовий | **секретний, з env** |

### DEBUG

`DEBUG = True` показує детальну сторінку помилки з усім стеком, локальними змінними, шляхами файлів і фрагментами `settings.py`. У розробці це рятує — одразу видно, де впало.

> <i class="bi bi-exclamation-triangle"></i> На проді `DEBUG` **завжди `False`**. Інакше будь-яка помилка покаже відвідувачу твій код, шляхи файлів і навіть фрагменти налаштувань — це серйозна діра безпеки. Django у своєму чеклісті деплою наголошує на цьому першим пунктом. Наслідок `DEBUG=False`: тобі треба самостійно зробити шаблони `404.html` і `500.html`, бо гарних сторінок-трейсбеків уже не буде.

### Свої сторінки 404 і 500

Коли `DEBUG = False`, замість трейсбека Django шукає шаблони `404.html` і `500.html` **у корені** папки шаблонів — не всередині якогось застосунку:

```
templates/
├── base.html
├── 404.html          ← сторінка «не знайдено»
├── 500.html           ← сторінка «помилка сервера»
└── blog/
    └── post_list.html
```

Django знаходить їх за іменем автоматично — реєструвати чи підключати нічого не треба. Шаблон отримує мінімальний контекст, тому найпростіше зробити його самодостатнім, без `{% extends %}` на важкий `base.html`:

```html
{# templates/404.html #}
<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><title>Сторінку не знайдено</title></head>
<body>
    <h1>404 — такої сторінки немає</h1>
    <a href="/">На головну</a>
</body>
</html>
```

`500.html` пишуть так само — але без жодних звернень до бази чи `context`: якщо сама помилка сталася через проблему з базою, сторінка помилки не повинна залежати від того самого, що щойно впало.

> <i class="bi bi-info-circle"></i> Побачити свою `404.html`, не вимикаючи `DEBUG` на весь проєкт, можна двома шляхами: `handler404`/`handler500` у головному `urls.py` (Django викличе твій view напряму) або тимчасово `DEBUG = False` з непорожнім `ALLOWED_HOSTS` локально. Найпростіше для перевірки — відкрити неіснуючу адресу з `DEBUG = False`.

### ALLOWED_HOSTS

Коли `DEBUG = False`, Django вимагає список доменів, з яких дозволено приймати запити:

```python
# config/settings.py — блог на своєму домені
ALLOWED_HOSTS = ['myblog.com', 'www.myblog.com']
```

Це захист від атак з підробленим заголовком `Host` (наприклад, отруєння кеша чи фішингові листи з підробленими посиланнями). У розробці порожній список працює (бо `DEBUG=True` неявно дозволяє `localhost` і `127.0.0.1`), на проді — заповнити обов'язково, інакше кожен запит дасть `400 Bad Request`.

### SECRET_KEY

Цей ключ Django використовує для криптографії: підпис сесій, CSRF-токени, токени скидання пароля, підписані cookie. Якщо він витече — зловмисник зможе підробляти сесії й токени.

> <i class="bi bi-exclamation-octagon"></i> Префікс `django-insecure-` у стартовому ключі — це **навмисна підказка від Django**: «цей ключ згенеровано для розробки, він НЕ для продакшну». Перед деплоєм його треба замінити на справжній секретний і **прибрати з коду**.

Згенерувати справжній ключ можна так:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Головне правило: секрети — не в коді

`SECRET_KEY`, паролі від БД, API-ключі (наприклад, ключ платіжного шлюзу для магазину) **не можна** тримати прямо в `settings.py`, який лежить у git. Бо тоді кожен, хто бачить репозиторій, бачить і твої секрети.

Рішення — **змінні оточення (environment variables)**. Секрет живе в середовищі сервера, а код лише *читає* його:

```python
# config/settings.py
import os

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']              # обов'язковий — падає, якщо немає
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True' # за замовчуванням безпечний False
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',')
```

Тепер у коді **немає** самого секрета — лише вказівка «візьми його з оточення».

> <i class="bi bi-info-circle"></i> Зверни увагу на типи: env-змінні **завжди рядки**. Тому `DEBUG` не читають напряму, а порівнюють: `== 'True'`. І `ALLOWED_HOSTS` — рядок, який треба розбити через `.split(',')`.

> <i class="bi bi-pin-angle"></i> Конвенція: за замовчуванням для `DEBUG` став **`False`** (безпечне значення). Краще випадково зламати dev, ніж випадково відкрити прод.

## Зручний інструмент: .env + python-dotenv

Тримати env-змінні руками незручно, тому популярний підхід — файл `.env` (який **не** комітять у git):

```bash
# .env  (додай у .gitignore!)
DJANGO_SECRET_KEY=справжній-довгий-секрет
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

```python
# config/settings.py
import os
from pathlib import Path
from dotenv import load_dotenv      # pip install python-dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')     # прочитати .env у змінні оточення

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'
```

> <i class="bi bi-info-circle"></i> `.env` лежить локально й на сервері (з різними значеннями), але **ніколи** в git. У `.gitignore` додають рядок `.env`. Так секрети розробки й проду різні, а в коді — **однаковий** `settings.py`.

## Надсилання пошти: EMAIL_BACKEND

`send_mail()` (уроки «Форми», «Сигнали») сам нічого не надсилає — він передає лист **бекенду**, а який бекенд підключений, каже `EMAIL_BACKEND` у `settings.py`. Це ще один параметр, що обов'язково відрізняється між dev і prod:

```python
# config/settings.py — розробка: лист друкується в термінал, а не йде нікуди
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

```python
# config/settings.py — продакшн: реальна відправка через SMTP
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.sendgrid.net'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')      # секрет — з env, як SECRET_KEY вище
DEFAULT_FROM_EMAIL = 'noreply@myblog.com'
```

`console.EmailBackend` — типовий вибір для розробки: лист не йде нікуди, а виводиться прямо в термінал, де запущено `runserver`. Це дає перевірити повний цикл (форма → `send_mail()` → лист) без реального поштового сервера й без ризику розіслати тестові листи справжнім адресам.

```python
# pages/views.py
from django.core.mail import send_mail

send_mail(
    'Тема листа',
    'Текст листа',
    None,                          # None → бере DEFAULT_FROM_EMAIL із settings
    ['user@example.com'],
)
```

> <i class="bi bi-info-circle"></i> `send_mail()` вистачає для простого тексту. Коли потрібен HTML-лист, вкладення або кілька одержувачів із різними заголовками — беруть `EmailMessage`/`EmailMultiAlternatives` з того самого `django.core.mail`: `send_mail()` — зручна обгортка саме над ними.

## Як розділяють dev і prod налаштування

Коли відмінностей багато, `settings.py` ділять. Три поширені підходи:

1. **Один файл + env-змінні** (найпростіше) — усе в `settings.py`, а dev/prod керується значеннями env (`DEBUG`, `ALLOWED_HOSTS`, `SECRET_KEY`…). Для навчального проєкту цього достатньо.
2. **Папка `settings/`** з файлами `base.py`, `dev.py`, `prod.py` — спільне в `base`, відмінності в окремих файлах. Який завантажити — вказують через змінну `DJANGO_SETTINGS_MODULE`:
   ```python
   # settings/base.py — спільне для всіх
   # settings/dev.py
   from .base import *
   DEBUG = True
   ALLOWED_HOSTS = ['localhost']
   # settings/prod.py
   from .base import *
   DEBUG = False
   ALLOWED_HOSTS = ['mylibrary.com']
   ```
   ```bash
   export DJANGO_SETTINGS_MODULE=config.settings.prod
   ```
   Поширено у великих проєктах.
3. **Бібліотеки** (`django-environ`, `django-split-settings`) — допомагають із пунктами 1–2 (зручний парсинг типів, читання `DATABASE_URL` одним рядком тощо).

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `SECRET_KEY` у репозиторії | Ключ стає загальнодоступним, і сесії з токенами можна підробити; після витоку його змінюють |
| `DEBUG = True` на бойовому сервері | Сторінка помилки показує трасування, фрагменти коду й частину налаштувань будь-кому |
| `DEBUG = False` без `ALLOWED_HOSTS` | Кожен запит відхиляється з `DisallowedHost` |
| `.env` доданий у git | Сенс винесення секретів зникає; файл додають у `.gitignore`, а поруч тримають `.env.example` без значень |
| `os.environ['KEY']` без запасного значення в розробці | Проєкт не стартує на чужій машині; для локальних значень використовують `os.environ.get(..., default)` |
| Різні налаштування правлять умовами `if DEBUG:` по всьому файлу | Логіка розповзається; середовища розділяють окремими модулями налаштувань |
| `404.html`/`500.html` усередині папки застосунку | Django шукає їх у корені шаблонів; там, де лежить `base.html`, а не в `blog/templates/blog/` |
| `EMAIL_BACKEND` не заданий, а лист «не приходить» | У розробці типово стоїть `console.EmailBackend` — лист не губиться, а друкується в термінал |

## Підсумок

- `DEBUG`, `ALLOWED_HOSTS`, `SECRET_KEY` поводяться по-різному в dev і prod; на проді: `DEBUG=False`, заповнений `ALLOWED_HOSTS`, секретний ключ.
- `DEBUG=True` показує детальний трейсбек (зручно в dev, небезпечно на проді); `ALLOWED_HOSTS` захищає від підробленого `Host`; `SECRET_KEY` — основа всієї криптографії Django.
- Префікс `django-insecure-` — підказка, що ключ лише для розробки.
- `DEBUG=False` вимагає власні `404.html`/`500.html` у корені шаблонів — Django знаходить їх сам, за іменем.
- `EMAIL_BACKEND` теж різний у dev/prod: `console.EmailBackend` друкує лист у термінал, `smtp.EmailBackend` надсилає реально; `send_mail()` лише передає лист бекенду.
- **Секрети — не в коді/git.** Код *читає* їх з env-змінних (`os.environ`); env-змінні завжди рядки (`== 'True'`, `.split(',')`). Локально зручно через `.env` + `python-dotenv` (файл у `.gitignore`).
- Розділяти dev/prod можна через env-змінні (просто) або через папку `settings/` з `base/dev/prod` + `DJANGO_SETTINGS_MODULE` (для великих проєктів).

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/howto/deployment/checklist/" target="_blank" rel="noopener">Deployment checklist <i class="bi bi-box-arrow-up-right"></i></a></div></div>
