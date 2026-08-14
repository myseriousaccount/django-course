# Де живе логіка

Підрахунки, правила й складні вибірки можна писати прямо у view — і це нормальна відправна точка. Питання виникає пізніше, коли той самий код знадобився вдруге. Урок про те, за якою ознакою й куди його виносити.

## Коли виносити, а коли ні

| Ситуація | Де писати |
|---|---|
| код потрібен в одній view і більше ніде | лишається у view |
| той самий підрахунок з'явився у другій view, в адмінці чи в команді | виносиш |
| обчислення стосується **одного** об'єкта | метод моделі |
| обчислення стосується **набору** об'єктів | метод менеджера |
| дія зачіпає **кілька** моделей одразу | окремий модуль із логікою |

Порядок саме такий: спершу пиши як зручно, виноси тоді, коли з'явився другий виклик. Виносити наперед — це ускладнення без причини.

## Рівень 1: у view

Поки логіка потрібна в одному місці, вона живе там, де використовується:

```python
# carts/views.py
def index_view(request):
    items = CartItem.objects.filter(user=request.user).select_related('product')

    total = Decimal('0.00')
    for item in items:
        total += item.product.price * item.quantity

    return render(request, 'carts/index.html', {'user_items': items, 'total': total})
```

Це робочий код, і для однієї сторінки він доречний.

## Рівень 2: метод моделі

Виносять, коли обчислення стосується **одного** об'єкта. Усередині методу `self` — це конкретний рядок таблиці з усіма його полями:

```python
# carts/models.py
class CartItem(models.Model):
    quantity = models.PositiveIntegerField(default=1)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    @property
    def subtotal(self):
        return self.product.price * self.quantity
```

Тепер сума рядка доступна скрізь однаково: `item.subtotal` у Python і `{{ item.subtotal }}` у шаблоні. `@property` означає звертання без дужок — у шаблонах це обов'язково, там дужки не працюють.

Метод може не лише рахувати, а й змінювати об'єкт:

```python
# shop/models.py
class Order(models.Model):
    status = models.CharField(max_length=20, default='new')

    def mark_paid(self):
        self.status = 'paid'
        self.save(update_fields=['status'])
```

```python
# shop/views.py
order.mark_paid()          # замість трьох рядків у кожній view
```

> <i class="bi bi-exclamation-triangle"></i> `self.product` — це **один** пов'язаний об'єкт (`ForeignKey`), тому `self.product.all()` дає `AttributeError`. Метод `.all()` є лише у `ManyToManyField` і у зворотних зв'язках: `post.comments.all()`.

## Рівень 3: менеджер

Виносять, коли обчислення стосується **набору**. Менеджер — це той самий `objects`, через який ти пишеш `.filter()` і `.all()`; власні методи додають до нього своїм класом:

```python
# carts/models.py
class CartItemQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(user=user).select_related('product')

    def total_price(self):
        return sum((item.subtotal for item in self), Decimal('0.00'))


class CartItem(models.Model):
    ...
    objects = CartItemQuerySet.as_manager()     # без цього рядка методи не працюють
```

```python
# carts/views.py
items = CartItem.objects.for_user(request.user)
total = items.total_price()
```

Три речі, які треба знати про цей рівень:

- **`self` тут — поточна вибірка**, а не таблиця цілком. Тому `CartItem.objects.total_price()` порахує всі рядки всіх користувачів, а `CartItem.objects.for_user(user).total_price()` — лише цього. Фільтр ставлять перед викликом, і метод лишається придатним для будь-якої вибірки.
- **Методи бувають двох видів.** Ті, що повертають набір (`for_user`), ланцюжаться далі: `.for_user(user).order_by('date')`. Ті, що повертають число (`total_price`), завершують ланцюжок.
- **Рядок `objects = …as_manager()` обов'язковий.** Без нього клас-queryset ні з чим не пов'язаний. Ім'я може бути будь-яким, але щойно модель отримує власний менеджер, автоматичний `objects` більше не створюється — тому його зазвичай так і називають.

Підрахунок усередині методу можна згодом перевести на бік бази, не змінюючи жодного рядка у view:

```python
# carts/models.py
from django.db.models import DecimalField, F, Sum

    def total_price(self):
        result = self.aggregate(
            total=Sum(F('product__price') * F('quantity'), output_field=DecimalField()),
        )
        return result['total'] or Decimal('0.00')
```

Це та сама операція, лише множить і додає база. Для кількох десятків рядків різниці не видно, для тисяч — істотна.

## Рівень 4: окремий модуль

Виносять, коли дія зачіпає **кілька** моделей і не належить жодній із них:

```python
# shop/services.py
from django.db import transaction


@transaction.atomic
def place_order(user, cart_items):
    order = Order.objects.create(user=user)
    for item in cart_items:
        OrderItem.objects.create(order=order, product=item.product, quantity=item.quantity)
        item.product.count -= item.quantity
        item.product.save(update_fields=['count'])
    cart_items.delete()
    return order
```

```python
# shop/views.py
order = place_order(request.user, CartItem.objects.for_user(request.user))
```

Оформлення замовлення стосується кошика, замовлення й товарів одночасно, тому не є методом жодної моделі. `transaction.atomic` гарантує, що при помилці посеред процесу не лишиться половина замовлення.

## Як перенести власний код

Перенесення — механічне, у три кроки. Було у view:

```python
# carts/views.py
items = CartItem.objects.filter(user=request.user)
total = Decimal('0.00')
for item in items:
    total += item.product.price * item.quantity
```

1. **Визнач рівень.** Підрахунок іде по кількох рядках — отже, менеджер.
2. **Перенеси код у клас і заміни змінну на `self`.** Вибірка всередині методу вже є, тому `CartItem.objects.filter(...)` звідти зникає:

   ```python
   # carts/models.py
   class CartItemQuerySet(models.QuerySet):
       def total_price(self):
           total = Decimal('0.00')
           for item in self:            # було: for item in items
               total += item.product.price * item.quantity
           return total
   ```

3. **Заміни код у view на виклик:**

   ```python
   # carts/views.py
   items = CartItem.objects.filter(user=request.user)
   total = items.total_price()
   ```

Нової логіки на жодному кроці не з'являється — той самий код змінює місце проживання.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Виносити наперед, «щоб було правильно» | Три шари заради одного виклику; виносять, коли з'явився другий |
| Обчислення й правила лишились у view, хоч потрібні в кількох місцях | Той самий код розходиться копіями, і зміна правила ламає частину сторінок |
| Метод моделі, що працює з кількома моделями | Модель починає знати про чужі таблиці; такі дії виносять в окремий модуль |
| `self.product.all()` у методі моделі | `AttributeError`: `ForeignKey` повертає один об'єкт, а не набір |
| Немає `objects = …as_manager()` | Методи менеджера не існують для моделі: `AttributeError` при виклику |
| Звужений менеджер оголошено першим | Він стає типовим для моделі, і частина записів «зникає» з адмінки; `objects` лишають повним |
| Модуль із логікою імпортує view | Зворотна залежність: логіка не має знати про HTTP-рівень |
| Логіка в шаблоні | Розмітка ухвалює рішення, які неможливо ні протестувати, ні перевикористати |

## Підсумок

- Код у view — нормальна відправна точка; виносять тоді, коли він знадобився вдруге.
- **Один об'єкт** — метод моделі (`self` — рядок таблиці); обчислення зручно оформити як `@property`, щоб працювало й у шаблоні.
- **Набір об'єктів** — метод менеджера (`self` — поточна вибірка); фільтр ставлять перед викликом, а рядок `objects = …as_manager()` обов'язковий.
- **Кілька моделей** — окремий модуль із логікою, за потреби в `transaction.atomic`.
- Перенесення механічне: визначити рівень, замінити змінну на `self`, поставити виклик замість коду.
- Внутрішню реалізацію методу можна змінювати (цикл → `aggregate`), не чіпаючи код, який його викликає.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/db/managers/" target="_blank" rel="noopener">Managers <i class="bi bi-box-arrow-up-right"></i></a></div></div>
