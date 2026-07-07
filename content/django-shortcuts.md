# django.shortcuts: щоденні хелпери

У кожному view повторюються одні й ті самі дії: знайти об'єкт, віддати шаблон, перенаправити користувача. Модуль `django.shortcuts` — це набір коротких хелперів для цих типових операцій, щоб ти не писала одне й те саме руками щоразу. Це буквально найчастіше вживані функції Django у повсякденному коді. Приклади навмисно з **різних доменів** (блог, магазин, бібліотека, кіно, замовлення), щоб ти бачила: ці хелпери універсальні, а не прив'язані до якоїсь однієї моделі.

## render — віддати сторінку

**Визначення.** `render(request, 'app/template.html', context)` бере шаблон, підставляє в нього дані з `context` і повертає готовий об'єкт `HttpResponse` з HTML.

**Як це працює.** Три ключові аргументи:

```python
from django.shortcuts import render
from .models import Post

def post_list(request):
    posts = Post.objects.all()
    return render(request, 'blog/post_list.html', {'posts': posts})
```

- `request` — обов'язковий об'єкт запиту (той самий, що приходить у view першим аргументом);
- `'blog/post_list.html'` — шлях до шаблону (Django шукає його у папках `templates/` застосунків за конвенцією);
- `{'posts': posts}` — **контекст**: словник даних, доступних усередині шаблону (`{{ posts }}`).

**Повна сигнатура.** У `render` є ще два необов'язкові аргументи, які інколи знадобляться:

```python
render(request, template_name, context=None, content_type=None, status=None)
```

- `status` — код відповіді. Наприклад, віддати власну сторінку 404:

  ```python
  # бібліотека — власна сторінка «книгу не знайдено» з кодом 404
  def book_missing(request):
      return render(request, 'library/not_found.html', status=404)
  ```

- `content_type` — тип вмісту, якщо віддаєш не HTML (наприклад, `'application/xml'` для карти сайту).

**Навіщо.** Без `render` довелося б вручну завантажувати шаблон, рендерити його з контекстом і загортати в `HttpResponse` — три рядки замість одного. `render` робить це за тебе.

> <i class="bi bi-lightbulb"></i> Якщо ти працювала з Flask — це прямий аналог `render_template('page.html', **context)`. Різниця лише в тому, що Django вимагає передати `request` явним першим аргументом (принцип «явність краще за неявність»).

## redirect — перенаправлення

**Визначення.** `redirect()` повертає відповідь із кодом 302 (тимчасове перенаправлення), що каже браузеру: «іди на іншу адресу». Приймає різні типи аргументів і залежно від них поводиться по-різному.

**Як це працює.** Чотири форми виклику — на різних доменах:

```python
from django.shortcuts import redirect

# 1) За іменем маршруту (найнадійніше) — після виходу з акаунта
return redirect('home')

# 2) За іменем + аргументи маршруту — на сторінку конкретного фільму
return redirect('movie_detail', pk=movie.pk)

# 3) За об'єктом моделі — Django викличе його get_absolute_url()
return redirect(post)          # на сторінку щойно створеного поста

# 4) За прямим шляхом (рядок, що починається з /)
return redirect('/orders/')
```

**Постійне перенаправлення.** Якщо адреса змінилася назавжди (стара сторінка більше не існує), передай `permanent=True` — тоді код буде 301, і пошуковики оновлять посилання:

```python
return redirect('new_catalog', permanent=True)   # 301 замість 302
```

**Навіщо.** Варіант за **іменем маршруту** — найкращий: якщо колись зміниш URL у `urls.py`, посилання не зламається, бо прив'язане до імені, а не до тексту адреси. Це знову ж таки принцип DRY — адреса описана в одному місці.

> <i class="bi bi-info-circle"></i> Щоб працював `redirect(obj)`, у моделі має бути метод `get_absolute_url()`. Він повертає рядок-шлях до сторінки об'єкта — Django викличе його автоматично.

```python
from django.urls import reverse

class Post(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)

    def get_absolute_url(self):
        return reverse('post_detail', kwargs={'slug': self.slug})
```

> <i class="bi bi-info-circle"></i> Пам'ятай про Post/Redirect/Get: після успішного POST (створили замовлення, додали коментар) завжди роби `redirect`, а не `render`. Інакше при оновленні сторінки браузер повторно надішле форму.

## get_object_or_404 — об'єкт або 404

**Визначення.** `get_object_or_404(Model, **умови)` намагається дістати **один** об'єкт; якщо його немає — автоматично віддає сторінку 404 замість того, щоб «впасти» з помилкою 500.

**Як це працює.** Порівняй два підходи на моделі фільму.

**До** — вручну ловимо виняток:

```python
from django.http import Http404
from .models import Movie

def movie_detail(request, pk):
    try:
        movie = Movie.objects.get(pk=pk)
    except Movie.DoesNotExist:
        raise Http404('Фільм не знайдено')
    return render(request, 'cinema/movie_detail.html', {'movie': movie})
```

**Після** — той самий результат одним рядком:

```python
from django.shortcuts import get_object_or_404, render

def movie_detail(request, pk):
    movie = get_object_or_404(Movie, pk=pk)
    return render(request, 'cinema/movie_detail.html', {'movie': movie})
```

