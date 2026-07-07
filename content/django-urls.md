# URL-маршрути: path, include, name

Маршрути — це таблиця відповідності «адреса в браузері → яка view її обробляє». У Django вони побудовані **дворівнево**: головний роутер проєкту делегує модулям. Механіку показуємо на структурі shop-app, а самі маршрути й адреси — з різних доменів (блог, магазин, бібліотека, користувачі), щоб ти бачила, що це універсальний інструмент.

## Дворівнева схема

> **URLconf** — конфігурація маршрутів: список `urlpatterns`, де кожен запис прив'язує шаблон URL до view або до іншого URLconf.

**Як це працює.** Загальний рух запиту виглядає так:

```
браузер: /blog/my-first-post/  →  root/urls.py (головний)
                                   │  path('blog/', include('blog.urls'))
                                   ▼
                                blog/urls.py (модуля)
                                   │  path('<slug:post_slug>/', ...)
                                   ▼
                                view
```

**Рівень 1 — головний роутер** (`root/urls.py`) не описує всі сторінки сам, а розкидає префікси по модулях:

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('home.urls')),          # корінь → модуль home
    path('blog/', include('blog.urls')),     # усе з blog/ → blog
    path('shop/', include('shop.urls')),     # усе з shop/ → shop
    path('library/', include('library.urls')),
    path('accounts/', include('accounts.urls')),
]
```

**Рівень 2 — роутер модуля** описує конкретні сторінки в межах свого префікса. Приклад для блогу:

```python
# blog/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.post_list, name='post_list'),              # /blog/
    path('<slug:post_slug>/', views.post_detail, name='post_detail'),  # /blog/my-post/
]
```

**Навіщо два рівні.**

> 🧠 Це і є модульність. Головний роутер каже лише «усе, що з `blog/` — питай у blog». А вже `blog/urls.py` сам розрулює свої сторінки. Додаєш новий модуль → дописуєш один рядок `include()` у головному, і не засмічуєш його десятками маршрутів.

## Анатомія path()

```python
path('books/<int:book_id>/', views.book_detail, name='book_detail')
#     │                       │                  │
#     │                       │                  └── ім'я маршруту (для reverse / {% url %})
#     │                       └── яку view викликати
#     └── шаблон URL (що після префікса модуля)
```

Три частини: **рядок-адреса**, **view**, і необов'язкове (але бажане) **ім'я**.

## include() — делегування

**Як це працює.**

```python
path('library/', include('library.urls'))
```

Це означає: «усе, що починається з `library/`, віддай у `library/urls.py`». Django «відрізає» префікс `library/` і передає **залишок** модулю.

> ⚠️ Тому всередині `library/urls.py` шляхи пишуться **без** `library/` — префікс уже враховано на рівні вище. Адреса `/library/books/5/` збирається так: `library/` (у root) + `books/<int:book_id>/` (у модулі).

## Динамічні частини: конвертери

**Як це працює.** Коли в адресі є змінна частина (id товару, slug статті, ім'я користувача), використовують **конвертери** в кутових дужках `<тип:ім'я>`:

```python
path('product/<int:id>/', views.product_detail)
#             └─ конвертер ─┘
```

Django перевіряє, що значення підходить під тип, і передає його у view як **іменований аргумент**.

| Конвертер | Приймає | Приклад адреси | Приклад маршруту |
|---|---|---|---|
| `<int:...>` | ціле невід'ємне число | `/shop/product/42/` | `path('product/<int:id>/', ...)` |
| `<slug:...>` | slug: літери, цифри, дефіс, підкреслення | `/blog/my-first-post/` | `path('<slug:post_slug>/', ...)` |
| `<str:...>` | будь-який рядок без `/` | `/users/olena/` | `path('users/<str:username>/', ...)` |
| `<uuid:...>` | UUID | `/orders/1a2b3c.../` | `path('orders/<uuid:order_id>/', ...)` |
| `<path:...>` | рядок, що **може містити** `/` | `/files/docs/2025/report.pdf` | `path('files/<path:filepath>/', ...)` |

Значення з `<...>` приходить у view під тим самим іменем:

```python
# library/views.py
def book_detail(request, book_id):     # ← book_id з <int:book_id>
    ...
```

> ⚠️ Ім'я в маршруті й аргумент view мусять **збігатися**: `<int:book_id>` ↔ `def book_detail(request, book_id)`.

> 💡 Це аналог Flask `<int:id>` у `@app.route('/product/<int:id>')`. Ідея та сама, синтаксис трохи інший.

## re_path() — маршрути через регулярні вирази

`path()` покриває майже все. Але коли потрібен **складніший** шаблон, ніж дозволяють конвертери, є `re_path()` — той самий маршрут, але шлях описано **регулярним виразом**:

```python
from django.urls import re_path

urlpatterns = [
    # архів блогу за роком: /blog/archive/2025/
    re_path(r'^archive/(?P<year>[0-9]{4})/$', views.year_archive, name='year_archive'),
]
```

Розбір шаблону:
- `^` — початок, `$` — кінець (щоб збіг був точний);
- `(?P<year>...)` — **іменована група**: те, що в дужках, прийде у view як аргумент `year`;
- `[0-9]{4}` — рівно чотири цифри.

> 🧠 Правило вибору просте: бери `path()` майже завжди — він читабельніший. `re_path()` діставай лише тоді, коли конвертерів не вистачає (напр. потрібен строго 4-значний рік або власний формат). Обидва можна змішувати в одному `urlpatterns`.

## name= і навіщо воно

**Проблема, яку це розв'язує.** Кожному маршруту варто дати `name=` — ім'я, щоб посилатися на нього **не хардкодячи URL**:

```python
path('about/', views.about, name='about')
```

Тоді в шаблоні замість жорсткого `/about/` пишеш:
```html
<a href="{% url 'about' %}">Про нас</a>
```

А для маршрутів із параметром передаєш його прямо в тег:
```html
<a href="{% url 'book_detail' book.id %}">{{ book.title }}</a>
<a href="{% url 'post_detail' post.slug %}">{{ post.title }}</a>
```

У Python-коді те саме робить `reverse('book_detail', args=[book.id])` — напр. усередині `redirect(...)`.

Перевага та сама, що з `url_for` у Flask: зміниш адресу в `urls.py` — усі посилання оновляться самі.

## app_name і namespacing (коротко)

Коли проєкт великий, у різних модулях легко з'являються **однакові** імена маршрутів: і в блозі, і в магазині є `detail`. Щоб не було конфлікту, модулю дають **простір імен** через `app_name`:

```python
# shop/urls.py
app_name = 'shop'

urlpatterns = [
    path('product/<int:id>/', views.product_detail, name='detail'),
]
```

Тепер на маршрут посилаються **з префіксом модуля** — `shop:detail`:

```html
<a href="{% url 'shop:detail' product.id %}">{{ product.name }}</a>
```

Так `shop:detail` і `blog:detail` більше не сплутати.

> 📖 Це лише вступ — деталі namespacing (вкладені простори, `namespace=` в `include`) дивись у розділі «URL namespaces» документації Django.

## Типові помилки / Нюанси (конвенції)

Кілька моментів, які роблять маршрути читабельними й «канонічними»:

1. **Слеш у кінці.** Django за конвенцією любить **кінцевий слеш**: `path('about/', ...)`, а не `path('about', ...)`. Головний роутер теж зі слешами. Без нього можливі дрібні незручності з редіректами. Тримайся однакового стилю в усьому проєкті.

2. **`from . import views`, а не `from .views import *`.** «Зірочка» імпортує все підряд — легко випадково перекрити імена. Канонічніше:
   ```python
   from django.urls import path
   from . import views

   urlpatterns = [
       path('', views.index, name='index'),
       path('about/', views.about, name='about'),
   ]
   ```
   Так одразу видно, звідки `index` — це `views.index`.

3. **Порядок маршрутів має значення.** Django перебирає `urlpatterns` **згори вниз** і бере **перший** збіг. Тому конкретніші маршрути став вище за загальніші:
   ```python
   path('posts/new/', views.post_create),           # спершу конкретний
   path('posts/<slug:post_slug>/', views.post_detail)  # потім загальний
   ```
   Інакше `new` сприйметься як slug і потрапить не в ту view.

> 📌 Пункти 1–2 — не помилки (код працює), а саме **конвенції**, які роблять проєкт читабельнішим. Пункт 3 — уже реальна причина багів.

## Підсумок

- Маршрути **дворівневі**: `root/urls.py` через `include()` делегує модулям, `app/urls.py` описує конкретні сторінки; всередині модуля шлях пишеться без префікса, який уже зрізав `include()`.
- `path(шлях, view, name=...)` — три частини; `re_path()` — те саме через регулярний вираз, коли конвертерів мало.
- Конвертери: `<int:>`, `<slug:>`, `<str:>`, `<uuid:>`, `<path:>` — значення йде у view як іменований аргумент (імена мусять збігатися).
- `name=` дозволяє посилатися на маршрут через `{% url %}` / `reverse` без хардкоду адреси (як `url_for` у Flask); `app_name` + `namespace` рятують від конфлікту однакових імен.
- Конвенції: кінцевий `/`, `from . import views` замість `import *`, конкретні маршрути вище за загальні.

> 📖 Повний опис диспетчера URL, конвертерів і namespacing — у розділі «URL dispatcher» документації Django (docs.djangoproject.com).
