# Карта модулів Django: що звідки імпортувати

Django — це один великий пакет `django`, розкладений на модулі за призначенням. Коли пишеш код, половина питань звучить як «а звідки це імпортувати?» — цей урок і є відповіддю: карта модулів, за що кожен відповідає і в яких ситуаціях до нього звертаються.

## Загальна карта

| Модуль | За що відповідає | Що беруть найчастіше |
|---|---|---|
| `django.db` | база даних: моделі, поля, транзакції | `models`, `transaction` |
| `django.urls` | маршрути | `path`, `include`, `reverse` |
| `django.shortcuts` | щоденні хелпери у views | `render`, `redirect`, `get_object_or_404` |
| `django.http` | об'єкти запиту й відповіді | `JsonResponse`, `HttpResponse`, `Http404` |
| `django.forms` | форми та їх поля | `Form`, `ModelForm`, `CharField` |
| `django.contrib` | вбудовані застосунки-батарейки | `auth`, `admin`, `messages` |
| `django.core` | ядро: валідатори, винятки, пагінація, пошта | `validators`, `exceptions`, `paginator` |
| `django.views` | базові класи views і декоратори | `generic`, `decorators.http` |
| `django.utils` | утиліти: час, текст, HTML | `timezone`, `text.slugify` |
| `django.conf` | доступ до налаштувань | `settings` |
| `django.test` | тестування | `TestCase`, `Client` |

Назви модулів відповідають зонам: `db` — база, `http` — запит і відповідь, `contrib` — готові підсистеми, `core` — механіка ядра, `utils` — дрібні помічники. Пошук потрібного починається з питання, до якої з цих зон належить задача.

## django.db — моделі й база

```python
# school/models.py
from django.db import models

class Lesson(models.Model):                       # школа
    title = models.CharField(max_length=200)
    starts_at = models.DateTimeField()
    teacher = models.ForeignKey('Teacher', on_delete=models.CASCADE)
```

Звідси беруть **усе для опису моделі**: базовий клас `models.Model`, типи полів, `ForeignKey`, `Meta`-опції.

Рідше, але важливо — транзакції: коли кілька змін мають зберегтися разом або не зберегтися взагалі:

```python
# shop/services.py
from django.db import transaction

with transaction.atomic():        # або обидва записи, або жодного
    order = Order.objects.create(user=request.user, total=total)
    OrderItem.objects.bulk_create(items)
```

## django.urls — маршрути й зворотні посилання

```python
# school/urls.py
from django.urls import path, include, reverse

path('lessons/<int:pk>/', views.lesson_detail, name='lesson_detail')
```

`reverse()` — це `{% url %}` для Python-коду: збирає адресу за іменем маршруту, щоб не писати шляхи рядками:

```python
# school/models.py
from django.urls import reverse

def get_absolute_url(self):
    return reverse('lesson_detail', args=[self.pk])     # /lessons/12/
```

> <i class="bi bi-info-circle"></i> `reverse_lazy` — та сама функція, але «відкладена». Потрібна там, де маршрути ще не завантажені в момент виконання рядка: у `success_url` класових views, у значеннях за замовчуванням, у налаштуваннях.

## django.shortcuts — щоденні хелпери

```python
# blog/views.py
from django.shortcuts import render, redirect, get_object_or_404
```

Три функції, які є майже в кожній view: віддати сторінку, перенаправити, дістати об'єкт або 404. Детально — в окремому уроці «Хелпери shortcuts».

## django.http — відповіді власноруч

```python
# cinema/views.py
from django.http import JsonResponse, HttpResponse, Http404, HttpResponseForbidden
```

| Клас | Коли потрібен |
|---|---|
| `JsonResponse` | відповідь для AJAX або простого API |
| `HttpResponse` | своя відповідь: текст, CSV, PDF, будь-який `content_type` |
| `Http404` | підняти 404 вручну (`raise Http404('Немає такої групи')`) |
| `HttpResponseForbidden` | 403 без пояснень |
| `HttpResponseRedirect` | те, що `redirect()` робить зручніше |