**Умови можуть бути будь-які**, не лише `pk`. Наприклад, знайти книгу за слагом, але тільки якщо вона опублікована:

```python
book = get_object_or_404(Book, slug=book_slug, is_published=True)
```

**Перший аргумент — модель або QuerySet.** Можна передати вже відфільтрований QuerySet — тоді пошук іде в його межах:

```python
# шукаємо замовлення 42, але лише серед замовлень поточного користувача
order = get_object_or_404(Order.objects.filter(user=request.user), pk=42)
```

**Навіщо.** Ситуація «об'єкта немає → покажи 404» трапляється в кожному detail-в'ю. Хелпер прибирає повторюваний `try/except` і робить намір коду очевидним з першого погляду.

> <i class="bi bi-exclamation-triangle"></i> Перший аргумент — це **сама модель або QuerySet**, а не рядок. `get_object_or_404(Movie, pk=pk)`, а не `get_object_or_404('Movie', ...)`.

> <i class="bi bi-exclamation-triangle"></i> Якщо умова знайде **більше одного** об'єкта, `get_object_or_404` кине `MultipleObjectsReturned` (це вже помилка 500, не 404). Фільтруй так, щоб результат був однозначний — за унікальним полем (`pk`, `slug`).

## get_list_or_404 — список або 404

**Визначення.** `get_list_or_404(Model, **умови)` повертає **список** об'єктів за умовою; якщо не знайдено жодного — віддає 404.

**Як це працює.**

```python
from django.shortcuts import get_list_or_404
from .models import Book

def author_books(request, author_id):
    books = get_list_or_404(Book, author_id=author_id)
    return render(request, 'library/book_list.html', {'books': books})
```

Якщо в автора немає жодної книги — користувач отримає 404, а не порожню сторінку. Зверни увагу: повертається **звичайний список**, а не QuerySet, тому далі його вже не «доланцюжиш» фільтрами.

**Навіщо.** Це `get_object_or_404` для випадку «очікую багато». Різниця з `.filter()`: `filter` спокійно повертає порожній набір, а `get_list_or_404` вважає порожнечу помилкою й піднімає 404.

> <i class="bi bi-info-circle"></i> Використовуй його лише тоді, коли порожній результат — це справді «нічого не знайдено» (помилка адреси). Якщо порожній список — нормальний стан («у цього автора поки немає книг»), бери звичайний `.filter()` і показуй відповідне повідомлення в шаблоні.

## Де це в проєкті

Ці хелпери — у **кожному view**. Ось той самий «скелет» на трьох різних доменах — намір усюди однаковий:

```python
from django.shortcuts import render, get_object_or_404, redirect

# блог — показати пост
def post_detail(request, slug):
    post = get_object_or_404(Post, slug=slug, is_published=True)
    return render(request, 'blog/post_detail.html', {'post': post})

# магазин — додати товар у кошик і повернутися до нього
def add_to_cart(request, pk):
    product = get_object_or_404(Product, pk=pk, in_stock=True)
    request.cart.add(product)
    return redirect('cart')

# бібліотека — усі книги полиці або 404
def shelf(request, shelf_id):
    books = get_list_or_404(Book, shelf_id=shelf_id)
    return render(request, 'library/shelf.html', {'books': books})
```

Хелпери разом покривають майже весь «скелет» звичайного view: дістати дані (`get_object_or_404` / `get_list_or_404`), показати сторінку (`render`), перенаправити після дії (`redirect`).

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Забутий `return` перед `render`/`redirect`** → `The view didn't return an HttpResponse object`. Ці хелпери лише **створюють** відповідь — повернути її мусиш ти.

> <i class="bi bi-exclamation-triangle"></i> **Рядок замість моделі** у `get_object_or_404('Product', ...)` — перший аргумент завжди сам клас моделі або QuerySet.

> <i class="bi bi-exclamation-triangle"></i> **`get_list_or_404` там, де порожнеча нормальна** — користувач отримає 404 на цілком робочій сторінці. Для «поки нічого немає» бери `.filter()`.

> <i class="bi bi-info-circle"></i> Після POST — завжди `redirect`, а не `render` (Post/Redirect/Get), щоб оновлення сторінки не відправило форму повторно.

## Підсумок

- **`render(request, шаблон, context, status=...)`** — рендерить шаблон із даними у `HttpResponse`; аналог `render_template` у Flask, але з обов'язковим `request`. `status=` дає власні коди (напр. 404).
- **`redirect()`** приймає ім'я маршруту, ім'я + аргументи, об'єкт (через `get_absolute_url()`) або шлях; надавай перевагу **імені маршруту**. `permanent=True` → код 301.
- **`get_object_or_404(Model, **умови)`** замінює ручний `try/except Model.DoesNotExist` і сам віддає 404; перший аргумент — модель або QuerySet, умови будь-які.
- **`get_list_or_404(Model, **умови)`** — те саме для списку; бери лише коли порожній результат означає помилку.
- Разом ці хелпери формують «скелет» майже кожного view: дістати → показати → перенаправити.

> <i class="bi bi-book"></i> Повний перелік хелперів — у розділі «django.shortcuts» офіційної документації (docs.djangoproject.com).
