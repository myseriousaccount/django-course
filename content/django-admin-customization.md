# Налаштування адмінки

Адмінка Django — це готова панель керування даними, яку ти отримуєш безкоштовно. Але «з коробки» вона показує лише голі назви об'єктів; цей урок про те, як перетворити її на зручний робочий інструмент для контент-менеджера, редактора чи бібліотекаря — за допомогою класу `ModelAdmin`. Приклади навмисно з **різних доменів** (блог, каталог книг, фільмотека), щоб ти бачила: налаштування ті самі, хоч дані різні.

## Спершу — реєстрація моделі

> **Реєстрація** — це дія, якою ти повідомляєш адмінці: «цю модель треба показувати й дозволити нею керувати». Незареєстрована модель в адмінці **не з'являється взагалі**.

Пам'ятаєш урок про `django.contrib.admin`? Адмінка — це вбудований app зі списку `INSTALLED_APPS`, а не окрема бібліотека. Але сам факт, що app увімкнено, ще нічого не показує: кожну модель треба зареєструвати явно — це той самий принцип **явності**, який ти вже бачила у Django.

Реєстрація живе у файлі `admin.py` всередині застосунку. Найпростіший варіант — одна лінійка:

```python
# blog/admin.py
from django.contrib import admin
from .models import Post

admin.site.register(Post)
```

Тепер `Post` видно в адмінці. Але список статей виглядатиме як монотонний перелік `Post object (1)`, `Post object (2)` — некорисно. Щоб керувати відображенням, потрібен окремий клас налаштувань.

> <i class="bi bi-info-circle"></i> Щоб об'єкти показувалися людською назвою, а не `Post object (1)`, у **моделі** додай `__str__`:
> ```python
> def __str__(self):
>     return self.title
> ```
> `list_display` (нижче) — це вже про **колонки в списку**, а `__str__` — про те, як об'єкт зветься всюди (у зв'язаних полях, у логах адмінки тощо).

## `ModelAdmin` і декоратор `@admin.register`

`ModelAdmin` — це клас, що описує, **як саме** конкретна модель поводиться в адмінці: які колонки показувати, за чим фільтрувати, що дозволено редагувати.

Ти створюєш підклас `admin.ModelAdmin` і прив'язуєш його до моделі. Сучасніша **конвенція** — робити це декоратором `@admin.register`:

```python
# blog/admin.py
from django.contrib import admin
from .models import Post

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "is_published")
```

Це повний еквівалент старішого запису:

```python
admin.site.register(Post, PostAdmin)
```

> <i class="bi bi-info-circle"></i> Обидва способи працюють однаково — результат ідентичний. Декоратор `@admin.register` лаконічніший і тримає налаштування та реєстрацію в одному місці, тож у новому коді обирай саме його.

`ModelAdmin` — це єдина точка, де ти описуєш поведінку моделі в адмінці. Змінюєш один клас — змінюється вся сторінка. Це знайомий тобі **DRY** у дії.

## Опції списку об'єктів (list view)

Це сторінка з переліком усіх об'єктів. кожна опція вмикає окрему зручність. Розберемо на моделі книги в каталозі:

```python
# library/admin.py
@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "genre", "year", "in_stock")
    list_display_links = ("title",)
    list_filter = ("genre", "in_stock", "year")
    search_fields = ("title", "author__name", "isbn")
    ordering = ("title",)
    list_editable = ("in_stock",)
    list_per_page = 25
    date_hierarchy = "added_at"
    list_select_related = ("author",)
    empty_value_display = "—"
```

Що робить кожен рядок:

| Опція | Що дає |
|---|---|
| **`list_display`** | які колонки видно в списку (замість `Book object (1)`) |
| **`list_display_links`** | які колонки є посиланням на сторінку об'єкта (за замовчуванням — перша) |
| **`list_filter`** | панель фільтрів збоку — швидко відсіяти за жанром, наявністю, роком |
| **`search_fields`** | рядок пошуку зверху; `author__name` шукає по зв'язаній моделі через `__` |
| **`ordering`** | порядок сортування списку (`-` = за спаданням) |
| **`list_editable`** | поля, які можна редагувати **прямо у списку**, не відкриваючи об'єкт |
| **`list_per_page`** | скільки об'єктів на одну сторінку списку (за замовчуванням 100) |
| **`date_hierarchy`** | навігація по датах угорі (рік → місяць → день) за вказаним полем-датою |
| **`list_select_related`** | оптимізація: підвантажити зв'язані об'єкти одним запитом (менше SQL) |
| **`empty_value_display`** | що показувати замість порожнього значення (`None`) |

