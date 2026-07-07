# Поля моделей і зв'язки

Модель — це серце Django-проєкту: з одного її опису фреймворк виводить таблицю в БД, форму, адмінку й валідацію (згадай DRY). А будівельний матеріал моделі — **поля**. Цей урок — довідник із типів полів, їхніх опцій і зв'язків між моделями. Приклади навмисно з **різних доменів** (`Book`, `Product`, `Post`, `Movie`, `Order`, `User`), щоб ти бачила: ці типи полів універсальні, а не прив'язані до якоїсь однієї моделі.

## Основні типи полів

> **Поле (field)** — атрибут моделі, який відповідає стовпцю таблиці в базі даних. Тип поля визначає, які дані в ньому зберігаються і як вони валідуються.

**Як це працює.** Кожне поле — це екземпляр класу з модуля `django.db.models`. Ось найуживаніші, показані на кількох моделях різних доменів:

```python
from django.db import models

class Book(models.Model):
    title = models.CharField(max_length=200)                 # короткий рядок
    summary = models.TextField(blank=True)                   # довгий текст
    pages = models.PositiveIntegerField()                    # ціле >= 0
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_available = models.BooleanField(default=True)
    slug = models.SlugField(unique=True)                     # для URL
    cover = models.ImageField(upload_to='covers/', blank=True)
    published_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Post(models.Model):
    author_email = models.EmailField()                       # валідує email
    source = models.URLField(blank=True)                     # валідує URL
    read_time = models.DurationField(null=True, blank=True)  # тривалість
    body = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)
```

Коротко про кожен тип:

| Поле | Для чого | Ключове |
|---|---|---|
| `CharField` | короткі рядки (назви, заголовки) | **обов'язковий** `max_length` |
| `TextField` | великі тексти (опис, стаття) | без обмеження довжини |
| `IntegerField` | цілі числа | — |
| `PositiveIntegerField` | цілі числа >= 0 (сторінки, кількість) | не приймає від'ємних |
| `FloatField` | дробові (наближено) | не для грошей! |
| `DecimalField` | точні дробові (гроші!) | `max_digits`, `decimal_places` |
| `BooleanField` | так / ні | часто з `default` |
| `DateField` / `DateTimeField` | дата / дата з часом | `auto_now`, `auto_now_add` |
| `DurationField` | проміжок часу (`timedelta`) | напр. тривалість фільму |
| `EmailField` | email | валідує формат адреси |
| `SlugField` | «слаг» для URL (`my-post`) | лише літери, цифри, дефіси |
| `URLField` | посилання | валідує формат URL |
| `UUIDField` | унікальний ідентифікатор | напр. номер замовлення |
| `JSONField` | структура даних (dict/list) | зберігає JSON |
| `ImageField` / `FileField` | картинки / файли | `upload_to='...'` |

> <i class="bi bi-info-circle"></i> `DecimalField` проти `FloatField`: для грошей завжди бери `DecimalField`. `float` округлює неточно (класична проблема з `0.1 + 0.2`), а `Decimal` зберігає точне значення. `FloatField` доречний для вимірювань, де мікропохибка не критична (рейтинг, вага).

**Про дати — `auto_now` vs `auto_now_add`:**

- `auto_now_add=True` — час ставиться **один раз**, у момент створення об'єкта. Ідеально для «коли створено» (`Order.created_at`).
- `auto_now=True` — час оновлюється **при кожному** збереженні. Ідеально для «коли востаннє змінено» (`Post.updated_at`).

> <i class="bi bi-exclamation-triangle"></i> `ImageField` вимагає встановленої бібліотеки **Pillow** (`pip install Pillow`), інакше міграція впаде з помилкою.

**Навіщо.** Правильний тип поля — це безкоштовна валідація й коректна схема БД. `EmailField` сам перевірить формат, `DecimalField` не зіпсує ціну округленням, `SlugField` гарантує «чистий» URL, `PositiveIntegerField` не пропустить від'ємну кількість.

## Загальні опції полів

Ці опції працюють майже з будь-яким полем:

| Опція | Що робить |
|---|---|
| `null=True` | дозволяє `NULL` **у базі даних** |
| `blank=True` | дозволяє **порожнє значення у формі** (валідація) |
| `default=...` | значення за замовчуванням |
| `choices=...` | обмежує вибір фіксованим списком |
| `unique=True` | значення має бути унікальним у таблиці |
| `db_index=True` | створити індекс для швидкого пошуку |
| `verbose_name='...'` | людяна назва поля (адмінка, форми) |
| `help_text='...'` | підказка під полем у формі |
| `editable=False` | приховати поле з форм |

**`choices` на прикладі замовлення:**

```python
class Order(models.Model):
    class Status(models.TextChoices):
        NEW = 'new', 'Нове'
        PAID = 'paid', 'Оплачене'
        SHIPPED = 'shipped', 'Відправлене'
        DONE = 'done', 'Виконане'

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.NEW,
    )
```

У БД зберігається короткий код (`'new'`), а користувачу показується читабельна назва (`'Нове'`). В адмінці й формах це автоматично стає випадним списком. Django ще й додає зручний метод `order.get_status_display()`, що повертає читабельну назву.

