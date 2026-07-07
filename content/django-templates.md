# Шаблони: наслідування та організація

Шар **T** (Template) у MTV — це HTML, який бачить користувач. Головна архітектурна ідея тут одна: **не дублювати спільну розмітку**. Шапка, меню, підвал однакові на всіх сторінках, тож їх описують **один раз** у базовому шаблоні, а решта сторінок його **наслідують**. Приклади навмисно з **різних доменів** (блог, магазин, бібліотека), щоб механізм не зливався з якимось одним проєктом.

## Проблема, яку вирішує наслідування

**Навіщо.** Без наслідування кожен HTML-файл містив би повну копію `<head>`, меню, підвалу. Зміниш один пункт меню — і правиш його в десяти файлах, а десь неминуче забудеш. Django усуває цей клас помилок механізмом `extends` + `block`: спільне існує в одному місці.

> <i class="bi bi-lightbulb"></i> Аналогія: база — це **бланк документа** з готовою шапкою і підписами, а `block` — порожні поля, які заповнюєш. Сам бланк не передруковуєш щоразу — береш готовий і вписуєш своє.

## Базовий шаблон

**Як це працює.** Базовий шаблон описує спільний «каркас» і лишає **дірки** (`block`), які заповнять дочірні сторінки. Ось база для **блогу**:

```html
<!-- templates/_layouts/base.html -->
<!DOCTYPE html>
{% load static %}
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <title>{% block title %}Мій блог{% endblock %}</title>
    <link rel="stylesheet" href="{% static 'css/blog.css' %}">
</head>
<body>
    <nav>
        <a href="{% url 'home' %}">Головна</a>
        <a href="{% url 'post_list' %}">Статті</a>
        <a href="{% url 'about' %}">Про автора</a>
    </nav>
    <main>
        {% block content %}{% endblock %}   <!-- сюди дочірні сторінки вставлять свій вміст -->
    </main>
    <footer>© 2026 Мій блог</footer>
    {% block scripts %}{% endblock %}
</body>
</html>
```

`{% block content %}{% endblock %}` — це **порожня дірка** з ім'ям `content`. Усе навколо неї (меню, `<head>`, підвал) — спільне для всіх сторінок.

## Дочірній шаблон: `{% extends %}` + `{% block %}`

Сторінка **наслідує** базу і заповнює лише свою дірку. Приклад — сторінка статті блогу:

```html
<!-- templates/blog/post_detail.html -->
{% extends "_layouts/base.html" %}

{% block title %}{{ post.title }} — Мій блог{% endblock %}

{% block content %}
    <article>
        <h1>{{ post.title }}</h1>
        <p class="meta">{{ post.published_at }} · {{ post.author }}</p>
        {{ post.body }}
    </article>
{% endblock %}
```

Що тут відбувається:

- `{% extends "_layouts/base.html" %}` — **обов'язково перший рядок**: «візьми каркас з base».
- `{% block title %}...{% endblock %}` і `{% block content %}...{% endblock %}` — «а в ці дірки встав ось це».
- Меню, `<head>`, підвал сторінка **не повторює** — вони приходять з бази.
- Блок `scripts` не заповнено → залишиться порожнім (значення з бази).

## `block.super` — доповнити, а не замінити

Іноді дочірня сторінка хоче **додати** до вмісту базового блоку, а не стерти його. Для цього є `{{ block.super }}` — воно підставляє вміст блоку з батьківського шаблону.

Приклад: у базі магазину блок `scripts` уже підключає загальний JS, а сторінка кошика хоче додати ще один — не втративши базовий:

```html
<!-- base.html магазину -->
{% block scripts %}
    <script src="{% static 'js/shop.js' %}"></script>
{% endblock %}
```

```html
<!-- shop/cart.html -->
{% extends "_layouts/base.html" %}

{% block scripts %}
    {{ block.super }}                              <!-- залишає shop.js з бази -->
    <script src="{% static 'js/cart.js' %}"></script>  <!-- + додає свій -->
{% endblock %}
```

> <i class="bi bi-info-circle"></i> Без `{{ block.super }}` дочірній блок **повністю замінив би** батьківський, і `shop.js` зник би. З ним — вміст додається поверх.

## `{% include %}` — вставити шматок шаблону

`{% extends %}` тягне **весь каркас**, а `{% include %}` вставляє **окремий фрагмент** у будь-яке місце. Це для повторюваних деталей: картка товару, картка книги, форма пошуку.

```html
<!-- бібліотека: список книг вставляє картку для кожної -->
<!-- library/book_list.html -->
{% extends "_layouts/base.html" %}

{% block content %}
    <h1>Каталог</h1>
    <div class="grid">
        {% for book in books %}
            {% include "library/_book_card.html" %}
        {% endfor %}
    </div>
{% endblock %}
```

```html
<!-- library/_book_card.html — маленький повторюваний шматок -->
<div class="card">
    <h3>{{ book.title }}</h3>
    <p>{{ book.author }}, {{ book.year }}</p>
</div>
```

Можна передати у фрагмент дані явно через `with`:

```html
{% include "shop/_price_badge.html" with price=product.price currency="грн" %}
```

> <i class="bi bi-lightbulb"></i> Різниця в одному реченні: **`extends`** — «я всередині цього каркасу», **`include`** — «встав сюди оцей шматок». Перше — про сторінку загалом, друге — про деталь усередині неї.

## Повний набір тегів наслідування