Кожна опція економить час людині, яка щодня працює з даними. `list_filter` + `search_fields` перетворюють список на 5000 книг із «стіни тексту» на кероване середовище за секунди.

### Обчислювані колонки в `list_display`

У `list_display` можна класти не лише поля моделі, а й **метод** `ModelAdmin` — так виводять похідні значення:

```python
# blog/admin.py
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "short_body", "is_published")

    @admin.display(description="Уривок")
    def short_body(self, obj):
        return obj.body[:60] + "…"
```

Декоратор `@admin.display` дає колонці людський заголовок; для булевих значень є `@admin.display(boolean=True)` — тоді Django показує зелену/сіру галочку замість `True`/`False`.

## Опції форми (сторінка окремого об'єкта)

Коли відкриваєш один об'єкт — це форма. Її теж налаштовують. Приклад для фільму:

```python
# cinema/admin.py
@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    fields = ("title", "director", "year", "genres", "rating")   # які поля й у якому порядку
    readonly_fields = ("created_at", "updated_at")               # лише перегляд
    prepopulated_fields = {"slug": ("title",)}                   # автозаповнення
    filter_horizontal = ("genres",)                              # зручний віджет для M2M
    autocomplete_fields = ("director",)                          # пошук замість довгого списку
    save_on_top = True                                           # кнопки збереження ще й угорі
```