### Типові помилки / Нюанси: `null` vs `blank`

Це **найчастіша плутанина** новачків, тож розберемо детально.

> **`null`** — про **базу даних**: чи може стовпець містити `NULL`.
> **`blank`** — про **валідацію**: чи можна залишити поле порожнім у формі (адмінка, `ModelForm`).

<i class="bi bi-lightbulb"></i> Аналогія: `null` — це «чи дозволено порожню комірку в таблиці Excel», а `blank` — «чи дозволено натиснути *Зберегти*, не заповнивши поле в анкеті». Це два різні рівні.

Наслідки з цього:

- Для **рядкових** полів (`CharField`, `TextField`) конвенція — **не ставити `null=True`**. Django для «порожнього рядка» використовує `''`, а не `NULL`. Два способи означати «пусто» — це плутанина. Став лише `blank=True`:

  ```python
  summary = models.TextField(blank=True)             # ✅ порожній рядок дозволено
  summary = models.TextField(null=True, blank=True)  # ❌ два способи «пусто»
  ```

- Для **нерядкових** полів (числа, дати, `ForeignKey`), якщо значення необов'язкове, потрібні **обидві**: `null=True` (щоб БД прийняла порожнечу) і `blank=True` (щоб форма прийняла):

  ```python
  shipped_at = models.DateField(null=True, blank=True)  # ✅ дата може бути невідома
  ```

> <i class="bi bi-info-circle"></i> Просте правило: `blank` — майже завжди, коли поле необов'язкове у формі. `null` — додатково лише для **не-рядкових** полів.

## Зв'язки між моделями

Реальні дані пов'язані: у поста є автор, у замовлення — товари, у користувача — профіль. Django описує це трьома полями зв'язку.

### ForeignKey — «багато до одного»

> **`ForeignKey`** — зв'язок «багато до одного»: багато об'єктів однієї моделі посилаються на один об'єкт іншої. Це аналог зовнішнього ключа в SQL.

```python
class Post(models.Model):
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='posts',
    )
    title = models.CharField(max_length=200)
```

Багато постів (`Post`) належать одному автору (`User`).

- **`on_delete`** — **обов'язковий** аргумент: що робити з постами, якщо видалити автора.
  - `models.CASCADE` — видалити й усі пости разом з автором (найчастіший вибір).
  - `models.PROTECT` — заборонити видалення автора, поки в нього є пости.
  - `models.SET_NULL` — обнулити зв'язок (вимагає `null=True` на полі): пост лишиться, а `author` стане `NULL` («автор видалений»).
  - `models.SET_DEFAULT` — поставити значення за замовчуванням.

- **`related_name`** — ім'я для **зворотного** доступу. З `related_name='posts'` ти отримуєш усі пости автора так:

  ```python
  user.posts.all()   # усі пости цього користувача
  post.author        # автор цього поста (пряме звернення)
  ```

  Без `related_name` Django створив би доступ `user.post_set.all()` — робоче, але менш читабельне.

> <i class="bi bi-info-circle"></i> Інший приклад того самого зв'язку: `Book.author = ForeignKey(Author, ...)` — багато книг одного автора; `Order.customer = ForeignKey(User, ...)` — багато замовлень одного клієнта. Патерн однаковий, домен різний.

### ManyToManyField — «багато до багатьох»

> **`ManyToManyField`** — зв'язок «багато до багатьох»: кожен об'єкт з одного боку може бути пов'язаний з багатьма з іншого, і навпаки.

```python
class Genre(models.Model):
    name = models.CharField(max_length=50)

class Movie(models.Model):
    title = models.CharField(max_length=200)
    genres = models.ManyToManyField(Genre, blank=True, related_name='movies')
```

Один фільм має багато жанрів, один жанр стосується багатьох фільмів. Django сам створює приховану проміжну таблицю зв'язків — тобі про неї думати не треба.

```python
movie.genres.add(sci_fi)      # додати жанр
movie.genres.remove(sci_fi)   # прибрати
movie.genres.all()            # усі жанри фільму
sci_fi.movies.all()           # усі фільми цього жанру (через related_name)
```

> <i class="bi bi-info-circle"></i> Той самий зв'язок в інших доменах: `Post.tags = ManyToManyField(Tag)` — пости й теги; `Product.categories = ManyToManyField(Category)` — товар у кількох категоріях.

### OneToOneField — «один до одного»

> **`OneToOneField`** — зв'язок «один до одного»: кожному об'єкту відповідає рівно один об'єкт іншої моделі.

Класичний приклад — **профіль користувача**: розширюємо стандартну модель `User`, не змінюючи її.

```python
from django.conf import settings

class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
```

Тепер `user.profile` дає профіль, а `profile.user` — користувача.

<i class="bi bi-lightbulb"></i> Різниця трьох зв'язків одним реченням: `ForeignKey` — «у багатьох одна мама», `ManyToManyField` — «у багатьох багато знайомих», `OneToOneField` — «у кожного одна пара».

> <i class="bi bi-info-circle"></i> Використовуй `settings.AUTH_USER_MODEL` (а не імпорт `User` напряму) для будь-яких зв'язків із користувачем — так модель не зламається, якщо проєкт має кастомну модель користувача.

