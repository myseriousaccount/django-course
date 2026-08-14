# Вбудовані застосунки (django.contrib)

Частина можливостей Django — адміністративна панель, користувачі, сесії, повідомлення — оформлена не як внутрішнє ядро фреймворку, а як звичайні застосунки в пакеті `django.contrib`. Вони підключаються тим самим способом, що й твої власні, і за тими самими правилами.

## Застосунок, модуль і бібліотека — різні речі

Терміни легко переплутати, бо все це «код, який ти не писала». Різниця в тому, чи Django має його зареєструвати.

| Поняття | Що це | Як потрапляє в проєкт | Приклад |
|---|---|---|---|
| **Модуль** (він же бібліотека) | набір функцій і класів | звичайний `import` | `django.shortcuts`, `django.urls`, `django.core.validators` |
| **Застосунок (app)** | пакет із власними моделями, міграціями, шаблонами, адмінкою, тегами | рядок в `INSTALLED_APPS` | `django.contrib.auth`, `blog`, `catalog` |
| **Бібліотека тегів** | модуль із тегами й фільтрами шаблонів | `{% load %}` у шаблоні | `shop_extras`, вбудований `static` |

Критерій простий: якщо код лише імпортується й одразу працює — це модуль. Якщо Django мусить знайти в ньому моделі, застосувати міграції, підхопити шаблони чи зареєструвати щось в адмінці — це застосунок, і його треба оголосити в `INSTALLED_APPS`.

Тому `django.contrib.auth` — застосунок: у ньому є моделі `User`, `Group`, `Permission` і міграції, які створюють відповідні таблиці. Приберіть його зі списку — і таблиць не буде, а `request.user` перестане працювати. А `django.shortcuts` — модуль: у ньому лише функції `render`, `redirect`, `get_object_or_404`, реєструвати нічого не треба.

> <i class="bi bi-info-circle"></i> Карта модулів, що звідки імпортувати (`db`, `urls`, `http`, `forms`, `core`, `utils`), — в уроці «Карта модулів Django». Цей урок — про другу категорію, застосунки.

## Один список для вбудованих і власних

```python
# root/settings.py
INSTALLED_APPS = [
    'django.contrib.admin',         # ┐
    'django.contrib.auth',          # │ вбудовані застосунки:
    'django.contrib.contenttypes',  # │ влаштовані так само,
    'django.contrib.sessions',      # │ просто написані
    'django.contrib.messages',      # │ командою Django
    'django.contrib.staticfiles',   # ┘
    'blog',                         # ┐ власні застосунки
    'shop',                         # ┘ проєкту
]
```

Архітектурно вони не відрізняються: мають моделі, міграції, шаблони, свої теги. Наслідок — у Django немає поділу на «ядро» й «надбудову»: непотрібний застосунок вимикається видаленням рядка, а не патчем фреймворку.

## Що дає кожен вбудований застосунок

| App | Що дає з коробки |
|---|---|
| `django.contrib.admin` | готова адмін-панель на `/admin` |
| `django.contrib.auth` | користувачі, групи, паролі, логін/логаут, права |
| `django.contrib.contenttypes` | службовий — облік усіх моделей проєкту |
| `django.contrib.sessions` | сесії (`request.session`) |
| `django.contrib.messages` | flash-повідомлення між запитами |
| `django.contrib.staticfiles` | тег `{% static %}`, `collectstatic` |

Далі — по кожному окремо.

## auth — користувачі, паролі, права

`django.contrib.auth` — система автентифікації: модель `User`, хешування паролів, вхід/вихід, групи й права доступу.

Те, що у Flask ти збирала вручну (Flask-Login, хешування, форми логіну), у Django вже готове:

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

`django.contrib.admin` — готовий CRUD-інтерфейс для твоїх моделей на `/admin`, без жодного HTML чи view.

Щоб модель з'явилась в адмінці, її реєструють:

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

`django.contrib.sessions` — механізм, що зберігає дані користувача між запитами через `request.session`.

HTTP не пам'ятає попередніх запитів; сесія додає цю пам'ять. Класичний приклад — кошик у магазині:

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

`django.contrib.messages` — одноразові повідомлення, що «переживають» редірект і показуються на наступній сторінці.

Ідеально для патерну Post/Redirect/Get — сказати «Збережено!» після редіректу:

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

`django.contrib.staticfiles` — керує статичними файлами: дає тег `{% static %}` і команду `collectstatic` для продакшену.

Замість зашивати шлях, будуєш його тегом:

```html
{% load static %}
<link rel="stylesheet" href="{% static 'blog/style.css' %}">
<img src="{% static 'library/logo.png' %}">
```

## contenttypes — облік усіх моделей

`django.contrib.contenttypes` — службова app, що веде реєстр усіх моделей проєкту. Сама по собі UI не дає.

Її використовують admin, auth (система прав) і «узагальнені зв'язки» (generic relations) — наприклад, коли коментар має вміти прикріплятись і до поста блогу, і до фільму. Ти рідко звертаєшся до неї напряму, але від неї залежать інші вбудовані застосунки — тому вона стоїть у списку за замовчуванням.

## Де вони вже працювали

Багато «магії» з попередніх уроків — це насправді робота цих apps:

- `request.user` (урок про middleware) → дає **auth**.
- `request.session` → дає **sessions**.
- `{% static %}` (урок про статику) → дає **staticfiles**.
- маршрут `path('admin/', admin.site.urls)` у `root/urls.py` → це підключення app **admin**.

Тобто вбудовані застосунки вже працювали в проєкті — просто через звичні `request.user`, `request.session` і `{% static %}`.

## Сторонні застосунки

Спільнота пише власні apps, які встановлюються як пакети і так само додаються в `INSTALLED_APPS`:

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

| Що не так | Наслідок і як правильно |
|---|---|
| Видалити рядок з `INSTALLED_APPS` «щоб не заважав» | Застосунки залежні один від одного: без `contenttypes` чи `auth` перестане працювати `admin`. Стандартний набір прибирають лише свідомо |
| `messages.success(...)` без виведення в шаблоні | Повідомлення додається, але користувач його не бачить: у базовому шаблоні потрібен цикл `{% for message in messages %}` |
| Прямий імпорт `User` у коді проєкту | Якщо модель користувача заміниться на власну, код зламається. Стійкий варіант — `get_user_model()` у коді й `settings.AUTH_USER_MODEL` у полях моделей |
| Розраховувати, що `staticfiles` роздасть файли й на продакшені | У розробці він роздає статику сам, на бойовому сервері потрібні `collectstatic` і окремий вебсервер або сховище |

## Підсумок

- Вбудовані можливості Django (`admin`, `auth`, `contenttypes`, `sessions`, `messages`, `staticfiles`) — це **звичайні apps** у `INSTALLED_APPS`, не окреме «ядро».
- **auth** — користувачі/паролі/права (`login_required`, `LoginRequiredMixin`); **admin** — готовий CRUD на `/admin`; **sessions** — пам'ять між запитами (`request.session`); **messages** — flash-повідомлення; **staticfiles** — `{% static %}`; **contenttypes** — службовий реєстр моделей.
- Батарейки залежні одна від одної (admin спирається на auth + contenttypes) — тому йдуть набором.
- Багато «магії» (`request.user`, `request.session`, `{% static %}`, `/admin`) — це робота цих apps.
- Зовнішні бібліотеки (DRF тощо) підключаються тим самим способом: `pip install` → рядок у `INSTALLED_APPS`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/contrib/" target="_blank" rel="noopener">contrib packages <i class="bi bi-box-arrow-up-right"></i></a></div></div>
