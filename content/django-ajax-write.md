# AJAX-рецепти: зміна даних

Запити, які змінюють дані: додати, оновити, видалити, надіслати форму. Усі йдуть методом POST, усі потребують CSRF-токена й перевірки прав у view. Урок — набір рецептів за тією самою схемою, що й у читанні даних.

## Спільні правила для всіх рецептів

| Правило | Чому |
|---|---|
| Метод — POST | дії, що змінюють дані, не мають виконуватися переходом за посиланням |
| Декоратор `@require_POST` | інакше ту саму адресу можна відкрити в браузері |
| CSRF-токен у запиті | без нього Django відповість 403 |
| Об'єкт шукають із перевіркою власника | інакше чужий запис змінюється підстановкою іншого номера |
| Ціни й підсумки рахує сервер | значення з браузера підробляються за пів хвилини |
| Обов'язкова гілка `error` | інакше при відмові користувач бачить, що «нічого не сталося» |

## Рецепт 1: дія над об'єктом

**Коли.** Одна кнопка змінює стан: додати в кошик, поставити лайк, зберегти в обране, підписатися.

```html
{# templates/catalog/product_list.html #}
{% csrf_token %}
<div id="catalog">
  {% for product in products %}
    <button class="add-btn" data-id="{{ product.id }}">У кошик</button>
  {% endfor %}
</div>
```

```js
// static/js/catalog.js
$('#catalog').on('click', '.add-btn', function () {
    const button = $(this);
    button.prop('disabled', true);                       // захист від подвійного кліку

    $.ajax({
        url: '/carts/add/',
        method: 'POST',
        data: {
            'product_id': button.data('id'),
            csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val(),
        },
        success: function (response) {
            $('#cart-qty').text(response.count);
            button.text('У кошику');
        },
        error: function (xhr) {
            button.prop('disabled', false);
            alert(xhr.responseJSON?.message || 'Не вдалося додати товар');
        },
    });
});
```

```python
# carts/views.py
@require_POST
def cart_add(request):
    if not request.user.is_authenticated:
        return JsonResponse({'message': 'Увійдіть, щоб додавати товари'}, status=401)

    product = get_object_or_404(Product, pk=request.POST.get('product_id'), count__gt=0)

    item, created = CartItem.objects.get_or_create(user=request.user, product=product)
    if not created:
        item.quantity += 1
        item.save(update_fields=['quantity'])

    items = CartItem.objects.filter(user=request.user)
    return JsonResponse({'count': sum(i.quantity for i in items)})
```

Ідентифікатор товару приходить у `data-` атрибуті, ціна не передається взагалі — view бере її з бази. Повторний клік не створює другий рядок завдяки `get_or_create`.

> <i class="bi bi-exclamation-triangle"></i> Замість `@login_required` тут ручна перевірка з `status=401`. Декоратор відповів би редіректом на сторінку входу, і в `success` прилетів би HTML цієї сторінки замість очікуваного JSON.

## Рецепт 2: оновлення значення

**Коли.** Користувач змінює число або вибір прямо в списку: кількість у кошику, оцінка, статус задачі.

```html
{# templates/carts/index.html #}
<div id="cart-list">
  {% for item in user_items %}
    <div class="cart-row" data-id="{{ item.pk }}">
      <span class="row-total">{{ item.subtotal }}</span>

      <form class="qty-form" method="post" action="{% url 'change_quantity' item.pk %}">
        {% csrf_token %}
        <input type="number" name="quantity" value="{{ item.quantity }}" min="1">
        <button type="submit">Оновити</button>
      </form>
    </div>
  {% endfor %}
</div>
```

```js
// static/js/cart.js
$('#cart-list').on('submit', '.qty-form', function (e) {
    e.preventDefault();                                  // скасувати перезавантаження

    const form = $(this);
    const row = form.closest('.cart-row');

    $.ajax({
        url: form.attr('action'),                        // адреса вже у формі
        method: 'POST',
        data: form.serialize(),                          // поля + csrf-токен одним рядком
        success: function (response) {
            row.find('.row-total').text(response.row_total);
            $('#cart-total').text(response.total);
            $('#cart-qty').text(response.count);
        },
        error: function (xhr) {
            alert(xhr.responseJSON?.message || 'Не вдалося змінити кількість');
        },
    });
});
```

```python
# carts/views.py
@require_POST
def change_quantity(request, item_id):
    item = get_object_or_404(CartItem, pk=item_id, user=request.user)

    raw = request.POST.get('quantity', '').strip()
    if not raw.isdigit() or int(raw) < 1:
        return JsonResponse({'message': 'Вкажіть кількість цілим числом'}, status=400)

    quantity = int(raw)
    if quantity > item.product.count:
        return JsonResponse({'message': f'На складі лише {item.product.count} шт.'}, status=400)

    item.quantity = quantity
    item.save(update_fields=['quantity'])

    items = CartItem.objects.filter(user=request.user).select_related('product')
    return JsonResponse({
        'row_total': str(item.subtotal),
        'total': str(sum((i.subtotal for i in items), Decimal('0.00'))),
        'count': sum(i.quantity for i in items),
    })
```

Форма лишається на місці, а скрипт лише перехоплює її відправлення. Завдяки цьому адреса, дані й токен беруться з самої форми, а сторінка продовжує працювати без JavaScript.

**У відповіді рівно ті числа, які змінюються на екрані:** сума рядка, загальна сума, лічильник. Порахувати, скільки чисел має повернути view, найпростіше поглядом на сторінку.

## Рецепт 3: видалення

**Коли.** Рядок зникає зі списку: товар із кошика, коментар, файл із галереї.

