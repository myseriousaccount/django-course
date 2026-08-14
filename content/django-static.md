# Статичні файли

Статика — файли, що не залежать від запиту: CSS, JavaScript, зображення, шрифти. Урок про те, де вони лежать, як потрапляють у розмітку і чому в розробці та на бойовому сервері їх роздають різні програми.

## Три `STATIC_*` параметри + MEDIA

За статику відповідає кілька налаштувань у `settings.py`. Їх часто плутають — розберемо кожне:

```python
# config/settings.py
STATIC_URL = 'static/'                      # URL-префікс, за яким доступна статика
STATICFILES_DIRS = [BASE_DIR / 'static']    # де лежать ТВОЇ статичні файли (dev)
STATIC_ROOT = BASE_DIR / 'staticfiles'      # куди collectstatic збирає все (prod)
```

| Параметр | Що означає | Коли працює |
|---|---|---|
| `STATIC_URL` | **адреса** в браузері: файл доступний як `/static/...` | завжди |
| `STATICFILES_DIRS` | **папки на диску**, де Django шукає *твою* статику | dev (і як джерело для `collectstatic`) |
| `STATIC_ROOT` | одна папка, куди `collectstatic` *збирає* все для проду | prod |

> <i class="bi bi-exclamation-triangle"></i> Головна пастка: **шлях на диску ≠ URL**. Файл лежить у `static/css/blog.css`, а в браузері він доступний за `/static/css/blog.css`. Тому ніколи не пиши URL руками — будуй його через тег `{% static %}` (нижче).

> <i class="bi bi-pin-angle"></i> Не плутай `STATICFILES_DIRS` і `STATIC_ROOT`. Перше — це **джерела** (де ти пишеш файли, може бути кілька папок). Друге — це **пункт збору** для проду (одна папка, куди все стікається; її ти не редагуєш руками і зазвичай додаєш у `.gitignore`).

## Структура папки static

Типова організація — розкладка за типом файлу:

```
static/
├── css/
│   ├── blog.css
│   └── shop.css
├── js/
│   ├── cart.js
│   └── search.js
└── img/
    ├── logo.png
    └── book-placeholder.svg
```

`STATICFILES_DIRS = [BASE_DIR / 'static']` каже Django: «моя статика — у цій папці». Можна перелічити кілька папок — Django шукатиме по черзі.

## Як підключити статику в шаблоні

Потрібні два кроки. Спершу — завантажити теги статики вгорі шаблону (зазвичай це вже є у спільному `_layouts/base.html`):

```html
{# templates/_layouts/base.html #}
{% load static %}
```

Далі посилання будують тегом `{% static %}`, а не рядком:

```html
{# templates/blog/post_list.html #}
<link rel="stylesheet" href="{% static 'css/blog.css' %}">
<script src="{% static 'js/cart.js' %}"></script>
<img src="{% static 'img/book-placeholder.svg' %}" alt="Без обкладинки">
```

`{% static 'css/blog.css' %}` згенерує правильний `/static/css/blog.css`, враховуючи `STATIC_URL`. Зміниш `STATIC_URL` чи додаси CDN — усі посилання оновляться самі.

## `collectstatic` і чому dev/prod різні

Це ключовий архітектурний момент.

**У розробці (`DEBUG = True`):** Django сам роздає статику через `runserver` — нічого додатково робити не треба. Зручно, але повільно й непридатно для навантаження.

**На проді (`DEBUG = False`):** Django **навмисно перестає** роздавати статику сам (це не його робота — для швидкості це має робити вебсервер: Nginx, WhiteNoise тощо). Перед деплоєм запускаєш:

```bash
python manage.py collectstatic
```

Ця команда **збирає** в одну папку `STATIC_ROOT`:
- твою статику з `STATICFILES_DIRS` (`blog.css`, `cart.js`…);
- статику вбудованих apps — наприклад, стилі та скрипти адмінки.

Звідти все віддає вебсервер одним махом.

