# Статика: структура та роздача

«Статика» (static files) — це файли, що не змінюються від запиту до запиту: **CSS, JavaScript, картинки, шрифти**. Архітектурне питання тут: де вони лежать і як Django віддає їх браузеру — причому в розробці й на проді це працює **по-різному**. Приклади навмисно з **різних доменів** (блог, магазин, бібліотека), щоб механізм не зливався з одним проєктом.

## Три `STATIC_*` параметри + MEDIA

За статику відповідає кілька налаштувань у `settings.py`. Їх часто плутають — розберемо кожне:

```python
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

**Як це працює.** Потрібні два кроки. По-перше, вгорі шаблону завантаж теги статики (це вже є у спільному `_layouts/base.html`):

```html
{% load static %}
```

По-друге, будуй посилання через тег `{% static %}`, а не хардкодом. Приклади з різних доменів:

```html
<!-- блог -->
<link rel="stylesheet" href="{% static 'css/blog.css' %}">

<!-- магазин -->
<script src="{% static 'js/cart.js' %}"></script>

<!-- бібліотека: картинка-заглушка для книги без обкладинки -->
<img src="{% static 'img/book-placeholder.svg' %}" alt="Без обкладинки">
```

`{% static 'css/blog.css' %}` згенерує правильний `/static/css/blog.css`, враховуючи `STATIC_URL`. Зміниш `STATIC_URL` чи додаси CDN — усі посилання оновляться самі.

> <i class="bi bi-info-circle"></i> Прямий аналог Flask: там ти писала `{{ url_for('static', filename='css/style.css') }}`. У Django та сама ідея — `{% static 'css/style.css' %}`. Принцип однаковий: **не хардкодити шлях, хай фреймворк побудує URL сам**.

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

> <i class="bi bi-lightbulb"></i> Аналогія: у розробці статику роздає сам кухар (Django) — повільно, зате просто. На проді кухар готує лише страви (динамічні сторінки), а напої (статику) видає окремий бармен (Nginx). `collectstatic` — це коли ти заздалегідь складаєш усі напої з різних барів в один холодильник.

## MEDIA: файли, які завантажують користувачі

Статика — це файли **розробника** (CSS, JS, логотип). Але є ще файли, які завантажують **користувачі**: аватар автора блогу, фото товару в магазині, скан обкладинки книги. Для них — окремий механізм: **MEDIA**.

```python
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
class Book(models.Model):
    title = models.CharField(max_length=200)
    cover = models.ImageField(upload_to='covers/')   # → media/covers/...
```

А в шаблоні до нього звертаються **не** через `{% static %}`, а через саме поле:

```html
<img src="{{ book.cover.url }}" alt="{{ book.title }}">   <!-- /media/covers/dune.jpg -->
```

> <i class="bi bi-info-circle"></i> У розробці, щоб `runserver` віддавав media-файли, у `root/urls.py` додають:
> ```python
> from django.conf import settings
> from django.conf.urls.static import static
> urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
> ```
> На проді media, як і статику, роздає вебсервер.

## `staticfiles` — це теж app

Зверни увагу: у `INSTALLED_APPS` є `'django.contrib.staticfiles'`. Саме цей вбудований app дає тег `{% static %}` і команду `collectstatic`. Тобто робота зі статикою — це ще одна «батарейка» Django (про батарейки — окрема тема).

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-octagon"></i> Забути `{% load static %}` вгорі шаблону → тег `{% static %}` не спрацює (`Invalid block tag 'static'`).

> <i class="bi bi-exclamation-octagon"></i> Писати `href="/static/css/blog.css"` хардкодом → працює в dev, але ламається, якщо зміниш `STATIC_URL` чи додаси CDN.

> <i class="bi bi-exclamation-octagon"></i> Чекати, що статика «сама з'явиться» на проді без `collectstatic` → при `DEBUG=False` її ніхто не роздасть (сторінка буде без стилів).

> <i class="bi bi-exclamation-octagon"></i> Плутати MEDIA і STATIC: звертатися до завантаженої користувачем картинки через `{% static %}`. Для завантажень — `{{ obj.field.url }}`, а не `{% static %}`.

## Підсумок

- Статика — незмінні файли розробника: CSS, JS, картинки, шрифти.
- `STATIC_URL` — **адреса** (`/static/...`), `STATICFILES_DIRS` — **папки-джерела на диску**, `STATIC_ROOT` — куди `collectstatic` збирає все для проду. Це три різні речі.
- У шаблоні: `{% load static %}` + `{% static 'css/blog.css' %}` (аналог `url_for('static', ...)` з Flask).
- **dev:** Django роздає сам (`DEBUG=True`). **prod:** `DEBUG=False` → треба `collectstatic` + вебсервер.
- **MEDIA** (`MEDIA_URL`/`MEDIA_ROOT`) — окремо для файлів, що завантажують користувачі (аватар, фото товару, обкладинка книги); звертаються через `{{ obj.field.url }}`, не через `{% static %}`.
- `django.contrib.staticfiles` — вбудований app, що дає тег `{% static %}` і `collectstatic`.

> <i class="bi bi-book"></i> Деталі та налаштування для продакшну — у документації: docs.djangoproject.com → «How to manage static files» і «How to manage media files».
