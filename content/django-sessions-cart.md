# Сесії та кошик

HTTP не зберігає стану: кожен запит для сервера самостійний. Сесія дає пам'ять між запитами — Django кладе в cookie лише ідентифікатор, а дані тримає на сервері. Урок про роботу з `request.session` і про типовий приклад її застосування — кошик.

## Що таке сесія

> **Сесія** — це сховище стану користувача **між запитами**. Django кладе в cookie браузера лише короткий **id сесії**, а самі дані тримає **на сервері** (за замовчуванням у БД, через застосунок `django.contrib.sessions`).

Схема проста:

```
браузер ← cookie з session_id ← Django
браузер → надсилає session_id → Django знаходить дані цієї сесії на сервері
```

Тобто в cookie немає твоїх даних — тільки «ключ» до них. Це і безпечніше (користувач не бачить і не підробить вміст), і зручніше (в cookie влазить мало, а на сервері — скільки завгодно).

## `request.session` — це словник

Django дає тобі сесію просто як словникоподібний об'єкт `request.session`. Працюєш із ним звично:

```python
# shop/views.py
def demo(request):
    request.session['theme'] = 'dark'          # записати
    theme = request.session.get('theme', 'light')  # прочитати з дефолтом
    request.session['visits'] = request.session.get('visits', 0) + 1

    if 'theme' in request.session:             # перевірити наявність
        del request.session['theme']           # видалити ключ
    ...
```

| Операція | Код |
|---|---|
| записати | `request.session['cart'] = {...}` |
| прочитати | `request.session.get('cart', {})` |
| видалити ключ | `del request.session['cart']` |
| перевірити | `if 'cart' in request.session:` |

Два правила, які треба знати одразу:

- <i class="bi bi-exclamation-triangle"></i> **Значення мають бути JSON-серіалізовними** — числа, рядки, списки, словники, булеві. Об'єкт моделі туди **не** покладеш; зберігай його `id`, а сам об'єкт діставай із БД за потреби.
- <i class="bi bi-info-circle"></i> **Зміна вкладеного значення не завжди помічається.** Django бачить `request.session['cart'] = ...` (присвоєння ключа), але якщо ти змінив словник **усередині** (`request.session['cart'][pid] += 1`), треба вручну сказати: `request.session.modified = True` — інакше зміна не збережеться.

## Класика — кошик у сесії

Кошик гостя не варто одразу писати в БД: користувач ще не залогінений, може нічого й не купити. Ідеальне місце — сесія. Домовимось про формат: `{product_id: quantity}`, де все — рядки/числа (JSON-сумісно).

**Додати товар** (або збільшити кількість):

```python
# carts/views.py
def cart_add(request, product_id):
    cart = request.session.get('cart', {})     # {} якщо кошика ще нема
    pid = str(product_id)                       # ключі JSON — рядки
    cart[pid] = cart.get(pid, 0) + 1
    request.session['cart'] = cart              # присвоєння → Django збереже
    return redirect('cart_detail')
```

**Змінити кількість** на конкретне число:

```python
# carts/views.py
def cart_set(request, product_id):
    cart = request.session.get('cart', {})
    qty = int(request.POST.get('quantity', 1))
    cart[str(product_id)] = qty
    request.session['cart'] = cart
    return redirect('cart_detail')
```

**Прибрати один товар:**

```python
# carts/views.py
def cart_remove(request, product_id):
    cart = request.session.get('cart', {})
    cart.pop(str(product_id), None)             # None → не впаде, якщо нема
    request.session['cart'] = cart
    return redirect('cart_detail')
```

**Очистити весь кошик:**

```python
# carts/views.py
def cart_clear(request):
    request.session['cart'] = {}                # або: del request.session['cart']
    return redirect('cart_detail')
```

> <i class="bi bi-pin-angle"></i> Помічаєш патерн: **дістати `cart` → змінити звичайний dict → присвоїти назад** у `request.session['cart']`. Присвоєння ключа Django ловить автоматично, тому `modified = True` тут не потрібен. Він знадобився б, якби ти правив вкладений словник без фінального присвоєння.

## Лічильник і підсумок

**Кількість позицій** для бейджа в шапці:

```python
# carts/views.py
cart = request.session.get('cart', {})
count = sum(cart.values())          # сума всіх кількостей
```

**Підсумкова сторінка** — тут уже дістаємо реальні товари з БД за їхніми id:

```python
# carts/views.py
from catalog.models import Product


def cart_detail(request):
    cart = request.session.get('cart', {})
    products = Product.objects.filter(id__in=cart.keys())
    items, total = [], 0
    for product in products:
        qty = cart[str(product.id)]
        subtotal = product.price * qty
        total += subtotal
        items.append({'product': product, 'qty': qty, 'subtotal': subtotal})
    return render(request, 'cart/detail.html', {'items': items, 'total': total})
```

Зверни увагу: у сесії лежать **тільки id й кількості**, а назви/ціни завжди беруться з БД. Так ціна в кошику ніколи не «застигне» застарілою.

## Лічильник у шапці — через context processor

Щоб бейдж кошика показувався на **кожній** сторінці, не варто рахувати його в кожній view. Для цього є **context processor** — функція, чиї дані Django автоматично додає в context усіх шаблонів:

```python
# carts/context_processors.py
def cart_counter(request):
    cart = request.session.get('cart', {})
    return {'cart_count': sum(cart.values())}
```

Підключаєш у `settings.py` → `TEMPLATES` → `OPTIONS` → `context_processors`, дописавши `'shop.context_processors.cart_counter'`. Після цього в будь-якому шаблоні працює:

```html
{# templates/_layouts/header.html #}
<a href="{% url 'cart_detail' %}">Кошик ({{ cart_count }})</a>
```

