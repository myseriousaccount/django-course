# FBV vs CBV: два стилі views

У Django є **два способи** писати views: функціями (function-based views, **FBV**) і класами (class-based views, **CBV**). Ти вже знаєш FBV. Тут розберемо обидва, пройдемо **всі базові generic views** і розберемо, коли який обирати. Це архітектурний вибір для шару **V**. Приклади — з **різних доменів** (блог, магазин, бібліотека, кіно).

## FBV — function-based views (те, що ти вже вмієш)

> **FBV (function-based view)** — view, написана як звичайна функція `request → відповідь`.

**Як це працює.** Явно, прозоро, легко читати:

```python
# blog/views.py
from django.shortcuts import render
from .models import Post

def post_list(request):
    posts = Post.objects.all()
    return render(request, 'blog/post_list.html', {'posts': posts})
```

<i class="bi bi-plus-circle"></i> Видно весь потік згори вниз — нічого не приховано.
<i class="bi bi-plus-circle"></i> Просто для нестандартної логіки й багатьох гілок (`if`).
<i class="bi bi-dash-circle"></i> Для типових дій (показати список, форму CRUD) доводиться щоразу писати той самий шаблонний код.

## CBV — class-based views

> **CBV (class-based view)** — view, написана як клас, де Django бере на себе типову роботу, а ти лише задаєш параметри.

**Як це працює.** View стає класом:

```python
# shop/views.py
from django.views.generic import ListView
from .models import Product

class ProductList(ListView):
    model = Product
    template_name = 'shop/product_list.html'
```

Цей клас **сам** дістане всі товари, відрендерить шаблон і передасть їх у `context` — рядків коду майже немає, бо `ListView` уже знає, як показувати список.

Щоб підключити CBV у маршрутах, додають `.as_view()`:

```python
# shop/urls.py
path('', ProductList.as_view(), name='list')
```

> <i class="bi bi-exclamation-triangle"></i> Деталь: FBV у `path()` передаєш як `views.post_list` (без дужок), а CBV — як `ProductList.as_view()`. Бо маршрут очікує функцію, а `.as_view()` якраз перетворює клас на функцію.

## Generic views — готові «заготовки» CBV

**Визначення.** **Generic views** — вбудовані класи CBV під типові задачі. Сила CBV — саме в них.

| Generic view | Для чого | Дає у context |
|---|---|---|
| `TemplateView` | просто віддати шаблон (без моделі) | — |
| `ListView` | показати список об'єктів | `object_list` |
| `DetailView` | показати один об'єкт за `<pk>`/`<slug>` | `object` |
| `CreateView` | форма створення об'єкта | `form` |
| `UpdateView` | форма редагування наявного | `form`, `object` |
| `DeleteView` | підтвердження й видалення | `object` |

> <i class="bi bi-lightbulb"></i> Аналогія: FBV — це **готувати з нуля** (повний контроль, але багато ручної роботи). CBV/generic — це **напівфабрикат за рецептом**: 90% типової роботи вже зроблено, ти лише додаєш свої штрихи (модель, шаблон, поля).

### TemplateView — просто сторінка

Коли треба лише віддати шаблон (наприклад «Про нас»), без бази:

```python
from django.views.generic import TemplateView

class AboutPage(TemplateView):
    template_name = 'pages/about.html'
```

### ListView — список

```python
# library/views.py — список книжок
from django.views.generic import ListView
from .models import Book

class BookList(ListView):
    model = Book
    template_name = 'library/book_list.html'
    context_object_name = 'books'    # інакше в шаблоні буде 'object_list'
    paginate_by = 20                 # пагінація «з коробки»
```

### DetailView — один об'єкт

```python
# blog/views.py — одна стаття за slug
from django.views.generic import DetailView
from .models import Post

class PostDetail(DetailView):
    model = Post
    template_name = 'blog/post_detail.html'
    slug_field = 'slug'              # шукати за slug, а не pk
    # сам знайде об'єкт за <slug> з URL і покладе у context як 'object'
```

### CreateView / UpdateView — форми без ручної форми

`CreateView` і `UpdateView` самі будують форму з полів моделі, показують її на GET і зберігають на POST:

```python
# movies/views.py — додати й редагувати рецензію
from django.views.generic import CreateView, UpdateView
from .models import Review

class ReviewCreate(CreateView):
    model = Review
    fields = ['movie', 'text', 'score']       # які поля показати у формі
    template_name = 'movies/review_form.html'

class ReviewUpdate(UpdateView):
    model = Review
    fields = ['text', 'score']
    template_name = 'movies/review_form.html'  # можна той самий шаблон
```

> <i class="bi bi-info-circle"></i> Після успішного збереження `CreateView`/`UpdateView` роблять редірект. Куди — беруть із `get_absolute_url()` моделі або з атрибута `success_url`. Ось де стає у пригоді `get_absolute_url` з уроку про namespacing.

### DeleteView — підтвердження й видалення