```python
# cinema/views.py — віддати список нагород фільму для AJAX
return JsonResponse({'awards': list(movie.awards.values('title', 'year'))})
```

## django.forms — форми

```python
# cinema/forms.py
from django import forms                       # імпортують саме так

class ReviewForm(forms.Form):
    score = forms.IntegerField(min_value=1, max_value=10)
    text = forms.CharField(widget=forms.Textarea)
```

Тут живуть класи форм, поля форм і віджети.

> <i class="bi bi-exclamation-triangle"></i> **Найпідступніша плутанина в Django.** `CharField` існує у двох різних модулях: `models.CharField` — це стовпець у базі, `forms.CharField` — це поле у формі. Назви однакові, призначення різні. Дивись на префікс: `models.` — база, `forms.` — форма.

## django.contrib — вбудовані застосунки

Це не один модуль, а набір готових застосунків. Найуживаніші імпорти:

```python
# accounts/views.py
from django.contrib import admin, messages
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
```

| Що треба | Звідки |
|---|---|
| Зареєструвати модель в адмінці | `django.contrib.admin` |
| Модель користувача | `django.contrib.auth.models` |
| Вхід і вихід з акаунта | `django.contrib.auth` |
| Захистити сторінку | `django.contrib.auth.decorators` (функції) або `.mixins` (класи) |
| Флеш-повідомлення | `django.contrib.messages` |
| Робота з сесією | нічого не імпортуєш — `request.session` |

Що дає кожен із них — в уроці «Вбудовані застосунки». Там же різниця між застосунком, модулем і бібліотекою тегів.

## django.core — валідатори, винятки, пагінація, пошта

```python
# library/models.py
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.core.exceptions import ValidationError, PermissionDenied
from django.core.paginator import Paginator
from django.core.mail import send_mail
```

```python
# library/models.py — рік видання не може бути з майбутнього
year = models.PositiveIntegerField(validators=[MaxValueValidator(2026)])

# блог: сторінка 20 статей
paginator = Paginator(Post.objects.all(), 20)
```

> <i class="bi bi-info-circle"></i> `ValidationError` теж має двійника: у формах його зазвичай піднімають у методах `clean_<field>()` і беруть із `django.core.exceptions`. Це та сама помилка, просто імпорт із ядра.

## django.views — декоратори й класові views

```python
# blog/views.py
from django.views.decorators.http import require_POST, require_GET, require_http_methods
from django.views.decorators.cache import cache_page
from django.views.generic import ListView, DetailView, CreateView
```

`require_POST` — той самий декоратор, яким закривають операції зміни даних, щоб їх не можна було виконати переходом за посиланням.

## django.utils — дрібні помічники

```python
# blog/models.py
from django.utils import timezone
from django.utils.text import slugify
from django.utils.html import escape
```

```python
# blog/views.py — опубліковані статті на зараз
Post.objects.filter(published_at__lte=timezone.now())

# слаг для URL із назви
slugify('Тигролови Івана Багряного')     # 'tigrolovi-ivana-bagrianogo'
```

> <i class="bi bi-exclamation-triangle"></i> Бери `timezone.now()`, а не `datetime.now()`. Django працює з часовими поясами (`USE_TZ = True`), і «наївний» час із `datetime` дасть попередження й криві порівняння.

## django.conf — налаштування

```python
# core/utils.py
from django.conf import settings

if settings.DEBUG:
    ...
upload_root = settings.MEDIA_ROOT
```

Саме `django.conf.settings`, а не прямий імпорт файлу: цей об'єкт враховує і твій `settings.py`, і значення за замовчуванням, і змінні оточення — це єдина правильна точка доступу.

## Задача → що імпортувати

Таблиця, яку зручно тримати перед очима, поки пишеш view:

| Хочу… | Імпорт |
|---|---|
| описати модель | `from django.db import models` |
| додати маршрут | `from django.urls import path, include` |
| зібрати адресу за іменем | `from django.urls import reverse` |
| віддати сторінку | `from django.shortcuts import render` |
| перенаправити після POST | `from django.shortcuts import redirect` |
| дістати об'єкт або 404 | `from django.shortcuts import get_object_or_404` |
| відповісти на AJAX | `from django.http import JsonResponse` |
| дозволити лише POST | `from django.views.decorators.http import require_POST` |
| пустити лише залогінених | `from django.contrib.auth.decorators import login_required` |
| створити користувача, перевірити пароль | `from django.contrib.auth.models import User`, `from django.contrib.auth import authenticate, login` |
| показати повідомлення після дії | `from django.contrib import messages` |
| зробити форму | `from django import forms` |
| перевірити діапазон значень поля | `from django.core.validators import MinValueValidator` |
| підняти помилку валідації | `from django.core.exceptions import ValidationError` |
| розбити список на сторінки | `from django.core.paginator import Paginator` |
| надіслати листа | `from django.core.mail import send_mail` |
| працювати з поточним часом | `from django.utils import timezone` |
| прочитати налаштування | `from django.conf import settings` |
| написати тест | `from django.test import TestCase, Client` |

## Як шукати самій

Документація Django поділена на два типи сторінок, і це дуже зручно, коли звикнеш:

- **`topics/`** — пояснення «як це працює загалом»: форми, автентифікація, сесії. Читають, коли вивчаєш тему.
- **`ref/`** — довідник: усі класи, усі аргументи, усі опції. Читають, коли вже знаєш що, але забула як саме.

Плюс два прийоми: у пошуку на сайті документації вводь саме ім'я класу (`JsonResponse`, `Paginator`), а в редакторі коду переходь до визначення — побачиш реальний модуль і сигнатуру.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Плутати `models.CharField` і `forms.CharField` | Однакові імена, різні речі: перше — стовпець у базі, друге — поле форми. Дивись на префікс, а не на назву |
| Імпортувати `User`, щоб дістати поточного користувача | Імпорт потрібен лише для запитів до таблиці користувачів. Поточний приходить сам — `request.user`, без імпорту |
| Прямий `User` у полях моделей | Після переходу на власну модель користувача код зламається. Стійко: `get_user_model()` у коді, `settings.AUTH_USER_MODEL` у полях |
| Циклічні імпорти між застосунками | `orders/models.py` імпортує `catalog`, а `catalog` — `orders`, і Python падає. Рішення: посилатися рядком, `ForeignKey('catalog.Product', ...)` |
| Шукати сторонні пакети в `django.*` | `rest_framework`, `crispy_forms`, `pillow` — окремі бібліотеки: спершу `pip install`, часто рядок в `INSTALLED_APPS`, і лише потім імпорт |

## Підсумок

- Пакет `django` поділений за призначенням: `db` — база, `urls` — маршрути, `http` — запит і відповідь, `forms` — форми, `contrib` — батарейки, `core` — ядро, `utils` — помічники, `conf` — налаштування.
- `shortcuts` — три щоденні хелпери (`render`, `redirect`, `get_object_or_404`), `http` — коли відповідь треба зібрати самій (`JsonResponse`).
- Захист операцій — це два різні модулі: метод запиту з `django.views.decorators.http`, права з `django.contrib.auth.decorators`.
- Однакові імена в різних модулях (`CharField`, `ValidationError`) — дивись на префікс, а не лише на назву.
- Поточний користувач не імпортується — він у `request.user`; імпорт `User` потрібен для запитів до таблиці користувачів.
- Налаштування читай тільки через `from django.conf import settings`.
- Шукати в документації: `topics/` — щоб зрозуміти тему, `ref/` — щоб уточнити аргументи.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/" target="_blank" rel="noopener">API Reference <i class="bi bi-box-arrow-up-right"></i></a></div></div>
