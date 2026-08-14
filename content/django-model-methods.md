# Методи моделі

Метод моделі — звичайна функція всередині класу моделі. Усередині неї доступне `self` — конкретний рядок таблиці з усіма його полями й зв'язками. Тому в методі можна порахувати або перевірити все, для чого достатньо **одного** об'єкта.

## Найпростіший приклад

Сума одного рядка кошика — це ціна товару, помножена на кількість. Спочатку такий підрахунок зазвичай пишуть у view:

```python
# carts/views.py
for item in items:
    subtotal = item.product.price * item.quantity
```

Той самий рядок як метод моделі:

```python
# carts/models.py
class CartItem(models.Model):
    quantity = models.PositiveIntegerField(default=1)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    def subtotal(self):
        return self.product.price * self.quantity
```

Різниця лише в тому, що замість `item` усередині стоїть `self`. Тепер обчислення доступне будь-де:

```python
# carts/views.py
item.subtotal()
```

## Метод чи `@property`

Той самий метод можна оформити властивістю — тоді звертаються без дужок:

```python
# carts/models.py
    @property
    def subtotal(self):
        return self.product.price * self.quantity
```

```python
item.subtotal        # без дужок
```

Це не косметика. У шаблонах Django дужки не працюють взагалі, тому обчислення, потрібне в розмітці, оформлюють саме властивістю:

```html
{# templates/carts/index.html #}
<span>₴ {{ item.subtotal }}</span>
```

| Оформлення | Виклик у Python | У шаблоні |
|---|---|---|
| `def subtotal(self)` | `item.subtotal()` | `{{ item.subtotal }}` — теж працює, Django викликає сам |
| `@property def subtotal(self)` | `item.subtotal` | `{{ item.subtotal }}` |

Django у шаблоні викликає метод без аргументів автоматично, тож обидва варіанти виводяться однаково. Різниця з'являється в Python-коді: властивість читається як поле, метод потребує дужок.

> <i class="bi bi-exclamation-triangle"></i> Метод, якому потрібен **аргумент**, у шаблоні викликати неможливо: `{{ item.discounted(10) }}` не працює. Такі обчислення роблять у view або оформлюють власним шаблонним тегом.

## Приклади з різних задач

**Обчислення на основі полів** — час читання статті:

```python
# blog/models.py
class Post(models.Model):
    body = models.TextField()

    @property
    def reading_time(self):
        words = len(self.body.split())
        return max(1, round(words / 200))     # приблизно 200 слів за хвилину
```

**Перевірка стану** — чи книга доступна для видачі:

```python
# library/models.py
class Book(models.Model):
    copies_total = models.PositiveIntegerField(default=1)
    copies_out = models.PositiveIntegerField(default=0)

    @property
    def is_available(self):
        return self.copies_out < self.copies_total
```

```html
{# templates/library/book_detail.html #}
{% if book.is_available %}<button>Позичити</button>{% endif %}
```

**Робота з датами** — скільки днів лишилось до повернення:

```python
# library/models.py
from django.utils import timezone


class Loan(models.Model):
    due_date = models.DateField()

    @property
    def days_left(self):
        return (self.due_date - timezone.now().date()).days

    @property
    def is_overdue(self):
        return self.days_left < 0
```

Зверни увагу: `is_overdue` використовує `days_left`. Методи моделі спокійно звертаються один до одного через `self`.

**Метод-дія** — не рахує, а змінює об'єкт:

```python
# shop/models.py
class Order(models.Model):
    status = models.CharField(max_length=20, default='new')
    paid_at = models.DateTimeField(null=True, blank=True)

    def mark_paid(self):
        self.status = 'paid'
        self.paid_at = timezone.now()
        self.save(update_fields=['status', 'paid_at'])
```

```python
# shop/views.py
order.mark_paid()        # замість трьох рядків у кожній view, де це потрібно
```

Дію оформлюють саме методом, а не властивістю: властивість має лише повертати значення, а не змінювати дані.

