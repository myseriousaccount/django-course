# Власні теги й фільтри шаблонів

Вбудованих тегів і фільтрів Django багато, але рано чи пізно їх бракує: відформатувати ціну як `25 000 ₴`, порахувати суму кошика, намалювати зірочки рейтингу. Цей урок пояснює, як створити **власні** теги й фільтри. Приклади навмисно з **різних доменів** (магазин, блог, рейтинг фільму), щоб ти бачила: механізм універсальний.

## Навіщо власні теги й фільтри

> **Власний тег/фільтр** — це твоя Python-функція, яку можна викликати прямо в шаблоні. Він розширює мову шаблонів там, де вбудованих засобів замало.

**Навіщо.** Щоб винести повторювану логіку відображення з шаблонів у Python. Порівняй:

```html
{# без власного фільтра — логіка «протікає» в HTML #}
{{ price|floatformat:0 }} грн, розряди руками...
```

```html
{# з власним фільтром — чисто й повторно #}
{{ price|currency }}
```

Форматування ціни, сума кошика, зірочки рейтингу — усе це варто описати **один раз** як тег/фільтр і використовувати скрізь.

## Структура: папка templatetags

**Як це працює.** Django шукає власні теги в спеціальній папці `templatetags` **усередині app**:

```
catalog/
├── __init__.py
├── models.py
├── views.py
└── templatetags/          ← саме така назва
    ├── __init__.py        ← обов'язковий, робить папку пакетом
    └── shop_extras.py     ← сюди пишемо теги/фільтри
```

На початку файлу з тегами — **завжди** ця пара рядків:

```python
# catalog/templatetags/shop_extras.py
from django import template

register = template.Library()      # реєстр, до якого чіпляємо теги
```

`register` — це «дошка оголошень»: усе, що ти позначиш декоратором `@register....`, стане доступним у шаблоні. А в самому шаблоні файл треба **завантажити**:

```html
{% load shop_extras %}      {# ім'я файлу без .py, зверху шаблону #}
```

**Навіщо** такий ритуал. Django не тягне всі функції підряд — ти явно кажеш «завантаж набір `shop_extras`». Це передбачувано й не засмічує простір імен.

## `@register.filter` — власний фільтр

Фільтр перетворює **одне значення**: `{{ значення|фільтр }}`. Пиши функцію, що приймає значення й повертає результат:

```python
# catalog/templatetags/shop_extras.py
@register.filter
def currency(value):
    return f'{value:,.0f} ₴'.replace(',', ' ')   # 25000 → "25 000 ₴"
```

```html
{% load shop_extras %}
<p>Ціна: {{ product.price|currency }}</p>       {# Ціна: 25 000 ₴ #}
```

Фільтр може приймати й **аргумент** — `{{ значення|фільтр:аргумент }}`:

```python
@register.filter
def discount(price, percent):
    return price - price * percent / 100

# {{ product.price|discount:10 }}  → ціна мінус 10%
```

## `@register.simple_tag` — тег, що повертає значення

Коли потрібно не перетворити змінну, а **обчислити** щось (часто з кількома аргументами) — це `simple_tag`. Він повертає значення:

```python
@register.simple_tag
def cart_total(cart):
    return sum(item.price * item.qty for item in cart)

# {% cart_total request.cart %}  → 47 300
```

Часто тегу потрібен доступ до всього контексту шаблону (де лежить `request`, `user`…). Тоді — `takes_context=True`, і **першим** аргументом функція отримує `context`:

```python
@register.simple_tag(takes_context=True)
def cart_total(context):
    cart = context['request'].session.get('cart', {})
    return sum(cart.values())

# {% cart_total %}   ← request діставати не треба, він у context
```

Результат можна й **зберегти** у змінну через `as`:

```html
{% cart_total as total %}
<p>Разом: {{ total|currency }}</p>
```

## `@register.inclusion_tag` — тег, що рендерить фрагмент

Найпотужніший вид: тег **рендерить окремий шаблон-фрагмент** і вставляє його результат. Ідеально для повторюваних блоків — картка товару, меню, віджет.