| Опція | Що дає |
|---|---|
| **`fields`** | перелік і порядок полів у формі (протилежність — `exclude`, що ховає вказані) |
| **`readonly_fields`** | поля лише для перегляду — видно, але не змінити |
| **`prepopulated_fields`** | автозаповнення одного поля з іншого під час набору (напр. slug із title) |
| **`filter_horizontal`** / **`filter_vertical`** | зручний двоколонковий віджет для `ManyToManyField` замість громіздкого списку |
| **`autocomplete_fields`** | для `ForeignKey`/M2M — поле з живим пошуком замість випадного списку на тисячі записів |
| **`radio_fields`** | показати вибір як радіокнопки, а не випадний список |
| **`save_on_top`** / **`save_as`** | кнопки збереження вгорі; «Зберегти як новий» (клонувати об'єкт) |

> <i class="bi bi-exclamation-triangle"></i> Щоб `autocomplete_fields = ("director",)` працювало, у `ModelAdmin` **зв'язаної** моделі (`DirectorAdmin`) мають бути задані `search_fields` — саме по них іде пошук.

### `fieldsets`: групування полів у формі

Коли полів багато, їх групують у секції з заголовками через `fieldsets`. Це заміна простому `fields`:

```python
# cinema/admin.py
@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    fieldsets = (
        ("Основне", {
            "fields": ("title", "slug", "director", "year"),
        }),
        ("Деталі", {
            "fields": ("genres", "rating", "description"),
            "classes": ("collapse",),        # секція згорнута за замовчуванням
        }),
        ("Службове", {
            "fields": ("created_at", "updated_at"),
            "description": "Заповнюється автоматично",
        }),
    )
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at", "updated_at")
```

Кожен елемент — пара `(назва_секції, {опції})`. `"classes": ("collapse",)` робить секцію згортуваною — зручно ховати рідковживані поля.

### Окремо про `prepopulated_fields`

`prepopulated_fields` автоматично формує значення одного поля з іншого прямо в браузері, поки ти друкуєш.

Найпоширеніший випадок — **slug із title**. Коли редактор вводить назву статті «Огляд Django 6.0», поле `slug` саме заповнюється як `oglyad-django-6-0`, без ручної роботи:

```python
prepopulated_fields = {"slug": ("title",)}
```

> <i class="bi bi-info-circle"></i> Значення дописується лише **під час створення** об'єкта — якщо потім змінити `title`, наявний `slug` не перезапишеться. Це навмисно: slug часто вже потрапив у посилання, і мовчазна його зміна ламала б URL.

## `inlines`: пов'язані об'єкти на одній сторінці

`inlines` дають змогу редагувати **пов'язані** об'єкти прямо на сторінці батьківського об'єкта — не переходячи на окрему сторінку кожного разу.

Візьмемо книгу і її розділи. Модель `Chapter` має зовнішній ключ на `Book`:

```python
# library/models.py
class Book(models.Model):
    title = models.CharField(max_length=200)

class Chapter(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="chapters")
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)
```

Щоб редагувати розділи просто зі сторінки книги, описуєш inline-клас і додаєш його в `BookAdmin`:

```python
# library/admin.py
class ChapterInline(admin.TabularInline):
    model = Chapter
    extra = 1                    # скільки порожніх рядків для нових розділів показати
    fields = ("order", "title")
    ordering = ("order",)

@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author")
    inlines = [ChapterInline]
```

Тепер, відкривши книгу, бібліотекар одразу бачить її розділи і може додавати чи правити їх на тій самій сторінці.

Є два типи inline-класів:

| Клас | Вигляд |
|---|---|
| **`TabularInline`** | компактна таблиця — рядок на об'єкт (добре для коротких записів) |
| **`StackedInline`** | кожен об'єкт розгорнутий у повну форму (добре, коли полів багато) |

Корисні опції inline: `extra` (порожні рядки), `max_num` (максимум записів), `min_num` (мінімум), `can_delete` (чи дозволити видалення), `show_change_link` (посилання на повну сторінку об'єкта).

Пов'язані дані редагують разом. Без цього кожен дочірній запис довелося б створювати окремою сторінкою, щоразу обираючи батьківський об'єкт зі списку.

## Дії над списком (`actions`)

`actions` — це операції, які застосовують **одразу до кількох** позначених об'єктів через випадне меню над списком.

Класика — «опублікувати позначені». У блозі це виглядає так:

```python
# blog/admin.py
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "is_published")
    actions = ["make_published", "make_draft"]

    @admin.action(description="Опублікувати позначені")
    def make_published(self, request, queryset):
        updated = queryset.update(is_published=True)
        self.message_user(request, f"Опубліковано: {updated}")

    @admin.action(description="Зняти з публікації")
    def make_draft(self, request, queryset):
        queryset.update(is_published=False)
```

Метод дії отримує `queryset` — усі позначені об'єкти — і робить із ними що треба (тут `update`). `message_user` показує повідомлення користувачу. Видалення позначених є вбудованою дією з коробки.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Модель не зареєстрована в `admin.py` | Її просто немає в панелі, і жодної помилки при цьому не виникає |
| Поле в `list_editable`, але не в `list_display` | Помилка перевірки при старті: редагувати можна лише показані колонки |
| Перше поле `list_display` у `list_editable` | Воно працює як посилання на об'єкт, тому редагованим бути не може |
| `autocomplete_fields` без `search_fields` у цільовому admin | Помилка `must define search_fields`; пошук додають у admin пов'язаної моделі |
| Числове або булеве поле в `search_fields` | Пошук працює лише за текстовими полями; для решти є `list_filter` |
| Список без `list_select_related` | Колонки зі зв'язаних моделей дають N+1 запитів на кожен рядок |
| Обчислена колонка без `@admin.display` | У заголовку з'являється технічна назва методу |
| Дія над списком без перевірки прав | `actions` виконуються масово; права перевіряють у самому методі дії |

## Підсумок

- Модель треба **зареєструвати** в `admin.py`, інакше її в адмінці не видно; людську назву дає `__str__` у моделі.
- Поведінку моделі описує клас **`ModelAdmin`**; сучасна конвенція реєстрації — декоратор **`@admin.register(Model)`** (еквівалент `admin.site.register`).
- **Список:** `list_display` (колонки, зокрема методи через `@admin.display`), `list_filter`, `search_fields` (можна `__`), `ordering`, `list_editable`, `list_per_page`, `date_hierarchy`, `list_select_related`.
- **Форма:** `fields`/`exclude`, `fieldsets` (групування з `collapse`), `readonly_fields`, `prepopulated_fields` (slug із title), `filter_horizontal` (M2M), `autocomplete_fields` (потребує `search_fields` у зв'язаної моделі), `save_on_top`/`save_as`.
- **`inlines`** (`TabularInline` / `StackedInline`) редагують пов'язані об'єкти на одній сторінці — наприклад, `Chapter` усередині `Book`; опції `extra`, `max_num`, `show_change_link`.
- **`actions`** (`@admin.action`) — масові операції над позначеними об'єктами (напр. «Опублікувати позначені»).
- Головна цінність: готове керування даними для не-програмістів **без написання власних CRUD-сторінок**.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/contrib/admin/" target="_blank" rel="noopener">The Django admin site <i class="bi bi-box-arrow-up-right"></i></a></div></div>