## Сесія чи модель у БД?

Кошик можна тримати двома способами — вибір залежить від того, хто користувач:

| | Кошик у **сесії** | Кошик у **БД** (модель) |
|---|---|---|
| Для кого | гість, незалогінений | залогінений користувач |
| Живе | доти, доки жива сесія / cookie | постійно, прив'язаний до акаунта |
| Плюси | нічого не треба зберігати наперед, легко | не зникне, доступний з іншого пристрою |
| Мінуси | зникне після виходу/чистки cookie | треба модель, зайве для випадкового гостя |

<i class="bi bi-info-circle"></i> Поширений компроміс: гість збирає кошик **у сесії**, а в момент **входу** цей сесійний кошик «зливають» у БД-кошик користувача. Так гість не втрачає вибране після реєстрації.

## Нюанси налаштувань

> <i class="bi bi-pin-angle"></i> **`SessionMiddleware` уже увімкнений** у стандартному `MIDDLEWARE`, а `django.contrib.sessions` — у `INSTALLED_APPS`. Тобто `request.session` працює «з коробки», нічого підключати не треба.

> <i class="bi bi-info-circle"></i> **Термін життя.** За замовчуванням сесія живе, доки задано в `SESSION_COOKIE_AGE`. Для конкретної сесії можна задати вручну: `request.session.set_expiry(3600)` (секунди), а `set_expiry(0)` — «до закриття браузера».

> <i class="bi bi-exclamation-triangle"></i> **Не клади в сесію багато й зайвого.** Сесія — не кеш і не сховище файлів. Тримай там маленький стан (id, кількості, прапорці), а не цілі об'єкти чи списки товарів. І ніколи не зберігай **секрети** (паролі, токени) — навіть попри те, що дані на сервері.

> <i class="bi bi-exclamation-triangle"></i> **Забутий `modified = True`** при зміні вкладеної структури — типова причина «кошик не оновлюється». Або став цей прапорець, або (простіше) завжди присвоюй словник назад у `request.session['cart']`.

## Місток: два кошики поруч

У навчальному shop-app кошик зроблено **другим способом** — на моделі: є `CartItem` із полями `user`, `product`, `quantity`, а додавання йде AJAX-запитом у view, яка створює рядок у базі. Це нормальний вибір, бо кошик там доступний лише залогіненим користувачам.

Сесійний кошик із цього уроку — не заміна тому, що вже написано, а **другий інструмент**, який закриває інший випадок: гість без акаунта. Порівняй на тому самому наборі дій:

| Дія | Кошик у сесії | Кошик у моделі (`CartItem`) |
|---|---|---|
| Додати товар | `cart[str(product.id)] = qty` | `CartItem.objects.get_or_create(...)` |
| Змінити кількість | присвоїти нове значення в словнику | `item.quantity = ...` і `item.save()` |
| Видалити | `del cart[str(product.id)]` | `item.delete()` |
| Порахувати суму | цикл по словнику + ціни з БД | сума по `item.product.price * item.quantity` |
| Хто бачить кошик | лише цей браузер | користувач із будь-якого пристрою |

Що з цього уроку варто перенести на модельний кошик:

- **Кількість має враховуватись у сумі.** Якщо підсумок рахується як `total += item.product.price`, поле `quantity` фактично ігнорується: два однакові товари дадуть ціну одного. Правильно — `item.product.price * item.quantity`.
- **Повторне додавання — не новий рядок.** Без `get_or_create()` кожен клік створює ще один `CartItem` того самого товару. Щоб дублікат не з'явився навіть при подвійному кліку, додай у модель `unique_together = ('user', 'product')`.
- **Злиття кошиків.** Найзручніший сценарій для користувача: гість збирає кошик у сесії, а в момент входу вміст переноситься в `CartItem` його акаунта — тоді вибране не губиться після реєстрації.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Зміна вкладеної структури без збереження назад | `request.session['cart'][pk] = 2` може не зберегтися: словник присвоюють назад або ставлять `request.session.modified = True` |
| Об'єкт моделі в сесії | Дані мусять бути JSON-серіалізовними; зберігають ідентифікатори, а об'єкти дістають із бази |
| Ціни й суми взято з сесії | Значення з браузерної сесії застаріває; підсумок рахують за поточними цінами з бази |
| Ключі-числа в сесійному словнику | Після серіалізації в JSON вони стають рядками, і `cart[5]` перестає працювати |
| Сесія як сховище великих даних | Кожен запит читає й пише весь обсяг; у сесії тримають лише невеликий стан |
| Секрети в сесії | Дані лежать на сервері, але сесія живе довго й може бути вкрадена разом із cookie |

## Підсумок

- **Сесія** дає HTTP пам'ять між запитами: в cookie — лише `session_id`, дані — на сервері (`django.contrib.sessions`).
- `request.session` — словник: запис, `.get()`, `del`, `in`; значення мусять бути **JSON-серіалізовними** (id, а не об'єкти моделі).
- **Кошик** = `{product_id: quantity}` у `request.session['cart']`; патерн «дістати → змінити dict → присвоїти назад».
- Товари для підсумку завжди беруться з **БД** за id — ціни лишаються актуальними.
- Лічильник у шапці — через **context processor**, щоб не рахувати в кожній view.
- **Сесія** — для гостя, **модель у БД** — для залогіненого; при вході кошики зливають.
- `SessionMiddleware` уже стоїть; `set_expiry` керує терміном; не зберігай великого й секретів; при зміні вкладеного — `modified = True`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/http/sessions/" target="_blank" rel="noopener">Sessions <i class="bi bi-box-arrow-up-right"></i></a></div></div>
