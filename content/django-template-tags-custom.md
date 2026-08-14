# Власні теги й фільтри шаблонів

Мова шаблонів Django навмисно обмежена: у ній немає довільних Python-виразів. Коли вбудованих тегів і фільтрів бракує, потрібну операцію описують Python-функцією і реєструють як розширення шаблонної мови. Видів розширень три, і вони відрізняються тим, що приймають і що повертають.

## Який вид обрати

| Вид | Виклик у шаблоні | Аргументи | Повертає | Доступ до контексту |
|---|---|---|---|---|
| `@register.filter` | `{{ value\|name:arg }}` | значення + максимум **один** аргумент | значення | немає |
| `@register.simple_tag` | `{% name a b key=c %}` | скільки завгодно, зокрема іменовані | значення | за `takes_context=True` |
| `@register.inclusion_tag` | `{% name a %}` | скільки завгодно | відрендерений HTML-фрагмент | за `takes_context=True` |

Практичний критерій: перетворюєш одне значення — фільтр; обчислюєш результат із кількох даних — `simple_tag`; треба вставити готовий шматок розмітки — `inclusion_tag`.

## Де живе код

Django шукає розширення в пакеті `templatetags` усередині застосунку, який стоїть в `INSTALLED_APPS`:

```
catalog/
├── __init__.py
├── models.py
└── templatetags/
    ├── __init__.py         ← обов'язковий, робить папку пакетом
    └── shop_extras.py      ← модуль із тегами й фільтрами
```

Модуль починається з реєстру, до якого декоратори чіпляють функції:

```python
# catalog/templatetags/shop_extras.py
from django import template

register = template.Library()
```

У шаблоні модуль підключають за іменем файлу без `.py`:

```html
{% load shop_extras %}
```

Можна завантажити й окремі імена:

```html
{% load currency read_time from shop_extras %}
```

> <i class="bi bi-pin-angle"></i> `{% load %}` діє в межах одного файлу шаблону і **не успадковується** від `base.html` до дочірніх шаблонів. У кожному шаблоні, де використовуєш тег, потрібен свій `{% load %}`.

## Фільтр

Функція приймає значення ліворуч від `|` і повертає результат. Другий параметр — необов'язковий аргумент після двокрапки.

```python
# catalog/templatetags/shop_extras.py
from decimal import Decimal, InvalidOperation

@register.filter
def currency(value, symbol='₴'):
    try:
        amount = Decimal(value)
    except (TypeError, ValueError, InvalidOperation):
        return value                       # некоректні дані повертаємо як є
    return f'{amount:,.0f} {symbol}'.replace(',', ' ')
```

```html
{# catalog/templates/catalog/product.html #}
{{ product.price|currency }}          {# 25 000 ₴ #}
{{ product.price|currency:'$' }}      {# 25 000 $ #}
```

Кілька важливих обмежень і опцій:

- **Максимум один аргумент.** Потрібно більше — це вже `simple_tag`.
- **Фільтр не має падати.** Виняток усередині фільтра зупинить рендер усієї сторінки, тому некоректні дані повертають без змін або порожнім рядком.
- **Ім'я в шаблоні** за замовчуванням дорівнює імені функції; змінюється параметром: `@register.filter(name='money')`.
- **`@stringfilter`** гарантує, що на вхід прийде рядок (Django сам зробить перетворення):

```python
# blog/templatetags/blog_extras.py
from django.template.defaultfilters import stringfilter

@register.filter
@stringfilter
def read_time(text):                       # блог
    return f'{len(text.split()) // 200 + 1} хв читання'
```

## simple_tag

Повертає обчислене значення, приймає будь-яку кількість аргументів — позиційних і іменованих.

```python
# catalog/templatetags/shop_extras.py
@register.simple_tag
def discounted(price, percent=0):
    return price - price * percent / 100
```

```html
{# catalog/templates/catalog/product.html #}
{% discounted product.price 15 %}
```

Результат можна покласти у змінну через `as` і використати нижче:

```html
{# catalog/templates/catalog/product.html #}
{% discounted product.price 15 as final_price %}
<p>Ціна зі знижкою: {{ final_price|currency }}</p>
```

**Доступ до контексту.** З `takes_context=True` першим параметром приходить контекст шаблону — там `request`, `user` та інші змінні:

```python
# carts/templatetags/cart_extras.py
@register.simple_tag(takes_context=True)
def cart_total(context):
    cart = context['request'].session.get('cart', {})
    return sum(cart.values())
```

```html
{# templates/_layouts/header.html #}
{% cart_total %}
```

> <i class="bi bi-info-circle"></i> `context['request']` доступний лише тоді, коли ввімкнено context processor `django.template.context_processors.request` — у стандартному `settings.py` він уже є.

