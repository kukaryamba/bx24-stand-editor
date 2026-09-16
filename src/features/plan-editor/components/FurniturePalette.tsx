import { useMemo, useState } from "react";
import { furnitureCategories, getFurnitureByCategory, getFurnitureImageUrl, searchFurniture } from "../../../shared/domain/furniture";
import type { FurnitureCategory, FurnitureSource } from "../../../shared/domain/types";
import { useEditorStore } from "../store/editorStore";

/**
 * Палитра предметов для плана стенда.
 *
 * Клик по предмету ставит его в центр видимой области — дальше его можно
 * перетащить мышью. Так же работало старое приложение: предмет сначала
 * появляется на плане, потом двигается.
 */
export function FurniturePalette() {
  const [openCategory, setOpenCategory] = useState<FurnitureCategory>("seating");
  const [source, setSource] = useState<FurnitureSource>("price2026");
  const addFurniture = useEditorStore((state) => state.addFurniture);
  const viewport = useEditorStore((state) => state.viewport);
  const stageSize = useEditorStore((state) => state.stageSize);

  const [query, setQuery] = useState("");
  /** Сколько штук ставить за одно нажатие — пятьдесят стульев не кликают по одному. */
  const [count, setCount] = useState(1);
  const searching = query.trim() !== "";
  // Пока ищут, разделы не мешают: ищем сразу во всех.
  const items = useMemo(
    () => (searching ? searchFurniture(query, source) : getFurnitureByCategory(openCategory, source)),
    [openCategory, query, searching, source],
  );

  const handleAdd = (itemId: string) => {
    // Центр текущего вида в координатах плана.
    const position = {
      x: (-viewport.x + stageSize.width / 2) / viewport.scale,
      y: (-viewport.y + stageSize.height / 2) / viewport.scale,
    };
    addFurniture(itemId, position, count);
  };

  return (
    <div className="panel-section furniture-palette">
      <h2>Предметы</h2>

      <div className="mode-switch" role="group" aria-label="Каталог">
        <button className={source === "price2026" ? "is-active" : ""} onClick={() => setSource("price2026")}>
          Прайс 2026
        </button>
        <button className={source === "legacy" ? "is-active" : ""} onClick={() => setSource("legacy")}>
          Старый каталог
        </button>
      </div>

      <input
        className="furniture-palette__search"
        type="search"
        value={query}
        placeholder="Поиск: артикул или название"
        onChange={(event) => setQuery(event.target.value)}
      />

      <label className="furniture-palette__count">
        Ставить за раз, шт.
        <input
          type="number"
          min={1}
          max={500}
          value={count}
          onChange={(event) => setCount(Math.max(1, Math.min(500, Math.round(Number(event.target.value)) || 1)))}
        />
      </label>

      <div className="furniture-palette__tabs" hidden={searching}>
        {furnitureCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={category.id === openCategory ? "is-active" : ""}
            onClick={() => setOpenCategory(category.id)}
          >
            {category.title}
          </button>
        ))}
      </div>

      {searching && items.length === 0 ? <p className="furniture-palette__hint">Ничего не нашлось. Проверьте артикул или попробуйте часть названия.</p> : null}

      <div className="furniture-palette__grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="furniture-card"
            onClick={() => handleAdd(item.id)}
            title={`${item.title} — ${formatSize(item.widthM)} x ${formatSize(item.depthM)} м`}
          >
            <img src={getFurnitureImageUrl(item)} alt="" />
            <span className="furniture-card__title">
              {item.catalogId ? <b>{item.catalogId}</b> : null} {item.title}
            </span>
            <span className="furniture-card__size">
              {formatSize(item.widthM)} x {formatSize(item.depthM)} м
              {searching ? ` · ${furnitureCategories.find((category) => category.id === item.category)?.title ?? ""}` : ""}
            </span>
          </button>
        ))}
      </div>

      <p className="furniture-palette__hint">
        Нажмите на предмет — он появится в центре плана (несколько штук — плотной группой, уже выделенной). Дальше перетаскивайте мышью, поворот — клавишей R или кнопкой в панели справа.
      </p>
    </div>
  );
}

function formatSize(value: number): string {
  return String(value).replace(".", ",");
}
