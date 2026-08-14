# Файли застосунку

`startapp` створює фіксований набір файлів, і кожен має чітку роль. Урок розбирає, що в них кладуть, які файли додають вручну і які редагувати не можна.

## Що створюється й що додають самостійно

```
blog/
├── __init__.py     # робить папку пакетом
├── apps.py         # конфігурація застосунку
├── models.py       # опис даних і таблиць
├── views.py        # обробники запитів
├── admin.py        # реєстрація моделей в адмін-панелі
├── tests.py        # тести
├── migrations/     # згенерована історія змін схеми
│   └── __init__.py
├── urls.py         # ← додаєш сама: маршрути застосунку
├── forms.py        # ← додаєш сама: форми
├── templates/blog/ # ← додаєш сама: шаблони
└── static/blog/    # ← додаєш сама: CSS, JS, зображення
```

| Файл | За що відповідає | Чи редагуєш |
|---|---|---|
| `models.py` | структура даних, таблиці бази | постійно |
| `views.py` | обробка запитів | постійно |
| `urls.py` | маршрути застосунку | постійно, створюєш сама |
| `forms.py` | форми й правила валідації | часто, створюєш сама |
| `admin.py` | вигляд моделей в адмін-панелі | часто |
| `apps.py` | конфігурація застосунку | рідко |
| `migrations/` | історія змін схеми | не редагуєш, але комітиш |
| `tests.py` | тести | за потреби |
| `__init__.py` | робить папку пакетом | ні |

## models.py

Класи описують таблиці: клас — таблиця, атрибут — стовпець.

```python
# blog/models.py
from django.db import models


class Post(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    body = models.TextField()
    published_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
```

Після кожної зміни цього файлу потрібні `makemigrations` (описати зміну) і `migrate` (застосувати до бази). Детально — в уроці «Створення моделі».

## views.py

Обробник приймає `request` і повертає відповідь.

```python
# blog/views.py
from django.shortcuts import get_object_or_404, render

from .models import Post


def post_list(request):
    posts = Post.objects.filter(is_published=True)
    return render(request, 'blog/post_list.html', {'posts': posts})


def post_detail(request, slug):
    post = get_object_or_404(Post, slug=slug)
    return render(request, 'blog/post_detail.html', {'post': post})
```

## urls.py

Файл створюють вручну й підключають у головній таблиці маршрутів.

```python
# blog/urls.py
from django.urls import path

from . import views

app_name = 'blog'

urlpatterns = [
    path('', views.post_list, name='list'),
    path('<slug:slug>/', views.post_detail, name='detail'),
]
```

```python
# config/urls.py
from django.urls import include, path

urlpatterns = [
    path('blog/', include('blog.urls')),
]
```

`app_name` задає простір імен, тож посилання пишуться як `{% url 'blog:detail' post.slug %}` і не конфліктують з однойменними маршрутами інших застосунків.

## forms.py

Окремий файл для форм — конвенція, а не вимога фреймворку, але саме його очікують знайти в чужому проєкті.

```python
# blog/forms.py
from django import forms

from .models import Post


class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ['title', 'slug', 'body']
```

## admin.py

Модель з'являється в адмін-панелі лише після реєстрації.

```python
# blog/admin.py
from django.contrib import admin

from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('title', 'published_at')
    search_fields = ('title',)
```

Декоратор `@admin.register(Post)` і виклик `admin.site.register(Post, PostAdmin)` рівнозначні; перший компактніший і частіше зустрічається в сучасному коді.

## apps.py

Конфігурація застосунку. Найчастіше її не чіпають, але саме тут підключають сигнали — код, який має виконатися при старті:

```python
# blog/apps.py
from django.apps import AppConfig


class BlogConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'blog'

    def ready(self):
        from . import signals            # noqa: F401
```

Імпорт усередині `ready()`, а не на рівні модуля — вимога Django: на момент завантаження `apps.py` реєстр моделей ще не готовий.

## migrations/

Файли створює `makemigrations`, застосовує `migrate`. Вони пронумеровані й посилаються один на одного, утворюючи послідовність станів схеми.

```
blog/migrations/
├── 0001_initial.py
├── 0002_post_slug.py
└── __init__.py
```

> <i class="bi bi-exclamation-triangle"></i> Міграції комітять у git разом із моделями: саме вони відтворюють схему бази на іншій машині й на сервері. Видалення застосованої міграції або її ручне редагування ламає цю послідовність.

## tests.py

```python
# blog/tests.py
from django.test import TestCase

from .models import Post


class PostModelTests(TestCase):
    def test_str_returns_title(self):
        post = Post.objects.create(title='Заголовок', slug='zagolovok', body='…')
        self.assertEqual(str(post), 'Заголовок')
```

Коли тестів стає багато, файл замінюють пакетом `tests/` із кількома модулями. Запуск — `python manage.py test`.

## Інші файли, які з'являються з ростом застосунку

| Шлях | Для чого |
|---|---|
| `templatetags/` | власні теги й фільтри шаблонів |
| `signals.py` | обробники сигналів моделей (`post_save` тощо) |
| `managers.py` | власні менеджери й QuerySet-и |
| `services.py` | логіка, що працює з кількома моделями |
| `management/commands/` | власні команди `manage.py` |
| `context_processors.py` | змінні, доступні в усіх шаблонах |

Жодна з цих назв не є вимогою Django (крім `templatetags/` і `management/commands/`) — це усталені імена, за якими код швидко знаходять.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Чекати `urls.py` одразу після `startapp` | Файл не створюється: додай його вручну і підключи через `include()` |
| Шаблони в `blog/templates/post_list.html` без підпапки | При збігу імен Django може взяти шаблон іншого застосунку. Правильний шлях — `blog/templates/blog/post_list.html` |
| Уся логіка у `views.py` | Файл розростається до сотень рядків; обчислення й правила виносять у методи моделі, менеджери або `services.py` |
| Ручне редагування файлів у `migrations/` | Історія схеми розходиться між копіями проєкту; зміну оформлюють новою міграцією |
| Імпорт сигналів на рівні модуля `apps.py` | Помилка `AppRegistryNotReady` при старті: імпорт має бути всередині `ready()` |
| `migrations/` у `.gitignore` | На іншій машині схему бази неможливо відтворити; ці файли версіонують |

## Підсумок

- `startapp` створює `models.py`, `views.py`, `admin.py`, `apps.py`, `tests.py` і `migrations/`; `urls.py`, `forms.py`, `templates/`, `static/` додають вручну.
- Основна робота йде в `models.py`, `views.py`, `urls.py` і `forms.py`; `admin.py` вмикає модель в адмін-панель.
- `app_name` в `urls.py` дає простір імен і рятує від конфліктів однакових імен маршрутів.
- `apps.py` потрібен, коли треба виконати код при старті — наприклад, підключити сигнали в `ready()`.
- Файли міграцій генеруються автоматично, не редагуються руками й обов'язково версіонуються.
- З ростом застосунку з'являються `templatetags/`, `signals.py`, `managers.py`, `services.py`, `management/commands/` — усталені імена, за якими код легко знайти.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/applications/" target="_blank" rel="noopener">Applications <i class="bi bi-box-arrow-up-right"></i></a></div></div>