**Блочний варіант.** З Django 5.2 є `@register.simple_block_tag` — тег із вмістом між відкривальним і закривальним тегами. Функція отримує цей вміст першим аргументом:

```python
# core/templatetags/ui.py
from django.utils.html import format_html

@register.simple_block_tag
def note(content, level='info'):
    return format_html('<div class="note note-{}">{}</div>', level, content)
```

```html
{# catalog/templates/catalog/product.html #}
{% note level="warning" %}Товар закінчується{% endnote %}
```

## inclusion_tag

Функція повертає **словник**, який стає контекстом окремого шаблону-фрагмента; результат рендера вставляється на місце виклику.

```python
# catalog/templatetags/shop_extras.py
@register.inclusion_tag('catalog/tags/product_card.html')
def product_card(product, show_price=True):
    return {'product': product, 'show_price': show_price}
```

```html
{# catalog/templates/catalog/tags/product_card.html #}
<article class="card">
  <h3>{{ product.name }}</h3>
  {% if show_price %}<p>{{ product.price }}</p>{% endif %}
</article>
```

```html
{# templates/catalog/product_list.html #}
{% load shop_extras %}
{% for p in products %}
  {% product_card p %}
{% endfor %}
```

`takes_context=True` працює так само, як у `simple_tag`: контекст приходить першим параметром.

> <i class="bi bi-exclamation-triangle"></i> Не роби запитів до бази всередині `inclusion_tag`, який викликається в циклі: сто карток дадуть сто запитів. Дані готуй у view (з `select_related` / `prefetch_related`) і передавай у тег готовими.

## Екранування та HTML у відповіді

Django автоматично екранує вивід — і фільтрів, і `simple_tag`. Якщо функція повертає розмітку, її треба позначити безпечною, інакше теги приїдуть у сторінку як текст `&lt;span&gt;`.

Правильний спосіб — `format_html()`: він екранує підставлені значення, але лишає твої теги розміткою.

```python
# cinema/templatetags/movie_extras.py
from django.utils.html import format_html

@register.simple_tag
def stars(rating):                                   # кінотека
    full, empty = int(rating), 5 - int(rating)
    return format_html('<span class="stars">{}{}</span>', '★' * full, '☆' * empty)
```

`mark_safe()` теж робить рядок безпечним, але **нічого не екранує** — застосовувати його можна лише до розмітки, у якій немає даних від користувача.

Для фільтрів є ще параметр `is_safe`:

```python
# accounts/templatetags/user_extras.py
@register.filter(is_safe=True)
def initials(value):                       # "Марія Коваль" → "МК"
    return ''.join(part[0].upper() for part in str(value).split()[:2])
```

`is_safe=True` означає «цей фільтр не додає у рядок небезпечних символів» — тоді Django не екранує результат повторно, якщо вхід уже був безпечним. Це не дозвіл повертати довільний HTML.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Немає `__init__.py` у `templatetags/` | Папка не є пакетом, `{% load %}` падає з `'shop_extras' is not a registered tag library`. Додай порожній файл |
| Сервер не перезапущено | `runserver` не підхоплює новий пакет із тегами на льоту — після створення папки перезапусти вручну |
| Застосунок не в `INSTALLED_APPS` | Бібліотека тегів не знайдеться, навіть якщо файли на місці |
| Забуто `register = template.Library()` або декоратор | Функція існує, але шаблон її не бачить |
| Ім'я збігається з вбудованим (`date`, `length`, `add`) | Твій тег перекриє стандартний у всіх шаблонах, де стоїть `{% load %}`. Давай відмінні назви |
| Теги лежать поза застосунком | Django їх не знайде; або переклади в застосунок, або зареєструй через `TEMPLATES['OPTIONS']['libraries']` |

## Підсумок

- Розширення шаблонної мови живуть у `app/templatetags/*.py`; потрібні `__init__.py`, `register = template.Library()`, застосунок в `INSTALLED_APPS` і `{% load %}` у кожному шаблоні.
- **Фільтр** — одне значення плюс максимум один аргумент, без доступу до контексту; не повинен піднімати винятків.
- **`simple_tag`** — довільна кількість аргументів, результат можна зберегти через `as`; `takes_context=True` дає `request` і `user`. Блочна форма — `simple_block_tag` (Django 5.2+).
- **`inclusion_tag`** — повертає словник-контекст для окремого шаблону-фрагмента; запити до бази тримай поза ним.
- Вивід автоматично екранується: для розмітки використовуй `format_html()`, `mark_safe()` — лише для рядків без даних користувача, `is_safe=True` — позначка, що фільтр не додає небезпечних символів.
- Після створення пакета `templatetags` сервер треба перезапустити.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/howto/custom-template-tags/" target="_blank" rel="noopener">Custom template tags and filters <i class="bi bi-box-arrow-up-right"></i></a></div></div>
