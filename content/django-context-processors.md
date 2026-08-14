# Context processors

Context processor — функція `(request) -> dict`, ключі якої стають змінними в кожному шаблоні. Її використовують для наскрізних даних: меню в шапці, лічильник кошика, налаштування сайту.

## Проблема, яку це розв'язує

Меню категорій живе в `base.html`, який наслідують усі сторінки, тому змінна потрібна в кожній view:

```python
# catalog/views.py — те саме доведеться повторити в кожній view
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

`categories = Category.objects.all()` повторюється скрізь, і пропуск в одній view ламає шапку саме на тій сторінці.

## Як це працює

Коли view викликає `render(request, ...)`, Django бере переданий контекст і додає до нього результати всіх зареєстрованих context processors. Шаблон бачить обидва набори змінних разом.

## Два кроки

Функція у файлі `app/context_processors.py`:

```python
# catalog/context_processors.py
from .models import Category

def header_categories(request):
    return {
        'header_categories': Category.objects.all().order_by('name'),
    }
```

Звичайна функція: приймає `request`, повертає `dict`. Ключ словника (`header_categories`) — це ім'я змінної, під яким дані з'являться в шаблонах.

Реєстрація в списку `TEMPLATES['OPTIONS']['context_processors']`:

```python
# config/settings.py
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
{# templates/_layouts/base.html #}
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

Саме тому в шаблоні працює `{% if user.is_authenticated %}`, хоча view не передавала `user`: змінну додає вбудований processor `auth`. Власні processors працюють так само.

## Приклади

Поточний рік для підвалу — без звернення до бази:

```python
# core/context_processors.py
from django.utils import timezone

def current_year(request):
    return {'current_year': timezone.now().year}
```

```html
{# templates/_layouts/footer.html #}
<footer>© {{ current_year }} Мій сайт</footer>
```

Лічильник кошика в шапці:

```python
# cart/context_processors.py
def cart_counter(request):
    cart = request.session.get('cart', {})
    return {'cart_count': sum(cart.values())}
```

```html
{# templates/_layouts/header.html #}
<a href="{% url 'cart:detail' %}">Кошик ({{ cart_count }})</a>
```

Популярні теги блогу — той самий патерн з іншою моделлю:

```python
# blog/context_processors.py
from .models import Tag

def popular_tags(request):
    return {'popular_tags': Tag.objects.order_by('-uses')[:10]}
```

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Важкий запит усередині processor | Виконується на **кожен** запит до сайту, включно зі сторінками, де ці дані не потрібні. Для важкого — кеш через `django.core.cache` |
| Функцію не зареєстровано в `settings.py` | Помилки не буде: змінна в шаблоні просто порожня, і сторінка мовчки втрачає блок |
| Функція повертає `None` замість словника | `TypeError` під час рендеру; порожній результат — це `{}` |
| Дані, потрібні на одній сторінці | Виконуються скрізь без потреби; такі змінні передають через `context` у `render()` |
| Звернення до `request.user` без перевірки | Для анонімного відвідувача це `AnonymousUser`; запит `Order.objects.filter(user=request.user)` впаде або поверне порожнечу |
| Ім'я ключа збігається зі змінною view | Значення з view перекриє спільне, і поведінка почне залежати від сторінки. Ключам дають характерні імена (`header_categories`, а не `categories`) |

## Підсумок

- **Context processor** — функція `(request) -> dict`, чиї ключі стають змінними в **кожному** шаблоні автоматично.
- Розв'язує **дублювання**: наскрізні дані (меню, кошик, рік) описуєш один раз, а не в кожній view.
- **Два кроки:** функція в `app/context_processors.py` + рядок `app.context_processors.функція` у `TEMPLATES['OPTIONS']['context_processors']`.
- Вбудовані — `request`, `auth` (звідси `user` і `perms`), `messages`; твої processor'и працюють так само.
- Реальний приклад shop-app: `catalog/context_processors.py` → `header_categories` дає меню категорій у шапці.
- **Нюанс:** виконується на кожен запит — жодних важких запитів; для важкого — кешуй.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/templates/api/" target="_blank" rel="noopener">Template API <i class="bi bi-box-arrow-up-right"></i></a></div></div>
