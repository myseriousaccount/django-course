# Хелпери shortcuts

Модуль `django.shortcuts` містить функції для дій, які повторюються майже в кожному view: віддати шаблон, перенаправити, дістати об'єкт або показати 404. Це найчастіше вживані імпорти у щоденному коді.

## render

```python
render(request, template_name, context=None, content_type=None, status=None)
```

Завантажує шаблон, підставляє в нього дані з контексту й повертає `HttpResponse`.

```python
# blog/views.py
from django.shortcuts import render

from .models import Post


def post_list(request):
    posts = Post.objects.filter(is_published=True)
    return render(request, 'blog/post_list.html', {'posts': posts})
```

- `request` передається обов'язково: через нього шаблон отримує доступ до `user`, `messages` та інших змінних із context processors.
- Шлях до шаблону вказують із префіксом застосунку, щоб уникнути конфлікту однакових імен.
- Контекст — звичайний словник; ключі стають іменами змінних у шаблоні.

Необов'язкові аргументи потрібні рідше, але саме вони дозволяють віддати нестандартну відповідь:

```python
# library/views.py
def not_found(request):
    return render(request, 'library/not_found.html', status=404)


def sitemap(request):
    return render(request, 'library/sitemap.xml', content_type='application/xml')
```

## redirect

Повертає відповідь із кодом 302, тобто вказує браузеру перейти на іншу адресу. Приймає чотири види аргументів:

```python
# shop/views.py
from django.shortcuts import redirect

return redirect('home')                          # ім'я маршруту
return redirect('movie_detail', pk=movie.pk)     # ім'я маршруту з аргументами
return redirect(post)                            # об'єкт із методом get_absolute_url()
return redirect('/orders/')                      # готовий шлях
```

Форма з іменем маршруту надійніша за рядок: після зміни адреси в `urls.py` код лишається робочим.

Щоб працював варіант із об'єктом, модель має описувати власну адресу:

```python
# blog/models.py
from django.db import models
from django.urls import reverse


class Post(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)

    def get_absolute_url(self):
        return reverse('post_detail', kwargs={'slug': self.slug})
```

`get_absolute_url()` використовує не лише `redirect()`: його викликає адмін-панель для кнопки «Дивитись на сайті» і generic-views для `success_url`.

Для адрес, що змінилися назавжди, передають `permanent=True` — тоді код відповіді 301 і пошукові системи оновлять посилання:

```python
return redirect('new_catalog', permanent=True)
```

## get_object_or_404

Дістає рівно один об'єкт або віддає сторінку 404 замість помилки 500.

```python
# cinema/views.py
from django.shortcuts import get_object_or_404, render

from .models import Movie


def movie_detail(request, pk):
    movie = get_object_or_404(Movie, pk=pk)
    return render(request, 'cinema/movie_detail.html', {'movie': movie})
```

Без хелпера той самий код виглядав би так:

```python
# cinema/views.py
from django.http import Http404

try:
    movie = Movie.objects.get(pk=pk)
except Movie.DoesNotExist:
    raise Http404('Фільм не знайдено')
```

Умови можуть бути будь-якими, не лише `pk` — і це основний спосіб обмежити доступ до чужих об'єктів:

```python
# library/views.py
book = get_object_or_404(Book, slug=slug, is_published=True)

# orders/views.py — замовлення знайдеться, лише якщо належить цьому користувачу
order = get_object_or_404(Order, pk=pk, user=request.user)
```

Перший аргумент — модель, менеджер або QuerySet, тому пошук можна вести в межах уже відфільтрованого набору:

```python
# orders/views.py
order = get_object_or_404(Order.objects.select_related('user'), pk=pk)
```

> <i class="bi bi-pin-angle"></i> Повертати 404 замість 403 для чужого об'єкта — свідома практика: сторінка не підтверджує навіть існування запису з таким номером.

## get_list_or_404

Повертає список об'єктів за умовою або 404, якщо не знайдено жодного.

```python
# library/views.py
from django.shortcuts import get_list_or_404, render


def author_books(request, author_id):
    books = get_list_or_404(Book, author_id=author_id)
    return render(request, 'library/book_list.html', {'books': books})
```

Результат — звичайний список, а не QuerySet, тому додати `.filter()` чи `.order_by()` після виклику вже не вдасться; сортування задають одразу через `Book.objects.order_by(...)` або `Meta.ordering`.

Хелпер доречний лише тоді, коли порожній результат означає помилкову адресу. Якщо «поки нічого немає» — нормальний стан, беруть `.filter()` і показують відповідне повідомлення в шаблоні.

## Скелет типового view

```python
# shop/views.py
from django.shortcuts import get_object_or_404, redirect, render

from .models import Product


def product_detail(request, pk):
    product = get_object_or_404(Product, pk=pk, is_active=True)   # дістати
    return render(request, 'shop/product_detail.html', {'product': product})  # показати


def product_archive(request, pk):
    product = get_object_or_404(Product, pk=pk)
    product.is_active = False
    product.save()
    return redirect('shop:list')                                   # перенаправити
```

Три хелпери покривають більшість звичайних сторінок: дістати дані, показати шаблон, перенаправити після дії.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Забутий `return` перед `render` або `redirect` | `The view didn't return an HttpResponse object`: хелпер лише створює відповідь, повернути її має view |
| Рядок замість моделі: `get_object_or_404('Movie', …)` | Перший аргумент — клас моделі, менеджер або QuerySet |
| Умова, під яку підпадає кілька об'єктів | `MultipleObjectsReturned` і помилка 500. Фільтруй за унікальним полем або звужуй умову |
| `get_list_or_404` там, де порожнеча нормальна | Користувач бачить 404 на робочій сторінці. Для «поки порожньо» — `.filter()` |
| `render` після успішного POST | Оновлення сторінки повторно надішле форму. Після POST — `redirect` |
| `redirect('/blog/42/')` замість імені маршруту | Посилання ламається після зміни `urls.py`. Передавай ім'я маршруту або об'єкт |
| Об'єкт дістають без перевірки власника | Чуже замовлення відкривається за прямим посиланням. Умову власності додають прямо у `get_object_or_404` |

## Підсумок

- `render(request, шаблон, context, status=…, content_type=…)` — рендер шаблону в `HttpResponse`; `request` обов'язковий, бо через нього працюють context processors.
- `redirect()` приймає ім'я маршруту, ім'я з аргументами, об'єкт із `get_absolute_url()` або шлях; ім'я маршруту стійкіше за рядок, `permanent=True` дає 301.
- `get_object_or_404()` замінює `try/except DoesNotExist`; умови довільні, тому саме тут зручно обмежувати доступ за власником.
- Перший аргумент може бути QuerySet — це дозволяє шукати в межах уже відфільтрованого набору.
- `get_list_or_404()` повертає список і піднімає 404 на порожньому результаті; для нормальної порожнечі використовують `.filter()`.
- Разом три хелпери утворюють скелет звичайного view: дістати → показати → перенаправити.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/http/shortcuts/" target="_blank" rel="noopener">Django shortcut functions <i class="bi bi-box-arrow-up-right"></i></a></div></div>