```python
@register.inclusion_tag('catalog/tags/product_card.html')
def product_card(product):
    return {'product': product}       # це context для фрагмента
```

Фрагмент `catalog/tags/product_card.html`:

```html
<div class="card">
  <h3>{{ product.name }}</h3>
  <p>{{ product.price|currency }}</p>
</div>
```

Виклик у будь-якому шаблоні:

```html
{% load shop_extras %}
{% for p in products %}
    {% product_card p %}          {# рендерить картку для кожного #}
{% endfor %}
```

**Навіщо.** Один опис картки — використання скрізь. Зміниш `product_card.html` — оновляться всі картки на сайті.

## Різні домени — той самий механізм

**Блог** — час читання посту (фільтр):

```python
@register.filter
def read_time(text):
    return f'{len(text.split()) // 200 + 1} хв читання'

# {{ post.body|read_time }}
```

**Рейтинг фільму** — зірочки (inclusion_tag):

```python
@register.inclusion_tag('reviews/tags/stars.html')
def stars(rating):
    return {'full': range(rating), 'empty': range(5 - rating)}
```

```html
{# reviews/tags/stars.html #}
{% for _ in full %}★{% endfor %}{% for _ in empty %}☆{% endfor %}
```

```html
{% load review_extras %}
{% stars movie.rating %}      {# ★★★★☆ #}
```

Один інструмент — три домени: магазин, блог, кіно.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Немає `__init__.py`** у папці `templatetags/` → Django не бачить її як пакет, і `{% load %}` падає з `... is not a registered tag library`. Порожній `__init__.py` **обов'язковий**.

> <i class="bi bi-exclamation-triangle"></i> **Перезапусти сервер** після створення папки `templatetags`. `runserver` **не** підхоплює нові пакети з тегами на льоту — теги «не знайдуться», доки не перезапустиш. Це найчастіша причина «я ж усе написала, а `{% load %}` не працює».

> <i class="bi bi-exclamation-triangle"></i> **Забула `register = template.Library()`** або декоратор `@register...` → тег не зареєстрований, шаблон його «не бачить». Ці два рядки на початку файлу — фундамент.

> <i class="bi bi-info-circle"></i> `{% load shop_extras %}` пиши на початку **кожного** шаблону, де використовуєш ці теги. Завантаження не успадковується від `base.html` до дочірніх шаблонів.

> <i class="bi bi-lightbulb"></i> Як обрати вид: **фільтр** — коли перетворюєш одне значення (`{{ x|currency }}`); **simple_tag** — коли обчислюєш результат із кількох аргументів (`{% cart_total %}`); **inclusion_tag** — коли треба відрендерити цілий шматок HTML (картка, меню).

> <i class="bi bi-pin-angle"></i> Ім'я файлу (`shop_extras`) — це те, що пишеш у `{% load %}`. Назви його осмислено (`blog_extras`, `review_extras`), бо саме воно «світиться» в кожному шаблоні.

## Підсумок

- **Власні теги/фільтри** розширюють мову шаблонів, коли вбудованих замало (форматування ціни, сума кошика, зірочки).
- **Структура:** папка `app/templatetags/` з `__init__.py` і файлом (напр. `shop_extras.py`); на початку — `register = template.Library()`; у шаблоні — `{% load shop_extras %}`.
- **`@register.filter`** — перетворює одне значення: `{{ price|currency }}`.
- **`@register.simple_tag`** — повертає обчислене значення: `{% cart_total %}`; `takes_context=True` дає доступ до `request`/`user`.
- **`@register.inclusion_tag('...')`** — рендерить фрагмент-шаблон (картка товару, зірочки, меню).
- **Нюанси:** обов'язковий `__init__.py`, **перезапуск сервера** після створення папки `templatetags`, `{% load %}` у кожному шаблоні.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/howto/custom-template-tags/" target="_blank" rel="noopener">Custom template tags and filters <i class="bi bi-box-arrow-up-right"></i></a></div></div>
