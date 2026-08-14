# Валідація: клієнт проти сервера

Валідація — це перевірка даних, що прийшли від користувача, перед тим як вони потраплять у базу або в бізнес-логіку. Виконувати її можна у двох місцях: у браузері та на сервері. Ці місця не рівноцінні, і плутанина між ними — головне джерело дір у формах.

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

## Рівень JavaScript: які події слухати

Другий рівень (JS) — про **миттєвий фідбек**: підсвітити помилку, показати «паролі збігаються» ще до відправлення. Але результат сильно залежить від того, **яку подію** ти слухаєш.

### `blur` — перевірити, коли користувач пішов з поля

> **`blur`** — подія, що спрацьовує, коли поле **втрачає фокус** (клік або Tab на інше поле).

```js
// static/js/register.js
// перевірити збіг паролів, коли користувач залишив поле підтвердження
$('#password_confirm').on('blur', function () {
    const ok = $('#password').val() === $(this).val();
    $('#confirm-hint').text(ok ? '' : 'Паролі не збігаються');
});
```

Зручно для перевірки «як закінчив»: не смикає під час набору. Але спрацьовує **лише** при виході з поля — тож не замінює перевірку на `submit` і на сервері.

> <i class="bi bi-info-circle"></i> `.on('blur', fn)` — сучасний запис; старий скорочений `.blur(fn)` робить те саме, але `.on()` кращий (і працює з делегуванням для динамічно доданих елементів).

### Які події бувають і коли що обирати

| Подія | Спрацьовує | Для чого |
|---|---|---|
| **`blur`** | пішов з поля | перевірка «як закінчив»: збіг паролів, формат email |
| **`input`** | на кожен символ/вставку | «живий» фідбек: сила пароля, лічильник символів, «збігається ✓» у реальному часі |
| **`change`** | значення змінилось + втрата фокуса | `<select>`, чекбокси, радіо (там це головна подія) |
| **`keyup`** | відпустив клавішу | старіший аналог `input`; гірший — не ловить вставку мишею та автозаповнення |
| **`submit`** (форми) | натиснув «Надіслати» | фінальні перевірки перед відправленням — потрібні завжди |

**Практично:** для підтвердження пароля бери `blur` (перевірити на виході) або `input` (живий індикатор); для `<select>`/чекбоксів — `change`; `keyup` не використовуй (є кращий `input`).

> <i class="bi bi-exclamation-triangle"></i> Хоч би яку подію ти обрала — це лише **клієнтський UX**. Ту саму перевірку збігу паролів Django робить у `clean()` на сервері, бо JS можна вимкнути чи обійти. Події прискорюють фідбек, але **істину зберігає сервер**.

---

## Рівні валідації в Django-формі детально

Тепер розберемо, з чого саме складається той «третій рівень» — серверна форма. У Django є **чотири механізми**, і вони спрацьовують у чіткому порядку.

### 1. Валідатори полів (`validators=[...]`)

Валідатор — це готова функція-перевірка, яку ти чіпляєш прямо до поля. Django має набір вбудованих валідаторів у `django.core.validators`.

Найпоширеніші:

| Валідатор | Що перевіряє |
|---|---|
| `MinValueValidator(x)` / `MaxValueValidator(x)` | число не менше / не більше за `x` |
| `MinLengthValidator(n)` / `MaxLengthValidator(n)` | довжину тексту |
| `RegexValidator(pattern)` | відповідність регулярному виразу |
| `EmailValidator()` | коректність email |

```python
# library/forms.py
from django import forms
from django.core.validators import MinValueValidator, RegexValidator

class BookForm(forms.Form):
    title = forms.CharField(
        max_length=200,
        validators=[
            RegexValidator(
                r"^[\w\s\-.,:]+$",
                message="Назва містить недопустимі символи.",
            )
        ],
    )
    isbn = forms.CharField(
        max_length=13,
        validators=[
            RegexValidator(r"^\d{13}$", message="ISBN має складатися з 13 цифр.")
        ],
    )
    published_year = forms.IntegerField(
        validators=[MinValueValidator(1450, message="Рік видання виглядає нереальним.")],
    )
```

