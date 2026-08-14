# Повідомлення

Messages framework передає короткочасне повідомлення з view на наступну сторінку. Воно зберігається в сесії, тому переживає `redirect` і показується користувачу рівно один раз.

## Що таке одноразове повідомлення

> **`messages`** — модуль (`from django.contrib import messages`), який записує одноразове повідомлення до сесії. Воно показується на **наступній** сторінці й після цього автоматично зникає.

Типовий сценарій: користувач надіслав форму → ти обробив → зробив `redirect` на іншу сторінку. Звичайний контекст (`render(..., {...})`) redirect **не переживає** — після перенаправлення це вже новий запит із новим контекстом. А повідомлення кладеться в сесію, тож переживає redirect і показується вже на новій сторінці.

## Рівні повідомлень

Рівень задає **важливість** повідомлення й визначає його CSS-клас (для кольору). Django має п'ять вбудованих рівнів, кожен — окрема функція:

| Функція | Рівень | Коли застосовувати | Приклад |
|---|---|---|---|
| `messages.debug(request, ...)` | debug | лише для розробки (у production не показується) | технічна деталь |
| `messages.info(request, ...)` | info | нейтральна інформація | «Профіль ще не заповнено» |
| `messages.success(request, ...)` | success | дія вдалася | «Статтю опубліковано» |
| `messages.warning(request, ...)` | warning | попередження, але не помилка | «Залишився 1 товар на складі» |
| `messages.error(request, ...)` | error | щось пішло не так | «Невірний пароль» |

Обираєш функцію під ситуацію — з різних доменів:

```python
# приклади виклику з різних застосунків
from django.contrib import messages

messages.success(request, 'Статтю опубліковано')          # блог
messages.error(request, 'Невірний логін або пароль')       # вхід
messages.info(request, 'Товар уже у вашому кошику')         # магазин
messages.warning(request, 'Ваш відгук чекає на модерацію')  # кіно / форум
```

> <i class="bi bi-info-circle"></i> `debug` за замовчуванням не показується: рівень видимості керується налаштуванням `MESSAGE_LEVEL` (типово — `INFO`, тому все від `info` й вище видно). Змінювати його майже ніколи не треба.

## Як додати повідомлення у view

Типовий сценарій — повідомлення **перед** `redirect`:

```python
# blog/views.py
from django.contrib import messages
from django.shortcuts import redirect


def publish_article(request, pk):
    article = get_object_or_404(Article, pk=pk)
    article.is_published = True
    article.save()
    messages.success(request, f'Статтю «{article.title}» опубліковано')
    return redirect('article_list')     # повідомлення покажеться вже там
```

Ще приклади з інших доменів:

```python
# carts/views.py
def add_to_cart(request, product_id):
    # ... логіка кошика ...
    messages.info(request, 'Товар додано до кошика')
    return redirect('cart')
```

```python
# cinema/views.py
def submit_review(request, movie_id):
    # ... збереження відгуку ...
    messages.warning(request, 'Дякуємо! Відгук з’явиться після перевірки.')
    return redirect('movie_detail', movie_id)
```

Повідомлення «переживає» redirect: ти показуєш його вже на іншій сторінці, куди перенаправив користувача. Саме тому воно кладеться в сесію, а не просто в контекст поточного шаблону.

## Вивід повідомлень у шаблоні

У шаблоні змінна `messages` містить усі повідомлення, накопичені для цього користувача. Її перебирають циклом.

Стандартний блок, який зазвичай ставлять у базовому шаблоні (`base.html`), щоб він працював на всіх сторінках:

```html
{# templates/_layouts/base.html #}
{% if messages %}
  <ul class="messages">
    {% for message in messages %}
      <li class="{{ message.tags }}">{{ message }}</li>
    {% endfor %}
  </ul>
{% endif %}
```

Кожне `message` має корисні атрибути:

| Атрибут | Що дає | Приклад |
|---|---|---|
| `{{ message }}` | сам текст повідомлення | `Статтю опубліковано` |
| `message.tags` | CSS-клас за рівнем | `success`, `error`, `warning` |
| `message.level` | числовий код рівня | `25` (success) |
| `message.level_tag` | назва рівня рядком | `success` |

