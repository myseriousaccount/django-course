# Context processors: дані в кожен шаблон

Часто одні й ті самі дані потрібні на **всіх** сторінках — меню категорій у шапці, лічильник кошика, поточний рік у футері. Цей урок пояснює, як віддати такі дані в **кожен** шаблон автоматично, не дублюючи код у всіх view. Приклади навмисно з **різних доменів** (магазин, блог, футер), щоб ти бачила: механізм універсальний.

## Проблема: дублювання в кожному view

Уяви, що в шапці сайту магазину має бути меню категорій. Шапка — у `base.html`, який наслідує **кожна** сторінка. Отже, змінна `categories` потрібна скрізь:

```python
# catalog/views.py — і так у КОЖНІЙ view проєкту 😩
def product_list(request):
    categories = Category.objects.all()
    products = Product.objects.all()
    return render(request, 'catalog/product_list.html',
                  {'categories': categories, 'products': products})

def product_detail(request, pk):
    categories = Category.objects.all()          # знову те саме
    product = get_object_or_404(Product, pk=pk)
    return render(request, 'catalog/product_detail.html',
                  {'categories': categories, 'product': product})
```

`categories = Category.objects.all()` повторюється в **кожній** view. Забудеш в одній — шапка на тій сторінці «зламається». Це порушує принцип DRY, за яким живе Django.

## Визначення

> **Context processor** — це функція `(request) -> dict`, чиї ключі стають доступні в **кожному** шаблоні автоматично. Django викликає її на кожен запит і **домішує** повернутий словник до `context` будь-якого шаблону, який рендериться через `render()`.

**Як це працює.** Коли view викликає `render(request, ...)`, Django бере твій `context` і **додає** до нього результати всіх зареєстрованих context processors. Тобто до змінних, які поклала view, приєднуються спільні змінні — і шаблон бачить їх усі разом.

**Навіщо.** Щоб «наскрізні» дані (меню, кошик, налаштування сайту) описати **один раз** в окремій функції, а не тягати їх руками через кожну view. Прибрав дублювання — прибрав джерело помилок.

## Як зробити: функція + реєстрація

Два кроки — і готово.

**Крок 1. Функція** у файлі `app/context_processors.py`:

```python
# catalog/context_processors.py
from .models import Category

def header_categories(request):
    return {
        'header_categories': Category.objects.all().order_by('name'),
    }
```

Звичайна функція: приймає `request`, повертає `dict`. Ключ словника (`header_categories`) — це ім'я змінної, під яким дані з'являться в шаблонах.

**Крок 2. Реєстрація** в `settings.py`, у списку `TEMPLATES['OPTIONS']['context_processors']`:

```python
# root/settings.py
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # ...
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'catalog.context_processors.header_categories',   # ← наш
            ],
        },
    },
]
```

Шлях — рядок `модуль.функція` (як імпорт, але через крапку). Після цього в **будь-якому** шаблоні:

```html
{# base.html — шапка на всіх сторінках #}
<nav>
  {% for cat in header_categories %}
    <a href="{% url 'catalog:category' cat.slug %}">{{ cat.name }}</a>
  {% endfor %}
</nav>
```

Жодна view більше не передає `categories` — вони «прилітають» самі.

> <i class="bi bi-pin-angle"></i> Реєструють processor **не** в моделях чи view, а саме в `settings.py` → `TEMPLATES` → `OPTIONS` → `context_processors`. Це той-таки список, де вже лежать вбудовані processor'и.

## Вбудовані context processors

Ти вже користувалася ними, навіть не помічаючи. Ось звідки в шаблонах беруться «магічні» змінні:

| Processor | Що додає | Змінна в шаблоні |
|---|---|---|
| `...context_processors.request` | сам об'єкт запиту | `{{ request.path }}` |
| `...contrib.auth.context_processors.auth` | поточного користувача | `{{ user }}`, `{{ perms }}` |
| `...contrib.messages.context_processors.messages` | flash-повідомлення | `{{ messages }}` |

**Ось відповідь** на давнє питання: чому в шаблоні працює `{% if user.is_authenticated %}`, хоч view не передавала `user`? Тому що це робить `auth` — вбудований context processor. Твій `header_categories` працює **точно так само**, просто написала його ти.

## Ще приклади (різні домени)

**Поточний рік для футера** — без бази взагалі:

```python
# core/context_processors.py
from django.utils import timezone

def current_year(request):
    return {'current_year': timezone.now().year}
```

```html
<footer>© {{ current_year }} Мій сайт</footer>
```

**Лічильник кошика** в шапці магазину:

```python
# cart/context_processors.py
def cart_counter(request):
    cart = request.session.get('cart', {})
    return {'cart_count': sum(cart.values())}
```

```html
<a href="{% url 'cart:detail' %}">Кошик ({{ cart_count }})</a>
```

**Меню рубрик блогу** — той самий патерн, інша модель:

```python
# blog/context_processors.py
from .models import Tag

def popular_tags(request):
    return {'popular_tags': Tag.objects.order_by('-uses')[:10]}
```

Один патерн — `(request) -> dict` — обслуговує будь-який домен.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Виконується на КОЖЕН запит.** Context processor спрацьовує щоразу для **кожної** сторінки. Не клади туди важких запитів (складні `JOIN`, агрегації, багато об'єктів) — інакше вповільниш увесь сайт. Для важких даних — кешуй (`django.core.cache`) і клади в processor уже кеш.

> <i class="bi bi-lightbulb"></i> Уяви context processor як «спільну полицю», куди Django заглядає перед рендером **кожного** шаблону. Що поклала на полицю — те бачать усі сторінки. Тому полиця має бути легкою: важкі речі туди — гальмуватиме весь дім.

> <i class="bi bi-exclamation-triangle"></i> **Забула зареєструвати** в `settings.py` → змінна в шаблоні просто порожня (не помилка!). Django не скаже нічого — шаблон покаже пусто. Перевір, що рядок `app.context_processors.функція` є у списку.

> <i class="bi bi-info-circle"></i> Функція **мусить** повернути `dict` (навіть порожній `{}`), а не `None`. Інакше — `TypeError` під час рендеру.

> <i class="bi bi-pin-angle"></i> Це для даних, потрібних **скрізь**. Якщо змінна треба лише на одній-двох сторінках — передавай її через `context` у `render()`, а не «глобально». Не засмічуй кожен шаблон зайвим.

## Підсумок

- **Context processor** — функція `(request) -> dict`, чиї ключі стають змінними в **кожному** шаблоні автоматично.
- Розв'язує **дублювання**: наскрізні дані (меню, кошик, рік) описуєш один раз, а не в кожній view.
- **Два кроки:** функція в `app/context_processors.py` + рядок `app.context_processors.функція` у `TEMPLATES['OPTIONS']['context_processors']`.
- Вбудовані — `request`, `auth` (звідси `user` і `perms`), `messages`; твої processor'и працюють так само.
- Реальний приклад shop-app: `catalog/context_processors.py` → `header_categories` дає меню категорій у шапці.
- **Нюанс:** виконується на кожен запит — жодних важких запитів; для важкого — кешуй.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/templates/api/" target="_blank" rel="noopener">Template API <i class="bi bi-box-arrow-up-right"></i></a></div></div>