## Методи, які ти вже писала

`__str__` — теж метод моделі, просто зі спеціальним ім'ям: Python викликає його, коли об'єкт треба показати рядком.

```python
# carts/models.py
    def __str__(self):
        return f'{self.product.name} ×{self.quantity}'
```

`get_absolute_url` — метод, який повертає адресу сторінки цього об'єкта; його використовують `redirect(obj)`, кнопка «Дивитись на сайті» в адмінці й generic-views:

```python
# blog/models.py
from django.urls import reverse

    def get_absolute_url(self):
        return reverse('post_detail', kwargs={'slug': self.slug})
```

## Як написати свій метод

1. **Сформулюй словами, що обчислюєш.** «Сума цього рядка кошика», «чи прострочена ця видача».
2. **Перевір, чи вистачає одного об'єкта.** Якщо для відповіді потрібні дані лише цього рядка та його зв'язків (`self.product`, `self.author`) — метод моделі підходить. Якщо треба перебрати кілька рядків таблиці — це вже менеджер, окремий урок.
3. **Перенеси код, замінивши змінну на `self`.** Було `item.product.price * item.quantity` — стало `self.product.price * self.quantity`.
4. **Обери оформлення.** Повертає значення й знадобиться в шаблоні — `@property`. Змінює об'єкт — звичайний метод із дієслівною назвою (`mark_paid`, `cancel`, `renew`).
5. **Заміни код у view на виклик.**

## Спробуй сама

**Задача 1.** Додай до `CartItem` властивість `subtotal`, а в шаблоні кошика виведи суму по кожному рядку.
Перевірка: товар за 100 ₴ з кількістю 3 має показати 300.

**Задача 2.** Додай до `Product` властивість `in_stock`, яка повертає `True`, коли `count > 0`, і сховай кнопку «додати в кошик» для товарів, яких немає.
Перевірка: постав `count = 0` в адмінці — кнопка має зникнути.

**Задача 3.** Додай до `Product` метод-дію `reserve(self, quantity)`, який зменшує `count` на вказану кількість і зберігає об'єкт.
Питання, на яке треба відповісти самій: що робити, якщо на складі менше, ніж просять?

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `self.product.all()` | `AttributeError`: `ForeignKey` повертає один об'єкт. `.all()` є лише в `ManyToManyField` і зворотних зв'язках (`post.comments.all()`) |
| Дужки в шаблоні: `{{ item.subtotal() }}` | Синтаксична помилка; у шаблоні викликають без дужок |
| Метод з аргументом, потрібний у шаблоні | Викликати неможливо; обчислюють у view або пишуть шаблонний тег |
| `@property`, що змінює й зберігає об'єкт | Читання поля непомітно пише в базу; для змін — звичайний метод із дієслівною назвою |
| Метод, якому потрібні інші рядки таблиці | Одного `self` не вистачить: такі підрахунки живуть у менеджері |
| Метод, що працює з кількома моделями | Модель починає знати про чужі таблиці; такі дії виносять в окремий модуль |
| `self.save()` без `update_fields` у методі-дії | Перезаписуються всі поля, зокрема ті, які паралельно змінив інший запит |

## Підсумок

- Метод моделі бачить `self` — один рядок таблиці з його полями й зв'язками; цього достатньо для обчислень «про один об'єкт».
- Перенесення з view механічне: той самий вираз, лише змінна замінюється на `self`.
- `@property` дає звертання без дужок і потрібен, коли значення виводиться в шаблоні; метод-дія (`mark_paid`) лишається звичайним методом.
- Django у шаблоні сам викликає метод без аргументів, але метод **з аргументом** у розмітці недоступний.
- `__str__` і `get_absolute_url` — теж методи моделі, просто з усталеними іменами.
- Якщо для обчислення потрібні кілька рядків таблиці — це вже завдання менеджера.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/db/models/#model-methods" target="_blank" rel="noopener">Model methods <i class="bi bi-box-arrow-up-right"></i></a></div></div>
