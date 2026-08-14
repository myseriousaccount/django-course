# Міграції

Міграція — файл, який описує зміну структури бази: створити таблицю, додати стовпець, змінити тип, накласти обмеження. Django генерує його з різниці між поточними моделями й попереднім станом, а потім виконує в базі. Урок про повний цикл роботи з ними й про ситуації, коли міграція не проходить.

## Модель і таблиця — різні речі

Клас у `models.py` описує, якою таблиця **має бути**. Реальна таблиця в базі змінюється лише тоді, коли виконано `migrate`. Поки цього не сталося, код і база розходяться, і поведінка залежить від того, що саме перевіряється:

| Де описано | Що працює без міграції | Що не працює |
|---|---|---|
| `default=1` у полі | Django підставляє значення сам | — |
| `blank=True` | впливає лише на форми | — |
| нове поле | нічого | запити падають із `no such column` |
| зміна типу поля | нічого | у базі лишається старий тип |
| `UniqueConstraint` | нічого | дублікати спокійно записуються |

Останній рядок особливо підступний: обмеження в `Meta` виглядає як робоче, але поки міграція не застосована, база нічого не забороняє.

Перевірити фактичний стан можна командою:

```bash
python manage.py showmigrations carts
```

```
carts
 [X] 0001_initial
 [ ] 0002_alter_cartitem_quantity_and_more
```

Позначка `[ ]` означає, що файл створено, але в базі змін ще немає.

## Дві команди

```bash
python manage.py makemigrations        # створити файли міграцій для всіх застосунків
python manage.py makemigrations carts  # тільки для одного
python manage.py migrate               # застосувати всі незастосовані
python manage.py migrate carts         # застосувати міграції одного застосунку
```

`makemigrations` порівнює моделі з останнім відомим станом (він зібраний із попередніх міграцій, а не з бази) і записує різницю у файл:

```python
# carts/migrations/0002_alter_cartitem_quantity_and_more.py
class Migration(migrations.Migration):

    dependencies = [
        ('carts', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cartitem',
            name='quantity',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddConstraint(
            model_name='cartitem',
            constraint=models.UniqueConstraint(
                fields=('user', 'product'), name='unique_product_per_user',
            ),
        ),
    ]
```

Перед виконанням можна побачити точний SQL:

```bash
python manage.py sqlmigrate carts 0002
```

## Нове обов'язкове поле

Якщо додати поле без `null=True` і без `default`, `makemigrations` не зможе заповнити його для наявних рядків і поставить запитання просто в терміналі: вказати значення один раз для існуючих записів чи скасувати команду й дописати `default` у моделі.

Три робочі варіанти:

```python
# shop/models.py
status = models.CharField(max_length=10, default='new')   # значення за замовчуванням
published_at = models.DateTimeField(null=True, blank=True)  # дозволити порожнє
slug = models.SlugField(unique=True, null=True)             # тимчасово, з наступним заповненням
```

Третій варіант потребує ще одного кроку — міграції даних (нижче).

## Обмеження на таблиці з даними

Це найчастіша причина, чому міграція падає. `UniqueConstraint` створює унікальний індекс, а індекс неможливо побудувати, якщо в таблиці вже є рядки, що порушують правило:

```
django.db.utils.IntegrityError: UNIQUE constraint failed: carts_cartitem.user_id, carts_cartitem.product_id
```

Порядок дій: спершу прибрати дублікати, потім застосувати міграцію.

```python
# python manage.py shell
from django.db.models import Count

from carts.models import CartItem

# знайти пари, що зустрічаються більше одного разу
duplicates = (CartItem.objects
              .values('user', 'product')
              .annotate(n=Count('id'))
              .filter(n__gt=1))

for row in duplicates:
    items = CartItem.objects.filter(user=row['user'], product=row['product']).order_by('id')
    keep = items.first()
    keep.quantity = sum(i.quantity for i in items)   # сумуємо кількість
    keep.save(update_fields=['quantity'])
    items.exclude(pk=keep.pk).delete()               # решту прибираємо
```

Те саме стосується `CheckConstraint`: якщо в таблиці є рядок із `rating = 0`, обмеження «від 1 до 10» не накладеться, доки цей рядок не виправлено.