Валідатор — це перевірка «одним рядком», яку легко перевикористати на багатьох полях. Не пиши те, що вже є у фреймворку.

### 2. `clean_<field>()` — валідація одного поля

Метод `clean_<назва_поля>()` описує **власне** правило для конкретного поля — те, чого немає серед готових валідаторів (звернення до бази, заборонені слова, складна логіка).

Django викликає його автоматично під час `is_valid()`. Ти читаєш значення з `self.cleaned_data`, перевіряєш і **обовʼязково повертаєш** його назад:

```python
# blog/forms.py
class PostForm(forms.Form):
    title = forms.CharField(max_length=200)

    FORBIDDEN = {"тест", "asdf", "123"}

    def clean_title(self):
        title = self.cleaned_data["title"].strip()
        if title.lower() in self.FORBIDDEN:
            raise forms.ValidationError("Це не схоже на справжній заголовок статті.")
        if len(title) < 5:
            raise forms.ValidationError("Заголовок має містити щонайменше 5 символів.")
        return title
```

Один метод — одне поле, одне правило. Помилка, кинута через `raise forms.ValidationError(...)`, автоматично прикріпиться саме до цього поля й покажеться користувачу поряд із ним.

> <i class="bi bi-exclamation-triangle"></i> Не забувай `return` наприкінці `clean_<field>()`. Якщо нічого не повернути, поле стане `None` — це поширена помилка новачків.

### 3. `clean()` — міжпольова (крос-полева) валідація

Метод `clean()` перевіряє **звʼязки між кількома полями** одразу — коли правильність одного поля залежить від іншого.

Класичні приклади: пароль має збігатися з підтвердженням; дата початку сеансу — бути раніше за дату завершення. Тут `clean_<field>()` не підходить, бо він бачить лише одне поле. Використовуй `clean()` і кидай помилку або на конкретне поле (`add_error`), або на форму загалом:

```python
# cinema/forms.py
class ScreeningForm(forms.Form):        # сеанс у кінотеатрі
    starts_at = forms.DateTimeField()
    ends_at = forms.DateTimeField()

    def clean(self):
        cleaned = super().clean()
        start = cleaned.get("starts_at")
        end = cleaned.get("ends_at")
        if start and end and start >= end:
            self.add_error("ends_at", "Кінець сеансу має бути пізніше за початок.")
        return cleaned
```

А ось той самий механізм для пари «пароль + підтвердження» у реєстрації:

```python
# accounts/forms.py
def clean(self):
    cleaned = super().clean()
    p1 = cleaned.get("password")
    p2 = cleaned.get("password_confirm")
    if p1 and p2 and p1 != p2:
        raise forms.ValidationError("Паролі не збігаються.")
    return cleaned
```

`clean()` — єдине місце, де видно всю форму цілком. Саме сюди виноситься логіка «поле A має узгоджуватися з полем B».

> <i class="bi bi-info-circle"></i> Порядок такий: спершу валідатори полів → потім усі `clean_<field>()` → наприкінці один `clean()`. У `clean()` потрапляють лише ті поля, що вже пройшли свою індивідуальну перевірку.

### 4. Валідація файлів і зображень (коротко)

Завантажені файли — теж введення користувача, і його теж треба перевіряти: розмір, розширення, тип.

Для розширень є готовий `FileExtensionValidator`; розмір перевіряєш у `clean_<field>()`:

```python
# library/forms.py
from django.core.validators import FileExtensionValidator

class CoverForm(forms.Form):            # обкладинка книги/фільму
    cover = forms.ImageField(
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])]
    )

    def clean_cover(self):
        img = self.cleaned_data["cover"]
        if img.size > 2 * 1024 * 1024:            # 2 МБ
            raise forms.ValidationError("Файл завеликий (максимум 2 МБ).")
        return img
```

Без перевірки хтось завантажить 500-мегабайтний файл чи виконуваний скрипт замість обкладинки. Розмір і розширення — мінімальний захист будь-якого поля з файлом.

---

## Приклади: форми є всюди

