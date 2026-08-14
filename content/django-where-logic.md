# Де живе логіка

Коли проєкт росте, виникає питання: куди класти правила предметної області — підрахунки, перевірки, складні вибірки. Усталена відповідь у Django: логіка належить моделям, менеджерам і окремим модулям із логікою, а view лише приймає запит, звертається до них і повертає відповідь. В англомовній документації цей принцип називають «fat models, thin views».

## Проблема: уся логіка всередині view

Подивись, як легко view розпухає, коли логіка живе в ній:

```python
# ❌ shop/views.py — логіка осідає у view
def checkout(request, order_id):
    order = Order.objects.get(id=order_id)

    total = 0
    for item in order.items.all():
        total += item.price * item.quantity
    if total > 1000:
        total = total * 0.9          # знижка 10%

    order.total = total
    order.status = 'paid'
    order.save()

    return render(request, 'orders/done.html', {'order': order})
```

Тут view займається **всім**: рахує суму, застосовує знижку, змінює статус. Проблеми:

- цю логіку не можна перевикористати (а раптом сума потрібна ще й в адмінці чи API?);
- view важко читати й тестувати;
- якщо правило знижки зміниться — шукай його серед HTTP-коду.

## Рішення 1: методи моделі

«Товста модель» — це модель, яка тримає **разом** дані й операції над ними. Операцію оформляють як **метод** — звичайну функцію всередині класу моделі, що має доступ до `self` (полів цього об'єкта).

Дані й операції над ними логічно тримати в одному місці — у моделі:

```python
# shop/models.py — модель уміє рахувати сама про себе
class Order(models.Model):
    status = models.CharField(max_length=20, default='new')

    def calculate_total(self):
        total = sum(i.price * i.quantity for i in self.items.all())
        if total > 1000:
            total *= 0.9        # знижка 10%
        return total

    def mark_paid(self):
        self.total = self.calculate_total()
        self.status = 'paid'
        self.save()
```

Тепер у view лишається сама координація:

```python
# ✅ shop/views.py — view приймає запит і делегує моделі
def checkout(request, order_id):
    order = Order.objects.get(id=order_id)
    order.mark_paid()
    return render(request, 'orders/done.html', {'order': order})
```

Методи бувають двох корисних видів. **Метод-дія** щось змінює й зберігає (`mark_paid`). **Метод-обчислення** нічого не змінює, лише повертає значення — його зручно оформити як `@property`, щоб звертатись без дужок, як до поля:

```python
# blog/models.py — обчислювані властивості поста
class Post(models.Model):
    body = models.TextField()
    published_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_published(self):
        return self.published_at is not None

    @property
    def reading_time(self):
        words = len(self.body.split())
        return max(1, round(words / 200))   # хвилин на прочитання
```

У шаблоні тоді просто `{{ post.reading_time }}` — без дужок, ніби це звичайне поле.

> <i class="bi bi-pin-angle"></i> Метод бачить `self` — тобто конкретний об'єкт і всі його поля та зв'язки (`self.items`, `self.body`). Саме тому логіка «про один об'єкт» природно живе методом моделі.

## Рішення 2: кастомний менеджер (логіка про набір об'єктів)

### Метод моделі чи метод менеджера

Обидва пишуться в `models.py` і обидва починаються з `self`, тому їх легко переплутати. Різниця в тому, що саме означає `self`:

| Клас | `self` — це | Приклад методу |
|---|---|---|
| `class CartItem(models.Model)` | **один рядок** таблиці | `subtotal` — ціна × кількість цього рядка |
| `class CartItemQuerySet(models.QuerySet)` | **набір рядків** | `total_price`, `items_count` — підсумки по всьому набору |

```python
# carts/models.py
class CartItem(models.Model):
    ...

    @property
    def subtotal(self):
        return self.product.price * self.quantity      # self — цей рядок


class CartItemQuerySet(models.QuerySet):
    def total_price(self):
        return sum((item.subtotal for item in self), Decimal('0.00'))   # self — набір
```

Верхній рівень використовує нижній: рядок знає власну суму, набір складає їх разом.

Мірило для вибору: якщо для обчислення достатньо **одного** об'єкта — це метод моделі; якщо треба перебрати **кілька** — метод менеджера.

> <i class="bi bi-exclamation-triangle"></i> `self.product` у методі моделі — це **один** пов'язаний об'єкт (`ForeignKey`), тому `self.product.all()` дає `AttributeError`. Метод `.all()` є лише у `ManyToManyField` і в зворотних зв'язках: `post.comments.all()`, `movie.genres.all()`.


**Менеджер** — це той самий `objects`, через який ти робиш `.all()`, `.filter()`, `.get()`. Django дає стандартний `Model.objects`, але ти можеш написати **власний менеджер** з іменованими запитами.

Якщо метод моделі — про **один** об'єкт, то менеджер — про **набір** об'єктів. Коли той самий `filter(...)` повторюється у кількох views, винеси його в менеджер під зрозумілою назвою:

```python
# blog/models.py
class PostQuerySet(models.QuerySet):
    def published(self):
        return self.filter(published_at__isnull=False)

    def by_author(self, author):
        return self.filter(author=author)


class Post(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    published_at = models.DateTimeField(null=True, blank=True)

    objects = PostQuerySet.as_manager()   # ← підключаємо власний менеджер
```

Тепер замість «магічного» фільтра у view пишеш людською мовою — і запити **ланцюжаться**:

```python
# ✅ читається як речення
Post.objects.published()                    # усі опубліковані
Post.objects.published().by_author(user)    # опубліковані цього автора
```

Той самий прийом на іншому домені — бібліотека:

```python
# library/models.py
class BookQuerySet(models.QuerySet):
    def available(self):
        return self.filter(copies_left__gt=0)


class Book(models.Model):
    title = models.CharField(max_length=200)
    copies_left = models.PositiveIntegerField(default=0)

    objects = BookQuerySet.as_manager()

# у view: Book.objects.available()  замість  Book.objects.filter(copies_left__gt=0)
```

### Що таке `self` у методі менеджера

Метод працює з тим набором, на якому його викликали, — `self` усередині означає «поточна вибірка», а не вся таблиця:

```python
# python manage.py shell
CartItem.objects.total_price()                            # усі рядки таблиці
CartItem.objects.filter(user=request.user).total_price()  # лише цього користувача
CartItem.objects.for_user(request.user).total_price()     # те саме, названим фільтром
```

Тому метод не «знає» про користувача й не має його знати: фільтр ставлять перед викликом, а сам метод лишається придатним для будь-якої вибірки — кошика одного користувача, замовлень за місяць, товарів однієї категорії.

### Методи, що повертають значення

Методи менеджера бувають двох видів. Перший повертає **набір** — такі ланцюжаться далі (`published().by_author(user)`). Другий повертає **готове значення** — суму, кількість, середню оцінку; на ньому ланцюжок закінчується.

```python
# carts/models.py
from decimal import Decimal

from django.db import models
from django.db.models import DecimalField, F, Sum


class CartItemQuerySet(models.QuerySet):
    def for_user(self, user):                      # повертає набір → ланцюжиться
        return self.filter(user=user).select_related('product')

    def total(self):                               # повертає число → завершує ланцюжок
        result = self.aggregate(
            total=Sum(F('product__price') * F('quantity'), output_field=DecimalField()),
        )
        return result['total'] or Decimal('0.00')

    def items_count(self):
        return self.aggregate(n=Sum('quantity'))['n'] or 0


class CartItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    objects = CartItemQuerySet.as_manager()
```

```python
# carts/views.py
items = CartItem.objects.for_user(request.user)
total = items.total()             # одна сума, порахована базою
count = items.items_count()       # кількість штук, а не рядків
```

Виграш видно в порівнянні з циклом у view: `Sum(F('product__price') * F('quantity'))` перетворюється на один SQL-запит, який множить і додає на боці бази. Цикл же завантажує всі рядки в пам'ять, звертається до `item.product` на кожній ітерації (N+1 запитів) і легко губить `quantity`.

> <i class="bi bi-info-circle"></i> `aggregate()` повертає словник, тому результат дістають за ключем. Якщо рядків немає, значення буде `None` — звідси `or Decimal('0.00')` і `or 0`, інакше сторінка кошика впаде на порожньому кошику.

Ту саму суму можна порахувати й циклом — це коректно, але з двома застереженнями:

```python
# carts/models.py
def total_price(self):
    return sum((item.product.price * item.quantity for item in self), Decimal('0.00'))
```

По-перше, кожне звернення до `item.product` — окремий запит, якщо у вибірці немає `select_related('product')`. По-друге, `sum()` без початкового значення повертає на порожньому наборі ціле `0`, а не `Decimal('0.00')`, і це згодом дає `'0'` замість `'0.00'` у відповіді або помилку при складанні з іншим `Decimal`.

### Як вивести такий метод самому

Метод менеджера — це перенесений код із view, а не окрема конструкція. Виводиться він у три кроки.

Спершу звичайний код у view:

```python
# carts/views.py
items = CartItem.objects.filter(user=request.user)
total = Decimal('0.00')
for item in items:
    total += item.product.price * item.quantity
```

Далі той самий код переїжджає в клас: вибірка всередині методу вже є — це `self`, тому звернення до `objects.filter(...)` звідти зникає.

```python
# carts/models.py
class CartItemQuerySet(models.QuerySet):
    def total_price(self):
        total = Decimal('0.00')
        for item in self:                 # було: for item in items
            total += item.product.price * item.quantity
        return total
```

Цей варіант уже робочий. Останній крок — переклад циклу на запит до бази, рядок у рядок:

| У циклі | В `aggregate()` |
|---|---|
| `for item in self` | `self.aggregate(...)` — рядки обходить база |
| `item.product.price` | `F('product__price')` |
| `item.quantity` | `F('quantity')` |
| множення між ними | `F(...) * F(...)` |
| `total +=` | `Sum(...)` |
| початкове значення | `or Decimal('0.00')` для порожньої вибірки |

Нової логіки на третьому кроці не з'являється — змінюється лише те, хто виконує обчислення: Python чи база.

### QuerySet чи Manager

`QuerySet.as_manager()` — сучасний спосіб: методи доступні і на `Model.objects`, і на будь-якому проміжному наборі, тому ланцюжки працюють. Окремий клас `models.Manager` потрібен рідше — коли метод не стосується вибірки взагалі (наприклад, створює об'єкт за складними правилами) або коли треба змінити базовий набір для всієї моделі:

```python
# blog/models.py
class PublishedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_published=True)


class Post(models.Model):
    objects = models.Manager()          # стандартний, бачить усе
    published = PublishedManager()      # додатковий, лише опубліковані
```

> <i class="bi bi-exclamation-triangle"></i> Менеджер, оголошений першим, стає типовим для моделі — його використовують адмінка й пов'язані об'єкти. Якщо першим поставити менеджер із фільтром, частина записів «зникне» з адмін-панелі. Тому звужені набори додають **другим** ім'ям, лишаючи `objects` повним.

> <i class="bi bi-exclamation-triangle"></i> Рядок `objects = CartItemQuerySet.as_manager()` обов'язковий: без нього клас-queryset ні з чим не пов'язаний, і виклик `CartItem.objects.for_user(...)` дасть `AttributeError`. Ім'я при цьому може бути будь-яким, але щойно модель отримує **власний** менеджер, автоматичний `objects` більше не створюється. Тому власний менеджер зазвичай і називають `objects` — він заміщає стандартний, зберігаючи `filter()`, `get()`, `all()` і додаючи свої методи.

## Рішення 3: сервісний модуль (логіка між кількома моделями)

**Сервісний модуль** (`services.py`) — звичайний файл у твоєму app, куди виносять логіку, що зачіпає **кілька моделей** одразу.

Іноді операція не належить жодній моделі окремо, бо стосується кількох (наприклад «оформити замовлення» зачіпає `Cart`, `Order`, `Product`, склад). Тоді її кладуть не в одну модель, а в окремий сервісний модуль:

```python
# shop/services.py
def place_order(user, cart):
    order = Order.objects.create(user=user)
    for item in cart.items.all():
        order.items.create(product=item.product, quantity=item.quantity)
        item.product.reduce_stock(item.quantity)   # оновити склад
    cart.clear()
    return order
```

Той самий підхід на домені кіно — «залишити рецензію» зачіпає і `Review`, і `Movie` (перерахувати середній рейтинг):

```python
# movies/services.py
def add_review(user, movie, text, score):
    review = Review.objects.create(user=user, movie=movie, text=text, score=score)
    movie.recalculate_rating()   # оновити агрегат у фільмі
    return review
```

View викликає `place_order(...)` чи `add_review(...)` і не знає деталей усередині.

> <i class="bi bi-pin-angle"></i> Сервіси — не вбудована «магія» Django, а просто конвенція: «складну логіку між моделями — в окремий файл, не у view». У доці Django ти не знайдеш слова `services.py` — це домовленість спільноти.

## Куди що класти — коротка карта

| Логіка про… | Кладеш у… | Приклад |
|---|---|---|
| один об'єкт (його поля, стан) | **метод / `@property` моделі** | `order.mark_paid()`, `post.reading_time` |
| набір об'єктів (запити, фільтри) | **менеджер / QuerySet** | `Post.objects.published()` |
| кілька моделей разом | **`services.py`** | `place_order(user, cart)` |
| прийняти запит і повернути відповідь | **view** | `checkout(request, ...)` |
| показ готових даних | **template** | `{{ post.reading_time }}` |

## Що чим має займатись

| Шар | Відповідає за | НЕ має |
|---|---|---|
| **View** | прийняти запит, викликати логіку, повернути відповідь | складних обчислень, правил бізнесу |
| **Model** | дані + операції над ними (рахунки, статуси, запити) | роботи з HTTP-запитом/відповіддю |
| **Template** | показ готових даних | будь-яких обчислень/рішень |

## Що це дає при рості проєкту

- **Перевикористання:** `order.calculate_total()` і `Post.objects.published()` працюють і у view, і в адмінці, і в API — логіка одна.
- **Тестування:** модель/менеджер/сервіс легко тестувати без імітації HTTP-запиту.
- **Читабельність:** дивишся у view — бачиш *що* робиться; дивишся в модель — бачиш *як*.
- **Стійкість до змін:** правило знижки чи «що вважати опублікованим» живе в одному місці, а не розповзається по views.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Обчислення й правила всередині view | Ту саму логіку неможливо викликати з команди `manage.py`, адмінки чи тесту без імітації запиту |
| Логіка в шаблоні | Розмітка починає ухвалювати рішення; перевірити її автоматично вже не вийде |
| Метод моделі, що працює з кількома моделями | Модель починає знати про чужі таблиці; такі сценарії виносять в окремий модуль із логікою |
| Запити до бази розкидані по views | Однакові фільтри дублюються й розходяться; їх збирають у менеджер (`Book.objects.available()`) |
| Власний менеджер замінив `objects` без потреби | Стандартні запити перестають працювати; кастомний менеджер додають окремим ім'ям або зберігають `objects` |
| Модуль із логікою імпортує view | Зворотна залежність робить код нерозв'язним; логіка не має знати про HTTP-рівень |

## Підсумок

- Принцип **«fat models, thin views»**: бізнес-логіка — у моделях/менеджерах/сервісах, не у views.
- **View — офіціант:** приймає запит, делегує, повертає відповідь; не рахує і не вирішує.
- Логіку про **один об'єкт** — оформляй **методом** чи **`@property`** моделі.
- Логіку про **набір об'єктів** (повторювані запити) — виноси в **кастомний менеджер / QuerySet** (`Post.objects.published()`).
- Логіку між **кількома моделями** — у **`services.py`**.
- Виграш: перевикористання, легше тестування, читабельність, стійкість до змін — критично при рості проєкту.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/db/models/" target="_blank" rel="noopener">Models <i class="bi bi-box-arrow-up-right"></i></a></div></div>