```html
{# templates/carts/index.html #}
<form class="remove-form" method="post" action="{% url 'remove_item' item.pk %}">
  {% csrf_token %}
  <button type="submit">Видалити</button>
</form>
```

```js
// static/js/cart.js
$('#cart-list').on('submit', '.remove-form', function (e) {
    e.preventDefault();

    const form = $(this);
    const row = form.closest('.cart-row');

    $.ajax({
        url: form.attr('action'),
        method: 'POST',
        data: form.serialize(),
        success: function (response) {
            row.fadeOut(200, function () {
                $(this).remove();                        // прибрати рядок зі сторінки

                if (response.count === 0) {
                    $('#cart-empty').show();             // показати «кошик порожній»
                }
            });

            $('#cart-total').text(response.total);
            $('#cart-qty').text(response.count);
        },
        error: () => alert('Не вдалося видалити товар'),
    });
});
```

```python
# carts/views.py
@require_POST
def remove_item(request, item_id):
    item = get_object_or_404(CartItem, pk=item_id, user=request.user)
    item.delete()

    items = CartItem.objects.filter(user=request.user).select_related('product')
    return JsonResponse({
        'total': str(sum((i.subtotal for i in items), Decimal('0.00'))),
        'count': sum(i.quantity for i in items),
    })
```

Тут з'являється те, чого немає у звичайній формі: після видалення останнього рядка сторінка не перезавантажується, тому порожній стан треба показати скриптом.

> <i class="bi bi-info-circle"></i> Підтвердження перед видаленням додають одним рядком на початку обробника: `if (!confirm('Видалити товар?')) return;`.

## Рецепт 4: форма цілком

**Коли.** Треба надіслати форму з кількома полями й показати помилки біля кожного: коментар, відгук, зміна профілю.

```html
{# templates/blog/post_detail.html #}
<form id="comment-form" method="post" action="{% url 'comment_add' post.pk %}">
  {% csrf_token %}
  <textarea name="text"></textarea>
  <span class="field-error" data-for="text"></span>
  <button type="submit">Надіслати</button>
</form>

<ul id="comments"></ul>
```

```js
// static/js/comments.js
$('#comment-form').on('submit', function (e) {
    e.preventDefault();

    const form = $(this);
    $('.field-error').text('');                          // прибрати помилки минулої спроби

    $.ajax({
        url: form.attr('action'),
        method: 'POST',
        data: form.serialize(),
        success: function (response) {
            $('#comments').prepend(`<li><b>${response.author}</b>: ${response.text}</li>`);
            form[0].reset();                             // очистити поля
        },
        error: function (xhr) {
            const errors = xhr.responseJSON?.errors || {};
            Object.keys(errors).forEach(function (field) {
                $(`.field-error[data-for="${field}"]`).text(errors[field][0]);
            });
        },
    });
});
```

```python
# blog/views.py
@require_POST
def comment_add(request, post_id):
    if not request.user.is_authenticated:
        return JsonResponse({'message': 'Увійдіть, щоб коментувати'}, status=401)

    post = get_object_or_404(Post, pk=post_id)
    form = CommentForm(request.POST)

    if not form.is_valid():
        return JsonResponse({'errors': form.errors}, status=400)

    comment = form.save(commit=False)
    comment.post = post
    comment.author = request.user
    comment.save()

    return JsonResponse({'author': comment.author.username, 'text': comment.text})
```

Тут працює звичайна Django-форма: `form.errors` уже є словником виду `{'text': ['Це поле обов'язкове.']}`, і його достатньо віддати як є — скрипт розкладе помилки по полях.

## Як обрати рецепт

| Що відбувається | Рецепт | Ключова деталь |
|---|---|---|
| одна кнопка змінює стан | 1 | ідентифікатор у `data-` атрибуті |
| користувач редагує значення в списку | 2 | форма в рядку + `serialize()` |
| елемент зникає зі списку | 3 | прибрати рядок і показати порожній стан |
| кілька полів із валідацією | 4 | `form.errors` у відповіді |

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Немає CSRF-токена | 403 при першому ж запиті |
| `@login_required` замість перевірки зі `status=401` | У `success` приходить HTML сторінки входу замість JSON |
| Об'єкт шукають без умови власника | Чужий запис змінюється підстановкою іншого номера в адресу |
| Ціна чи сума приходять із браузера | Значення підробляється; сервер бере їх із бази |
| Немає `e.preventDefault()` | Сторінка перезавантажується, і результат роботи скрипта зникає |
| Обробник навішано не делеговано | Після видалення чи довантаження рядків нові елементи не реагують |
| Кнопка не блокується на час запиту | Подвійний клік створює два записи |
| Порожній стан не оновлюється | Список видалено повністю, а напис «кошик порожній» так і не з'явився |
| Відповідь містить менше даних, ніж змінюється на екрані | Частина чисел лишається старою до перезавантаження |

## Підсумок

- Усі рецепти зміни даних мають однакову основу: POST, CSRF-токен, `@require_POST`, пошук об'єкта з перевіркою власника, підрахунки на сервері.
- Кнопка передає ідентифікатор через `data-` атрибут; форма передає все одразу через `serialize()`, включно з токеном і адресою в `action`.
- Форму краще лишати в розмітці й перехоплювати `submit` — тоді сторінка працює й без JavaScript.
- Відповідь містить рівно ті значення, які змінюються на екрані; порахувати їх можна поглядом на сторінку.
- Видалення потребує окремої уваги до порожнього стану, бо сторінка не перезавантажується.
- Для форм із кількома полями достатньо повернути `form.errors` — це готовий словник «поле → список помилок».

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/csrf/" target="_blank" rel="noopener">CSRF protection <i class="bi bi-box-arrow-up-right"></i></a></div></div>