Механізми вище застосовні до будь-якої форми. Нижче — по одному прикладу на кожен характерний випадок.

### Публікація статті (`ModelForm`)

`ModelForm` бере поля з моделі, тож частина правил (типи, `max_length`) успадковується автоматично. Додаєш лише те, чого моделі бракує:

```python
# blog/forms.py
from django import forms

from blog.models import Post

class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ["title", "slug", "body"]

    def clean_body(self):
        body = self.cleaned_data["body"].strip()
        if len(body) < 50:
            raise forms.ValidationError("Текст статті замалий — напиши хоча б абзац.")
        return body

    def clean_slug(self):
        slug = self.cleaned_data["slug"]
        qs = Post.objects.filter(slug=slug).exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("Стаття з таким slug уже існує.")
        return slug
```

Тут працюють одразу три речі: успадкована з моделі перевірка довжини `title`, власна перевірка обсягу `body` та унікальності `slug`.

### Контактна форма (`forms.Form`)

Проста форма без моделі — бо їй нема що зберігати в БД, вона лише надсилає лист:

```python
# pages/forms.py
class ContactForm(forms.Form):
    name = forms.CharField(max_length=80)
    email = forms.EmailField()                      # EmailField сам перевіряє формат
    message = forms.CharField(widget=forms.Textarea, min_length=10)

    def clean_message(self):
        msg = self.cleaned_data["message"].strip()
        if "http://" in msg or "https://" in msg:
            raise forms.ValidationError("Посилання у повідомленні заборонені (спам).")
        return msg
```

> <i class="bi bi-info-circle"></i> `forms.Form` беруть, коли даним не потрібна модель (контакт, пошук, фільтр). `forms.ModelForm` — коли форма напряму створює/редагує обʼєкт у БД (стаття, книга, профіль). Правило вибору просте: *є модель для збереження — бери `ModelForm`.*

### Оформлення замовлення (`forms.Form`, кількість)

```python
# shop/forms.py
class OrderItemForm(forms.Form):
    product_id = forms.IntegerField(widget=forms.HiddenInput)
    quantity = forms.IntegerField(min_value=1)

    def clean_quantity(self):
        quantity = self.cleaned_data["quantity"]
        if quantity > 99:
            raise forms.ValidationError("За раз можна замовити не більше 99 штук.")
        return quantity
```

> <i class="bi bi-info-circle"></i> `min_value=1` у полі вже вбудовує `MinValueValidator` — тобі не треба писати його руками. Власний `clean_quantity` додаємо лише для правила, якого немає «з коробки» (верхня межа з бізнес-причин).

### Редагування профілю (унікальність, крім себе)

Тонкий, але дуже частий випадок. При редагуванні email має лишатися унікальним — але **не конфліктувати із самим користувачем**, якого ти зараз редагуєш. Тому в запиті виключаємо поточний обʼєкт через `.exclude(pk=...)`:

```python
# accounts/forms.py
from django.contrib.auth import get_user_model

User = get_user_model()


class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["username", "email"]

    def clean_email(self):
        email = self.cleaned_data["email"]
        qs = User.objects.filter(email=email).exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("Ця пошта вже зайнята іншим користувачем.")
        return email
```

> <i class="bi bi-exclamation-triangle"></i> Без `.exclude(pk=self.instance.pk)` користувач не зможе зберегти профіль, навіть не змінюючи пошту: форма знайде «дубль» — і це буде він сам.

## Наскрізний приклад: реєстрація

Повний стек однієї форми в тому порядку, у якому його пишуть: модель → форма → маршрут → view → шаблон → JavaScript. Реєстрація зручна тим, що задіює всі механізми одразу.

### 1. Модель

Реєстрація спирається на вбудовану модель `User`. Додаткові дані виносять в окрему модель, зв'язану з нею `OneToOneField`:

```python
# accounts/models.py
from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    phone = models.CharField(
        max_length=20,
        blank=True,
        validators=[RegexValidator(r'^\+?\d{9,15}$', 'Телефон у форматі +380XXXXXXXXX')],
    )

    def __str__(self):
        return f'Профіль {self.user.username}'
```

