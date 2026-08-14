# Валідація: клієнт і сервер

Валідація — перевірка даних від користувача перед тим, як вони потраплять у базу або в бізнес-логіку. Виконувати її можна у двох місцях, і ці місця дають різні гарантії. Урок про принцип поділу й про перевірки без форми; механізми самої форми — в уроці «Валідація у формах».

## Дві лінії валідації

- **Клієнтська** — у браузері: атрибути HTML5 (`required`, `type="email"`, `minlength`) і, за потреби, JavaScript.
- **Серверна** — у Django після отримання запиту: `Form` / `ModelForm` або перевірки у view.

Різниця не в зручності, а в гарантіях. Клієнтський код виконується на машині, яку ти не контролюєш: JavaScript вимикається, HTML5-атрибути стираються в DevTools, а запит можна надіслати взагалі повз сторінку:

```bash
curl -X POST https://example.com/login/ -d "username=&password="
```

Сервер отримає порожні поля так, ніби `required` не існувало.

> <i class="bi bi-exclamation-triangle"></i> **Серверна валідація обов'язкова завжди; клієнтська — лише UX і не є її заміною.** Дані з браузера вважаються недовіреними, поки сервер не перевірив їх сам.

Це стосується кожної форми, а не лише входу: публікація статті, оформлення замовлення, рецензія, завантаження обкладинки — усе це введення користувача.

## Три рівні

| Рівень | Чим задається | Що гарантує |
|---|---|---|
| HTML5 | `required`, `type`, `minlength`, `min` / `max` | нічого; відсіює випадкові помилки чесного користувача |
| JavaScript | обробники подій у браузері | нічого; дає миттєвий фідбек до відправлення |
| Сервер | `Form` / `ModelForm` або перевірки у view | єдиний рівень, який неможливо обійти |

Два практичні висновки з цієї таблиці:

**Чи потрібен JavaScript для форми логіна.** Ні. Django-форма перевірить заповненість полів, `authenticate()` — коректність пари «логін + пароль». JS додає лише миттєвий фідбек, на правильність він не впливає.

**Чи перевіряти на сервері те, що вже перевірив JavaScript.** Так, завжди. Це не дублювання, а різні ролі: клієнт відповідає за зручність, сервер — за коректність.

```python
# accounts/views.py
from django.contrib.auth.forms import AuthenticationForm

def login_view(request):
    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():                  # серверна валідація
            login(request, form.get_user())
            return redirect("home")
    else:
        form = AuthenticationForm()
    return render(request, "login.html", {"form": form})
```

---

## Валідація без форми

Форма — інструмент, а не обов'язок. Можна прийняти дані напряму з `request.POST` і перевірити їх самій. Але тоді треба знати головне обмеження.

### Модель сама себе не валідує

`save()` і `objects.create()` **не викликають** `full_clean()`. Отже, ні `blank=False`, ні `max_length`, ні `validators=[...]`, ні тип `EmailField` не спрацюють при прямому записі:

```python
# усе це збережеться, попри опис моделі
Product.objects.create(name='', price=-100)
User.objects.create_user(username='', email='не-email', password='1')
```

Зупинить лише те, що описано на рівні бази: `UNIQUE`, `NOT NULL`, зовнішні ключі — і то помилкою `IntegrityError`, тобто сторінкою 500, а не зрозумілим повідомленням. SQLite при цьому не перевіряє навіть `max_length`.

> <i class="bi bi-exclamation-triangle"></i> Опис моделі — це схема таблиці, а не автоматична перевірка даних. Правила з `models.py` вмикає **або форма, або явний `full_clean()`**.

### Варіант 1: ручні перевірки у view

Для двох-трьох полів це нормальний і читабельний шлях:

```python
# cinema/views.py
@require_POST
def review_add(request, movie_id):
    text = (request.POST.get('text') or '').strip()
    score = request.POST.get('score')

    if not text:
        messages.error(request, 'Напишіть текст відгуку')
        return redirect('movie_detail', movie_id=movie_id)

    if score not in {'1', '2', '3', '4', '5'}:
        messages.error(request, 'Оцінка має бути від 1 до 5')
        return redirect('movie_detail', movie_id=movie_id)

    Review.objects.create(movie_id=movie_id, author=request.user, text=text, score=int(score))
    return redirect('movie_detail', movie_id=movie_id)
```

Два прийоми, без яких такий код дірявий:

