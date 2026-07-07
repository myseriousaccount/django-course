# Views: функції-обробники

View — це серце логіки в Django. Цей урок пояснює, що таке view, як вона влаштована, які бувають відповіді та як view пов'язана з URL і шаблоном. Приклади навмисно з **різних доменів** (блог, магазин, бібліотека, проста сторінка, API), щоб ти бачила: це універсальний механізм, а не щось прив'язане до конкретного проєкту.

## Що таке view

> **View** — це Python-функція, яка приймає об'єкт запиту (`request`) і **повертає** об'єкт відповіді (HTML-сторінку, редірект, JSON, помилку…). У патерні MTV це шар **V** — логіка між даними (Model) і відображенням (Template).

Найпростіша view взагалі не потребує ні бази, ні шаблону:

```python
from django.http import HttpResponse

def hello(request):
    return HttpResponse('Привіт!')      # приймає request → повертає відповідь
```

Запам'ятай суть: **приймає `request` → повертає відповідь**. Усе інше — варіації на цю тему.

## Місце view в циклі запиту

View не викликається сама — вона ланка ланцюга:

```
браузер → URLconf (urls.py) → VIEW → (Model / Template) → відповідь → браузер
```

Тобто маршрут (`urls.py`) вирішує, **яка** view спрацює на цю адресу, а view вирішує, **що робити** й **що повернути**. Ці дві ролі завжди розділені.

## View завжди приймає `request`

Перший аргумент **кожної** view — об'єкт запиту з усією інформацією про звернення:

| Атрибут | Що містить | Приклад |
|---|---|---|
| `request.method` | метод запиту | `'GET'`, `'POST'` |
| `request.GET` | параметри з адреси (`?...`) | `/search/?q=книга` → `request.GET.get('q')` |
| `request.POST` | дані надісланої форми | `request.POST.get('email')` |
| `request.user` | поточний користувач | `request.user.is_authenticated` |
| `request.FILES` | завантажені файли | `request.FILES['avatar']` |
| `request.path` | шлях запиту | `'/blog/5/'` |

> 💡 Паралель із Flask: там `request` глобальний (`from flask import request`), а в Django його **передають аргументом**. Тому `def hello(request):` — не магія: `request` тут звичайний параметр, який Django підставляє сам. Плюс явності: дивишся на сигнатуру — одразу видно, що функція отримує.

## Які бувають відповіді

Головне правило: **будь-яка view мусить повернути об'єкт відповіді**. Але відповіді бувають різні — ось повний набір, кожен на своєму прикладі.

### HttpResponse — простий текст/HTML

```python
from django.http import HttpResponse

def status(request):
    return HttpResponse('Сервер працює')          # звичайний текст
```

### render — HTML із шаблону (найчастіше)

```python
from django.shortcuts import render

def about(request):
    return render(request, 'pages/about.html', {'year': 2025})
```

### redirect — перенаправлення

```python
from django.shortcuts import redirect

def old_page(request):
    return redirect('home')                        # на маршрут з ім'ям 'home'
```

### JsonResponse — дані для JavaScript/API

```python
from django.http import JsonResponse

def api_ping(request):
    return JsonResponse({'status': 'ok', 'items': 3})
```

### 404 — коли об'єкта немає

```python
from django.http import Http404

def secret(request):
    raise Http404('Нічого тут немає')
```

> 📌 Усі ці класи (`render`, `redirect`, `JsonResponse`, `HttpResponse`) — різновиди одного: **`HttpResponse`**. Тобто view завжди повертає «якусь відповідь», просто в різній формі.

## `render()` детально

`render` — найуживаніший спосіб віддати сторінку. Три аргументи:

```python
render(request, 'blog/post_list.html', {'posts': posts})
#       (1)      (2)                     (3)
```

1. **`request`** — обов'язково передати далі.
2. **шлях до шаблону** — рядок; Django шукає файл у папках шаблонів. Підпапку за іменем app (`blog/`) пишуть, щоб не сплутати з однойменним шаблоном іншого модуля.
3. **context** — словник даних; кожен ключ стає змінною в шаблоні (`{{ posts }}`).

## Передавання даних у шаблон (context)

`context` — це «місток» від Python до HTML. Що поклав у словник — те й доступне в шаблоні. Приклади з різних доменів:

```python
# блог
def post_detail(request):
    return render(request, 'blog/post.html', {'title': 'Мій пост', 'views': 128})

# магазин
def product_page(request):
    return render(request, 'shop/product.html', {'name': 'Ноутбук', 'price': 25000})

# профіль
def profile(request):
    return render(request, 'accounts/profile.html', {'user': request.user})
```

А в шаблоні:

```html
<h1>{{ title }}</h1>
<p>Переглядів: {{ views }}</p>
```

## View з даними з бази — універсальний патерн

