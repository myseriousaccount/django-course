# Автентифікація: login, logout, @login_required

Майже кожен реальний проєкт рано чи пізно ставить питання «а хто це до нас прийшов?». Django відповідає на нього готовою системою автентифікації — тобі не треба вручну хешувати паролі, зберігати сесії чи перевіряти доступ. У цьому уроці ми зберемо повний цикл: створення користувача → вхід → доступ до `request.user` → захист сторінок → вихід. Приклади навмисно з **різних доменів** (блог, кінопортал, інтернет-магазин, форум), щоб ти бачила: автентифікація — універсальний шар, а не частина конкретного проєкту.

## Модель User

> **`User`** — вбудована модель користувача Django (`from django.contrib.auth.models import User`). У ній уже є поля `username`, `password` (зберігається як **хеш**), `email`, `first_name`, `last_name`, `is_active`, `is_staff`, `is_superuser`, дати `date_joined` і `last_login`.

**Як це працює.** Тобі не треба описувати таблицю користувачів — вона вже є після першої `migrate`. Створити суперкористувача можна командою `python manage.py createsuperuser`.

```python
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

**Як це працює.** Ключова відмінність від звичайного `create()`: `create_user` пропускає пароль через хеш-функцію перед збереженням.

```python
from django.contrib.auth.models import User

user = User.objects.create_user(
    username='reviewer',
    email='reviewer@kino.ua',
    password='secret123',      # збережеться як хеш, не відкритим текстом
)
```

Якщо користувач уже існує, а пароль треба **змінити** — використовуй `set_password()`:

```python
user.set_password('new-pass')   # хешує новий пароль
user.save()                     # ОБОВ'ЯЗКОВО зберегти
```

> <i class="bi bi-exclamation-triangle"></i> **Не створюй користувача через `User.objects.create(password='...')`.** Так пароль запишеться в базу **відкритим текстом**, і `authenticate()` ніколи не спрацює. Для паролів завжди `create_user()` (або `set_password()` + `save()`).

**Навіщо.** Хешування — це вимога безпеки: навіть якщо базу вкрадуть, паролі не буде видно. Django бере цю відповідальність на себе, якщо ти користуєшся правильним методом.

## authenticate() — перевірка облікових даних

> **`authenticate(request, username=..., password=...)`** — функція, яка перевіряє логін і пароль. Якщо пара правильна, повертає об'єкт `User`; якщо ні — повертає `None`.

**Як це працює.** Ти передаєш дані з форми, а Django сам порівнює пароль із **хешем** у базі (сирі паролі ніде не зберігаються):

```python
from django.contrib.auth import authenticate

user = authenticate(request, username='reviewer', password='secret123')
if user is not None:
    ...  # дані вірні
else:
    ...  # логін або пароль неправильні
```

**Навіщо.** `authenticate()` лише **звіряє** дані — вона ще не відкриває сесію. Це окремий крок навмисно: перевірка і вхід розділені, щоб між ними можна було вставити свою логіку (наприклад, заблокувати неактивного користувача).

> <i class="bi bi-lightbulb"></i> **Аналогія.** Це як охоронець на вході, який лише звіряє твій пропуск зі списком. Він каже «так, ти в списку» — але ще не відчиняє двері. Двері відчинить наступна функція.

## login() та logout() — керування сесією

> **`login(request, user)`** — відкриває сесію: записує, що цей користувач тепер увійшов.
> **`logout(request)`** — закриває сесію й очищає її дані.

**Як це працює.** Типова зв'язка «перевірити → впустити» на прикладі входу до кінопорталу:

```python
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render, redirect

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

**Навіщо.** Після `login()` Django сам покладе ідентифікатор користувача в сесію та підпише куку. Далі на кожному запиті фреймворк відновлюватиме користувача автоматично — тобі більше нічого робити не треба.

> <i class="bi bi-info-circle"></i> Після `login()` і `logout()` майже завжди йде `redirect` (патерн Post/Redirect/Get). Це запобігає повторному надсиланню форми, якщо користувач оновить сторінку.

**Реєстрація = створення + одразу вхід.** Щоб не змушувати щойно зареєстрованого користувача входити повторно:

