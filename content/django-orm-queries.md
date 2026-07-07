# ORM-запити: QuerySet API

Модель описує **структуру** даних, а `QuerySet` API — це те, як ти ці дані **дістаєш і змінюєш**, не пишучи SQL руками. Кожна модель має менеджер `objects`, через який починається будь-який запит. Цей урок — практичний довідник по найчастіших операціях із базою. Приклади навмисно з **різних доменів** (`Book`, `Product`, `Post`, `Movie`, `Order`, `User`), щоб ти бачила: те саме API працює над будь-якою моделлю.

## Дістати дані: all, filter, exclude, get

**Визначення.** Це чотири базові способи вибрати рядки з таблиці через менеджер `Model.objects`.

**Як це працює.**

```python
Book.objects.all()                     # усі книги
Book.objects.filter(is_available=True) # усі, що відповідають умові
Book.objects.exclude(pages=0)          # усі, КРІМ тих, що відповідають
Book.objects.get(isbn='978-0000')      # РІВНО один об'єкт
```

- `.all()`, `.filter()` / `.exclude()` повертають **QuerySet** — колекцію (можливо порожню, можливо з тисячами об'єктів);
- `.get()` повертає **один** об'єкт — і саме тому він примхливий щодо кількості.

**Навіщо.** Розділення чітке: `filter/exclude` — коли очікуєш багато (або нуль) результатів; `get` — коли очікуєш рівно один (наприклад, за унікальним `pk`, `isbn`, `email`).

> <i class="bi bi-exclamation-triangle"></i> `.get()` кидає винятки, якщо кількість не дорівнює одиниці:
> - **`Model.DoesNotExist`** — якщо не знайдено жодного об'єкта (`Book.DoesNotExist`);
> - **`Model.MultipleObjectsReturned`** — якщо знайдено більше одного.
>
> Тому для detail-сторінок замість голого `.get()` зазвичай беруть `get_object_or_404` (див. урок про shortcuts).

> <i class="bi bi-lightbulb"></i> Аналогія з SQLAlchemy: `filter()` тут схожий на `Query.filter_by()`, а `.get()` — на `session.get()`, тільки Django кидає власні винятки моделі замість повернення `None`.

## Досліджувати результат: order_by, count, exists, first, last

**Визначення.** Методи, що впорядковують QuerySet або дістають про нього коротку інформацію.

**Як це працює.**

```python
Post.objects.order_by('created_at')           # за зростанням дати
Post.objects.order_by('-created_at')          # мінус = за спаданням (новіші вгорі)
Post.objects.order_by('author', '-views')     # спершу за автором, потім за переглядами ↓
Post.objects.count()                          # скільки об'єктів (SELECT COUNT)
Post.objects.filter(is_published=True).exists()  # True/False — чи є хоч один
Post.objects.first()                          # перший об'єкт або None
Post.objects.last()                           # останній об'єкт або None
```

- `order_by` приймає кілька полів (сортування за пріоритетом), а `'?'` дає випадковий порядок: `Movie.objects.order_by('?').first()` — випадковий фільм;
- `.first()` / `.last()` повертають `None`, якщо набір порожній, — тому їх зручно перевіряти без винятків.

**Навіщо.** `.exists()` і `.count()` не тягнуть об'єкти в пам'ять — вони питають БД напряму, тому набагато дешевші, ніж `len(qs)` чи `if qs:`, коли тобі потрібне лише «чи є» або «скільки».

> <i class="bi bi-info-circle"></i> Хочеш перевірити наявність — пиши `if qs.exists():`, а не `if qs:`. Обидва працюють, але `.exists()` виконує легкий запит замість завантаження всього набору.

## Field lookups: фільтрація за умовами

**Визначення.** Field lookups — це «модифікатори» полів через подвійне підкреслення `__`, що задають **як саме** порівнювати значення.

**Як це працює.** Різні lookups на різних моделях:

```python
Product.objects.filter(price__gte=100)          # ціна >= 100
Product.objects.filter(price__lte=500)          # ціна <= 500
Product.objects.filter(price__range=(100, 500)) # ціна від 100 до 500 включно
Movie.objects.filter(title__icontains='dune')   # назва містить 'dune' (БЕЗ регістру)
Book.objects.filter(pk__in=[1, 2, 3])           # pk серед перелічених
User.objects.filter(email__endswith='@ukr.net') # email закінчується на...
Order.objects.filter(shipped_at__isnull=True)   # ще не відправлені (поле = NULL)
Post.objects.filter(created_at__year=2026)      # опубліковані 2026 року
```

| Lookup | Значення |
|---|---|
| `__gte` / `__lte` | більше-дорівнює / менше-дорівнює |
| `__gt` / `__lt` | суворо більше / менше |
| `__range=(a, b)` | значення в діапазоні `[a, b]` включно |
| `__contains` / `__icontains` | містить підрядок (з регістром / без, `i` = insensitive) |
| `__startswith` / `__endswith` | починається / закінчується підрядком |
| `__in` | значення в переліку/списку |
| `__isnull=True/False` | поле дорівнює / не дорівнює `NULL` |
| `__year` / `__month` / `__date` | частини дати |

**Проходження по зв'язках.** Через `__` можна фільтрувати ще й **по полях пов'язаної моделі**:

```python
# усі книги, автор яких з України (Book → author → country)
Book.objects.filter(author__country='UA')

# усі замовлення користувачів із заблокованим акаунтом (Order → user)
Order.objects.filter(user__is_active=False)
```

**Навіщо.** Lookups покривають типові SQL-умови (`>=`, `LIKE`, `IN`, `IS NULL`) декларативно, без ручного SQL. Кілька умов у межах одного `.filter()` поєднуються через **І (AND)**.

## Ланцюжки й лінивість QuerySet

**Визначення.** QuerySet **лінивий**: запит до БД **не виконується** в момент його створення. Він відкладається до того, коли ти реально звернешся до даних.

**Як це працює.** Фільтри можна нанизувати ланцюжком — це не робить кількох запитів:

```python
qs = Movie.objects.filter(is_released=True)   # SQL ще НЕ виконано
qs = qs.filter(rating__gte=8)                 # досі НЕ виконано
qs = qs.exclude(genre='horror')               # досі НЕ виконано
qs = qs.order_by('-rating')                    # досі НЕ виконано

for movie in qs:   # ← ОСЬ ТУТ виконується один SELECT
    print(movie.title)
```

Запит спрацьовує лише при **зверненні**: цикл `for`, `list(qs)`, зріз `qs[:10]`, `len()`, друк у шаблоні. До того моменту Django просто «накопичує» умови й збирає з них один оптимальний SQL.

**Навіщо.** Лінивість дає дві переваги: можна будувати запит поступово (наприклад, додавати фільтри залежно від параметрів URL), і Django робить **один** ефективний запит замість багатьох проміжних.

> <i class="bi bi-exclamation-triangle"></i> Зворотний бік — кешування. Якщо звернутися до одного QuerySet двічі в різних місцях, він може виконати запит повторно. Коли результат потрібен кілька разів, збережи його в список: `movies = list(qs)`.

## Створення: create, save, bulk_create

**Визначення.** Три способи додати нові рядки в таблицю.

**Як це працює.**

```python
# 1) create() — INSERT одразу, повертає готовий об'єкт
post = Post.objects.create(title='Новий пост', author=user)

# 2) конструктор + save() — коли треба щось зробити перед збереженням
book = Book(title='1984', pages=328)
book.slug = slugify(book.title)
book.save()

# 3) bulk_create() — багато об'єктів ОДНИМ запитом
Product.objects.bulk_create([
    Product(name='Мишка', price=300),
    Product(name='Клавіатура', price=800),
    Product(name='Килимок', price=150),
])
```

**Навіщо.** `.create()` економить рядок порівняно з конструктором + `.save()`. А `bulk_create()` виконує **один** `INSERT` на весь список — незрівнянно швидше, ніж викликати `.save()` у циклі (там був би окремий запит на кожен об'єкт).

> <i class="bi bi-exclamation-triangle"></i> `bulk_create()` **не викликає** метод `save()` моделі й сигнали `pre_save`/`post_save` — якщо в моделі є логіка в `save()`, масове створення її омине.

## Зміна: save, update

**Визначення.** Змінити один об'єкт або цілий набір.

**Як це працює.**

```python
# Один об'єкт: змінити атрибут і зберегти
product = Product.objects.get(pk=5)
product.price = 999
product.save()

# Цілий QuerySet — один UPDATE на всі рядки
Order.objects.filter(status='new').update(status='processing')
Movie.objects.filter(is_released=False).update(rating=None)
```

**Навіщо.** `queryset.update()` виконує **одну** SQL-команду на весь набір — набагато швидше, ніж цикл із `.save()` по кожному об'єкту.

> <i class="bi bi-exclamation-triangle"></i> `queryset.update()`, як і `bulk_create`, НЕ викликає `save()` моделі й сигнали. Якщо в моделі є кастомна логіка в `save()`, масовий `update()` її омине — враховуй це.

## Видалення: delete

```python
# один об'єкт
post = Post.objects.get(pk=10)
post.delete()

# масово — один DELETE на весь набір
Order.objects.filter(status='cancelled').delete()
```

> <i class="bi bi-exclamation-triangle"></i> Видалення каскадне: якщо в об'єкта є пов'язані записи через `ForeignKey(on_delete=CASCADE)`, вони теж зникнуть. Наприклад, видалення `Post` забере й усі його коментарі.

## Q і F: складніші умови

**Визначення.** `Q` дозволяє будувати умови з **АБО (OR)**, а `F` — посилатися на **інше поле** того самого рядка прямо в запиті.

**Як це працює.**

```python
from django.db.models import Q, F

# Q: назва містить 'Django' АБО ціна менша за 500
Book.objects.filter(Q(title__icontains='django') | Q(price__lt=500))

# Q: НЕ (~) — усі пости, крім чернеток
Post.objects.filter(~Q(status='draft'))

# F: товари, де ціна зі знижкою менша за звичайну ціну (поле проти поля)
Product.objects.filter(sale_price__lt=F('price'))

# F: підняти ціну всім на 100 — на рівні БД, без завантаження об'єктів
Product.objects.update(price=F('price') + 100)
```

**Навіщо.** Звичайний `.filter(a=1, b=2)` — це завжди **І**. Для **АБО** потрібен `Q` (`|` — або, `&` — і, `~` — не). А `F` дозволяє порівнювати чи змінювати поле відносно іншого поля прямо в базі, без зайвого циклу в Python.

## Агрегація й анотація: aggregate, annotate

**Визначення.** `aggregate` рахує **одне** підсумкове число по всьому набору; `annotate` додає обчислене поле **до кожного** об'єкта.

**Як це працює.**

```python
from django.db.models import Count, Avg, Sum, Max

# aggregate → словник з одним підсумком
Product.objects.aggregate(Avg('price'))      # {'price__avg': 512.4}
Order.objects.aggregate(total=Sum('amount')) # {'total': 18400}

# annotate → у кожного автора з'являється .book_count
from django.db.models import Count
authors = Author.objects.annotate(book_count=Count('books'))
for a in authors:
    print(a.name, a.book_count)              # кількість книг кожного автора
```

**Навіщо.** Ці підрахунки робить **база**, а не Python-цикл, — тому вони швидкі навіть на великих таблицях. `Count`, `Sum`, `Avg`, `Max`, `Min` — найчастіші функції.

## values і values_list: без повних об'єктів

**Визначення.** Замість повноцінних об'єктів моделі повернути лише окремі поля — як словники (`values`) або кортежі/плоский список (`values_list`).

**Як це працює.**

```python
# словники з обраними полями
Book.objects.values('title', 'price')
# <QuerySet [{'title': '1984', 'price': 250}, ...]>

# кортежі
Product.objects.values_list('name', 'price')
# <QuerySet [('Мишка', 300), ('Клавіатура', 800), ...]>

# flat=True — плоский список одного поля
User.objects.values_list('email', flat=True)
# <QuerySet ['a@ex.com', 'b@ex.com', ...]>
```

**Навіщо.** Коли потрібні лише кілька полів (наприклад, список email для розсилки), `values_list(..., flat=True)` дешевший за завантаження цілих об'єктів — менше даних із БД і менше пам'яті.

## Де це в проєкті

QuerySet API — це **будь-яка робота з БД**: списки, фільтри, пошук, форми, адмінка. Типове view-каталог (тут на блозі, але патерн однаковий для магазину, бібліотеки, кіно):

```python
def post_feed(request):
    posts = Post.objects.filter(is_published=True).order_by('-created_at')

    query = request.GET.get('q')
    if query:                                   # фільтр додається ЛІНИВО
        posts = posts.filter(
            Q(title__icontains=query) | Q(body__icontains=query)
        )

    context = {
        'posts': posts,                         # SQL виконається в шаблоні
        'total': posts.count(),
    }
    return render(request, 'blog/feed.html', context)
```

Тут добре видно лінивість: фільтр за пошуком додається лише за потреби, а реальний запит іде один раз — коли шаблон почне ітерувати `posts`.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **`.get()` без гарантії унікальності** → `MultipleObjectsReturned`. Використовуй `.get()` лише за унікальним полем; для «одного зі списку» бери `.filter(...).first()`.

> <i class="bi bi-exclamation-triangle"></i> **`if qs:` замість `if qs.exists():`** — завантажує весь набір заради простої перевірки. Для «чи є хоч один» — `.exists()`.

> <i class="bi bi-exclamation-triangle"></i> **`update()` / `bulk_create()` минають `save()` і сигнали** — кастомна логіка моделі не спрацює. Коли вона потрібна, ітеруй і викликай `.save()`.

> <i class="bi bi-info-circle"></i> Той самий результат кілька разів? Збережи `list(qs)`, щоб не повторювати SQL.

## Підсумок

- `objects.all() / .filter() / .exclude()` повертають **QuerySet** (багато); `.get()` — рівно **один** об'єкт і кидає `DoesNotExist` / `MultipleObjectsReturned`.
- `.order_by()` (кілька полів, `-` для спадання), `.count()`, `.exists()`, `.first()/.last()` досліджують набір; `.exists()` і `.count()` дешевші за завантаження всіх об'єктів.
- **Field lookups** через `__` (`gte`, `lte`, `range`, `contains`, `icontains`, `in`, `isnull`, дати) задають умову; у межах `.filter()` вони поєднуються через **І**; через `__` можна йти й по зв'язках (`author__country`).
- QuerySet **лінивий**: ланцюжок фільтрів збирається в один SQL, що виконується лише при зверненні до даних.
- Запис: `.create()`, конструктор + `.save()`, `bulk_create()`; зміна `obj.save()` / масовий `queryset.update()`; видалення `.delete()` (масові операції — одна SQL-команда, але без сигналів).
- `Q` — умови **АБО** (`|`, `&`, `~`); `F` — посилання на поле в самій БД; `aggregate`/`annotate` — підрахунки на боці бази; `values`/`values_list` — лише потрібні поля.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">ÐÑÑÑÑÐ¹Ð½Ð° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°ÑÑÑ</span><a href="https://docs.djangoproject.com/en/stable/topics/db/queries/" target="_blank" rel="noopener">Making queries <i class="bi bi-box-arrow-up-right"></i></a></div></div>