Найчастіша задача — дістати об'єкти з БД і показати. Патерн однаковий для **будь-якої** моделі:

```python
# бібліотека
from django.shortcuts import render
from .models import Book

def book_list(request):
    books = Book.objects.all()                     # дістаємо з БД
    return render(request, 'library/book_list.html', {'books': books})
```

```python
# магазин — той самий патерн, інша модель
from .models import Product

def product_list(request):
    products = Product.objects.filter(in_stock=True)
    return render(request, 'shop/product_list.html', {'products': products})
```

Ось тут видно **весь MTV**: **Model** дає дані (`Book`/`Product`), **View** їх дістає, **Template** показує. Це кістяк будь-якої сторінки-списку, байдуже блог це, магазин чи бібліотека.

> 🧠 Тримай view «тонкою»: її робота — узяти дані й повернути відповідь. Складні обчислення й правила — у моделях (урок «Де живе логіка»).

## Параметри в адресі приходять у view

Коли в маршруті є динамічна частина, її значення Django передає у view **наступним аргументом** (після `request`):

```python
# urls.py:  path('books/<int:book_id>/', views.book_detail)

from django.shortcuts import get_object_or_404, render

def book_detail(request, book_id):                 # book_id з URL
    book = get_object_or_404(Book, pk=book_id)
    return render(request, 'library/book_detail.html', {'book': book})
```

Види конвертерів:

| Конвертер | Приймає | Приклад адреси |
|---|---|---|
| `<int:id>` | ціле число | `/books/42/` |
| `<slug:slug>` | slug (літери-цифри-дефіс) | `/blog/my-first-post/` |
| `<str:name>` | рядок без `/` | `/user/olena/` |
| `<uuid:id>` | UUID | `/order/1a2b.../` |

> ⚠️ Ім'я в маршруті й аргумент view мусять **збігатися**: `<int:book_id>` ↔ `book_id`.

## GET і POST в одній view

Часто одна view і показує форму (GET), і приймає її (POST). Розрізняють через `request.method`:

```python
def contact(request):
    if request.method == 'POST':
        # обробити надіслані дані
        email = request.POST.get('email')
        # ... зберегти / надіслати ...
        return redirect('thanks')
    # GET — просто показати форму
    return render(request, 'pages/contact.html')
```

> 💡 Патерн **Post/Redirect/Get**: після успішного POST завжди роби `redirect`, а не `render`. Інакше при оновленні сторінки браузер повторно надішле форму.

## Функції чи класи?

Усе вище — **function-based views (FBV)**: view як функція. Django має ще **class-based views (CBV)** — view як клас із готовими «заготовками» (`ListView`, `DetailView`). Для типових списків/деталей вони економлять код. Коли який обирати — окремий урок «FBV vs CBV».

## Щоб сторінка запрацювала — чотири речі разом

View сама по собі сторінки не дасть. Потрібні **чотири** складники:

1. **view** у `app/views.py` — що робити;
2. **шаблон** (якщо рендериш HTML) — як показати;
3. **маршрут** у `app/urls.py` + `include()` у `root/urls.py` — за якою адресою;
4. запущений **сервер** (`runserver`).

Забув одне — сторінка не відкриється (частіше: не підключив маршрут → 404, або шаблон не там → `TemplateDoesNotExist`).

## Типові помилки / Нюанси

> ⚠️ **Забутий `return`** → `The view didn't return an HttpResponse object. It returned None instead.` View **мусить** повертати відповідь.

> ⚠️ **`TemplateDoesNotExist`** → шлях у `render` неправильний або app не в `INSTALLED_APPS`. Пиши шлях із підпапкою app: `'blog/post_list.html'`.

> ⚠️ **Плутанина ролей** — `urls.py` каже **за якою адресою**, `views.py` каже **що робити**. Не змішуй.

> 💡 Після POST — `redirect`, а не `render` (Post/Redirect/Get), щоб уникнути повторної відправки форми.

## Підсумок

- **View** — функція `request → відповідь`; шар **V** у MTV; викликається маршрутом.
- Перший аргумент **завжди** `request`; динамічні частини URL (`<int:id>`) приходять наступними аргументами.
- Відповіді різні, але всі — це `HttpResponse`: `render` (HTML), `redirect`, `JsonResponse`, `Http404`, простий `HttpResponse`.
- `render(request, шаблон, context)` — найчастіша; `context` стає змінними шаблону (`{{ }}`).
- Патерн «дістати з БД → передати в шаблон» однаковий для будь-якої моделі (блог, магазин, бібліотека).
- Щоб сторінка ожила, потрібні **чотири** речі: view + шаблон + маршрут + сервер.

> 📖 Деталі — розділи «Writing views» і «Request and response objects» у документації Django (docs.djangoproject.com).
