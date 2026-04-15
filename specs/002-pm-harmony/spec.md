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
Beige `#E8D5B5`, Off-white `#FAF0E6`, Pale Lime `#DCEEB0`, Orchid `#EEB8E5`

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

## Алгоритм совместимости

```
isCompatible(base, target):
  if !base                 → true   (нет базы — все доступны)
  if base.isAchromatic
     || target.isAchromatic → true   (ахроматы со всем)
  if base.temp ≠ target.temp → false (разная температура)
  if base.group === target.group → true
  if {base.group, target.group} === {desaturated, dark} → true
  → false
```

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
2. Клик → первый добавленный цвет становится базой (выделен двойной рамкой).
   Несовместимые swatch'и тускнеют.
3. Пользователь добавляет до 11 хроматических + до 3 ахроматов = 14 максимум.
4. Кнопка «Скачать PNG» активна при ≥ 1 цвете в палитре.
5. Нижний drawer — финальная палитра: ахроматы первыми (Black → Gray → White),
   затем хроматические в порядке добавления.
6. PNG-экспорт через html2canvas; файл `palette.png`.

---

## Acceptance criteria

- [ ] На экране 51 swatch; порядок: ахроматы → brights → pastels → desaturated → darks
- [ ] Клик по любому swatch без базы → устанавливает базу (двойная рамка)
- [ ] Несовместимые цвета приглушены и не кликабельны после выбора базы
- [ ] Ахроматы всегда активны, пока `total < 14`
- [ ] `Brights warm ↔ Brights warm` ✓ · `Brights warm ↔ Brights cool` ✗
- [ ] `Desaturated warm ↔ Darks warm` ✓ · `Desaturated warm ↔ Darks cool` ✗
- [ ] `Brights warm ↔ Pastels warm` ✗
- [ ] Максимум 11 хроматических; 12-й клик игнорируется
- [ ] Максимум 14 total; лишние задимлены
- [ ] Повторный клик → удаление; варинт А при удалении базы
- [ ] Кнопка «Скачать PNG» disabled при 0 цветах
- [ ] В финальной палитре ахроматы идут первыми
- [ ] PNG-экспорт корректный, файл `palette.png`
- [ ] chroma-js не используется и не импортируется
- [ ] `pnpm run ci` зелёный