```python
# shop/views.py — видалити товар
from django.views.generic import DeleteView
from django.urls import reverse_lazy
from .models import Product

class ProductDelete(DeleteView):
    model = Product
    template_name = 'shop/product_confirm_delete.html'
    success_url = reverse_lazy('shop:list')   # куди після видалення
```

> <i class="bi bi-pin-angle"></i> `reverse_lazy` (а не `reverse`) потрібен, бо `success_url` обчислюється під час завантаження класу, коли маршрути ще можуть бути не готові. `reverse_lazy` відкладає обчислення до моменту використання.

## Ці шість покривають увесь CRUD

Разом `ListView` + `DetailView` + `CreateView` + `UpdateView` + `DeleteView` дають повний **CRUD** для будь-якої моделі, а `TemplateView` — статичні сторінки. На домені кіно це виглядало б так:

```python
# movies/urls.py
urlpatterns = [
    path('', MovieList.as_view(), name='list'),              # Read (список)
    path('<slug:slug>/', MovieDetail.as_view(), name='detail'),   # Read (один)
    path('new/', MovieCreate.as_view(), name='create'),     # Create
    path('<slug:slug>/edit/', MovieUpdate.as_view(), name='update'),  # Update
    path('<slug:slug>/delete/', MovieDelete.as_view(), name='delete'), # Delete
]
```

Той самий набір маршрутів однаково лягає на блог, магазин чи бібліотеку — змінюється лише модель.

## Коли який обирати

| Ситуація | Краще |
|---|---|
| Типовий CRUD (список, деталі, форма) | **CBV** (generic) — менше коду |
| Нестандартна логіка, багато гілок | **FBV** — прозоріше |
| Вчишся / хочеш бачити весь потік | **FBV** — нічого не приховано |
| Багато однотипних сторінок | **CBV** — DRY, не дублюєш |

> <i class="bi bi-info-circle"></i> Немає «правильного» вибору на всі випадки. Багато проєктів **змішують**: прості списки/деталі/форми — на CBV, складні нетипові дії — на FBV. Почни з FBV (ти їх розумієш), а CBV додавай, коли побачиш, що пишеш той самий шаблонний код учетверте.

## Налаштування CBV: які методи перевизначати

CBV компактні, але «магічні»: багато відбувається в надкласі, якого не видно. Коли поведінку треба змінити, знай **який метод перевизначити**:

| Метод | Коли перевизначати |
|---|---|
| `get_queryset()` | звузити/відсортувати список (не всі об'єкти) |
| `get_context_data()` | додати у шаблон ще щось, крім основного об'єкта |

```python
# library/views.py — лише доступні книги + додаткова змінна в context
class BookList(ListView):
    model = Book
    template_name = 'library/book_list.html'

    def get_queryset(self):
        return Book.objects.filter(copies_left__gt=0)   # тільки доступні

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['total'] = self.get_queryset().count()  # ще одна змінна
        return context
```

> <i class="bi bi-lightbulb"></i> Тут згадується минулий урок: `Book.objects.filter(...)` краще винести в менеджер (`Book.objects.available()`) — і `get_queryset` стане однорядковим. CBV і «товсті моделі» чудово поєднуються.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Забула `.as_view()`** → `path('', ProductList)` дасть помилку, бо маршрут отримує клас, а не функцію. Завжди `ProductList.as_view()`.

> <i class="bi bi-exclamation-triangle"></i> **`context_object_name`** — за замовчуванням `ListView` кладе список як `object_list`, а `DetailView` — об'єкт як `object`. Якщо в шаблоні пишеш `{{ books }}`, а не задала `context_object_name = 'books'` — буде порожньо.

> <i class="bi bi-exclamation-triangle"></i> **Магія надкласу** — для новачка FBV часто зрозуміліші, бо весь потік видно. Це нормально: не переходь на CBV лише «бо модно», переходь, коли CBV реально економить дублювання.

## Підсумок

- **FBV** — view-функція: явно, прозоро, добре для нетипової логіки й багатьох гілок.
- **CBV** — view-клас; вбудовані **generic views** роблять типову роботу за тебе.
- Шість базових: `TemplateView` (сторінка), `ListView` (список), `DetailView` (один), `CreateView`/`UpdateView` (форми), `DeleteView` — разом це повний **CRUD**.
- У `path()`: FBV — `views.post_list`, CBV — `ClassName.as_view()`.
- Налаштовуєш CBV, перевизначаючи `get_queryset()` (який набір) і `get_context_data()` (що ще в шаблон).
- Вибір не абсолютний: типовий CRUD → CBV (менше коду), нестандартне/навчання → FBV (прозоріше); проєкти часто змішують.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">ÐÑÑÑÑÐ¹Ð½Ð° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°ÑÑÑ</span><a href="https://docs.djangoproject.com/en/stable/topics/class-based-views/" target="_blank" rel="noopener">Class-based views <i class="bi bi-box-arrow-up-right"></i></a></div></div>
