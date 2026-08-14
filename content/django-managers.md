# Менеджери й власні вибірки

`objects` у `Model.objects.filter(...)` — це менеджер. Через нього починається будь-який запит до бази. Django дає стандартний менеджер із `all()`, `filter()`, `get()`, а власний потрібен, коли ти хочеш додати до цього набору свої іменовані вибірки й підсумки.

## Проблема, яку це розв'язує

Один і той самий фільтр розповзається по проєкту:

```python
# blog/views.py
def post_list(request):
    posts = Post.objects.filter(status='published', published_at__lte=timezone.now())
    ...

def archive(request, year):
    posts = Post.objects.filter(status='published', published_at__lte=timezone.now(), published_at__year=year)
    ...
```

Коли правило «що вважається опублікованим» зміниться, доведеться згадати всі місця, де воно записане. Менеджер дає цьому правилу ім'я й одне місце існування.

## Як створити

Клас із методами й один рядок у моделі:

```python
# blog/models.py
class PostQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status='published', published_at__lte=timezone.now())


class Post(models.Model):
    status = models.CharField(max_length=10, default='draft')
    published_at = models.DateTimeField(null=True, blank=True)

    objects = PostQuerySet.as_manager()      # ← під'єднання; без нього методів не буде
```

```python
# blog/views.py
posts = Post.objects.published()
```

`as_manager()` перетворює клас-queryset на менеджер. Ім'я `objects` не обов'язкове, але щойно модель отримує власний менеджер, автоматичний `objects` більше не створюється — тому власний зазвичай так і називають.

## Головне: що таке `self`

Усередині методу `self` — це **поточна вибірка**, а не вся таблиця. Метод працює з тим набором, на якому його викликали:

```python
# python manage.py shell
Post.objects.published()                       # усі опубліковані
Post.objects.filter(author=user).published()   # опубліковані цього автора
```

Тому метод не приймає користувача чи автора аргументом — фільтр ставлять **перед** викликом. Завдяки цьому той самий `published()` придатний для будь-якої вибірки.

## Два види методів

**Повертають набір** — їх можна ланцюжити далі:

```python
# carts/models.py
class CartItemQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(user=user).select_related('product')
```

```python
CartItem.objects.for_user(request.user).order_by('-date')
```

**Повертають значення** — на них ланцюжок завершується:

```python
# carts/models.py
    def total_price(self):
        return sum((item.subtotal for item in self), Decimal('0.00'))

    def items_count(self):
        return sum(item.quantity for item in self)
```

```python
# carts/views.py
items = CartItem.objects.for_user(request.user)
total = items.total_price()
count = items.items_count()
```

Метод `total_price()` використовує властивість `subtotal` із моделі: рядок знає власну суму, набір складає їх разом. Кожен рівень робить свою частину.

> <i class="bi bi-info-circle"></i> Збережи вибірку у змінну, як у прикладі вище. Django кешує результат після першого проходу, тож обидва підсумки на одному об'єкті `items` дадуть **один** запит до бази. Два окремі виклики `CartItem.objects.for_user(user)` — це дві різні вибірки й два запити.

## Приклад повністю: до і після

```python
# carts/views.py — до
def index_view(request):
    items = CartItem.objects.filter(user=request.user).select_related('product')
    total = Decimal('0.00')
    for item in items:
        total += item.product.price * item.quantity
    return render(request, 'carts/index.html', {'user_items': items, 'total': total})
```

```python
# carts/models.py — після
class CartItemQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(user=user).select_related('product')

    def total_price(self):
        return sum((item.subtotal for item in self), Decimal('0.00'))


class CartItem(models.Model):
    ...
    objects = CartItemQuerySet.as_manager()
```

```python
# carts/views.py — після
def index_view(request):
    items = CartItem.objects.for_user(request.user)
    return render(request, 'carts/index.html', {'user_items': items, 'total': items.total_price()})
```

Виграш видно, коли той самий підсумок знадобиться ще й у лічильнику шапки та на сторінці оформлення замовлення: там буде `items.total_price()`, а не скопійований цикл.

## Ще приклади

```python
# library/models.py
class BookQuerySet(models.QuerySet):
    def available(self):
        return self.filter(copies_out__lt=F('copies_total'))

    def by_genre(self, genre):
        return self.filter(genres__name=genre)
```

```python
Book.objects.available()                      # доступні
Book.objects.available().by_genre('фантастика')  # доступні в жанрі
```

```python
# shop/models.py
class OrderQuerySet(models.QuerySet):
    def paid(self):
        return self.filter(status='paid')

    def revenue(self):
        return sum((order.total for order in self), Decimal('0.00'))
```

