# Анатомія app: які файли і навіщо

Коли ти робиш `startapp`, Django створює папку з готовим набором файлів. Цей урок розбирає **кожен** із них — за що відповідає, коли ти його редагуєш і що в нього кладеш. Структуру беремо як у shop-app, а приклади моделей/логіки навмисно з різних доменів (блог, бібліотека, магазин, користувачі), щоб набір файлів читався як універсальний.

## Карта файлів модуля

```
blog/
├── __init__.py     ← робить папку пакетом (порожній)
├── apps.py         ← конфіг самого app
├── models.py       ← опис даних і таблиць БД
├── views.py        ← логіка: обробка запитів
├── admin.py        ← реєстрація моделей в адмінці
├── tests.py        ← тести
├── migrations/     ← історія змін схеми БД
│   └── __init__.py
└── urls.py         ← маршрути модуля (ДОДАЄШ САМА)
```

Далі — кожен файл окремо, у порядку від найважливіших до тих, що чіпаєш рідко.

## __init__.py — робить папку пакетом

Порожній файл. Його роль — зробити папку app **Python-пакетом**, щоб працювали імпорти `from blog import views`, `from .models import Post`. Не редагуєш.

## models.py — дані

> **models.py** — тут описуєш, які дані зберігає модуль, у вигляді Python-класів. Кожен клас = таблиця в БД, кожен атрибут = колонка. Це шар **M** у MTV.

Той самий механізм, різні домени:

```python
# blog/models.py
from django.db import models

class Post(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)          # для гарних URL
    body = models.TextField()
    published = models.DateTimeField(auto_now_add=True)
```

```python
# library/models.py — інша тема, той самий підхід
from django.db import models

class Book(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=120)
    year = models.PositiveIntegerField()
    available = models.BooleanField(default=True)
```

> <i class="bi bi-info-circle"></i> Це Django ORM — аналог SQLAlchemy-моделей з Flask. Тільки тут ORM вбудований, окрему бібліотеку ставити не треба. У свіжому app `models.py` спершу порожній (`# Create your models here.`) — його наповнюють пізніше.

Після будь-яких змін у `models.py` запускаєш `makemigrations` (створити «інструкцію») + `migrate` (застосувати до БД). Детально — в уроці про моделі.

## views.py — логіка

> **views.py** — тут «обробники»: функція приймає запит (`request`) і повертає відповідь. Це шар **V** у MTV.

```python
# library/views.py
from django.shortcuts import render, get_object_or_404
from .models import Book

def book_list(request):
    books = Book.objects.all()
    return render(request, 'library/book_list.html', {'books': books})

def book_detail(request, book_id):
    book = get_object_or_404(Book, pk=book_id)
    return render(request, 'library/book_detail.html', {'book': book})
```

Кожна view відповідає за одну дію/сторінку. Детально — в окремому уроці «Views».

## urls.py — маршрути модуля

> **urls.py** — цей файл **ти створюєш сама** (`startapp` його не робить). Він каже, який URL веде до якої view в межах модуля.

```python
# blog/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.post_list, name='post_list'),
    path('<slug:post_slug>/', views.post_detail, name='post_detail'),
]
```

> <i class="bi bi-lightbulb"></i> Логіка зв'язку: головний `root/urls.py` через `include('blog.urls')` передає сюди керування, а вже цей файл вирішує, яку саме view викликати. Детально — в уроці «URL-маршрути».

## admin.py — підключення до адмінки

> **admin.py** — Django має готову адмін-панель, але щоб вона показувала твою модель — її треба **зареєструвати** тут.

```python
# library/admin.py
from django.contrib import admin
from .models import Book

admin.site.register(Book)
```

**Навіщо.** Після цього на `/admin` з'явиться розділ для керування книгами — без жодного HTML. Можна додавати, редагувати, шукати, видаляти записи. Це одна з найсильніших «батарейок» Django. За бажанням тут же налаштовують, які колонки показувати й за чим фільтрувати (`ModelAdmin`).

## apps.py — конфіг модуля

Невеликий клас із налаштуваннями самого app. Django генерує його автоматично, зазвичай не чіпаєш:

```python
# blog/apps.py
from django.apps import AppConfig

class BlogConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'blog'
```

**Навіщо взагалі існує.** Це «паспорт» модуля: його ім'я і базові налаштування. Іноді сюди дописують метод `ready()` — код, що має виконатися при старті app (напр. підключення сигналів). Але на старті просто залишаєш як є.

## migrations/ — історія змін БД

> **migrations/** — папка, куди `makemigrations` складає файли-«інструкції» зміни схеми БД. Кожен файл описує, що додати/змінити в таблицях (нова модель, нове поле тощо).

**Як це працює.** Ти міняєш `models.py` → `makemigrations` створює тут пронумерований файл (`0001_initial.py`, `0002_...`) → `migrate` застосовує його до бази. Так база завжди відповідає моделям, а історія змін зберігається.

> <i class="bi bi-exclamation-triangle"></i> Ці файли **не редагують руками** — вони генеруються. Але їх **комітять у git**, щоб уся команда мала однакову структуру БД.

## tests.py — тести

Місце для автотестів модуля (перевірити, що view повертає 200, що модель рахує правильно тощо). Запускаються через `python manage.py test`. На старті порожній — заповнюєш за потреби.

## Хто що робить — підсумкова таблиця

| Файл | Відповідає за | Чи редагуєш |
|---|---|---|
| `models.py` | дані / таблиці БД | так |
| `views.py` | логіку обробки запитів | так |
| `urls.py` | маршрути модуля | так (сама створюєш) |
| `admin.py` | показ моделей в адмінці | часто |
| `apps.py` | конфіг app | рідко |
| `migrations/` | історію змін схеми | ні (генерується, комітиться) |
| `tests.py` | тести | за бажанням |
| `__init__.py` | робить пакетом | ні (порожній) |

## Підсумок

- App складається з фіксованого набору файлів, кожен — зі своєю роллю; набір однаковий для будь-якої теми (блог, бібліотека, магазин).
- Найчастіше працюєш з `models.py` (дані), `views.py` (логіка), `urls.py` (маршрути — створюєш сама).
- `admin.py` підключає модель до готової адмінки; `migrations/` — авто-історія змін БД (руками не чіпаєш, але комітиш).
- `apps.py` — «паспорт» app; `tests.py`, `__init__.py` — зазвичай залишаєш як є.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">ÐÑÑÑÑÐ¹Ð½Ð° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°ÑÑÑ</span><a href="https://docs.djangoproject.com/en/stable/ref/applications/" target="_blank" rel="noopener">Applications <i class="bi bi-box-arrow-up-right"></i></a></div></div>