## `class Meta` і метод `__str__`

**`class Meta`** — вкладений клас із **метаданими** моделі (те, що описує модель загалом, а не окреме поле):

```python
class Product(models.Model):
    name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']              # сортування за замовчуванням: новіші вгорі
        verbose_name = 'Товар'                  # читабельна назва в однині
        verbose_name_plural = 'Товари'          # у множині (для адмінки)
        unique_together = ['name', 'price']     # пара має бути унікальною
        indexes = [models.Index(fields=['name'])]  # індекс для швидкого пошуку

    def __str__(self):
        return self.name
```

- **`ordering`** — типовий порядок вибірок. `'-created_at'` (з дефісом) — за спаданням.
- **`verbose_name`** / `verbose_name_plural` — як модель підписана в адмінці.
- **`unique_together`** — комбінація полів має бути унікальною (напр. один відгук на товар від одного користувача).
- **`indexes`** / **`constraints`** — індекси й обмеження на рівні БД.

**`__str__`** — стандартний Python-метод, що повертає **читабельне представлення** об'єкта. Без нього в адмінці й шелі ти бачитимеш беззмістовне `<Product: Product object (1)>`, а з ним — назву товару. Це маленька дрібниця, яку варто додавати завжди.

## Де це в проєкті

Поля й зв'язки — це **кожна модель** без винятку, вони і є її вміст. Приклади з різних доменів:

- `Book` — `CharField` (назва), `TextField` (опис), `DecimalField` (ціна), `SlugField`, `ImageField` (обкладинка), `ForeignKey(Author)`.
- `Post` — `CharField` (заголовок), `TextField` (тіло), `ForeignKey(User, related_name='posts')`, `ManyToManyField(Tag)`, `DateTimeField(auto_now_add=True)`.
- `Movie` — `CharField`, `DurationField` (тривалість), `ManyToManyField(Genre)`, `FloatField` (рейтинг).
- `Order` — `ForeignKey(User)`, `choices` статусу, `DecimalField` (сума), `DateTimeField`.
- `Profile` — `OneToOneField` на `User`: розширення профілю.

Порівняння зі SQLAlchemy, яку ти вже знаєш:

| Django | SQLAlchemy (Flask) |
|---|---|
| `models.CharField(max_length=200)` | `db.Column(db.String(200))` |
| `models.ForeignKey(User, ...)` | `db.ForeignKey('user.id')` + `relationship` |
| `related_name='posts'` | `backref='posts'` |
| `class Meta: ordering = [...]` | `order_by` у запиті / relationship |

Ідея та сама — таблиця як Python-клас, стовпці як атрибути; відрізняється лише синтаксис і те, що в Django зв'язок і його зворотний бік задаються одним полем.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **`CharField` без `max_length`** → помилка перевірки моделі. Для `CharField` довжина обов'язкова; безлімітний текст — це `TextField`.

> <i class="bi bi-exclamation-triangle"></i> **`ForeignKey` без `on_delete`** → `TypeError`. Аргумент обов'язковий — Django змушує тебе свідомо обрати долю пов'язаних об'єктів.

> <i class="bi bi-exclamation-triangle"></i> **`null=True` на `CharField`/`TextField`** — уникай: два способи означати «пусто» (`''` і `NULL`). Для рядків став лише `blank=True`.

> <i class="bi bi-exclamation-triangle"></i> **`SET_NULL` без `null=True`** → міграція впаде: обнулити зв'язок неможливо, якщо поле не приймає `NULL`.

> <i class="bi bi-info-circle"></i> Забула `__str__`? Об'єкти в адмінці й шелі будуть безіменні (`object (1)`). Додавай завжди.

## Підсумок

- **Тип поля** = тип стовпця в БД + безкоштовна валідація. Для грошей — `DecimalField`, для URL-слагів — `SlugField`, для email — `EmailField`, для дат — `DateTimeField` з `auto_now_add` (створення) чи `auto_now` (оновлення); є ще `PositiveIntegerField`, `DurationField`, `UUIDField`, `JSONField`.
- **Опції**: `null`/`blank` (база vs форма), `default`, `choices`, `unique`, `db_index`, `help_text`. Для рядкових полів став лише `blank=True`; для не-рядкових необов'язкових — обидва.
- **Три зв'язки**: `ForeignKey` (багато-до-одного, з обов'язковим `on_delete` і зручним `related_name`), `ManyToManyField` (багато-до-багатьох, `add`/`remove`/`all`), `OneToOneField` (один-до-одного, як профіль до `User`).
- **`on_delete`**: `CASCADE` (видаляти разом), `PROTECT` (заборонити), `SET_NULL` (обнулити, потребує `null=True`), `SET_DEFAULT`.
- **`class Meta`** задає метадані (`ordering`, `verbose_name`, `unique_together`, `indexes`), а **`__str__`** робить об'єкт читабельним в адмінці й шелі — додавай його завжди.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/models/fields/" target="_blank" rel="noopener">Model field reference <i class="bi bi-box-arrow-up-right"></i></a></div></div>
