# Views

View — функція (або клас), яка приймає об'єкт запиту й повертає об'єкт відповіді. У MTV це шар, що з'єднує дані з відображенням: маршрут вирішує, яка view спрацює, а view — що зробити й що повернути.

```python
# pages/views.py
from django.http import HttpResponse


def status(request):
    return HttpResponse('Сервер працює')
```

Це повноцінна view: жодної бази й шаблону тут не потрібно.

## Об'єкт запиту

Перший аргумент кожної view — `HttpRequest` з усією інформацією про звернення.

| Атрибут | Що містить |
|---|---|
| `request.method` | `'GET'`, `'POST'`, `'PATCH'` … |
| `request.GET` | параметри рядка запиту: `/search/?q=книга` → `request.GET.get('q')` |
| `request.POST` | дані надісланої форми |
| `request.FILES` | завантажені файли |
| `request.user` | поточний користувач або `AnonymousUser` |
| `request.session` | сесія поточного відвідувача |
| `request.path` | шлях без домену: `/blog/5/` |
| `request.headers` | заголовки запиту |

`request.GET` і `request.POST` — не звичайні словники, а `QueryDict`: вони незмінні й уміють повертати кілька значень для одного ключа (`request.GET.getlist('tag')`). Тому дані з них завжди дістають через `.get()` зі значенням за замовчуванням — прямий доступ `request.POST['email']` падає з `MultiValueDictKeyError`, якщо поля немає в запиті.

## Види відповідей

| Що повертаємо | Функція або клас | Коли |
|---|---|---|
| HTML зі шаблону | `render()` | звичайна сторінка |
| перенаправлення | `redirect()` | після успішної дії, зміна адреси |
| дані для JavaScript | `JsonResponse()` | AJAX, простий API |
| довільний вміст | `HttpResponse()` | текст, CSV, XML, PDF |
| помилка «не знайдено» | `raise Http404` | об'єкта не існує |

```python
# shop/views.py
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect, render


def product_page(request, pk):
    return render(request, 'shop/product.html', {'pk': pk})


def moved(request):
    return redirect('shop:list')


def stock_api(request, pk):
    return JsonResponse({'in_stock': True, 'count': 3})


def export(request):
    return HttpResponse('id;name\n1;Мишка', content_type='text/csv')
```

Усі варіанти — підкласи або обгортки над `HttpResponse`: view завжди повертає відповідь, різниця лише в її вмісті й заголовках.

## render і контекст

```python
# library/views.py
from django.shortcuts import render

from .models import Book


def book_list(request):
    books = Book.objects.filter(is_available=True)
    return render(request, 'library/book_list.html', {'books': books})
```

```html
{# library/templates/library/book_list.html #}
{% for book in books %}
  <li>{{ book.title }}</li>
{% endfor %}
```

Контекст — словник, ключі якого стають іменами змінних у шаблоні. Шлях до шаблону пишуть із префіксом застосунку (`library/`), інакше при однакових іменах Django може взяти файл іншого застосунку.

Патерн «дістати з бази — передати в шаблон» однаковий для будь-якої моделі; змінюються лише клас і назва шаблону.

## Аргументи з адреси

Динамічні частини маршруту приходять у view іменованими аргументами після `request`:

```python
# library/urls.py
path('books/<int:book_id>/', views.book_detail, name='book_detail')
```

```python
# library/views.py
from django.shortcuts import get_object_or_404, render


def book_detail(request, book_id):
    book = get_object_or_404(Book, pk=book_id)
    return render(request, 'library/book_detail.html', {'book': book})
```

Імена в маршруті й у сигнатурі мають збігатися. Значення вже перетворене конвертером: `<int:book_id>` дає число, а не рядок.

## GET і POST в одній view

```python
# pages/views.py
from django.shortcuts import redirect, render


def contact(request):
    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        if email:
            # ... обробка ...
            return redirect('thanks')          # Post/Redirect/Get

    return render(request, 'pages/contact.html')
```

Після успішного POST повертають `redirect`, а не `render`: інакше оновлення сторінки повторно надішле форму. Повний сценарій дії, що змінює дані — перевірка методу й прав, робота з ORM, вибір між `redirect` і `JsonResponse` — розібраний в уроці «Операції з даними».

## Що лишається у view, а що виносять

Робота view — прийняти запит, звернутися до потрібного шару й повернути відповідь. Обчислення, правила предметної області та складні запити виносять у моделі, менеджери або окремі модулі з логікою:

```python
# ❌ shop/views.py — логіка осіла у view
def cart_total(request):
    items = CartItem.objects.filter(user=request.user)
    total = 0
    for item in items:
        price = item.product.price
        if item.product.discount:
            price -= price * item.product.discount / 100
        total += price * item.quantity
    return render(request, 'shop/cart.html', {'total': total})
```

```python
# ✅ shop/views.py — обчислення в моделі, у view лишилась координація
def cart_total(request):
    cart = Cart.objects.for_user(request.user)
    return render(request, 'shop/cart.html', {'total': cart.total()})
```

Причина не в естетиці: логіку всередині view неможливо перевикористати в команді `manage.py`, в адмінці чи в тесті без імітації HTTP-запиту. Детально — в уроці «Де живе логіка».

## Функції чи класи

Усе вище — function-based views. Django має ще class-based views із готовими заготовками (`ListView`, `DetailView`, `CreateView`), які скорочують типовий CRUD. Порівняння підходів — в окремому уроці «Функції чи класи».

## Що потрібно, щоб сторінка відкрилась

1. view у `app/views.py`;
2. маршрут у `app/urls.py`, підключений через `include()` у головному `urls.py`;
3. шаблон у `app/templates/app/`, якщо повертається HTML;
4. застосунок в `INSTALLED_APPS`.

Пропущений пункт дає характерну помилку: без маршруту — 404, без шаблону або без реєстрації застосунку — `TemplateDoesNotExist`.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Немає `return` | `The view didn't return an HttpResponse object. It returned None instead` |
| Неправильний шлях у `render` | `TemplateDoesNotExist`: шлях пишуть із префіксом застосунку, а сам застосунок має бути в `INSTALLED_APPS` |
| `request.POST['email']` замість `.get()` | `MultiValueDictKeyError`, якщо поле не надіслали. Використовуй `.get('email', '')` |
| Очікувати число з `request.GET` | Значення завжди рядок: `'5'`, а не `5`. Перетворення роблять після перевірки |
| Робота з базою просто у view при кожному запиті | Важкі обчислення й правила виносять у модель або сервіс, інакше їх не перевикористати й не протестувати |
| `render` після успішного POST | Повторна відправка форми при оновленні сторінки; потрібен `redirect` |
| Ім'я аргументу не збігається з конвертером | `TypeError: got an unexpected keyword argument` |

## Підсумок

- View приймає `request` і повертає відповідь; маршрут визначає, яка саме view спрацює.
- `request` містить метод, дані форми, файли, користувача, сесію; `GET` і `POST` — це `QueryDict`, з яких значення беруть через `.get()`.
- Типи відповідей: `render`, `redirect`, `JsonResponse`, `HttpResponse`, `Http404` — усе це різновиди `HttpResponse`.
- Контекст `render()` стає змінними шаблону; шлях до шаблону пишуть із префіксом застосунку.
- Динамічні частини адреси приходять іменованими аргументами вже перетвореними конвертером.
- Після успішного POST — `redirect` (Post/Redirect/Get).
- У view лишають лише координацію: предметна логіка живе в моделях, менеджерах і окремих модулях.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/http/views/" target="_blank" rel="noopener">Writing views <i class="bi bi-box-arrow-up-right"></i></a></div></div>