Атрибут **`message.tags`** зручно поєднати зі стилями, наприклад Bootstrap:

```html
{# templates/_layouts/base.html #}
{% for message in messages %}
  <div class="alert alert-{{ message.tags }}">{{ message }}</div>
{% endfor %}
```

> <i class="bi bi-exclamation-triangle"></i> Одна дрібниця: рівень `error` у Django має тег `error`, а клас Bootstrap для помилки — `danger`. Якщо користуєшся Bootstrap, або перевизначай `MESSAGE_TAGS` у `settings.py` (`{messages.ERROR: 'danger'}`), або обробляй це в шаблоні.

> <i class="bi bi-info-circle"></i> Сам перебір `{% for message in messages %}` **позначає** повідомлення як прочитані. Тому достатньо вивести їх один раз у `base.html` — на наступній сторінці їх уже не буде. Дублювати блок на кожній сторінці не треба.

## Що потрібно для роботи: middleware

Messages framework спирається на два middleware: **`SessionMiddleware`** (де зберігати) і **`MessageMiddleware`** (як переносити повідомлення між запитами). Плюс `django.contrib.messages` має бути в `INSTALLED_APPS`, а `messages` — у процесорах контексту шаблонів.

У проєкті, створеному через `startproject`, усе це вже налаштовано:

```python
# config/settings.py — усе це вже стоїть за замовчуванням
INSTALLED_APPS = [
    'django.contrib.messages',
    ...
]

MIDDLEWARE = [
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    ...
]

TEMPLATES = [{
    'OPTIONS': {'context_processors': [
        'django.contrib.messages.context_processors.messages',  # робить `messages` доступним у шаблоні
        ...
    ]},
}]
```

Тобто **нічого налаштовувати не треба** — інструмент готовий одразу.

> <i class="bi bi-exclamation-triangle"></i> Якщо ти колись правила `settings.py` вручну й прибрала `MessageMiddleware` або процесор контексту — повідомлення просто перестануть показуватись (або з'явиться помилка контексту). У такому разі поверни рядок `'django.contrib.messages.middleware.MessageMiddleware'` до `MIDDLEWARE` і процесор `messages` — до `TEMPLATES`.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Повідомлення додано, але в шаблоні немає циклу | Користувач нічого не бачить; блок виводу ставлять один раз у базовому шаблоні |
| Блок виводу продубльовано на кількох шаблонах | Перебір позначає повідомлення прочитаними, тому другий блок лишиться порожнім |
| Клас `alert-error` у Bootstrap | Bootstrap очікує `danger`; або перевизнач `MESSAGE_TAGS`, або зістав класи в шаблоні |
| `messages.debug()` у робочому коді | За замовчуванням не показується через `MESSAGE_LEVEL` |
| `render` замість `redirect` після додавання повідомлення | Повідомлення з'явиться лише при наступному переході; штатний порядок — дія, повідомлення, `redirect` |
| Прибрано `MessageMiddleware` або процесор контексту | Повідомлення перестають показуватися або рендер падає з помилкою контексту |
| Повідомлення для AJAX-запиту | Воно осідає в сесії й спливе на наступній звичайній сторінці; для AJAX текст повертають у `JsonResponse` |

## Підсумок

- **Messages framework** передає одноразове повідомлення з view на наступну сторінку; воно переживає `redirect`, бо зберігається в сесії.
- П'ять рівнів: **`debug` / `info` / `success` / `warning` / `error`**; додаєш через `messages.<рівень>(request, 'текст')`, зазвичай **перед `redirect`**.
- У шаблоні перебираєш `{% for message in messages %}`; **`message.tags`** дає CSS-клас за рівнем, `{{ message }}` — текст.
- Потрібні `SessionMiddleware`, **`MessageMiddleware`** і процесор контексту `messages` — у стандартному `settings.py` вони вже стоять.
- Перебір повідомлень позначає їх прочитаними, тож достатньо вивести блок один раз у `base.html`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/contrib/messages/" target="_blank" rel="noopener">Messages framework <i class="bi bi-box-arrow-up-right"></i></a></div></div>