```python
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

**Визначення.** `request.user` — це об'єкт користувача, доступний **у кожному** view та шаблоні. Атрибут `request.user.is_authenticated` каже, чи це реальний увійшлий користувач.

**Як це працює.** Django кладе `request.user` автоматично (через `AuthenticationMiddleware`). Якщо гість не увійшов — там буде спеціальний `AnonymousUser`, у якого `is_authenticated == False`:

```python
def my_reviews(request):
    if request.user.is_authenticated:
        reviews = Review.objects.filter(author=request.user)   # відгуки саме цього юзера
        return render(request, 'accounts/my_reviews.html', {'reviews': reviews})
    return redirect('login')
```

У шаблоні `user` доступний без передавання в контекст:

```html
{% if user.is_authenticated %}
  Привіт, {{ user.username }}! <a href="{% url 'logout' %}">Вийти</a>
{% else %}
  <a href="{% url 'login' %}">Увійти</a>
{% endif %}
```

> <i class="bi bi-exclamation-triangle"></i> `is_authenticated` — це **атрибут**, а не метод. Не став дужок: пиши `user.is_authenticated`, а не `user.is_authenticated()`. З дужками умова завжди буде істинною (перевірятиметься сам об'єкт-метод), і захист «зламається» непомітно.

## @login_required — захист сторінок (функції)

> **`@login_required`** — декоратор, що пускає у view лише увійшлих користувачів. Гостя він перенаправляє на сторінку входу.

**Як це працює.** Декоратор ставиться над view-функцією:

```python
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
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import CreateView
from .models import Order

class OrderCreateView(LoginRequiredMixin, CreateView):   # домішка ЗЛІВА
    model = Order
    fields = ['product', 'quantity', 'address']
```

> <i class="bi bi-lightbulb"></i> **Паралель із Flask.** Це прямий аналог `@login_required` із **Flask-Login**. І назва, і суть майже однакові: у Clinic-app ти ставила цей декоратор над роутами кабінету — тут робиш те саме над view Django. Різниця лише в тому, що для класів Django дає домішку замість декоратора.

> <i class="bi bi-exclamation-triangle"></i> `LoginRequiredMixin` мусить стояти **першою** в списку батьків. Якщо поставити її після `CreateView`/`ListView`, MRO (порядок пошуку методів) може «проковтнути» перевірку, і захист не спрацює. Правило: домішки-захисники йдуть **зліва**.

## Налаштування: LOGIN_URL та LOGIN_REDIRECT_URL

Дві настройки у `settings.py` керують перенаправленнями:

- **`LOGIN_URL`** — куди відсилати гостя, який спробував зайти на захищену `@login_required` сторінку. За замовчуванням `/accounts/login/`.
- **`LOGIN_REDIRECT_URL`** — куди вести користувача **після** успішного входу (якщо не вказано `next`).

```python
# settings.py
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

> <i class="bi bi-exclamation-triangle"></i> **`create()` замість `create_user()`** — пароль збережеться без хешування, вхід не працюватиме. Найчастіша помилка новачків.

> <i class="bi bi-exclamation-triangle"></i> **`set_password()` без `save()`** — новий пароль не запишеться в БД. Завжди зберігай після зміни пароля.

> <i class="bi bi-exclamation-triangle"></i> **Дужки в `is_authenticated()`** — умова завжди істинна, захист фактично вимкнено.

> <i class="bi bi-exclamation-triangle"></i> **`LoginRequiredMixin` не першою в списку батьків** — MRO може «проковтнути» перевірку. Домішки-захисники йдуть **зліва**.

## Підсумок

- **`User`** — вбудована модель; звертайся до неї як до будь-якої (`User.objects.filter(...)`), пароль зберігається **хешем**.
- Користувача створюй лише через **`create_user()`** (або `set_password()` + `save()`) — інакше пароль не захешується.
- **`authenticate()`** лише перевіряє логін і пароль та повертає `User` або `None` — сесію не відкриває.
- **`login()`** відкриває сесію, **`logout()`** закриває; після обох майже завжди `redirect`. Реєстрація = `create_user()` + одразу `login()`.
- **`request.user`** доступний усюди; **`request.user.is_authenticated`** (атрибут, без дужок) відрізняє гостя від увійшлого.
- **`@login_required`** (для функцій) і **`LoginRequiredMixin`** (для класів, ставити зліва) захищають сторінки — прямий аналог `@login_required` із Flask-Login. `LOGIN_URL` і `LOGIN_REDIRECT_URL` керують перенаправленнями.

> <i class="bi bi-book"></i> Першоджерело — розділ «Using the Django authentication system» у документації Django (docs.djangoproject.com), де описано модель `User`, усі функції, декоратори та домішки автентифікації.
