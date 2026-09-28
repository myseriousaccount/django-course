# Фільтрація списку

Фільтрація звужує список елементів за умовами, які обирає користувач: вид тварини, місто притулку, діапазон ціни, кілька жанрів одразу. Вибір потрапляє в адресний рядок через GET-форму, view читає параметри й послідовно звужує QuerySet тими самими `.filter()`, що й у решті уроків, а шаблон повертає ту саму форму з позначеним вибором.

## Що фільтруємо: модель і поле

Для кожного фільтра потрібне поле, де лежить значення, — і воно може належати самій моделі або пов'язаній через `ForeignKey`.

| Питання | Де лежить значення | Що напише Django |
|---|---|---|
| Який вид тварини? | `Animal.species` | `species=...` |
| В якому місті притулок? | `Animal.shelter` → `Shelter.city` | `shelter__city=...` |

Подвійне підкреслення `__` означає «перейди зв'язком до поля іншої моделі» — той самий синтаксис, що й у field lookups (урок «Запити до бази (ORM)»). Для товарів так само працює `category__name`, для книжки з автором — `author__country`.

```python
# shelters/models.py
class Shelter(models.Model):
    name = models.CharField(max_length=100)
    city = models.CharField(max_length=100)


class Animal(models.Model):
    SPECIES_CHOICES = [
        ('cat', 'Кіт'),
        ('dog', 'Собака'),
        ('other', 'Інше'),
    ]
    name = models.CharField(max_length=100)
    species = models.CharField(max_length=10, choices=SPECIES_CHOICES)
    shelter = models.ForeignKey(Shelter, on_delete=models.CASCADE, related_name='animals')
```

### Значення фільтра мають збігатися з базою

Форма показує людині підпис («Коти»), а Django отримує значення з `value` — і саме це значення `.filter()` порівнює з тим, що лежить у стовпці бази. Якщо вони записані по-різному, фільтр мовчки не знаходить нічого: помилки не буде, просто список стане порожнім.

Для поля з `choices` проблема не виникає — варіанти в формі й значення в базі описані одним списком `SPECIES_CHOICES`. Для вільного тексту (місто) розбіжність трапляється легко: `value="Київ"` не знайде рядків із `Kyiv`. Найнадійніший спосіб — не вигадувати варіанти вручну, а брати їх із того, що вже є в базі:

```python
# shelters/views.py (уривок)
cities = Shelter.objects.values_list('city', flat=True).distinct().order_by('city')
```

Тоді `<select>` завжди пропонує лише ті міста, які справді зустрічаються в записах, — розбіжність написання стає неможливою.

## GET-форма фільтра

Фільтрація лише читає дані, тому форма використовує `method="get"` — вибір буде видно просто в URL, і на таку адресу можна дати посилання чи оновити сторінку без втрати результату. Це відрізняє її від форм, що зберігають дані (`django-registration-example`): ті працюють через `POST`.

```django
{# templates/shelters/animal_list.html #}
<form method="get">
    <label for="species">Вид</label>
    <select id="species" name="species">
        <option value="">Усі види</option>
        {% for value, label in species_choices %}
            <option value="{{ value }}" {% if selected_species == value %}selected{% endif %}>
                {{ label }}
            </option>
        {% endfor %}
    </select>

    <label for="city">Місто притулку</label>
    <select id="city" name="city">
        <option value="">Усі міста</option>
        {% for city in cities %}
            <option value="{{ city }}" {% if selected_city == city %}selected{% endif %}>
                {{ city }}
            </option>
        {% endfor %}
    </select>

    <button type="submit">Показати</button>
    <a href="{% url 'shelters:animal_list' %}">Скинути фільтри</a>
</form>
```

Три атрибути відповідають за різне: `name` — ключ, за яким view прочитає значення з `request.GET`; `value` — саме значення, яке піде в запит; `id` пов'язує поле з `<label>` і на читання у view не впливає. Порожній `<option value="">Усі...</option>` — обов'язковий варіант: він вимикає фільтр, а не встановлює його в порожній рядок.

## Читання параметрів у view

`request.GET` — це `QueryDict` (детальніше про нього й про `request.POST` — урок «Views»), тому значення дістають через `.get()` із запасним варіантом, а не прямим зверненням за ключем:

```python
# shelters/views.py
species = request.GET.get('species', '').strip()
city = request.GET.get('city', '').strip()
```

