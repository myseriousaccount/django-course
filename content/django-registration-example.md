# Наскрізний приклад: реєстрація

Повний стек однієї форми в тому порядку, у якому його пишуть: модель, форма, маршрути, view, шаблон, JavaScript. Реєстрація зручна тим, що задіює всі механізми валідації одразу.

## 1. Модель

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

## 2. Форма

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

## 3. Маршрути

```python
# accounts/urls.py
urlpatterns = [
    path('register/', views.register, name='register'),
    path('register/check/', views.register_check, name='register_check'),
]
```

## 4. View

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

## 5. Шаблон

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

## 6. JavaScript

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

## Хто за що відповідає

| Рівень | Що робить у цьому прикладі |
|---|---|
| HTML5 | `required`, `type="email"` — Django додав їх сам із опису форми |
| JavaScript | підказки про збіг паролів і зайнятість логіна |
| Форма | унікальність, сила пароля, збіг паролів, хешування |
| Модель | формат телефону, `OneToOne` зв'язок, обмеження полів |
| База даних | `UNIQUE` на `username` — останній бар'єр від одночасних реєстрацій |

Правила описані один раз — у формі й моделі. JavaScript їх дублює лише заради швидкого фідбеку і жодних гарантій не дає.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Пароль збережено без `set_password()` | У базі опиняється відкритий текст, і вхід не працює: `authenticate()` порівнює хеші |
| `password` у `Meta.fields` моделі користувача | Значення записується як звичайне поле, без хешування |
| Немає `validate_password()` | Вимоги з `AUTH_PASSWORD_VALIDATORS` не застосуються |
| Перевірка зайнятості логіна лише на клієнті | Між перевіркою й відправленням форми логін може зайняти інший користувач |
| `render` замість `redirect` після успішної реєстрації | Оновлення сторінки повторно надсилає форму |
| Прямий імпорт `User` замість `get_user_model()` | Код зламається після переходу на власну модель користувача |

## Підсумок

- Порядок написання: модель → форма → маршрути → view → шаблон → JavaScript.
- Пароль ніколи не потрапляє в модель напряму: `save(commit=False)`, потім `set_password()`, потім `save()`.
- `validate_password()` вмикає вимоги з налаштувань — `ModelForm` не робить цього сам.
- View не містить перевірок даних: усі правила лишаються у формі, а невалідна форма повертається в шаблон із помилками.
- Жива перевірка на клієнті нічого не гарантує; остаточне рішення ухвалює `clean_<field>()`.
- Зв'язок із користувачем описують через `settings.AUTH_USER_MODEL`, а в коді беруть `get_user_model()`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/forms/validation/" target="_blank" rel="noopener">Form and field validation <i class="bi bi-box-arrow-up-right"></i></a></div></div>