Причина розділення в тому, що віддавати файли з диска ефективно вміє вебсервер, а не Python-процес: він робить це швидше, кешує й не займає робочі потоки застосунку.

## MEDIA: файли, які завантажують користувачі

Статика — це файли **розробника** (CSS, JS, логотип). Але є ще файли, які завантажують **користувачі**: аватар автора блогу, фото товару в магазині, скан обкладинки книги. Для них — окремий механізм: **MEDIA**.

```python
# config/settings.py
MEDIA_URL = 'media/'                 # URL-префікс: /media/...
MEDIA_ROOT = BASE_DIR / 'media'      # папка на диску, куди зберігаються завантаження
```

Чому окремо від статики:

| | STATIC | MEDIA |
|---|---|---|
| Хто створює файли | розробник | користувач (через форму/`ImageField`) |
| У git? | так (сирці) | ні (це чужі дані) |
| Приклад | `blog.css`, `logo.png` | `covers/dune.jpg`, `avatars/olena.png` |

У моделі поле `ImageField`/`FileField` кладе файл у `MEDIA_ROOT`:

```python
# library/models.py
class Book(models.Model):
    title = models.CharField(max_length=200)
    cover = models.ImageField(upload_to='covers/')   # → media/covers/...
```

А в шаблоні до нього звертаються **не** через `{% static %}`, а через саме поле:

```html
{# templates/library/book_detail.html #}
<img src="{{ book.cover.url }}" alt="{{ book.title }}">   {# /media/covers/dune.jpg #}
```

У режимі розробки роздачу медіафайлів вмикають у головних маршрутах:

```python
# config/urls.py
from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

На бойовому сервері медіа, як і статику, роздає вебсервер.

## Звідки береться сам механізм

Тег `{% static %}` і команда `collectstatic` — це вбудований застосунок `django.contrib.staticfiles` зі списку `INSTALLED_APPS`. Прибрати його зі списку означає втратити і тег, і команду.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Немає `{% load static %}` у шаблоні | `Invalid block tag 'static'`; тег завантажують у кожному файлі, де він потрібен |
| Шлях написаний рядком: `href="/static/css/blog.css"` | Ламається після зміни `STATIC_URL` або переходу на CDN; шлях будує `{% static %}` |
| `DEBUG = False` без `collectstatic` | Сторінка відкривається без стилів: у цьому режимі Django статику не роздає |
| Плутати `STATICFILES_DIRS` і `STATIC_ROOT` | Перше — джерела, друге — папка збору для сервера. Якщо вказати те саме значення, `collectstatic` спробує копіювати папку саму в себе |
| `{% static %}` для завантаженого користувачем файлу | Посилання веде в нікуди: медіа доступні через `{{ obj.field.url }}` |
| `STATIC_ROOT` у git | У репозиторій потрапляють згенеровані копії файлів; цю папку додають у `.gitignore` |
| Медіа в тій самій папці, що й статика | Файли користувачів затираються при деплої й потрапляють у git |

## Підсумок

- Статика — незмінні файли розробника: CSS, JS, картинки, шрифти.
- `STATIC_URL` — **адреса** (`/static/...`), `STATICFILES_DIRS` — **папки-джерела на диску**, `STATIC_ROOT` — куди `collectstatic` збирає все для проду. Це три різні речі.
- У шаблоні: `{% load static %}` і `{% static 'css/blog.css' %}` — шлях будує фреймворк, у розмітці його не хардкодять.
- **dev:** Django роздає сам (`DEBUG=True`). **prod:** `DEBUG=False` → треба `collectstatic` + вебсервер.
- **MEDIA** (`MEDIA_URL`/`MEDIA_ROOT`) — окремо для файлів, що завантажують користувачі (аватар, фото товару, обкладинка книги); звертаються через `{{ obj.field.url }}`, не через `{% static %}`.
- `django.contrib.staticfiles` — вбудований app, що дає тег `{% static %}` і `collectstatic`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/howto/static-files/" target="_blank" rel="noopener">Managing static files <i class="bi bi-box-arrow-up-right"></i></a></div></div>