Порожній рядок за замовчуванням — навмисний вибір: коли користувач лишив «Усі види», `species` дорівнює `''`, і це сигнал «цей фільтр не застосовувати». `.strip()` прибирає випадкові пробіли, які людина могла ввести в текстове поле.

> <i class="bi bi-pin-angle"></i> Значення з `request.GET` завжди рядок, навіть якщо це число (`'150'`, а не `150`). Для текстових полів і `choices` це не заважає, а от порівняння з числовим полем потребує явного приведення типу — приклад нижче, у розділі про діапазон значень.

## Послідовне звуження QuerySet

Кожен непорожній параметр додає ще один `.filter()` до тієї самої змінної — так наступний фільтр звужує вже відфільтрований набір, а не перезаписує його:

```python
# shelters/views.py
def animal_list(request):
    animals = Animal.objects.select_related('shelter').all()

    species = request.GET.get('species', '').strip()
    city = request.GET.get('city', '').strip()

    if species:
        animals = animals.filter(species=species)

    if city:
        animals = animals.filter(shelter__city=city)

    ...
```

Якщо замість `animals.filter(...)` написати знову `Animal.objects.filter(...)`, другий фільтр почне з повного списку і скасує результат першого. Два послідовні `.filter()` над однією змінною означають умову **І**: тварина має бути і потрібного виду, і з притулку в потрібному місті. QuerySet при цьому лишається лінивим (урок «Запити до бази (ORM)», розділ «Лінивість на практиці») — жоден із цих `.filter()` не звертається до бази, поки шаблон не почне перебирати `animals`.

### Кілька значень одного фільтра

Коли поле дозволяє вибрати одразу декілька варіантів (checkbox-список, а не одиночний `<select>`), форма надсилає той самий `name` кілька разів. `request.GET.get()` поверне лише одне з них — потрібен `getlist()`:

```python
# library/views.py
selected_genres = request.GET.getlist('genre')   # ['fantasy', 'thriller'] або []

books = Book.objects.all()
if selected_genres:
    books = books.filter(genres__name__in=selected_genres).distinct()
```

```django
{# templates/library/book_list.html #}
{% for genre in all_genres %}
    <label>
        <input type="checkbox" name="genre" value="{{ genre.name }}"
               {% if genre.name in selected_genres %}checked{% endif %}>
        {{ genre.name }}
    </label>
{% endfor %}
```

> <i class="bi bi-exclamation-triangle"></i> Фільтр `__in` через `ManyToMany`-зв'язок (`genres__name__in=[...]`) може повернути один і той самий рядок кілька разів — по разу на кожен збіг зв'язаної таблиці. Тому такий фільтр завжди завершують `.distinct()`.

### Діапазон значень (від–до)

Для ціни, дати чи будь-якого числового поля фільтр складається з двох незалежних меж, кожна — окремий GET-параметр і окремий lookup (`__gte`/`__lte`, урок «Запити до бази (ORM)»):

```python
# catalog/views.py
price_min = request.GET.get('price_min', '').strip()
price_max = request.GET.get('price_max', '').strip()

products = Product.objects.all()

if price_min.isdigit():
    products = products.filter(price__gte=price_min)

if price_max.isdigit():
    products = products.filter(price__lte=price_max)
```

