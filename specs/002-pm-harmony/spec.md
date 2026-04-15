# PM Harmony — алгоритм сочетания цветов pallete-maker

## Статус

Active

## Цель

Заменить произвольную LCH-генерацию фиксированной палитрой из 51 цвета с алгоритмом
сочетаемости на основе группы (насыщенность/светлота) и температуры (тёплый/холодный).

---

## Модель данных

### Структура цвета

```ts
type ColorTemp = "warm" | "cool";
type ColorGroup = "bright" | "pastel" | "desaturated" | "dark";

interface PaletteColor {
  hex: string; // '#RRGGBB'
  name: string; // человекочитаемое название (EN)
  isAchromatic?: true; // только для 3 ахроматов
  group?: ColorGroup; // для хроматических
  temp?: ColorTemp; // для хроматических
}
```

### Состав: 51 цвет = 3 ахромата + 4 × 12

| Группа           | Warm (6–7) | Cool (5–6) |
| ---------------- | ---------- | ---------- |
| Achromatics (3)  | —          | —          |
| Brights (12)     | 6          | 6          |
| Pastels (12)     | 7          | 5          |
| Desaturated (12) | 7          | 5          |
| Darks (12)       | 7          | 5          |

Итого хроматических: 27 warm / 21 cool.

**Achromatics:** Black `#1C1C1C`, Gray `#8C8C8C`, White `#F0F0F0`

**Brights warm:** Scarlet `#E82535`, Vermillion `#E84B20`, Tangerine `#E87820`,
Amber `#E8AA20`, Canary `#E8D520`, Chartreuse `#7EC820`

**Brights cool:** Emerald `#20A84E`, Teal `#10A896`, Cobalt `#186AE8`,
Indigo `#3828E8`, Violet `#8820E8`, Fuchsia `#D020AA`

**Pastels warm:** Blush `#F5B5BB`, Peach `#F5C5B0`, Apricot `#F5D5B0`,
Beige `#E8D5B5`, Off-white `#FAF0E6`, Primrose `#F7EDA5`, Orchid `#EEB8E5`

**Pastels cool:** Mint `#B0EEC5`, Aqua `#B0EEDE`, Sky `#B0CDEE`,
Periwinkle `#C0B8EE`, Lavender `#DCB8EE`

**Desaturated warm:** Brick `#B86068`, Coral `#C07860`, Terracotta `#C08A65`,
Sand `#C0A268`, Straw `#B8B268`, Sage `#88A865`, Antique Rose `#B860A2`

**Desaturated cool:** Fern `#60A878`, Dusty Teal `#50A095`, Slate `#5082B8`,
Dusty Indigo `#6860B8`, Mauve `#9860B8`

**Darks warm:** Burgundy `#8C1820`, Rust `#8C3015`, Burnt Orange `#8C5018`,
Ochre `#8C6C15`, Olive Gold `#787815`, Olive `#4A7A18`, Mulberry `#781860`

**Darks cool:** Forest `#187838`, Pine `#187870`, Navy `#182878`,
Midnight `#201878`, Plum `#5A1878`

---

## Алгоритм совместимости (мягкая температура)

Жёсткая развязка идёт только по группе насыщенности. Температура —
метаданные: она НЕ фильтрует цвета, а только влияет на отображение
итоговой палитры в секциях Warm / Cool / Universal.

```
isCompatible(base, target):
  if !base                 → true   (нет базы — все доступны)
  if base.isAchromatic
     || target.isAchromatic → true   (ахроматы со всем)
  if base.group === target.group → true
  if {base.group, target.group} === {desaturated, dark} → true
  → false
```

**Почему:** при жёстком temperature-фильтре cool-базы физически не могут
достичь 7 уникальных Itten-hues (в палитре всего 6 cool-hues).
Снятие фильтра даёт ≥12 hues от любой базы. Гармоничность "тёплое с тёплым"
сохраняется через визуальную группировку в итоговой палитре.

---

## Правила выбора и лимиты

| Параметр        | Значение |
| --------------- | -------- |
| MAX_TOTAL       | 14       |
| MAX_CHROMATIC   | 11       |
| MIN_TO_DOWNLOAD | 1        |

- `userPalette[0]` — всегда базовый цвет (первый добавленный).
- Повторный клик по выбранному цвету — удаляет его из палитры.
- При удалении базового новым базовым становится `userPalette[0]` после удаления
  (Вариант А — пересчёт по следующему в очереди; если палитра пуста — база сброшена).
- Цвет задимлен (visually disabled) если:
  - `!isSelected && base && !isCompatible(base, target)` — несовместим с базой
  - `!isSelected && total >= 14` — общий лимит достигнут
  - `!isSelected && !target.isAchromatic && chromatic >= 11` — хроматический лимит

---

## UI flow

1. Экран: сетка 51 swatch в порядке **ахроматы → brights → pastels → desaturated → darks**.
   Визуально — единая сетка, без заголовков групп.
2. Клик → первый non-achromatic цвет становится базой (выделен рамкой).
   Несовместимые swatch'и тускнеют по правилу групп насыщенности.
3. Пользователь добавляет до 11 хроматических + до 3 ахроматов = 14 максимум.
4. Кнопка «Скачать PNG» активна при ≥ 1 цвете в палитре.
5. Нижний drawer — финальная палитра в виде **трёх секций в одну полосу**:
   - **Warm** — хроматические с `temp === 'warm'` в порядке добавления
   - **Cool** — хроматические с `temp === 'cool'` в порядке добавления
   - **Universal** — ахроматы в порядке Black → Gray → White
     Пустые секции не отображаются.
6. PNG-экспорт через html2canvas; файл `palette.png`. Секционирование
   в экспорте идентично drawer — три ряда Warm / Cool / Universal с лейблами.

---

## Acceptance criteria

- [ ] На экране 51 swatch; порядок: ахроматы → brights → pastels → desaturated → darks
- [ ] Клик по ахромату НЕ устанавливает его как базу (фильтр остаётся открыт)
- [ ] Клик по хроматическому цвету → становится базой (первый non-achromatic)
- [ ] Несовместимые по группе цвета приглушены и не кликабельны после выбора базы
- [ ] Ахроматы всегда активны, пока `total < 14`
- [ ] `Brights warm ↔ Brights cool` ✓ (нет temperature-фильтра)
- [ ] `Desaturated warm ↔ Darks cool` ✓ (desat↔dark кросс-группа + мягкая темп.)
- [ ] `Brights ↔ Pastels` ✗ (жёсткий фильтр групп насыщенности)
- [ ] От любой хроматической базы доступно ≥12 Itten-hues
- [ ] Максимум 11 хроматических; 12-й клик игнорируется
- [ ] Максимум 14 total; лишние задимлены
- [ ] Повторный клик → удаление; вариант А при удалении базы
- [ ] Кнопка «Скачать PNG» disabled при 0 цветах
- [ ] Финальная палитра рендерится в 3 секциях: Warm, Cool, Universal
- [ ] Пустые секции скрыты
- [ ] PNG-экспорт повторяет секционирование drawer
- [ ] chroma-js не используется и не импортируется
- [ ] `pnpm run ci` зелёный