- `request.POST.get('text')` повертає `None`, якщо поля немає в запиті, тому `(… or '').strip()` — щоб порожній рядок і пробіли не пройшли;
- значення з браузера завжди **рядки**: `score` це `'5'`, а не `5`, і перетворювати його треба після перевірки.

### Варіант 2: ручні перевірки плюс `full_clean()`

Якщо обмеження вже описані в моделі, їх можна ввімкнути явно — тоді не доведеться дублювати ті самі правила у view:

```python
# cinema/views.py
from django.core.exceptions import ValidationError

review = Review(movie_id=movie_id, author=request.user, text=text, score=score)
try:
    review.full_clean()          # запускає валідатори полів, blank, max_length, choices, clean()
    review.save()
except ValidationError as e:
    messages.error(request, '; '.join(m for msgs in e.message_dict.values() for m in msgs))
    return redirect('movie_detail', movie_id=movie_id)
```

`full_clean()` збирає всі помилки в `e.message_dict` — словник «поле → список повідомлень».

### Паролі — окремий випадок

`AUTH_PASSWORD_VALIDATORS` із `settings.py` застосовуються **тільки** через форми автентифікації або явний виклик. `create_user()` їх не перевіряє, тож пароль `1` пройде:

```python
# accounts/views.py
from django.contrib.auth.password_validation import validate_password

try:
    validate_password(password)
except ValidationError as e:
    ...   # e.messages — список зрозумілих причин: закороткий, надто поширений, лише цифри
```

Для реєстрації й входу є готові форми — `UserCreationForm` і `AuthenticationForm` із `django.contrib.auth.forms`: там ці перевірки, збіг паролів і унікальність логіна вже написані.

### Що обрати

| | Ручні `if` | Ручні `if` + `full_clean()` | `Form` / `ModelForm` |
|---|---|---|---|
| Правила описані | у view | у моделі | у формі |
| Перевірка типів (число, email, дата) | пишеш сама | частково, за описом моделі | безкоштовно |
| Помилки для шаблону | збираєш сама | `e.message_dict` | `form.errors`, автоматично біля полів |
| Повернути введені дані у форму після помилки | вручну | вручну | само |
| Доречно | 2–3 поля | коли модель уже описує обмеження | багато полів і правил |

> <i class="bi bi-info-circle"></i> Ручний підхід не «гірший», він просто дешевший на старті й дорожчий при зростанні: щойно полів стає більше п'яти або доводиться вручну повертати введені значення назад у форму, форма економить більше коду, ніж коштує.

## Клієнтська перевірка на JavaScript

Миттєвий фідбек до відправлення форми роблять на подіях поля: `blur` перевіряє, коли користувач пішов із поля, `input` — на кожен символ, `change` — для списків і чекбоксів. Деталі подій розібрані в уроці «Події DOM».

Хоч би яку подію ти обрала, це лише зручність: ту саму перевірку сервер робить заново, бо запит можна надіслати повз сторінку.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Перевірка лише в JavaScript | Запит через `curl` або DevTools обходить її повністю |
| Розрахунок на те, що модель перевірить себе сама | `save()` не викликає `full_clean()`: валідатори, `blank` і `max_length` мовчать при прямому записі |
| `create()` замість форми там, де є правила | Обмеження з моделі не застосуються, у базі опиняться некоректні дані |
| Валідація лише форми входу | Стаття, замовлення, рецензія, файл — теж введення користувача |
| Правила описані окремо в JS і в Python | Розходяться при першій зміні: клієнт пропускає, сервер відхиляє |
| Пароль збережено без `validate_password()` | Вимоги з `AUTH_PASSWORD_VALIDATORS` не застосуються: пройде пароль `1` |

## Підсумок

- Клієнтська перевірка дає зручність, серверна — гарантію; замінити одну одною неможливо.
- Три рівні: HTML5 і JavaScript нічого не гарантують, сервер — єдиний, який не обійти.
- Модель себе не валідує: `save()` і `create()` не викликають `full_clean()`.
- Без форми теж можна: ручні `if` у view, за потреби `full_clean()` для правил моделі та `validate_password()` для паролів.
- Форма стає вигіднішою, коли полів багато й потрібно показувати помилки біля кожного.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/forms/validation/" target="_blank" rel="noopener">Form and field validation <i class="bi bi-box-arrow-up-right"></i></a></div></div>
