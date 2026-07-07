# Повідомлення (messages framework)

Коли користувач щось зробив — опублікував статтю, ввів невірний пароль, додав товар у кошик, залишив відгук — йому треба дати зрозумілий зворотний зв'язок. Django має для цього окремий вбудований інструмент: **messages framework**. Він дозволяє передати короткочасне повідомлення з view у наступну сторінку — рівно те, що у Flask робили `flash()` і `get_flashed_messages()`. Приклади навмисно з **різних доменів** (блог, магазин, кіно, форум), щоб було видно універсальність механізму.

## Що таке одноразове повідомлення

> **`messages`** — модуль (`from django.contrib import messages`), який записує одноразове повідомлення до сесії. Воно показується на **наступній** сторінці й після цього автоматично зникає.

**Навіщо саме одноразове.** Типовий сценарій: користувач надіслав форму → ти обробив → зробив `redirect` на іншу сторінку. Звичайний контекст (`render(..., {...})`) redirect **не переживає** — після перенаправлення це вже новий запит із новим контекстом. А повідомлення кладеться в сесію, тож переживає redirect і показується вже на новій сторінці.

> <i class="bi bi-lightbulb"></i> **Аналогія.** Це як стікер-нагадування, який ти клеїш на двері наступної кімнати. Людина зайде туди, побачить записку — і вона одразу відклеїться. Другого разу той самий стікер уже не з'явиться.

## Рівні повідомлень

**Визначення.** Рівень задає **важливість** повідомлення й визначає його CSS-клас (для кольору). Django має п'ять вбудованих рівнів, кожен — окрема функція:

| Функція | Рівень | Коли застосовувати | Приклад |
|---|---|---|---|
| `messages.debug(request, ...)` | debug | лише для розробки (у production не показується) | технічна деталь |
| `messages.info(request, ...)` | info | нейтральна інформація | «Профіль ще не заповнено» |
| `messages.success(request, ...)` | success | дія вдалася | «Статтю опубліковано» |
| `messages.warning(request, ...)` | warning | попередження, але не помилка | «Залишився 1 товар на складі» |
| `messages.error(request, ...)` | error | щось пішло не так | «Невірний пароль» |

**Як це працює.** Обираєш функцію під ситуацію — з різних доменів:

```python
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
# магазин — додавання в кошик
def add_to_cart(request, product_id):
    # ... логіка кошика ...
    messages.info(request, 'Товар додано до кошика')
    return redirect('cart')

# кіно — відгук на модерацію
def submit_review(request, movie_id):
    # ... збереження відгуку ...
    messages.warning(request, 'Дякуємо! Відгук з’явиться після перевірки.')
    return redirect('movie_detail', movie_id)
```

**Навіщо.** Повідомлення «переживає» redirect: ти показуєш його вже на іншій сторінці, куди перенаправив користувача. Саме тому воно кладеться в сесію, а не просто в контекст поточного шаблону.

## Вивід повідомлень у шаблоні

**Визначення.** У шаблоні змінна `messages` містить усі повідомлення, накопичені для цього користувача. Її перебирають циклом.

**Як це працює.** Стандартний блок, який зазвичай ставлять у базовому шаблоні (`base.html`), щоб він працював на всіх сторінках:

```html
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
{% for message in messages %}
  <div class="alert alert-{{ message.tags }}">{{ message }}</div>
{% endfor %}
```

> <i class="bi bi-exclamation-triangle"></i> Одна дрібниця: рівень `error` у Django має тег `error`, а клас Bootstrap для помилки — `danger`. Якщо користуєшся Bootstrap, або перевизначай `MESSAGE_TAGS` у `settings.py` (`{messages.ERROR: 'danger'}`), або обробляй це в шаблоні.

> <i class="bi bi-info-circle"></i> Сам перебір `{% for message in messages %}` **позначає** повідомлення як прочитані. Тому достатньо вивести їх один раз у `base.html` — на наступній сторінці їх уже не буде. Дублювати блок на кожній сторінці не треба.

## Що потрібно для роботи: middleware

**Визначення.** Messages framework спирається на два middleware: **`SessionMiddleware`** (де зберігати) і **`MessageMiddleware`** (як переносити повідомлення між запитами). Плюс `django.contrib.messages` має бути в `INSTALLED_APPS`, а `messages` — у процесорах контексту шаблонів.

**Як це працює.** У проєкті, створеному через `startproject`, усе це вже налаштовано:

```python
# settings.py (усе це вже стоїть за замовчуванням)
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

## Де це в проєкті

Messages потрібні всюди, де користувач зробив дію й чекає підтвердження — у будь-якому домені:

- **Блог**: `messages.success(request, 'Статтю опубліковано')` → `redirect` на список.
- **Вхід**: `messages.error(request, 'Невірний пароль')` → назад на форму.
- **Магазин**: `messages.info(request, 'Товар додано до кошика')`.
- **Форум / кіно**: `messages.warning(request, 'Відгук на модерації')`.
- Загальний конвеєр майже завжди однаковий: **дія → `messages.*` → `redirect`**.

## Паралель із Flask

Якщо ти працювала з Clinic-app, ця тема тобі знайома — це прямий аналог flash-повідомлень Flask:

| Дія | Flask (Clinic-app) | Django |
|---|---|---|
| Додати повідомлення | `flash('текст', 'success')` | `messages.success(request, 'текст')` |
| Отримати в шаблоні | `get_flashed_messages(with_categories=True)` | змінна `messages` (сама доступна) |
| Категорія / рівень | другий аргумент `flash` | окрема функція (`success`/`error`/…) |
| Зберігається в | сесії | сесії |

Головна відмінність: у Flask ти обираєш категорію рядком-аргументом, а в Django — **вибором функції** (`success`, `error`, `info`, `warning`, `debug`). Суть та сама: одноразове повідомлення, що переживає redirect.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Прибраний `MessageMiddleware` або процесор контексту** → повідомлення не показуються. У стандартному `settings.py` вони вже стоять — не чіпай.

> <i class="bi bi-exclamation-triangle"></i> **Bootstrap `danger` ≠ Django `error`** → червоні повідомлення не фарбуються. Перевизнач `MESSAGE_TAGS` або обробляй у шаблоні.

> <i class="bi bi-info-circle"></i> Не рендери блок повідомлень на кожній сторінці — перебір позначає їх прочитаними. Один блок у `base.html` — і достатньо.

## Підсумок

- **Messages framework** передає одноразове повідомлення з view на наступну сторінку — прямий аналог `flash()` з Flask; переживає `redirect` завдяки сесії.
- П'ять рівнів: **`debug` / `info` / `success` / `warning` / `error`**; додаєш через `messages.<рівень>(request, 'текст')`, зазвичай **перед `redirect`**.
- У шаблоні перебираєш `{% for message in messages %}`; **`message.tags`** дає CSS-клас за рівнем, `{{ message }}` — текст.
- Потрібні `SessionMiddleware`, **`MessageMiddleware`** і процесор контексту `messages` — у стандартному `settings.py` вони вже стоять.
- Перебір повідомлень позначає їх прочитаними, тож достатньо вивести блок один раз у `base.html`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/contrib/messages/" target="_blank" rel="noopener">Messages framework <i class="bi bi-box-arrow-up-right"></i></a></div></div>
