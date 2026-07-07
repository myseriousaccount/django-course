# Settings: dev проти prod і секрети

`settings.py` — єдиний файл, що описує весь проєкт. Але одна й та сама конфігурація **не може** однаково підходити і для твого ноутбука, і для бойового сервера. Це архітектурна тема: як розділити «налаштування для розробки» і «налаштування для продакшну», і де зберігати секрети. Приклади доменів різні (блог, магазин, бібліотека) — щоб було видно: тема універсальна.

## Три параметри, що поводяться по-різному в dev і prod

Глянь на початок будь-якого свіжого `settings.py`:

```python
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

**Як це працює.** `DEBUG = True` показує детальну сторінку помилки з усім стеком, локальними змінними, шляхами файлів і фрагментами `settings.py`. У розробці це рятує — одразу видно, де впало.

> <i class="bi bi-exclamation-triangle"></i> На проді `DEBUG` **завжди `False`**. Інакше будь-яка помилка покаже відвідувачу твій код, шляхи файлів і навіть фрагменти налаштувань — це серйозна діра безпеки. Django у своєму чеклісті деплою наголошує на цьому першим пунктом. Наслідок `DEBUG=False`: тобі треба самостійно зробити шаблони `404.html` і `500.html`, бо гарних сторінок-трейсбеків уже не буде.

### ALLOWED_HOSTS

**Як це працює.** Коли `DEBUG = False`, Django вимагає список доменів, з яких дозволено приймати запити:

```python
# блог на своєму домені
ALLOWED_HOSTS = ['myblog.com', 'www.myblog.com']
```

**Навіщо.** Це захист від атак з підробленим заголовком `Host` (наприклад, отруєння кеша чи фішингові листи з підробленими посиланнями). У розробці порожній список працює (бо `DEBUG=True` неявно дозволяє `localhost` і `127.0.0.1`), на проді — заповнити обов'язково, інакше кожен запит дасть `400 Bad Request`.

### SECRET_KEY

**Визначення.** Цей ключ Django використовує для криптографії: підпис сесій, CSRF-токени, токени скидання пароля, підписані cookie. Якщо він витече — зловмисник зможе підробляти сесії й токени.

> <i class="bi bi-exclamation-octagon"></i> Префікс `django-insecure-` у стартовому ключі — це **навмисна підказка від Django**: «цей ключ згенеровано для розробки, він НЕ для продакшну». Перед деплоєм його треба замінити на справжній секретний і **прибрати з коду**.

Згенерувати справжній ключ можна так:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Головне правило: секрети — не в коді

**Навіщо.** `SECRET_KEY`, паролі від БД, API-ключі (наприклад, ключ платіжного шлюзу для магазину) **не можна** тримати прямо в `settings.py`, який лежить у git. Бо тоді кожен, хто бачить репозиторій, бачить і твої секрети.

> <i class="bi bi-lightbulb"></i> Аналогія: `settings.py` у git — це як повісити список на дошку оголошень. Пароль від квартири туди не пишуть. Його тримають окремо й приватно.

**Як це працює.** Рішення — **змінні оточення (environment variables)**. Секрет живе в середовищі сервера, а код лише *читає* його:

```python
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
# settings.py
import os
from pathlib import Path
from dotenv import load_dotenv      # pip install python-dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')     # прочитати .env у змінні оточення

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'
```

> <i class="bi bi-info-circle"></i> `.env` лежить локально й на сервері (з різними значеннями), але **ніколи** в git. У `.gitignore` додають рядок `.env`. Так секрети розробки й проду різні, а в коді — **однаковий** `settings.py`.

> <i class="bi bi-info-circle"></i> Паралель із Flask: там теж стандарт — `os.environ` + `python-dotenv`, часто через `app.config.from_prefixed_env()`. Ідея та сама у всіх фреймворках: **код читає секрети з оточення, а не містить їх**.

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

> <i class="bi bi-exclamation-triangle"></i> **`DEBUG=True` на проді** — найгірша й найпоширеніша помилка. Трейсбек з кодом і секретами стає видимим усім. Завжди `False` у бойовому оточенні.

> <i class="bi bi-exclamation-triangle"></i> **Порожній `ALLOWED_HOSTS` за `DEBUG=False`** → кожен запит `400 Bad Request (DisallowedHost)`. Заповни доменами.

> <i class="bi bi-exclamation-triangle"></i> **`SECRET_KEY` з префіксом `django-insecure-` на проді** — ключ не секретний, а «навчальний». Згенеруй справжній і поклади в env.

> <i class="bi bi-exclamation-triangle"></i> **`.env` потрапив у git** → секрети скомпрометовані. Додай `.env` у `.gitignore **до** першого коміту; якщо вже закомітила — ключ треба вважати «злитим» і перегенерувати.

## Підсумок

- `DEBUG`, `ALLOWED_HOSTS`, `SECRET_KEY` поводяться по-різному в dev і prod; на проді: `DEBUG=False`, заповнений `ALLOWED_HOSTS`, секретний ключ.
- `DEBUG=True` показує детальний трейсбек (зручно в dev, небезпечно на проді); `ALLOWED_HOSTS` захищає від підробленого `Host`; `SECRET_KEY` — основа всієї криптографії Django.
- Префікс `django-insecure-` — підказка, що ключ лише для розробки.
- **Секрети — не в коді/git.** Код *читає* їх з env-змінних (`os.environ`); env-змінні завжди рядки (`== 'True'`, `.split(',')`). Локально зручно через `.env` + `python-dotenv` (файл у `.gitignore`).
- Розділяти dev/prod можна через env-змінні (просто) або через папку `settings/` з `base/dev/prod` + `DJANGO_SETTINGS_MODULE` (для великих проєктів).

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/howto/deployment/checklist/" target="_blank" rel="noopener">Deployment checklist <i class="bi bi-box-arrow-up-right"></i></a></div></div>