- `settings.AUTH_USER_MODEL` замість прямого імпорту `User`: модель користувача в проєкті можна замінити, і такий код це переживе.
- Валідатор описано в моделі, але спрацює він через форму або `full_clean()` — прямий `save()` його не запускає.

> <i class="bi bi-info-circle"></i> Для нового проєкту документація радить одразу заводити власну модель користувача (`AbstractUser`), бо замінити її після перших міграцій складно. Для навчального проєкту достатньо вбудованої `User` плюс `Profile`.

### 2. Форма

Форма — єдине джерело правил. Пароль описуємо окремим полем, бо його не можна зберігати як звичайне значення моделі:

```python
# accounts/forms.py
from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

from .models import Profile

User = get_user_model()


class RegisterForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, label='Пароль')
    password_confirm = forms.CharField(widget=forms.PasswordInput, label='Повторіть пароль')
    phone = forms.CharField(required=False, label='Телефон')

    class Meta:
        model = User
        fields = ['username', 'email']          # password сюди не входить

    def clean_username(self):
        username = self.cleaned_data['username'].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError('Такий логін уже зайнятий.')
        return username

    def clean_email(self):
        email = self.cleaned_data['email'].strip()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('Ця пошта вже зайнята.')
        return email

    def clean_password(self):
        password = self.cleaned_data['password']
        validate_password(password)             # застосовує AUTH_PASSWORD_VALIDATORS
        return password

    def clean(self):
        cleaned = super().clean()
        if cleaned.get('password') != cleaned.get('password_confirm'):
            self.add_error('password_confirm', 'Паролі не збігаються.')
        return cleaned

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password'])     # хешування
        if commit:
            user.save()
            Profile.objects.create(user=user, phone=self.cleaned_data.get('phone', ''))
        return user
```

Що тут задіяно:

- `clean_username` / `clean_email` — унікальність; `__iexact` порівнює без урахування регістру, щоб `Olena` і `olena` вважались тим самим.
- `clean_password` — виклик `validate_password()`. Без нього вимоги до пароля з `AUTH_PASSWORD_VALIDATORS` не застосуються: `ModelForm` не робить цього сам.
- `clean` — порівняння двох полів, тому саме тут, а не в `clean_<field>()`.
- `save(commit=False)` дає незбережений об'єкт, `set_password()` хешує пароль, і лише після цього йде `save()`.

> <i class="bi bi-exclamation-triangle"></i> Пароль ніколи не потрапляє в модель напряму. `User(password=...)` або `fields = ['username', 'password']` збережуть **чистий текст**, і вхід не працюватиме, бо `authenticate()` порівнює хеші.

> <i class="bi bi-info-circle"></i> Готова `UserCreationForm` із `django.contrib.auth.forms` робить те саме: підтвердження пароля, `validate_password()`, хешування. Власну форму пишуть, коли потрібні свої поля чи правила — як тут із телефоном.

### 3. Маршрути

```python
# accounts/urls.py
urlpatterns = [
    path('register/', views.register, name='register'),
    path('register/check/', views.register_check, name='register_check'),
]
```

### 4. View

```python
# accounts/views.py
from django.contrib import messages
from django.contrib.auth import get_user_model, login
from django.http import JsonResponse
from django.shortcuts import redirect, render

from .forms import RegisterForm

User = get_user_model()


def register(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)                     # одразу впускаємо
            messages.success(request, 'Реєстрацію завершено')
            return redirect('home')                  # Post/Redirect/Get
    else:
        form = RegisterForm()

    return render(request, 'accounts/register.html', {'form': form})
```

У view немає жодної перевірки даних — усі правила лишились у формі. Якщо `is_valid()` повернув `False`, та сама `form` іде назад у шаблон уже з помилками й раніше введеними значеннями, тож користувачу не доведеться заповнювати все спочатку.

Друга, допоміжна view — для живої перевірки з браузера:

```python
# accounts/views.py
def register_check(request):
    username = request.GET.get('username', '').strip()
    email = request.GET.get('email', '').strip()

    return JsonResponse({
        'username_taken': bool(username) and User.objects.filter(username__iexact=username).exists(),
        'email_taken': bool(email) and User.objects.filter(email__iexact=email).exists(),
    })
```

> <i class="bi bi-exclamation-triangle"></i> Ця view існує лише заради UX і нічого не гарантує: між перевіркою та натисканням «Зареєструватися» логін може зайняти інший користувач. Остаточне рішення завжди за `clean_username()` у формі.

### 5. Шаблон

```html
{# templates/accounts/register.html #}
<form method="post" id="register-form">
  {% csrf_token %}

  {{ form.non_field_errors }}

  {% for field in form %}
    <p>
      {{ field.label_tag }}
      {{ field }}
      <span class="hint" data-hint-for="{{ field.name }}"></span>
      {% for error in field.errors %}<span class="error">{{ error }}</span>{% endfor %}
    </p>
  {% endfor %}

  <button type="submit">Зареєструватися</button>
</form>
```

- `{% csrf_token %}` обов'язковий для будь-якого POST.
- `field.errors` — серверні помилки біля свого поля, `non_field_errors` — ті, що прийшли з `clean()`.
- Окремий `<span class="hint">` для клієнтських підказок: так JS не затирає серверні помилки й навпаки.
- Атрибути `required` і `type="email"` Django проставляє сам, виходячи з опису полів форми, — писати їх руками не треба.

### 6. JavaScript

Клієнтський рівень нічого не вирішує — він лише скорочує час до фідбеку:

```js
// static/js/register.js
$(function () {
    // збіг паролів — перевіряємо на виході з поля
    $('#id_password_confirm').on('blur', function () {
        const ok = $('#id_password').val() === $(this).val();
        $('[data-hint-for="password_confirm"]').text(ok ? '' : 'Паролі не збігаються');
    });

    // зайнятість логіна й пошти — GET-запит, тому без CSRF-токена
    $('#id_username, #id_email').on('blur', function () {
        const field = $(this).attr('name');

        $.get('/accounts/register/check/', { [field]: $(this).val() }, function (response) {
            $(`[data-hint-for="${field}"]`).text(response[`${field}_taken`] ? 'Уже зайнято' : '');
        });
    });
});
```

- Django генерує атрибути `id` за схемою `id_<назва поля>` — саме за ними тут і йде звертання.
- Скрипт не блокує відправлення форми: навіть якщо підказка не встигла з'явитись, рішення ухвалить сервер.

### Хто за що відповідає

| Рівень | Що робить у цьому прикладі |
|---|---|
| HTML5 | `required`, `type="email"` — Django додав їх сам із опису форми |
| JavaScript | підказки про збіг паролів і зайнятість логіна |
| Форма | унікальність, сила пароля, збіг паролів, хешування |
| Модель | формат телефону, `OneToOne` зв'язок, обмеження полів |
| База даних | `UNIQUE` на `username` — останній бар'єр від одночасних реєстрацій |

Правила описані один раз — у формі й моделі. JavaScript їх дублює лише заради швидкого фідбеку і жодних гарантій не дає.

## Як помилки повертаються користувачу

Коли `is_valid()` повертає `False`, усі помилки складаються у `form.errors`, і Django сам домальовує їх у шаблоні поряд із відповідними полями.

У view нічого спеціального робити не треба — просто повертаєш ту саму форму назад у шаблон, і вона «памʼятає» свої помилки та введені значення:

```python
# blog/views.py
def create_post(request):
    if request.method == "POST":
        form = PostForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("post_list")
        # якщо НЕ valid — form уже містить .errors, просто рендеримо її знову
    else:
        form = PostForm()
    return render(request, "blog/create.html", {"form": form})
```

У шаблоні виводиш помилки поля поряд із самим полем. `{{ form.non_field_errors }}` показує помилки з `clean()`, що не привʼязані до конкретного поля:

```html
{# templates/blog/create.html #}
<form method="post">
  {% csrf_token %}

  {{ form.non_field_errors }}

  {% for field in form %}
    <p>
      {{ field.label_tag }} {{ field }}
      {% for error in field.errors %}
        <span class="error">{{ error }}</span>
      {% endfor %}
    </p>
  {% endfor %}

  <button type="submit">Зберегти</button>
</form>
```

