# Namespacing маршрутів (app_name)

У розділі про URL ти бачила `name=` для маршрутів. Тут — архітектурне продовження: що робити, коли проєкт росте і в різних apps з'являються однакові імена маршрутів. У блозі є `detail`, у магазині теж захочеться `detail`, у бібліотеці — `list`, і в кіно — `list`. Як їх не сплутати? Розберемо `app_name`, простір імен, `reverse` і `{% url %}`. Приклади — з **різних доменів** (блог, магазин, бібліотека, кіно).

## Проблема: зіткнення імен

**Як це працює.** Уяви, що у двох apps є маршрут з ім'ям `detail`:

```python
# blog/urls.py
path('<slug:slug>/', views.detail, name='detail')

# shop/urls.py
path('<int:pk>/', views.detail, name='detail')
```

Тепер у шаблоні ти пишеш:

```html
<a href="{% url 'detail' 5 %}">...</a>
```

<i class="bi bi-question-circle"></i> Який `detail` мається на увазі — поста чи товару? Django не вгадає однозначно. Імена маршрутів **глобальні** на весь проєкт, тож два однакові `name='detail'` конфліктують: Django візьме той, що зареєстрований останнім, і посилання «поламаються» непередбачувано.

## Рішення: namespace через app_name

> **Namespace (простір імен)** — це префікс модуля, що робить ім'я маршруту унікальним. Маршрути адресуються як `<app>:<name>`.

**Як це працює.** Кожному app дають власний простір імен.

**Крок 1** — у `urls.py` модуля додаєш `app_name`:

```python
# blog/urls.py
from django.urls import path
from . import views

app_name = 'blog'           # ← простір імен цього модуля

urlpatterns = [
    path('', views.index, name='index'),
    path('<slug:slug>/', views.detail, name='detail'),
]
```

```python
# shop/urls.py
from django.urls import path
from . import views

app_name = 'shop'

urlpatterns = [
    path('', views.index, name='index'),
    path('<int:pk>/', views.detail, name='detail'),
]
```

**Крок 2** — тепер звертаєшся з префіксом модуля, і двозначності немає:

```html
<a href="{% url 'blog:detail' post.slug %}">Пост</a>
<a href="{% url 'shop:detail' product.pk %}">Товар</a>
```

> <i class="bi bi-lightbulb"></i> Аналогія: `app_name` — це як **прізвище**. У класі може бути дві Олени, тому кличуть «Олена Коваль» і «Олена Шевченко». `blog:detail` і `shop:detail` — той самий принцип: ім'я + «прізвище» модуля.

## Тег `{% url %}` детально

**Як це працює.** `{% url %}` будує **адресу за іменем маршруту**, а не пише її вручну. Це головна причина взагалі давати маршрутам імена: якщо завтра зміниш `path`, усі посилання оновляться самі.

```html
{# без аргументів — статичний маршрут #}
<a href="{% url 'library:index' %}">Каталог</a>

{# позиційний аргумент — динамічна частина URL #}
<a href="{% url 'library:detail' book.pk %}">{{ book.title }}</a>

{# іменований аргумент — якщо в path() частина названа #}
<a href="{% url 'movies:reviews' movie_slug=movie.slug %}">Рецензії</a>

{# зберегти результат у змінну шаблону #}
{% url 'shop:detail' product.pk as product_url %}
<a href="{{ product_url }}">Купити</a>
```

> <i class="bi bi-exclamation-triangle"></i> Кількість і порядок аргументів у `{% url %}` мають збігатися з динамічними частинами `path()`. Для `path('<int:pk>/reviews/<slug:slug>/')` треба передати **обидва** значення.

## Те саме у Python-коді: `reverse` і `redirect`

**Визначення.** **`reverse`** — функція, що робить те саме, що `{% url %}`, але в Python-коді: за іменем маршруту (з namespace) повертає готовий рядок-адресу.

**Як це працює.** Namespace працює скрізь, де адресуєш маршрут за іменем — не лише в шаблонах:

```python
from django.urls import reverse
from django.shortcuts import redirect

# reverse → повертає рядок з адресою
url = reverse('blog:detail', args=['my-first-post'])   # → '/blog/my-first-post/'
url = reverse('shop:detail', kwargs={'pk': 5})         # → '/shop/5/'

# redirect → одразу перенаправляє (приймає ім'я маршруту так само)
return redirect('shop:index')
return redirect('movies:detail', pk=movie.id)
```

Найкорисніше застосування `reverse` — метод **`get_absolute_url`** на моделі. Django (і адмінка, і CBV) знає цю конвенцію: якщо модель має `get_absolute_url`, з'являється кнопка «Переглянути на сайті», а `redirect(obj)` спрацює автоматично:

```python
# library/models.py
from django.urls import reverse

class Book(models.Model):
    slug = models.SlugField(unique=True)

    def get_absolute_url(self):
        return reverse('library:detail', kwargs={'slug': self.slug})
```

```python
# у view після створення книги достатньо:
return redirect(book)     # Django сам викличе book.get_absolute_url()
```

## Як це лягає на `include()`

**Як це працює.** Згадай головний `root/urls.py` — він підключає модулі через `include()`:

```python
# config/urls.py
urlpatterns = [
    path('blog/', include('blog.urls')),
    path('shop/', include('shop.urls')),
    path('library/', include('library.urls')),
    path('movies/', include('movies.urls')),
]
```

Коли в `blog/urls.py` є `app_name = 'blog'`, Django автоматично прив'язує цей namespace до підключення. Тобто `app_name` у модулі + `include()` у головному роутері працюють **у парі** — окремо оголошувати namespace в `include()` не треба.

> <i class="bi bi-info-circle"></i> Хороша звичка: додавати `app_name` у **кожен** `app/urls.py` одразу, ще до того, як виникли конфлікти. Це дешево зараз і рятує від плутанини потім. Тоді ти завжди пишеш `blog:index`, `shop:index` — послідовно, без винятків.

## Навіщо: чому це архітектурно важливо

Namespacing — це те, що дозволяє проєкту **масштабуватись без хаосу**. Кожен модуль живе у власному просторі імен, маршрути не конфліктують, і ти завжди точно знаєш, на що посилаєшся. Плюс — жодних «зашитих» адрес у HTML: змінив `path` — усі `{% url %}` і `reverse` оновились самі. Без цього у великому проєкті імена маршрутів і адреси швидко перетворюються на мінне поле.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **`NoReverseMatch`** — Django не знайшов маршрут за цим іменем. Причини: забула `app_name`, друкарська помилка у префіксі (`blg:detail`), або передала не ту кількість аргументів.

> <i class="bi bi-exclamation-triangle"></i> **Забула префікс після додавання `app_name`** — щойно з'являється `app_name`, старе `{% url 'detail' %}` перестає працювати; треба всюди `{% url 'blog:detail' %}`. Це очікувано: namespace тепер обов'язковий для цього app.

> <i class="bi bi-exclamation-triangle"></i> **Плутанина `args` vs `kwargs`** у `reverse` — `args=[...]` для позиційних, `kwargs={...}` для іменованих частин `path()`. Змішувати в одному виклику не можна.

## Підсумок

- Імена маршрутів **глобальні**, тому однакові `name=` у різних apps конфліктують.
- Рішення: `app_name = '<app>'` у `urls.py` модуля → адресуєш як `blog:detail`, `shop:detail`.
- У шаблоні — тег `{% url '<app>:<name>' arg %}`; у Python — `reverse('<app>:<name>', args=[...])` і `redirect('<app>:<name>', ...)`.
- Метод моделі **`get_absolute_url`** (через `reverse`) — конвенція, яку розуміють адмінка й `redirect(obj)`.
- `app_name` + `include()` діють у парі; додавай `app_name` у кожен модуль одразу — це масштабованість без плутанини.

> <i class="bi bi-book"></i> Деталі — у доці: docs.djangoproject.com → «URL dispatcher» → «URL namespaces» і «Reversing namespaced URLs».
