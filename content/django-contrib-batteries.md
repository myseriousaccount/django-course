# django.contrib — батарейки як apps

У першому уроці ми назвали Django фреймворком «batteries included». Тепер, коли ти розумієш, що таке **app**, можна побачити головне архітектурне відкриття: **самі «батарейки» — це теж apps**. Вони влаштовані рівно так само, як твої `blog` чи `shop`. Розберемо кожну основну contrib-app і що вона дає з коробки. Приклади — з **різних доменів** (блог, магазин, бібліотека, кіно).

## Подивись на INSTALLED_APPS уважніше

**Як це працює.** Вбудовані можливості й твої модулі живуть в одному списку:

```python
INSTALLED_APPS = [
    'django.contrib.admin',        # ┐
    'django.contrib.auth',         # │ це теж apps —
    'django.contrib.contenttypes', # │ просто написані
    'django.contrib.sessions',     # │ командою Django
    'django.contrib.messages',     # │
    'django.contrib.staticfiles',  # ┘
    'blog',                        # ┐ твої apps —
    'shop',                        # ┘ за тим самим принципом
]
```

Верхні шість — це вбудовані apps з пакета `django.contrib`. Вони в тому самому списку, що й твої модулі, бо архітектурно **нічим не відрізняються**: мають свої моделі, міграції, шаблони. Різниця лише в тому, що їх написала команда Django, а не ти.

> <i class="bi bi-lightbulb"></i> Велика ідея: у Django **немає «ядра» й «надбудови»**. Адмінка, користувачі, сесії — не вшиті десь глибоко, а підключені як звичайні apps. Тому їх можна вмикати/вимикати рядком у `INSTALLED_APPS`. Хочеш сайт без сесій — прибрав рядок.

## Що дає кожна батарейка

| App | Що дає з коробки |
|---|---|
| `django.contrib.admin` | готова адмін-панель на `/admin` |
| `django.contrib.auth` | користувачі, групи, паролі, логін/логаут, права |
| `django.contrib.contenttypes` | службовий — облік усіх моделей проєкту |
| `django.contrib.sessions` | сесії (`request.session`) |
| `django.contrib.messages` | flash-повідомлення між запитами |
| `django.contrib.staticfiles` | тег `{% static %}`, `collectstatic` |

Пройдемо по кожній докладніше.

## auth — користувачі, паролі, права

**Визначення.** `django.contrib.auth` — система автентифікації: модель `User`, хешування паролів, вхід/вихід, групи й права доступу.

**Як це працює.** Те, що у Flask ти збирала вручну (Flask-Login, хешування, форми логіну), у Django вже готове:

```python
from django.contrib.auth import authenticate, login, logout

# перевірити пару логін/пароль (хешування — усередині)
user = authenticate(request, username='olena', password='secret')
if user:
    login(request, user)        # сесію відкрито, request.user заповнено
```

Захистити view для авторизованих — один декоратор (FBV) або міксин (CBV):

```python
# blog/views.py
from django.contrib.auth.decorators import login_required

@login_required
def create_post(request):
    ...        # неавторизованого перекине на сторінку логіну
```

```python
# shop/views.py
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import CreateView

class ProductCreate(LoginRequiredMixin, CreateView):
    model = Product
    fields = ['name', 'price']
```

## admin — панель керування даними

**Визначення.** `django.contrib.admin` — готовий CRUD-інтерфейс для твоїх моделей на `/admin`, без жодного HTML чи view.

**Як це працює.** Щоб модель з'явилась в адмінці, її реєструють:

```python
# library/admin.py
from django.contrib import admin
from .models import Book

@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'copies_left')  # колонки в списку
    search_fields = ('title', 'author')                # поле пошуку
    list_filter = ('genre',)                           # фільтри збоку
```

Після `createsuperuser` і логіну на `/admin` ти отримуєш повноцінне керування книгами — **без жодного HTML чи view**. Це і є «batteries included» у дії.

> <i class="bi bi-lightbulb"></i> admin спирається на **auth** (треба залогінитись) і на **contenttypes** (щоб знати всі моделі). Батарейки працюють у зв'язці — саме тому кілька рядків у `INSTALLED_APPS` йдуть разом.

## sessions — пам'ять між запитами

**Визначення.** `django.contrib.sessions` — механізм, що зберігає дані користувача між запитами через `request.session`.

**Як це працює.** HTTP не пам'ятає попередніх запитів; сесія додає цю пам'ять. Класичний приклад — кошик у магазині:

```python
# shop/views.py
def add_to_cart(request, product_id):
    cart = request.session.get('cart', [])
    cart.append(product_id)
    request.session['cart'] = cart      # збережеться до наступного запиту
    return redirect('shop:list')
```

Саме на сесіях тримається й `login()` з auth — тому auth і sessions зазвичай ідуть разом.

