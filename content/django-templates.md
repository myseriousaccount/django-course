# Шаблони

Шаблон — це HTML із підстановками, який Django заповнює даними з view. Основний механізм організації — наслідування: спільна розмітка описується один раз у базовому шаблоні, а сторінки заповнюють у ньому лише свої ділянки.

## Базовий шаблон

Без наслідування кожен файл містив би копію `<head>`, меню й підвалу, і зміна одного пункту меню означала б правку десяти файлів. Базовий шаблон описує каркас і лишає іменовані ділянки — блоки, які заповнять дочірні сторінки.

```html
{# templates/_layouts/base.html #}
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
{# templates/blog/post_detail.html #}
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
{# templates/_layouts/base.html — магазин #}
{% block scripts %}
    <script src="{% static 'js/shop.js' %}"></script>
{% endblock %}
```

```html
{# templates/shop/cart.html #}
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
{# templates/library/book_list.html #}
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
{# templates/library/_book_card.html — повторюваний фрагмент #}
<div class="card">
    <h3>{{ book.title }}</h3>
    <p>{{ book.author }}, {{ book.year }}</p>
</div>
```

Можна передати у фрагмент дані явно через `with`:

```html
{# templates/shop/product_card.html #}
{% include "shop/_price_badge.html" with price=product.price currency="грн" %}
```

Різниця між тегами: `extends` задає каркас, усередині якого живе вся сторінка, `include` вставляє фрагмент у конкретне місце. Перше стосується сторінки цілком, друге — окремої деталі.

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
# config/settings.py
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

Ти рендериш `'blog/post_detail.html'`, а не просто `'post_detail.html'`. Причина — **уникнути конфлікту імен**: якщо у блогу і в магазину є свій `list.html`, то з `APP_DIRS` Django узяв би **перший-ліпший** (за порядком в `INSTALLED_APPS`). Підпапка з ім'ям модуля (`blog/`, `shop/`, `library/`) робить шлях однозначним:

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
# library/views.py
return render(request, 'library/book_list.html', {'books': books})
```

```html
{# templates/library/book_list.html #}
{% for book in books %}
    <p>{{ book.title }} — {{ book.author }}</p>
{% endfor %}
```

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `{% extends %}` не в першому рядку | `TemplateSyntaxError`; перед ним допускаються лише коментарі |
| `TemplateDoesNotExist` | Шаблон не в `DIRS` і не в `APP_DIRS`, застосунок не в `INSTALLED_APPS` або пропущено підпапку з іменем застосунку |
| Дочірній блок стер вміст базового | Це штатна поведінка `{% block %}`; щоб доповнити, а не замінити, використовують `{{ block.super }}` |
| Забутий `{% load static %}` | `Invalid block tag 'static'` — тег статики потрібно завантажити в кожному шаблоні, де він використовується |
| Однакові імена шаблонів у різних застосунках | Django бере перший знайдений за порядком `INSTALLED_APPS`; рятує підпапка з іменем застосунку |
| Логіка в шаблоні замість view | Обчислення й запити в розмітці неможливо ні протестувати, ні перевикористати |

## Підсумок

- Наслідування шаблонів прибирає дублювання: спільний каркас — у `base.html`, сторінки його `{% extends %}`.
- `{% block %}` у базі — «дірка»; дочірня сторінка заповнює її своїм вмістом, решту бере з бази.
- `{{ block.super }}` — **доповнити** батьківський блок, а не замінити його.
- `{% include %}` — вставити окремий фрагмент (картку товару/книги, форму); `with` передає йому конкретні дані.
- `TEMPLATES`: **`DIRS`** — спільна папка проєкту (шукається першою), **`APP_DIRS`** — папки всередині кожного app; обидва підходи валідні, часто поєднуються.
- Підпапка за іменем модуля (`blog/`, `shop/`, `library/`) рятує від конфлікту однакових імен.
- Дані: `context` у view → `{{ }}` у шаблоні.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/templates/" target="_blank" rel="noopener">Templates <i class="bi bi-box-arrow-up-right"></i></a></div></div>
