import { useMemo, useState } from "react";
import { furnitureCategories, getFurnitureByCategory, getFurnitureImageUrl } from "../../../shared/domain/furniture";
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

  const items = useMemo(() => getFurnitureByCategory(openCategory, source), [openCategory, source]);

  const handleAdd = (itemId: string) => {
    // Центр текущего вида в координатах плана.
    const position = {
      x: (-viewport.x + 420) / viewport.scale,
      y: (-viewport.y + 320) / viewport.scale,
    };
    addFurniture(itemId, position);
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

      <div className="furniture-palette__tabs">
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
            </span>
          </button>
        ))}
      </div>

      <p className="furniture-palette__hint">
        Нажмите на предмет — он появится в центре плана. Дальше перетаскивайте мышью, поворот — клавишей R или кнопкой в панели справа.
      </p>
    </div>
  );
}

function formatSize(value: number): string {
  return String(value).replace(".", ",");
}