| Тег | Що робить |
|---|---|
| `{% extends "base.html" %}` | наслідувати каркас (перший рядок дочірнього шаблону) |
| `{% block x %}...{% endblock %}` | оголосити дірку (у базі) / заповнити її (у дочірньому) |
| `{{ block.super }}` | підставити вміст цього ж блоку з батьківського шаблону |
| `{% include "part.html" %}` | вставити інший шаблон (картку, форму) |
| `{% include "p.html" with a=b %}` | те саме + передати конкретні змінні |

## Звідки Django бере шаблони: DIRS чи APP_DIRS

У `settings.py` за пошук шаблонів відповідає блок `TEMPLATES`:

```python
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],   # 1) спільна папка проєкту
    'APP_DIRS': True,                   # 2) + папка templates/ всередині КОЖНОГО app
    'OPTIONS': {'context_processors': [...]},
}]
```

Є **два місця**, де Django шукає шаблони, і він перевіряє їх по черзі:

- **`DIRS`** — список твоїх спільних папок. Django шукає тут **першим**. Зручно для спільного каркаса (`_layouts/base.html`), який використовують усі модулі.
- **`APP_DIRS: True`** — після `DIRS` Django заглядає у `<app>/templates/` **усередині кожного** app зі списку `INSTALLED_APPS`.

> <i class="bi bi-info-circle"></i> Два підходи до організації:
> - **Спільна `templates/`** — усі шаблони в одному місці, поділені підпапками за модулем (`templates/blog/`, `templates/shop/`).
> - **`templates/` всередині app** — шаблони лежать поряд зі своїм модулем (`blog/templates/blog/…`). Зручно, коли app хочеш перевикористати в іншому проєкті — він «самодостатній».
>
> Обидва підходи робочі; часто їх поєднують: спільний каркас у `DIRS`, а специфічні сторінки — в app.

## Чому підпапка з ім'ям модуля

**Як це працює.** Ти рендериш `'blog/post_detail.html'`, а не просто `'post_detail.html'`. Причина — **уникнути конфлікту імен**: якщо у блогу і в магазину є свій `list.html`, то з `APP_DIRS` Django узяв би **перший-ліпший** (за порядком в `INSTALLED_APPS`). Підпапка з ім'ям модуля (`blog/`, `shop/`, `library/`) робить шлях однозначним:

```
templates/
├── _layouts/
│   └── base.html
├── blog/
│   └── post_detail.html
├── shop/
│   ├── product_list.html
│   └── _price_badge.html
└── library/
    ├── book_list.html
    └── _book_card.html
```

> <i class="bi bi-pin-angle"></i> Конвенція: файли-фрагменти для `{% include %}` часто називають з підкресленням спереду (`_book_card.html`, `_price_badge.html`) — щоб одразу видно, що це «частинка», а не самостійна сторінка.

## Передача даних: context → {{ }}

Дані з view потрапляють у шаблон через `context`, а в HTML виводяться через `{{ }}`. Той самий міст працює в будь-якому домені:

```python
# view бібліотеки
return render(request, 'library/book_list.html', {'books': books})
```

```html
<!-- template -->
{% for book in books %}
    <p>{{ book.title }} — {{ book.author }}</p>
{% endfor %}
```

> <i class="bi bi-info-circle"></i> Якщо знаєш Jinja2 з Flask — синтаксис майже ідентичний: `{{ змінна }}`, `{% тег %}`, `{% extends %}`, `{% block %}`. Django Templates — близький родич, але це **окремий рушій**: свої правила, трохи менше «магії» у Python-виразах (наприклад, не можна викликати функцію з аргументами прямо в шаблоні). У Flask аналог `include` — теж `{% include %}`, а аналог `block.super` — `{{ super() }}`.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **`{% extends %}` не першим рядком** → `TemplateSyntaxError`. Тег наслідування має бути найпершим у файлі (перед ним лише коментарі).

> <i class="bi bi-exclamation-triangle"></i> **`TemplateDoesNotExist: blog/post_detail.html`** → шаблон не в `DIRS`/`APP_DIRS`, або app не в `INSTALLED_APPS`, або переплутано підпапку. Пиши повний шлях із підпапкою модуля.

> <i class="bi bi-exclamation-triangle"></i> **Дочірній блок стер батьківський вміст** — це нормальна поведінка `{% block %}`. Якщо хотіла **доповнити**, а не замінити — використай `{{ block.super }}`.

> <i class="bi bi-info-circle"></i> Забула `{% load static %}` вгорі → тег `{% static %}` не спрацює (про це — окремий урок про статику).

## Підсумок

- Наслідування шаблонів прибирає дублювання: спільний каркас — у `base.html`, сторінки його `{% extends %}`.
- `{% block %}` у базі — «дірка»; дочірня сторінка заповнює її своїм вмістом, решту бере з бази.
- `{{ block.super }}` — **доповнити** батьківський блок, а не замінити його.
- `{% include %}` — вставити окремий фрагмент (картку товару/книги, форму); `with` передає йому конкретні дані.
- `TEMPLATES`: **`DIRS`** — спільна папка проєкту (шукається першою), **`APP_DIRS`** — папки всередині кожного app; обидва підходи валідні, часто поєднуються.
- Підпапка за іменем модуля (`blog/`, `shop/`, `library/`) рятує від конфлікту однакових імен.
- Дані: `context` у view → `{{ }}` у шаблоні (схоже на Jinja2, але це окремий рушій).

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/templates/" target="_blank" rel="noopener">Templates <i class="bi bi-box-arrow-up-right"></i></a></div></div>