`.isdigit()` тут — мінімальна перевірка перед тим, як рядок піде у порівняння: без неї нечисловий чи порожній рядок або нічого не знайде, або впаде з помилкою залежно від типу поля. Для суворішої перевірки (від'ємні числа, межі, повідомлення про помилку) значення заводять через форму — урок «Валідація: клієнт і сервер».

## Поточний вибір: контекст і позначені варіанти

У контекст передають не лише відфільтрований список, а й те, що саме вибрав користувач, — інакше форма після оновлення сторінки знову покаже «Усі...», хоча результат уже звужений.

```python
# shelters/views.py
context = {
    'animals': animals,
    'species_choices': Animal.SPECIES_CHOICES,
    'cities': Shelter.objects.values_list('city', flat=True).distinct().order_by('city'),
    'selected_species': species,
    'selected_city': city,
}
return render(request, 'shelters/animal_list.html', context)
```

`selected` чи `checked` — звичайні HTML-атрибути; шаблон лише вирішує, до якого варіанта їх додати, порівнюючи збережений вибір зі значенням кожного поля:

| Тип поля | Як позначити поточний вибір |
|---|---|
| `<select>` | `{% if selected == value %}selected{% endif %}` на `<option>` |
| `checkbox` (кілька значень) | `{% if value in selected_list %}checked{% endif %}` |
| `radio` | так само, як `<select>` — порівняння з одним збереженим значенням |
| `<input type="text">` | `value="{{ selected_value }}"` |

## Скидання фільтрів і порожній результат

`<button type="reset">` очищає лише поля форми в браузері — показані результати лишаються відфільтрованими. Щоб справді повернути повний список, потрібне посилання на адресу без параметрів — так само, як показано вище (`<a href="{% url 'shelters:animal_list' %}">`).

У `{% empty %}` варто розрізняти дві різні причини порожнього списку: фільтр не знайшов збігів чи в базі взагалі немає записів.

```django
{# templates/shelters/animal_list.html #}
{% for animal in animals %}
    <p>{{ animal.name }} — {{ animal.get_species_display }} ({{ animal.shelter.city }})</p>
{% empty %}
    {% if selected_species or selected_city %}
        <p>За цими умовами тварин не знайдено.</p>
    {% else %}
        <p>У базі поки немає жодної тварини.</p>
    {% endif %}
{% endfor %}
```

## Фільтрація разом із пагінацією

Порядок дій завжди такий: спершу звужують список фільтрами, і лише відфільтрований QuerySet передають у `Paginator`.

```python
# shelters/views.py
paginator = Paginator(animals, 12)
page = paginator.get_page(request.GET.get('page'))
```

Посилання пагінації (`?page=2`) при цьому мають нести і решту активних параметрів (`species`, `city`) — інакше перехід на другу сторінку скидає вибір. Як зберегти всі GET-параметри в посиланні — урок «Пагінація», розділ «Збереження інших GET-параметрів».

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `name` у HTML не збігається з ключем `request.GET.get()` | Форма надсилається, список не змінюється — і жодної видимої помилки |
| `Model.objects.filter(...)` замість `animals.filter(...)` на кожному кроці | Кожен наступний фільтр починає з повного списку і скасовує попередній |
| Значення `<option>` не збігається з тим, що в базі (`Київ` проти `Kyiv`) | Фільтр нічого не знаходить; варіанти для `<select>` беруть із `choices` моделі або з `distinct()` по реальних даних |
| У контекст не передано поточний вибір | Після відправлення форма знову показує «Усі...», хоча список уже звужений |
| `<button type="reset">` як «скинути фільтри» | Очищає лише поля форми в браузері; результати лишаються відфільтрованими — потрібне посилання без параметрів |
| `request.GET.get('genre')` для чекбоксів із однаковим `name` | Повертає тільки одне значення з кількох; потрібен `getlist('genre')` |
| `__in` по `ManyToMany`-зв'язку без `.distinct()` | Один і той самий об'єкт повторюється в списку по разу на кожен збіг |
| Числове значення з `request.GET` у `.filter()` без перевірки | Порожній чи нечисловий рядок ламає фільтр або дає помилку; перевіряють (`isdigit()`) перед порівнянням |
| Посилання пагінації `?page=2` без активних фільтрів | Перехід на іншу сторінку скидає вибір; параметри переносять разом (урок «Пагінація») |

## Підсумок

- Для кожного фільтра шукай поле в моделі: напряму (`species=...`) або через зв'язок (`shelter__city=...`).
- Значення в `<option value="...">` мають збігатися з тим, що лежить у базі; для полів без `choices` варіанти краще брати з реальних даних (`.distinct()`), а не писати вручну.
- Форма фільтра — `method="get"`, кожне поле має `name`, і серед варіантів є порожній «Усі...», що вимикає фільтр.
- `request.GET.get(name, '').strip()` читає одне значення, `request.GET.getlist(name)` — кілька (чекбокси); діапазон — два незалежні GET-параметри з `__gte`/`__lte`.
- Фільтри звужують одну й ту саму змінну послідовними `.filter()`; `__in` по `ManyToMany` завершують `.distinct()`.
- У контекст передають не лише результат, а й поточний вибір — інакше форма «забуває» його після оновлення; `selected`/`checked`/`value` порівнюють це збережене значення з кожним варіантом.
- Скидання фільтрів — посилання на чисту адресу, а не `<button type="reset">`; `{% empty %}` розрізняє «нічого не знайдено» і «в базі порожньо».
- Фільтри застосовують до `Paginator`, а не навпаки, і переносять у посилання пагінації разом з іншими GET-параметрами.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/request-response/#querydict-objects" target="_blank" rel="noopener">QueryDict objects <i class="bi bi-box-arrow-up-right"></i></a></div></div>
