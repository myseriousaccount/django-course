# Тестування Django

Тест — це код, який перевіряє твій код. Цей урок пояснює, навіщо взагалі писати тести, як влаштований `TestCase`, де живуть тести і як за допомогою тестового клієнта перевіряти моделі, форми та views. Приклади навмисно з **різних доменів** (блог, магазин, бібліотека), щоб ти бачила: механізм універсальний.

## Навіщо писати тести

> **Тест** — це окрема функція, яка викликає частину твого коду й перевіряє, що результат саме такий, як ти очікуєш. Якщо очікування не збіглося — тест «падає» і показує, де.

**Як це працює.** Ти один раз описуєш правильну поведінку («сторінка списку постів має повертати код 200 і містити заголовок»), а потім будь-коли запускаєш усі тести однією командою. Django сам проганяє їх і каже, що зламалося.

**Навіщо.** Головна цінність — **зміни не ламають наявне непомітно**. Ти дописала нову фічу, запустила тести, і одразу бачиш: стара сторінка кошика перестала працювати. Без тестів ти дізналася б про це від користувача через тиждень. Тести — це страхувальна сітка, яка дозволяє сміливо міняти код.

> <i class="bi bi-lightbulb"></i> Уяви тести як список пунктів огляду перед виїздом авто: гальма, фари, тиск у шинах. Ти не перевіряєш їх щоразу вручну — є чекліст, який швидко каже «все справне» або «ось тут проблема».

## `django.test.TestCase`

> **`TestCase`** — базовий клас Django для тестів. Це обгортка над стандартним `unittest` із Python, яка додає найважливіше: **окрему тестову базу даних**.

**Як це працює.** Перед запуском тестів Django створює **тимчасову** БД, а після — видаляє її. Кожен окремий тест виконується в **транзакції**, яка **відкочується** після завершення. Тобто дані, які ти створила в одному тесті, зникають перед наступним — тести не впливають один на одного.

**Навіщо.** Тестова база **окрема від реальної**. Хоч скільки об'єктів ти створюй у тестах, твоя справжня БД із реальними постами й замовленнями лишається недоторканою.

```python
from django.test import TestCase


class PostModelTest(TestCase):
    def test_example(self):
        self.assertEqual(2 + 2, 4)     # найпростіша перевірка
```

> <i class="bi bi-info-circle"></i> `assertEqual`, `assertTrue`, `assertContains` — це методи перевірки (assertions). Кожен каже, що саме має бути істиною. Якщо ні — тест падає з поясненням.

## Де живуть тести

**Як це працює.** Django шукає тести у файлі `app/tests.py`, який створюється разом із кожним застосунком. Коли тестів стає багато, файл замінюють на **пакет** — папку `tests/` із `__init__.py` та кількома файлами (`test_models.py`, `test_views.py`, `test_forms.py`).

```
blog/
├── tests.py            # маленький проєкт: усе тут
└── tests/              # або пакет, коли тестів багато
    ├── __init__.py
    ├── test_models.py
    ├── test_forms.py
    └── test_views.py
```

**Навіщо.** Правило пошуку одне: файли мають починатися з `test`, класи успадковувати `TestCase`, а методи-тести — починатися з `test_`. Тільки такі методи Django запускає як тести.

```python
class ProductTest(TestCase):
    def setUp(self):
        # готуємо дані ПЕРЕД КОЖНИМ тестом
        Product.objects.create(name='Ноутбук', price=25000)

    def test_price_positive(self):    # запуститься — починається з test_
        product = Product.objects.first()
        self.assertGreater(product.price, 0)

    def helper(self):                 # НЕ запуститься — не test_
        ...
```

## `setUp` і `setUpTestData`

Майже завжди тесту потрібні готові дані (пост, товар, книга). Django дає два способи їх підготувати.

> **`setUp`** — метод, який виконується **перед кожним** тестом класу. **`setUpTestData`** — класовий метод, який виконується **один раз** на весь клас.

```python
class BookTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        # один раз на всі тести — швидше
        cls.book = Book.objects.create(title='Кобзар', author='Шевченко')

    def test_title(self):
        self.assertEqual(self.book.title, 'Кобзар')
```

**Навіщо.** `setUpTestData` **швидший** за `setUp`: дані створюються раз, а не перед кожним методом. Бери його для об'єктів, які тести лише читають. `setUp` потрібен, коли тест **змінює** об'єкт і кожному потрібна свіжа копія.

> <i class="bi bi-pin-angle"></i> `setUpTestData` — класовий метод, тому приймає `cls`, а дані клади в `cls.book`. Звертаєшся до них у тестах через `self.book` — Django робить це можливим автоматично.

## Тестовий клієнт `self.client`

> **Тестовий клієнт** — це «браузер без браузера»: об'єкт `self.client`, який імітує запити до твого сайту й повертає відповідь, не запускаючи справжній сервер.

**Як це працює.** Ти кажеш клієнту «зайди на цю адресу» — він проганяє повний цикл (URLconf → view → шаблон) і віддає тобі `response`. Далі перевіряєш поля відповіді.

```python
from django.urls import reverse


class BlogViewTest(TestCase):
    def test_post_list(self):
        url = reverse('post_list')            # ім'я маршруту → адреса
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'blog/post_list.html')
        self.assertContains(response, 'Останні пости')
```

