# Автентифікація

Django містить готову систему автентифікації: модель користувача, хешування паролів, сесії та декоратори доступу. Урок проходить повний цикл — створення користувача, вхід, доступ до `request.user`, захист сторінок і вихід.

## Модель User

> **`User`** — вбудована модель користувача Django (`from django.contrib.auth.models import User`). У ній уже є поля `username`, `password` (зберігається як **хеш**), `email`, `first_name`, `last_name`, `is_active`, `is_staff`, `is_superuser`, дати `date_joined` і `last_login`.

Тобі не треба описувати таблицю користувачів — вона вже є після першої `migrate`. Створити суперкористувача можна командою `python manage.py createsuperuser`.

```python
# python manage.py shell
from django.contrib.auth.models import User

# дістати користувача, як будь-яку модель
author = User.objects.get(username='olena')
staff = User.objects.filter(is_staff=True)
```

Корисні прапорці:

| Поле | Означає |
|---|---|
| `is_active` | акаунт не заблокований |
| `is_staff` | має доступ до адмінки |
| `is_superuser` | має всі права |

> <i class="bi bi-info-circle"></i> Django дозволяє замінити `User` на власну модель (`AUTH_USER_MODEL`), якщо потрібні свої поля. Для навчальних проєктів достатньо стандартної. Але звертайся до неї через `get_user_model()`, якщо пишеш перевикористовуваний код.

## User.objects.create_user() — правильне створення користувача

> **`User.objects.create_user(username, email, password)`** — створює користувача **з хешуванням пароля**.

Ключова відмінність від звичайного `create()`: `create_user` пропускає пароль через хеш-функцію перед збереженням.

```python
# accounts/views.py
from django.contrib.auth.models import User

user = User.objects.create_user(
    username='reviewer',
    email='reviewer@kino.ua',
    password='secret123',      # збережеться як хеш, не відкритим текстом
)
```

Якщо користувач уже існує, а пароль треба **змінити** — використовуй `set_password()`:

```python
# accounts/views.py
user.set_password('new-pass')   # хешує новий пароль
user.save()                     # ОБОВ'ЯЗКОВО зберегти
```

> <i class="bi bi-exclamation-triangle"></i> **Не створюй користувача через `User.objects.create(password='...')`.** Так пароль запишеться в базу **відкритим текстом**, і `authenticate()` ніколи не спрацює. Для паролів завжди `create_user()` (або `set_password()` + `save()`).

Хешування — це вимога безпеки: навіть якщо базу вкрадуть, паролі не буде видно. Django бере цю відповідальність на себе, якщо ти користуєшся правильним методом.

## authenticate() — перевірка облікових даних

> **`authenticate(request, username=..., password=...)`** — функція, яка перевіряє логін і пароль. Якщо пара правильна, повертає об'єкт `User`; якщо ні — повертає `None`.

Ти передаєш дані з форми, а Django сам порівнює пароль із **хешем** у базі (сирі паролі ніде не зберігаються):

```python
# accounts/views.py
from django.contrib.auth import authenticate

user = authenticate(request, username='reviewer', password='secret123')
if user is not None:
    ...  # дані вірні
else:
    ...  # логін або пароль неправильні
```

`authenticate()` лише **звіряє** дані — вона ще не відкриває сесію. Це окремий крок навмисно: перевірка і вхід розділені, щоб між ними можна було вставити свою логіку (наприклад, заблокувати неактивного користувача).

## login() та logout() — керування сесією

> **`login(request, user)`** — відкриває сесію: записує, що цей користувач тепер увійшов.
> **`logout(request)`** — закриває сесію й очищає її дані.

Типова зв'язка «перевірити → впустити» на прикладі входу до кінопорталу:

```python
# accounts/views.py
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import redirect, render


def login_view(request):
    if request.method == 'POST':
        user = authenticate(
            request,
            username=request.POST['username'],
            password=request.POST['password'],
        )
        if user is not None:
            login(request, user)          # відкрили сесію
            return redirect('movie_list')
        # інакше — форма з помилкою
        return render(request, 'accounts/login.html', {'error': 'Невірні дані'})
    return render(request, 'accounts/login.html')

def logout_view(request):
    logout(request)                       # закрили сесію
    return redirect('home')
```

Після `login()` Django сам покладе ідентифікатор користувача в сесію та підпише куку. Далі на кожному запиті фреймворк відновлюватиме користувача автоматично — тобі більше нічого робити не треба.

> <i class="bi bi-info-circle"></i> Після `login()` і `logout()` майже завжди йде `redirect` (патерн Post/Redirect/Get). Це запобігає повторному надсиланню форми, якщо користувач оновить сторінку.

**Реєстрація = створення + одразу вхід.** Щоб не змушувати щойно зареєстрованого користувача входити повторно:

```python
# accounts/views.py
def register(request):
    if request.method == 'POST':
        user = User.objects.create_user(
            username=request.POST['username'],
            email=request.POST['email'],
            password=request.POST['password'],
        )
        login(request, user)              # одразу впускаємо
        return redirect('home')
    return render(request, 'accounts/register.html')
```

## request.user та is_authenticated

`request.user` — це об'єкт користувача, доступний **у кожному** view та шаблоні. Атрибут `request.user.is_authenticated` каже, чи це реальний увійшлий користувач.

Django кладе `request.user` автоматично (через `AuthenticationMiddleware`). Якщо гість не увійшов — там буде спеціальний `AnonymousUser`, у якого `is_authenticated == False`:

```python
# cinema/views.py
def my_reviews(request):
    if request.user.is_authenticated:
        reviews = Review.objects.filter(author=request.user)   # відгуки саме цього юзера
        return render(request, 'accounts/my_reviews.html', {'reviews': reviews})
    return redirect('login')
```

У шаблоні `user` доступний без передавання в контекст:

```html
{# templates/_layouts/header.html #}
{% if user.is_authenticated %}
  Привіт, {{ user.username }}! <a href="{% url 'logout' %}">Вийти</a>
{% else %}
  <a href="{% url 'login' %}">Увійти</a>
{% endif %}
```