Користувач одразу бачить, *що саме* не так і *біля якого поля*, — а не порожню сторінку. Помилки з `clean_<field>()` лягають до поля, помилки з `clean()` — у `non_field_errors`.

> <i class="bi bi-info-circle"></i> Не хочеш вручну перебирати поля — Django вміє відрендерити всю форму одним викликом: `{{ form.as_p }}`, `{{ form.as_div }}` (рекомендований у Django 6.0) або `{{ form.as_table }}`. Помилки він додасть автоматично.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Перевірка лише в JavaScript | Запит, надісланий через `curl` або DevTools, обходить її повністю. Сервер валідує завжди |
| Валідують тільки форму входу | Стаття, замовлення, рецензія, завантажений файл — теж введення користувача, і теж потребують перевірки |
| Правила описані окремо в JS і в Python | Розходяться при першій зміні: клієнт пропускає, сервер відхиляє. Джерело правил — форма або модель |
| Немає `return` у `clean_<field>()` | Поле стає `None` і дані «зникають» без явної помилки |
| Перевірка унікальності при редагуванні без `.exclude(pk=…)` | Користувач не може зберегти власний профіль: форма вважає його ж дублікатом |
| `clean_<field>()` там, де потрібен `clean()` | Метод бачить лише одне поле, тому пароль і підтвердження порівняти в ньому неможливо |
| Форма відхилила дані, а сторінка нічого не показує | Потрібно виводити `field.errors` і `non_field_errors`, інакше користувач не розуміє, що сталося |
| Розрахунок на те, що модель перевірить себе сама | `save()` не викликає `full_clean()`: валідатори, `blank` і `max_length` мовчать при прямому записі |
| Пароль збережено без `set_password()` | У базі опиняється відкритий текст, а вхід не працює, бо `authenticate()` порівнює хеші |

## Підсумок

- Є **дві лінії** валідації: клієнтська (браузер: HTML5 + JS) і серверна (Django: `Form` / `ModelForm` / view).
- **Золоте правило:** серверна — обов'язкова завжди; клієнтська — лише UX і не замінює її. Ніколи не довіряй даним із браузера — JS вимикається, а запит підробляється (`curl`, Postman, DevTools).
- **Валідуй будь-яке введення**, а не лише логін: стаття, замовлення, профіль, рецензія, файл — усе це форми, усе через сервер.
- **Три рівні:** HTML5 і JavaScript нічого не гарантують і потрібні лише для зручності; сервер — єдиний рівень, який неможливо обійти.
- **Модель себе не валідує:** `save()` і `create()` не викликають `full_clean()`, тож `blank`, `max_length`, `validators` і `EmailField` при прямому записі мовчать. Правила вмикає форма або явний `full_clean()`; база зупинить лише `UNIQUE` та `NOT NULL` — помилкою 500.
- **Без форми теж можна:** ручні `if` у view (для 2–3 полів), за потреби плюс `full_clean()` для правил моделі та `validate_password()` для паролів. Форма стає вигіднішою, коли полів багато й треба показувати помилки біля кожного.
- **Чотири механізми форми:** валідатори полів (`validators=[...]`) → `clean_<field>()` (одне поле) → `clean()` (звʼязок між полями) → `AUTH_PASSWORD_VALIDATORS` (паролі); файли перевіряй за розміром і розширенням.
- **Порядок роботи над формою:** модель (поля й обмеження) → форма (правила) → маршрут → view (`is_valid()` і Post/Redirect/Get) → шаблон (`csrf_token`, `field.errors`) → JavaScript (підказки). Правила описані один раз, JS їх лише дублює для фідбеку.
- **Паролі:** тільки `set_password()` перед збереженням і `validate_password()` для перевірки вимог; `ModelForm` сам їх не застосовує.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/forms/validation/" target="_blank" rel="noopener">Form and field validation <i class="bi bi-box-arrow-up-right"></i></a></div></div>