## Міграція даних

Файли міграцій змінюють не лише структуру, а й самі дані. Для цього використовують операцію `RunPython`:

```python
# blog/migrations/0003_fill_slugs.py
from django.db import migrations
from django.utils.text import slugify


def fill_slugs(apps, schema_editor):
    Post = apps.get_model('blog', 'Post')          # історична версія моделі
    for post in Post.objects.filter(slug=''):
        post.slug = slugify(post.title)
        post.save(update_fields=['slug'])


def undo(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [('blog', '0002_post_slug')]
    operations = [migrations.RunPython(fill_slugs, undo)]
```

> <i class="bi bi-exclamation-triangle"></i> Усередині міграції модель беруть через `apps.get_model()`, а не звичайним імпортом. Імпортована модель — це її **поточна** версія з усіма полями, яких на момент цієї міграції ще могло не існувати; `apps.get_model()` повертає стан моделі саме на цьому кроці історії.

Порожня заготовка для власного коду створюється командою:

```bash
python manage.py makemigrations carts --empty --name merge_duplicates
```

## Відкат

Міграції можна прокрутити назад, вказавши номер, до якого треба повернутися:

```bash
python manage.py migrate carts 0001    # відкотити все, що після 0001
python manage.py migrate carts zero    # відкотити всі міграції застосунку
```

Відкат працює, доки операції зворотні. `AddField` скасовується видаленням стовпця, `RunPython` — лише якщо описана зворотна функція. Дані, видалені при відкаті, не повертаються.

## Що комітять і чого не роблять

Файли міграцій — частина коду: саме вони відтворюють схему на іншій машині й на сервері. Їх комітять разом зі змінами моделей.

Правити вже застосовану міграцію не можна: в інших копіях проєкту вона вже виконана, і зміна файлу створює розбіжність, яку Django не помітить. Потрібну зміну оформлюють **новою** міграцією.

Коли в команді дві гілки одночасно додали міграції з однаковим номером, Django повідомить про конфлікт. Розв'язується він окремою міграцією-злиттям:

```bash
python manage.py makemigrations --merge
```

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Модель змінено, `migrate` не виконано | Запити падають із `no such column`, а обмеження з `Meta` не діють |
| `makemigrations` каже `No changes detected` | Застосунку немає в `INSTALLED_APPS` або файл не збережено |
| `UniqueConstraint` на таблицю з дублікатами | `IntegrityError` під час `migrate`; спершу прибирають повтори, потім застосовують міграцію |
| Нове поле без `default` і без `null=True` | Команда зупиняється й вимагає значення для наявних рядків |
| Ручне редагування застосованої міграції | Історія схеми розходиться між копіями проєкту; зміну оформлюють новою міграцією |
| `migrations/` у `.gitignore` | На іншій машині схему неможливо відтворити |
| Звичайний імпорт моделі в `RunPython` | Код спирається на поточні поля й падає при повторному прогоні історії з нуля |
| Видалити файли міграцій, щоб «почати спочатку» | Django вважатиме таблиці неіснуючими й спробує створити їх повторно; на робочій базі це втрата даних |

## Підсумок

- Модель описує бажаний стан, реальна таблиця змінюється лише після `migrate`; до того обмеження з `Meta` не діють.
- `makemigrations` створює файл із різницею, `migrate` виконує його; `showmigrations` показує, що застосовано, `sqlmigrate` — який саме SQL виконається.
- Нове обов'язкове поле потребує `default` або `null=True`, інакше команда зупиниться на запитанні.
- Обмеження не накладається на таблицю, дані якої його порушують: спершу чистять дублікати чи некоректні значення.
- Зміни самих даних оформлюють через `RunPython` з `apps.get_model()`, а не прямим імпортом моделі.
- Відкат — `migrate <app> <номер>`; зворотність залежить від операцій.
- Файли міграцій комітять, не редагують після застосування, а конфлікти гілок зводять командою `makemigrations --merge`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/migrations/" target="_blank" rel="noopener">Migrations <i class="bi bi-box-arrow-up-right"></i></a></div></div>