> <i class="bi bi-exclamation-triangle"></i> `is_authenticated` — це **атрибут**, а не метод. Не став дужок: пиши `user.is_authenticated`, а не `user.is_authenticated()`. З дужками умова завжди буде істинною (перевірятиметься сам об'єкт-метод), і захист «зламається» непомітно.

## Звідки сторінка знає, хто ти

Питання, яке виникає майже завжди: **як окрема сторінка дізнається `user.id`, якщо ми нічого туди не передавали?** Розберемо весь ланцюжок — він пояснює й те, чому імпорт `User` тут ні до чого.

**Крок 1. Вхід.** Користувач надіслав логін і пароль, `authenticate()` їх перевірив, `login(request, user)` записав у **сесію** на сервері рядок «ця сесія належить користувачу №7».

**Крок 2. Cookie.** У відповідь браузер отримав cookie `sessionid` — довгий випадковий рядок. Це просто ключ від комірки: жодного імені чи `user_id` у ньому немає.

**Крок 3. Наступний запит.** Браузер сам додає цю cookie **до кожного** запиту на цей сайт — до сторінки каталогу, до AJAX-запиту, до завантаження форми.

**Крок 4. Middleware.** Тут і відбувається магія, ще до того, як почне працювати твоя view:

```
запит із cookie sessionid
   ↓
SessionMiddleware        → знаходить сесію за ключем, кладе request.session
   ↓
AuthenticationMiddleware → бачить у сесії id користувача, робить запит до БД
                           і кладе готовий об'єкт у request.user
   ↓
твоя view                → request.user уже заповнений
```

**Крок 5. У view.** Тому в будь-якій view поточний користувач уже є — його не треба ні шукати, ні імпортувати:

```python
# orders/views.py
def my_orders(request):
    orders = Order.objects.filter(user=request.user)      # user.id усередині
    return render(request, 'orders/my.html', {'orders': orders})
```

**Крок 6. У шаблоні.** Змінна `{{ user }}` є в кожному шаблоні, бо її додає context processor `django.contrib.auth.context_processors.auth` зі списку в `settings.py`. Саме тому шапка сайту знає ім'я користувача, хоча жодна view її туди не передавала.

> <i class="bi bi-pin-angle"></i> **Головне непорозуміння.** `from django.contrib.auth.models import User` потрібен, щоб **робити запити до таблиці користувачів** (`User.objects.filter(...)`, `ForeignKey(User, ...)`). До поточного користувача цей імпорт не має жодного стосунку: він приходить сам, у `request.user`, завдяки middleware.

У cookie немає ні імені, ні прав: це лише випадковий ключ до запису на сервері. Тому підмінити його й «стати» іншим користувачем не вийде — сервер звіряє ключ зі своїм сховищем сесій, а сам ключ підписаний.

Три наслідки, які варто пам'ятати:

- **Це працює й для AJAX.** Браузер додає cookie і до фонових запитів, тож у AJAX-в'ю `request.user` теж заповнений. Передавати `user_id` у `data` не треба — і не можна, бо це підробляється.
- **Немає cookie — немає користувача.** Очистила cookie, відкрила вікно в режимі анонімного перегляду, зайшла з іншого браузера — там `request.user` буде `AnonymousUser`.
- **`logout(request)` знищує сесію** на сервері, тому наступний запит із тією самою cookie вже нікого не «впізнає».

## @login_required — захист сторінок (функції)

> **`@login_required`** — декоратор, що пускає у view лише увійшлих користувачів. Гостя він перенаправляє на сторінку входу.

Декоратор ставиться над view-функцією:

```python
# blog/views.py
from django.contrib.auth.decorators import login_required

@login_required
def write_review(request):
    # сюди потрапить лише увійшлий користувач
    return render(request, 'movies/write_review.html')
```

Тепер тобі не треба щоразу писати `if request.user.is_authenticated` — декоратор робить цю перевірку за тебе. Гостя він відправить на `LOGIN_URL`, дописавши `?next=...` (адресу, куди він хотів), щоб після входу повернути його назад.

## LoginRequiredMixin — захист сторінок (класи)

Для class-based views замість декоратора використовують домішку (mixin) `LoginRequiredMixin`. Її ставлять **першою** в списку батьків:

```python
# blog/views.py
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import CreateView
from .models import Order

class OrderCreateView(LoginRequiredMixin, CreateView):   # домішка ЗЛІВА
    model = Order
    fields = ['product', 'quantity', 'address']
```

> <i class="bi bi-exclamation-triangle"></i> `LoginRequiredMixin` мусить стояти **першою** в списку батьків. Якщо поставити її після `CreateView`/`ListView`, MRO (порядок пошуку методів) може «проковтнути» перевірку, і захист не спрацює. Правило: домішки-захисники йдуть **зліва**.

## Налаштування: LOGIN_URL та LOGIN_REDIRECT_URL

Дві настройки у `settings.py` керують перенаправленнями:

- **`LOGIN_URL`** — куди відсилати гостя, який спробував зайти на захищену `@login_required` сторінку. За замовчуванням `/accounts/login/`.
- **`LOGIN_REDIRECT_URL`** — куди вести користувача **після** успішного входу (якщо не вказано `next`).

```python
# config/settings.py
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'home'
```

> <i class="bi bi-info-circle"></i> Можна вказувати як URL (`/login/`), так і **ім'я маршруту** (`'login'`). Другий варіант надійніший: якщо зміниш адресу в `urls.py`, налаштування залишиться робочим.

## Де це в проєкті

Ці елементи покривають увесь життєвий цикл користувача — у будь-якому домені:

- **Реєстрація** (форум, блог) — форма → `User.objects.create_user()` → одразу `login()`.
- **Вхід** (кінопортал) — форма → `authenticate()` → `login()` → `redirect` у список фільмів.
- **Захищені сторінки** — написати відгук, оформити замовлення, кабінет автора — `@login_required` або `LoginRequiredMixin`.
- **«Мої дані»** — `Review.objects.filter(author=request.user)`, `Order.objects.filter(customer=request.user)`.
- **Вихід** — `logout()` → `redirect` на головну.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `User.objects.create(password=…)` | Пароль зберігається відкритим текстом, і `authenticate()` ніколи не спрацює. Потрібен `create_user()` |
| `set_password()` без `save()` | Новий пароль лишається лише в пам'яті об'єкта |
| `user.is_authenticated()` з дужками | Умова завжди істинна: перевіряється сам метод. Це атрибут, дужки не ставлять |
| `LoginRequiredMixin` не першим у списку батьків | Перевірка може не спрацювати через порядок успадкування; домішки-захисники ставлять зліва |
| `@login_required` на AJAX-в'ю | Замість помилки повертається редірект на сторінку входу, і в `success` приходить HTML замість JSON |
| `authenticate()` без наступного `login()` | Дані перевірені, але сесія не відкрита: наступний запит знову анонімний |
| Перевірка прав лише в шаблоні | Прихована кнопка не захищає адресу: доступ обмежують у view |
| Пряме звернення до `User` у перевикористовуваному коді | Проєкт може мати власну модель користувача; беруть `get_user_model()` або `settings.AUTH_USER_MODEL` |

## Підсумок

- **`User`** — вбудована модель; звертайся до неї як до будь-якої (`User.objects.filter(...)`), пароль зберігається **хешем**.
- Користувача створюй лише через **`create_user()`** (або `set_password()` + `save()`) — інакше пароль не захешується.
- **`authenticate()`** лише перевіряє логін і пароль та повертає `User` або `None` — сесію не відкриває.
- **`login()`** відкриває сесію, **`logout()`** закриває; після обох майже завжди `redirect`. Реєстрація = `create_user()` + одразу `login()`.
- **`request.user`** доступний усюди; **`request.user.is_authenticated`** (атрибут, без дужок) відрізняє гостя від увійшлого.
- Ланцюжок «звідки сторінка знає, хто ти»: cookie `sessionid` → `SessionMiddleware` → `AuthenticationMiddleware` → `request.user` у view → context processor `auth` → `{{ user }}` у шаблоні. Імпорт `User` потрібен лише для **запитів до таблиці** користувачів, а не для доступу до поточного.
- **`@login_required`** (для функцій) і **`LoginRequiredMixin`** (для класів, ставити зліва) захищають сторінки; `LOGIN_URL` і `LOGIN_REDIRECT_URL` керують перенаправленнями.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/auth/default/" target="_blank" rel="noopener">Using the authentication system <i class="bi bi-box-arrow-up-right"></i></a></div></div>
