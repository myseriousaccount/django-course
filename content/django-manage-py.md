# Команди manage.py

`manage.py` — скрипт у корені проєкту, через який виконуються всі адміністративні команди Django. Він відрізняється від утиліти `django-admin` одним: знає, де лежать налаштування саме цього проєкту.

## Як він працює

```python
# manage.py
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
```

Цей рядок задає модуль налаштувань, тому будь-яка команда, запущена через `manage.py`, бачить твою базу, список застосунків і шаблони. Утиліта `django-admin` цього контексту не має, тому її використовують лише для `startproject`, коли налаштувань ще не існує.

```bash
python manage.py <команда> [аргументи]
python manage.py help                  # усі доступні команди
python manage.py help migrate          # прапорці конкретної команди
```

Список команд не фіксований: кожен застосунок в `INSTALLED_APPS` може додавати власні. Тому `help` показує і команди Django, і команди сторонніх пакетів, і твої власні, якщо створиш папку `app/management/commands/`.

## Щоденні команди

| Команда | Що робить |
|---|---|
| `runserver` | сервер розробки на `127.0.0.1:8000` |
| `startapp <ім'я>` | створює каркас застосунку |
| `makemigrations` | створює файли міграцій зі змін у моделях |
| `migrate` | застосовує міграції до бази |
| `createsuperuser` | створює користувача з доступом до `/admin` |
| `shell` | інтерактивний Python із налаштованим доступом до моделей |
| `test` | запускає тести |
| `check` | перевіряє проєкт на типові проблеми без запуску сервера |

## Команди, потрібні рідше

| Команда | Що робить |
|---|---|
| `showmigrations` | перелік міграцій із позначкою, які застосовані |
| `sqlmigrate <app> <номер>` | показує SQL міграції, не виконуючи його |
| `dbshell` | відкриває консоль самої бази |
| `dumpdata` / `loaddata` | експорт і імпорт даних (фікстури) |
| `changepassword <user>` | зміна пароля користувача |
| `collectstatic` | збирає статику в одну папку для продакшну |
| `flush` | видаляє всі дані, лишаючи структуру таблиць |
| `makemessages` / `compilemessages` | робота з перекладами |

## makemigrations і migrate

Зміна схеми бази виконується у два кроки, і це поділ ролей, а не формальність:

```bash
python manage.py makemigrations    # 1. описати зміну у файлі міграції
python manage.py migrate           # 2. виконати її в базі
```

`makemigrations` порівнює поточні моделі з попередніми міграціями й створює файл, наприклад `blog/migrations/0002_post_slug.py`. База при цьому не змінюється. `migrate` бере всі незастосовані файли й виконує їх.

Розділення потрібне тому, що файл міграції потрапляє в git: на іншій машині й на сервері схема оновлюється тією самою послідовністю кроків, а не повторним «вгадуванням» змін. Перед виконанням можна подивитися, що саме станеться:

```bash
python manage.py showmigrations blog
python manage.py sqlmigrate blog 0002
```

> <i class="bi bi-exclamation-triangle"></i> Міграції — частина коду, а не тимчасові файли. Їх комітять разом із моделями; видалення чи ручне редагування вже застосованих міграцій ламає історію схеми в інших копіях проєкту.

## shell

```bash
python manage.py shell
```

```python
>>> from blog.models import Post
>>> Post.objects.count()
42
>>> Post.objects.create(title='Перший пост', body='Текст')
```

Звичайний `python` тут не підійде: без `DJANGO_SETTINGS_MODULE` імпорт моделей завершиться помилкою `ImproperlyConfigured`. Оболонка зручна, щоб перевірити запит або подивитися, що реально лежить у базі, не пишучи view.

## createsuperuser

```bash
python manage.py createsuperuser
```

Команда запитає логін, email і пароль та створить користувача з прапорцями `is_staff` і `is_superuser`. Після цього `/admin` пускає в панель керування даними. Пароль зберігається хешем, тож відновити його неможливо — забутий пароль змінюють командою `changepassword`.

## Власні команди

Будь-яку рутину можна оформити як команду `manage.py` — це штатний спосіб писати скрипти обслуговування, які мають доступ до моделей:

```python
# blog/management/commands/clear_drafts.py
from django.core.management.base import BaseCommand
from blog.models import Post


class Command(BaseCommand):
    help = 'Видаляє чернетки, старші за 30 днів'

    def handle(self, *args, **options):
        deleted, _ = Post.objects.filter(is_draft=True).delete()
        self.stdout.write(self.style.SUCCESS(f'Видалено: {deleted}'))
```

```bash
python manage.py clear_drafts
```

Потрібні порожні `__init__.py` у папках `management/` і `management/commands/`. Такі команди зручно ставити в планувальник (cron), на відміну від коду, який виконується лише при заході користувача на сторінку.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `No changes detected` після зміни моделі | Застосунку немає в `INSTALLED_APPS` або файл не збережено — Django не бачить модель |
| Виконано `makemigrations` без `migrate` | Файл міграції є, база стара; на сторінках з'являється `no such column` |
| `python manage.py` без активованого середовища | Команда не знайдеться або запуститься іншим інтерпретатором без Django |
| `django-admin migrate` замість `manage.py migrate` | `ImproperlyConfigured: settings are not configured` — утиліта не знає, де налаштування |
| Ручне редагування застосованої міграції | Історія схеми розходиться між копіями проєкту. Зміну оформлюють новою міграцією |
| `python` замість `manage.py shell` | Імпорт моделей падає з `ImproperlyConfigured` |

## Підсумок

- `manage.py` виконує команди в контексті проєкту завдяки `DJANGO_SETTINGS_MODULE`; `django-admin` потрібен лише для `startproject`.
- `help` показує повний список команд, `help <команда>` — її прапорці; набір команд залежить від встановлених застосунків.
- Щоденні: `runserver`, `startapp`, `makemigrations`, `migrate`, `createsuperuser`, `shell`, `test`, `check`.
- `makemigrations` описує зміну у файлі, `migrate` виконує її в базі; файли міграцій комітять, бо саме вони відтворюють схему в інших копіях проєкту.
- `showmigrations` і `sqlmigrate` показують стан та SQL до виконання.
- Рутинні скрипти оформлюють як власні команди в `app/management/commands/` — вони мають доступ до моделей і запускаються з планувальника.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/django-admin/" target="_blank" rel="noopener">django-admin and manage.py <i class="bi bi-box-arrow-up-right"></i></a></div></div>