```python
Order.objects.paid().revenue()                       # виторг за весь час
Order.objects.paid().filter(date__year=2026).revenue()  # за рік
```

Останній рядок показує сенс поділу на два види методів: `paid()` звужує набір, звичайний `filter()` звужує далі, а `revenue()` завершує ланцюжок числом.

## Підрахунок на боці бази

Коли рядків стає багато, цикл у методі замінюють запитом — код у view при цьому не змінюється:

```python
# carts/models.py
from django.db.models import DecimalField, F, Sum

    def total_price(self):
        result = self.aggregate(
            total=Sum(F('product__price') * F('quantity'), output_field=DecimalField()),
        )
        return result['total'] or Decimal('0.00')
```

- `aggregate()` виконує підрахунок у базі й повертає **словник**: `{'total': Decimal('1250.00')}`.
- `F('product__price')` означає «значення поля з бази»; подвійне підкреслення йде по зв'язку — з рядка кошика в товар.
- `output_field=DecimalField()` потрібен, бо множаться поля різних типів і Django не вгадує тип результату.
- На порожній вибірці `Sum` повертає `None` — звідси `or Decimal('0.00')`.

Для кошика на десяток позицій різниці немає; для списку на тисячі рядків база виграє помітно. Починати з циклу цілком нормально.

## Кілька менеджерів

Модель може мати їх кілька — наприклад, повний набір і звужений:

```python
# blog/models.py
class PublishedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(status='published')


class Post(models.Model):
    objects = models.Manager()          # повний набір
    published = PublishedManager()      # лише опубліковані
```

```python
Post.objects.count()      # усі
Post.published.count()    # лише опубліковані
```

> <i class="bi bi-exclamation-triangle"></i> Менеджер, оголошений **першим**, стає типовим для моделі — його використовують адмін-панель і пов'язані об'єкти. Якщо першим поставити звужений, частина записів зникне з адмінки. Тому `objects` лишають повним і оголошують його першим.

## Як написати свій

1. **Знайди повторення.** Той самий `filter(...)` або той самий цикл підрахунку у двох місцях — це кандидат.
2. **Дай йому ім'я словами.** «Опубліковані», «доступні», «цього користувача», «загальна сума».
3. **Перенеси код у клас-queryset, замінивши вибірку на `self`.** Було `CartItem.objects.filter(user=user)` — стало `self.filter(user=user)`.
4. **Під'єднай:** `objects = MyQuerySet.as_manager()` у моделі.
5. **Заміни повторення на виклики.**

## Спробуй сама

**Задача 1.** Створи `CartItemQuerySet` із методом `for_user()` і використай його в `index_view` замість `filter(user=request.user)`.
Перевірка: сторінка кошика працює як раніше.

**Задача 2.** Додай `total_price()` і `items_count()`, а потім прибери цикли підрахунку з обох AJAX-в'юх.
Перевірка: сума й лічильник у шапці збігаються з тим, що було.

**Задача 3.** Додай до `Product` менеджер із методом `in_stock()`, який повертає лише товари з `count > 0`, і застосуй його в каталозі.
Питання: чи можна після `in_stock()` дописати `.order_by('price')`? Від чого це залежить?

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Немає `objects = …as_manager()` | `AttributeError`: клас-queryset ні з чим не пов'язаний |
| Метод приймає користувача аргументом | Дублює роботу фільтра; вибірку звужують перед викликом |
| Метод-значення в середині ланцюжка | `sum()` повертає число, і `.order_by()` після нього неможливий |
| Дві окремі вибірки замість збереженої змінної | Кожна робить власний запит до бази |
| Звужений менеджер оголошено першим | Адмінка й пов'язані об'єкти бачать неповний набір |
| `aggregate()` без обробки `None` | Порожня вибірка ламає сторінку або дає `None` у шаблоні |
| Логіка кількох моделей у менеджері | Менеджер відповідає за вибірки своєї моделі; складні сценарії виносять в окремий модуль |

## Підсумок

- Менеджер — це `objects`; власний клас додає до нього іменовані вибірки й підсумки.
- `self` усередині методу — поточна вибірка, тому фільтр ставлять перед викликом, а метод лишається універсальним.
- Методи, що повертають набір, ланцюжаться; методи, що повертають значення, завершують ланцюжок.
- `objects = MyQuerySet.as_manager()` обов'язковий, і власний менеджер скасовує автоматичний `objects`.
- Внутрішню реалізацію (цикл або `aggregate`) можна змінити пізніше, не чіпаючи код у views.
- Кілька менеджерів допустимі, але першим оголошують повний — інакше адмінка втратить записи.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/db/managers/" target="_blank" rel="noopener">Managers <i class="bi bi-box-arrow-up-right"></i></a></div></div>