Найкорисніші перевірки для відповіді:

| Перевірка | Що підтверджує |
|---|---|
| `response.status_code` | код відповіді (`200`, `404`, `302`) |
| `assertContains(response, текст)` | у HTML є цей текст |
| `assertTemplateUsed(response, шлях)` | сторінку намалював саме цей шаблон |
| `assertRedirects(response, url)` | був редірект на потрібну адресу |

> <i class="bi bi-info-circle"></i> Використовуй **`reverse('ім'я')`** замість жорсткого рядка `'/blog/'`. Якщо колись зміниш адресу в `urls.py`, тест не зламається — він знайде маршрут за іменем.

### POST через клієнт

Форми перевіряють методом `post`, передаючи дані другим аргументом:

```python
class ContactTest(TestCase):
    def test_submit(self):
        url = reverse('contact')
        response = self.client.post(url, {'email': 'olena@example.com',
                                          'text': 'Вітаю'})
        # після успішного POST — редірект (Post/Redirect/Get)
        self.assertRedirects(response, reverse('thanks'))
```

## Тести моделей

Перевіряй **власну поведінку** моделі: метод `__str__`, обчислення, кастомні методи.

```python
class ProductModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.product = Product.objects.create(name='Клавіатура', price=1200)

    def test_str(self):
        self.assertEqual(str(self.product), 'Клавіатура')

    def test_is_expensive(self):
        # власний метод моделі
        self.assertFalse(self.product.is_expensive())
```

> <i class="bi bi-lightbulb"></i> Не тестуй сам Django — те, що `create()` збереже об'єкт, вже перевірено розробниками фреймворку. Тестуй **свій** код: методи, які написала ти.

## Тести форм

У форм перевіряй головне — коли вони валідні, а коли ні (`is_valid()`).

```python
from .forms import PostForm


class PostFormTest(TestCase):
    def test_valid(self):
        form = PostForm(data={'title': 'Новий пост', 'body': 'Текст'})
        self.assertTrue(form.is_valid())

    def test_empty_title_invalid(self):
        form = PostForm(data={'title': '', 'body': 'Текст'})
        self.assertFalse(form.is_valid())
        self.assertIn('title', form.errors)     # помилка саме в title
```

## Тести views

Тут стикається все: клієнт робить запит, view відпрацьовує, ти перевіряєш відповідь. GET — що сторінка показується; POST — що дані обробилися.

```python
class BookViewTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.book = Book.objects.create(title='Тіні забутих предків')

    def test_detail_get(self):
        url = reverse('book_detail', args=[self.book.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Тіні забутих предків')

    def test_missing_book_404(self):
        url = reverse('book_detail', args=[9999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)
```

## Запуск тестів

**Як це працює.** Django сам знаходить усі тести й запускає їх однією командою:

```bash
python manage.py test              # усі тести проєкту
python manage.py test blog         # тільки застосунок blog
python manage.py test blog.tests.BookViewTest        # один клас
python manage.py test blog.tests.BookViewTest.test_detail_get   # один метод
```

У результаті кожна крапка — успішний тест, `F` — падіння, `E` — помилка:

```
...F.
FAIL: test_empty_title_invalid (blog.tests.PostFormTest)
```

> <i class="bi bi-info-circle"></i> Запускай тести часто — після кожної помітної зміни. Що раніше побачиш падіння, то легше зрозуміти, який саме рядок його спричинив.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Метод не запускається** — ім'я не починається з `test_`. Django бачить як тест **тільки** методи `test_*`. `check_price` не запуститься, `test_price` — так.

> <i class="bi bi-exclamation-triangle"></i> **«Дані з попереднього тесту зникли»** — так і має бути. БД **відкочується** після кожного тесту. Створюй потрібне в `setUp`/`setUpTestData`, а не сподівайся на попередній тест.

> <i class="bi bi-exclamation-triangle"></i> **Жорсткі URL** (`self.client.get('/blog/')`) ламаються при зміні адрес. Бери `reverse('ім'я')`.

> <i class="bi bi-info-circle"></i> Тестова база **окрема** — реальні дані вона не чіпає. Можна тестувати спокійно.

> <i class="bi bi-pin-angle"></i> Називай тести **зрозуміло**: `test_empty_email_is_invalid`, а не `test_1`. Ім'я має читатися як речення про те, що перевіряється — так падіння одразу зрозуміле.

## Підсумок

- **Тест** — код, що перевіряє код; головна цінність — зміни не ламають наявне непомітно.
- **`TestCase`** — обгортка над `unittest` з **окремою тестовою БД**, яка відкочується після кожного тесту (реальні дані в безпеці).
- Тести живуть у `app/tests.py` або пакеті `tests/`; методи починаються з `test_`; дані готуй у `setUp` (перед кожним) або `setUpTestData` (раз, швидше).
- **`self.client`** імітує браузер: `get`/`post`, а далі перевіряєш `status_code`, `assertContains`, `assertTemplateUsed`, `assertRedirects`.
- Тестуй **своє**: `__str__` і методи моделей, `is_valid()` форм, GET/POST у views; для URL бери `reverse()`.
- Запуск — `python manage.py test`, можна звузити до app, класу чи методу.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/testing/" target="_blank" rel="noopener">Testing in Django <i class="bi bi-box-arrow-up-right"></i></a></div></div>