## messages — flash-повідомлення

**Визначення.** `django.contrib.messages` — одноразові повідомлення, що «переживають» редірект і показуються на наступній сторінці.

**Як це працює.** Ідеально для патерну Post/Redirect/Get — сказати «Збережено!» після редіректу:

```python
# movies/views.py
from django.contrib import messages

def add_review(request, movie_id):
    ...
    messages.success(request, 'Дякуємо за рецензію!')
    return redirect('movies:detail', pk=movie_id)
```

А в шаблоні (зазвичай у базовому) показуєш чергу повідомлень:

```html
{% for message in messages %}
  <div class="alert alert-{{ message.tags }}">{{ message }}</div>
{% endfor %}
```

Рівні: `messages.success`, `.info`, `.warning`, `.error` — теги лягають у CSS-клас.

## staticfiles — статика (CSS, JS, зображення)

**Визначення.** `django.contrib.staticfiles` — керує статичними файлами: дає тег `{% static %}` і команду `collectstatic` для продакшену.

**Як це працює.** Замість зашивати шлях, будуєш його тегом:

```html
{% load static %}
<link rel="stylesheet" href="{% static 'blog/style.css' %}">
<img src="{% static 'library/logo.png' %}">
```

## contenttypes — облік усіх моделей

**Визначення.** `django.contrib.contenttypes` — службова app, що веде реєстр усіх моделей проєкту. Сама по собі UI не дає.

**Як це працює.** Її використовують admin, auth (система прав) і «узагальнені зв'язки» (generic relations) — наприклад, коли коментар має вміти прикріплятись і до поста блогу, і до фільму. Ти рідко звертаєшся до неї напряму, але вона потрібна іншим батарейкам — тому стоїть у списку за замовчуванням.

## Як батарейки пов'язані з тим, що ти вже вивчила

Багато «магії» з попередніх уроків — це насправді робота цих apps:

- `request.user` (урок про middleware) → дає **auth**.
- `request.session` → дає **sessions**.
- `{% static %}` (урок про статику) → дає **staticfiles**.
- маршрут `path('admin/', admin.site.urls)` у `root/urls.py` → це підключення app **admin**.

Тобто батарейки — не абстракція, ти вже користувалась ними, не помічаючи.

## Можна додавати й «зовнішні батарейки»

**Як це працює.** Спільнота пише власні apps, які встановлюються як пакети і так само додаються в `INSTALLED_APPS`:

```python
# після pip install ...
INSTALLED_APPS = [
    ...
    'rest_framework',     # Django REST Framework — API
    'django_extensions',  # корисні команди
]
```

Принцип той самий: встановив → додав рядок → користуєшся. Уся екосистема Django побудована на цьому однаковому механізмі app.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Прибрала рядок «щоб не заважав»** — батарейки залежні: приберешь `contenttypes` чи `auth`, і `admin` зламається. Не чіпай стандартний набір без потреби.

> <i class="bi bi-exclamation-triangle"></i> **`messages` без відображення** — якщо додаєш `messages.success(...)`, але в базовому шаблоні немає циклу `{% for message in messages %}`, користувач нічого не побачить.

> <i class="bi bi-exclamation-triangle"></i> **Пряме звертання до `User` через import** — краще `get_user_model()`, бо в проєкті модель користувача можуть замінити на власну. Це зробить код стійким до кастомного `User`.

> <i class="bi bi-info-circle"></i> `staticfiles` у розробці роздає файли сам, а на продакшені треба `collectstatic` + окремий вебсервер/сховище. У навчальному проєкті про це можна поки не думати.

## Підсумок

- Вбудовані можливості Django (`admin`, `auth`, `contenttypes`, `sessions`, `messages`, `staticfiles`) — це **звичайні apps** у `INSTALLED_APPS`, не окреме «ядро».
- **auth** — користувачі/паролі/права (`login_required`, `LoginRequiredMixin`); **admin** — готовий CRUD на `/admin`; **sessions** — пам'ять між запитами (`request.session`); **messages** — flash-повідомлення; **staticfiles** — `{% static %}`; **contenttypes** — службовий реєстр моделей.
- Батарейки залежні одна від одної (admin спирається на auth + contenttypes) — тому йдуть набором.
- Багато «магії» (`request.user`, `request.session`, `{% static %}`, `/admin`) — це робота цих apps.
- Зовнішні бібліотеки (DRF тощо) підключаються тим самим способом: `pip install` → рядок у `INSTALLED_APPS`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">ÐÑÑÑÑÐ¹Ð½Ð° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°ÑÑÑ</span><a href="https://docs.djangoproject.com/en/stable/ref/contrib/" target="_blank" rel="noopener">contrib packages <i class="bi bi-box-arrow-up-right"></i></a></div></div>
