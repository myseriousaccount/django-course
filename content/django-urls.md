# URL-маршрути

Маршрутизація в Django описана декларативно: список `urlpatterns` зіставляє шаблон адреси з view. Структура дворівнева — головна таблиця проєкту делегує адреси застосункам, а ті описують свої сторінки.

## Дворівнева схема

```
браузер: /blog/my-first-post/
   ↓
config/urls.py       path('blog/', include('blog.urls'))     ← відрізає префікс blog/
   ↓
blog/urls.py         path('<slug:slug>/', views.post_detail) ← отримує залишок my-first-post/
   ↓
blog/views.py        post_detail(request, slug='my-first-post')
```

```python
# config/urls.py
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('home.urls')),
    path('blog/', include('blog.urls')),
    path('shop/', include('shop.urls')),
    path('accounts/', include('accounts.urls')),
]
```

```python
# blog/urls.py
from django.urls import path

from . import views

urlpatterns = [
    path('', views.post_list, name='post_list'),
    path('<slug:slug>/', views.post_detail, name='post_detail'),
]
```

`include()` відрізає свій префікс і передає застосунку решту адреси, тому всередині `blog/urls.py` шляхи пишуться без `blog/`. Повна адреса складається з двох частин: `blog/` з головної таблиці плюс `<slug:slug>/` з таблиці застосунку.

Додавання нового розділу зводиться до одного рядка `include()` у головному файлі — решта маршрутів лишається в межах свого застосунку.

## Анатомія path()

```python
# library/urls.py
path('books/<int:book_id>/', views.book_detail, name='book_detail')
#     └─ шаблон адреси ─┘     └─ обробник ─┘     └─ ім'я маршруту ─┘
```

Ім'я формально необов'язкове, але без нього не працюють `{% url %}` і `reverse()`, тому маршрути без імені лишають хіба що для службових адрес.

## Конвертери

Змінна частина адреси описується як `<тип:ім'я>` і приходить у view іменованим аргументом.

| Конвертер | Приймає | Приклад адреси |
|---|---|---|
| `int` | невід'ємне ціле | `/shop/product/42/` |
| `slug` | літери, цифри, дефіс, підкреслення | `/blog/my-first-post/` |
| `str` | будь-який рядок без `/` (типово, якщо тип не вказано) | `/users/olena/` |
| `uuid` | UUID | `/orders/1a2b3c4d-.../` |
| `path` | рядок, що може містити `/` | `/files/docs/2026/report.pdf` |

```python
# library/urls.py
path('books/<int:book_id>/', views.book_detail, name='book_detail')
```

```python
# library/views.py
def book_detail(request, book_id):     # ім'я аргументу збігається з іменем у маршруті
    ...
```

Конвертер не лише витягує значення, а й перевіряє формат: адреса `/books/abc/` не збігатиметься з `<int:book_id>` і Django піде шукати далі по списку.

Для нестандартних форматів існує `re_path()` з регулярним виразом:

```python
# blog/urls.py
from django.urls import re_path

re_path(r'^archive/(?P<year>[0-9]{4})/$', views.year_archive, name='year_archive')
```

Іменована група `(?P<year>...)` стає аргументом view. `re_path()` беруть лише тоді, коли конвертерів не вистачає — наприклад, потрібен рівно чотиризначний рік.

## Порядок маршрутів

Django перебирає `urlpatterns` згори вниз і зупиняється на першому збігу.

```python
# blog/urls.py
urlpatterns = [
    path('new/', views.post_create, name='post_create'),      # конкретний — вище
    path('<slug:slug>/', views.post_detail, name='post_detail'),  # загальний — нижче
]
```

У зворотному порядку адреса `/blog/new/` збіглася б зі `<slug:slug>` і потрапила у `post_detail` зі значенням `slug='new'`. Помилки не буде — буде 404 «пост не знайдено», що збиває з пантелику при налагодженні.

## Імена маршрутів

Ім'я дозволяє посилатися на адресу, не повторюючи її текст:

```html
{# blog/templates/blog/post_list.html #}
<a href="{% url 'post_detail' post.slug %}">{{ post.title }}</a>
```

```python
# blog/views.py
from django.shortcuts import redirect
from django.urls import reverse

return redirect('post_detail', slug=post.slug)
url = reverse('post_detail', kwargs={'slug': post.slug})
```

Зміна шляху в `urls.py` після цього не потребує правок у шаблонах і views — адреса описана в одному місці.

Коли однакові імена з'являються в різних застосунках (`detail` у блозі й у магазині), застосунку задають простір імен:

```python
# shop/urls.py
app_name = 'shop'

urlpatterns = [
    path('product/<int:pk>/', views.product_detail, name='detail'),
]
```

```html
{# shop/templates/shop/product_list.html #}
<a href="{% url 'shop:detail' product.pk %}">{{ product.name }}</a>
```

Детально про простори імен — в окремому уроці.

## Кінцевий слеш

Django-конвенція — адреси з кінцевим слешем: `path('about/', ...)`. Налаштування `APPEND_SLASH` (типово `True`) разом із `CommonMiddleware` перенаправляє `/about` на `/about/`, якщо перший варіант не знайдено.

Але це працює лише для GET: POST-запит із втраченим слешем не перенаправляється, бо це означало б втратити тіло запиту. Тому в атрибутах `action` форми адресу пишуть точно, а ще краще — через `{% url %}`.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Загальний маршрут вище за конкретний | `/blog/new/` потрапляє в `post_detail` зі `slug='new'` і дає 404. Конкретні шляхи ставлять першими |
| Ім'я в конвертері не збігається з аргументом view | `TypeError: got an unexpected keyword argument`. `<int:book_id>` вимагає `def book_detail(request, book_id)` |
| Префікс продубльовано в застосунку | `path('blog/…')` усередині `blog/urls.py` дає адресу `/blog/blog/…`; `include()` префікс уже відрізав |
| Хардкод адрес у шаблонах | `<a href="/blog/42/">` перестає працювати після зміни маршруту. Використовують `{% url %}` і `reverse()` |
| Маршрут без `name=` | На нього неможливо послатися через `{% url %}`; ім'я дають усім адресам, які згадуються в коді |
| `from .views import *` | Незрозуміло, звідки взялася функція, і легко перекрити імена. Канонічно — `from . import views` |
| Форма шле POST на адресу без кінцевого слеша | `APPEND_SLASH` не рятує POST-запити: дані губляться. Адресу в `action` беруть з `{% url %}` |

## Підсумок

- Маршрути дворівневі: `config/urls.py` делегує префікси застосункам через `include()`, застосунок описує свої сторінки без цього префікса.
- `path(шаблон, view, name=...)` — базова форма; `re_path()` потрібен лише для складніших шаблонів, ніж дозволяють конвертери.
- Конвертери `int`, `slug`, `str`, `uuid`, `path` витягують значення й одночасно перевіряють формат; імена в маршруті й у сигнатурі view мають збігатися.
- Список перебирається згори вниз до першого збігу, тому конкретні маршрути ставлять вище за загальні.
- `name=` і `{% url %}` / `reverse()` прибирають хардкод адрес; `app_name` розділяє однакові імена з різних застосунків.
- Конвенція — кінцевий слеш; `APPEND_SLASH` виправляє лише GET-запити.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/http/urls/" target="_blank" rel="noopener">URL dispatcher <i class="bi bi-box-arrow-up-right"></i></a></div></div>
